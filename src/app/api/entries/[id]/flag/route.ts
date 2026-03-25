import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee } = auth;
  const { id } = await params;
  const body = await request.json();
  const note: string = body.note ?? "";

  const db = createAdminClient();

  // Verify entry exists and belongs to this supervisor's team
  const { data: entry } = await db
    .from("time_entries")
    .select("id, employee:employees!time_entries_employee_id_fkey(supervisor_id)")
    .eq("id", id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const supervisor_id = (entry.employee as unknown as { supervisor_id: string | null } | null)?.supervisor_id;
  if (employee.role === "supervisor" && supervisor_id !== employee.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("time_entries")
    .update({ status: "flagged", notes: note || null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    time_entry_id: id,
    actor_id: employee.id,
    action: "flagged",
    new_data: { note },
  });

  return NextResponse.json({ success: true });
}
