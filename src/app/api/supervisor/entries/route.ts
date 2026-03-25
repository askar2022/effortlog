import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee } = auth;

  const { searchParams } = new URL(request.url);
  const pay_period_id = searchParams.get("pay_period_id");
  if (!pay_period_id) {
    return NextResponse.json({ error: "pay_period_id required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Get staff under this supervisor (or all staff if admin)
  const staffQuery = db
    .from("employees")
    .select("*")
    .eq("role", "staff")
    .eq("is_active", true);

  if (employee.role === "supervisor") {
    staffQuery.eq("supervisor_id", employee.id);
  }

  const { data: staffList } = await staffQuery;
  const staffIds = (staffList ?? []).map((s: { id: string }) => s.id);

  if (!staffIds.length) {
    return NextResponse.json({ entries: [], missingStaff: [] });
  }

  // Get entries for this period
  const { data: entries } = await db
    .from("time_entries")
    .select(
      "*, employee:employees!time_entries_employee_id_fkey(*), lines:time_entry_lines(*, grant:grants(*))"
    )
    .eq("pay_period_id", pay_period_id)
    .in("employee_id", staffIds);

  const entryEmployeeIds = new Set((entries ?? []).map((e: { employee_id: string }) => e.employee_id));
  const missingStaff = (staffList ?? []).filter((s: { id: string }) => !entryEmployeeIds.has(s.id));

  return NextResponse.json({ entries: entries ?? [], missingStaff });
}
