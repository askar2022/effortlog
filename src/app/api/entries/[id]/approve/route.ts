import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee } = auth;
  const { id } = await params;

  const db = createAdminClient();

  // Verify the entry belongs to a staff member under this supervisor
  const { data: entry } = await db
    .from("time_entries")
    .select("id, employee_id, status, employee:employees!time_entries_employee_id_fkey(supervisor_id)")
    .eq("id", id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Supervisors can only approve their own team; admins can approve anyone
  const supervisor_id = (entry.employee as unknown as { supervisor_id: string | null } | null)?.supervisor_id;
  if (employee.role === "supervisor" && supervisor_id !== employee.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("time_entries")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: employee.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    time_entry_id: id,
    actor_id: employee.id,
    action: "approved",
  });

  return NextResponse.json({ success: true });
}
