import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee } = auth;

  const body = await request.json();
  const { entry_ids } = body as { entry_ids: string[] };

  if (!entry_ids?.length) {
    return NextResponse.json({ error: "No entry IDs provided" }, { status: 400 });
  }

  const db = createAdminClient();

  // For supervisors: verify all entries belong to their team
  if (employee.role === "supervisor") {
    const { data: entries } = await db
      .from("time_entries")
      .select("id, employee:employees!time_entries_employee_id_fkey(supervisor_id)")
      .in("id", entry_ids);

    const unauthorized = (entries ?? []).some(
      (e) => (e.employee as unknown as { supervisor_id: string | null } | null)?.supervisor_id !== employee.id
    );
    if (unauthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from("time_entries")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: employee.id,
    })
    .in("id", entry_ids)
    .eq("status", "submitted");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Bulk audit log
  await db.from("audit_log").insert(
    entry_ids.map((eid) => ({
      time_entry_id: eid,
      actor_id: employee.id,
      action: "approved",
    }))
  );

  return NextResponse.json({ approved: entry_ids.length });
}
