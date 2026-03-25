import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM } from "@/lib/email/resend";
import { flaggedEmail } from "@/lib/email/templates";
import type { Employee, PayPeriod } from "@/types";

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee: supervisor } = auth;
  const { id } = await params;
  const body = await request.json();
  const note: string = body.note ?? "";

  const db = createAdminClient();

  // Load entry with employee + pay period
  const { data: entry } = await db
    .from("time_entries")
    .select(
      "id, employee_id, status, pay_period_id, employee:employees!time_entries_employee_id_fkey(*), pay_period:pay_periods(*)"
    )
    .eq("id", id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const emp = entry.employee as unknown as Employee;
  const period = entry.pay_period as unknown as PayPeriod;

  if (supervisor.role === "supervisor" && emp.supervisor_id !== supervisor.id) {
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
    actor_id: supervisor.id,
    action: "flagged",
    new_data: { note },
  });

  // Notify employee (fire & forget)
  if (emp?.email && period) {
    const { subject, html } = flaggedEmail({
      name: emp.full_name.split(" ")[0],
      periodStart: fmt(period.start_date),
      periodEnd: fmt(period.end_date),
      supervisorNote: note,
    });
    getResend().emails.send({ from: FROM, to: emp.email, subject, html }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
