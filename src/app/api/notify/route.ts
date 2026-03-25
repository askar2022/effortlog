import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, FROM } from "@/lib/email/resend";
import {
  staffReminderEmail,
  supervisorAlertEmail,
} from "@/lib/email/templates";
import type { Employee, PayPeriod } from "@/types";

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["supervisor", "admin"]);
  if (auth.error) return auth.error;
  const { employee: actor } = auth;

  const body = await request.json();
  const { type, pay_period_id } = body as {
    type: "remind_staff" | "alert_supervisors";
    pay_period_id: string;
  };

  if (!type || !pay_period_id) {
    return NextResponse.json({ error: "type and pay_period_id are required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Load pay period
  const { data: period } = await db
    .from("pay_periods")
    .select("*")
    .eq("id", pay_period_id)
    .single<PayPeriod>();

  if (!period) {
    return NextResponse.json({ error: "Pay period not found" }, { status: 404 });
  }

  const periodStart = fmt(period.start_date);
  const periodEnd = fmt(period.end_date);
  const dueDate = fmt(period.due_date);

  // Find staff who haven't submitted yet
  const staffQuery = db
    .from("employees")
    .select("*")
    .eq("role", "staff")
    .eq("is_active", true);
  if (actor.role === "supervisor") {
    staffQuery.eq("supervisor_id", actor.id);
  }
  const { data: allStaff } = await staffQuery.returns<Employee[]>();
  const staffIds = (allStaff ?? []).map((s) => s.id);

  const { data: submittedEntries } = await db
    .from("time_entries")
    .select("employee_id")
    .eq("pay_period_id", pay_period_id)
    .in("status", ["submitted", "approved"])
    .in("employee_id", staffIds);

  const submittedIds = new Set(
    (submittedEntries ?? []).map((e: { employee_id: string }) => e.employee_id)
  );
  const missingStaff = (allStaff ?? []).filter((s) => !submittedIds.has(s.id));

  const sent: string[] = [];
  const failed: string[] = [];

  if (type === "remind_staff") {
    // Email each missing staff member individually
    for (const staff of missingStaff) {
      try {
        const { subject, html } = staffReminderEmail({
          name: staff.full_name.split(" ")[0],
          periodStart,
          periodEnd,
          dueDate,
        });
        await resend.emails.send({
          from: FROM,
          to: staff.email,
          subject,
          html,
        });
        sent.push(staff.full_name);
      } catch {
        failed.push(staff.full_name);
      }
    }
  } else if (type === "alert_supervisors") {
    // Group missing staff by supervisor, then email each supervisor
    const supervisorMap: Map<string, { supervisor: Employee; missing: Employee[] }> = new Map();

    for (const staff of missingStaff) {
      if (!staff.supervisor_id) continue;
      if (!supervisorMap.has(staff.supervisor_id)) {
        const { data: sup } = await db
          .from("employees")
          .select("*")
          .eq("id", staff.supervisor_id)
          .single<Employee>();
        if (sup) supervisorMap.set(staff.supervisor_id, { supervisor: sup, missing: [] });
      }
      supervisorMap.get(staff.supervisor_id)?.missing.push(staff);
    }

    for (const { supervisor, missing } of supervisorMap.values()) {
      try {
        const { subject, html } = supervisorAlertEmail({
          supervisorName: supervisor.full_name.split(" ")[0],
          missingNames: missing.map((m) => m.full_name),
          periodStart,
          periodEnd,
          dueDate,
        });
        await resend.emails.send({
          from: FROM,
          to: supervisor.email,
          subject,
          html,
        });
        sent.push(supervisor.full_name);
      } catch {
        failed.push(supervisor.full_name);
      }
    }
  }

  return NextResponse.json({
    sent: sent.length,
    failed: failed.length,
    sentNames: sent,
    missingCount: missingStaff.length,
  });
}
