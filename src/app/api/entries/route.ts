import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface LinePayload {
  grant_id: string;
  default_hours: number;
  actual_hours: number;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["staff"]);
  if (auth.error) return auth.error;
  const { employee } = auth;

  const body = await request.json();
  const { pay_period_id, lines, notes } = body as {
    pay_period_id: string;
    lines: LinePayload[];
    notes?: string;
  };

  if (!pay_period_id || !lines?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify the pay period is open
  const { data: period } = await db
    .from("pay_periods")
    .select("id, status")
    .eq("id", pay_period_id)
    .single();

  if (!period || period.status !== "open") {
    return NextResponse.json({ error: "Pay period is not open" }, { status: 400 });
  }

  // Upsert the time entry
  const { data: entry, error: entryErr } = await db
    .from("time_entries")
    .upsert(
      {
        employee_id: employee.id,
        pay_period_id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        notes: notes ?? null,
      },
      { onConflict: "employee_id,pay_period_id" }
    )
    .select()
    .single();

  if (entryErr || !entry) {
    return NextResponse.json({ error: entryErr?.message ?? "Failed to save entry" }, { status: 500 });
  }

  // Calculate percent_time for each line (total actual hours across all lines)
  const totalActual = lines.reduce((sum, l) => sum + (l.actual_hours || 0), 0);

  // Upsert all lines with calculated percent_time
  const { error: linesErr } = await db.from("time_entry_lines").upsert(
    lines.map((l) => ({
      time_entry_id: entry.id,
      grant_id: l.grant_id,
      default_hours: l.default_hours,
      actual_hours: l.actual_hours,
      percent_time: totalActual > 0
        ? parseFloat(((l.actual_hours / totalActual) * 100).toFixed(2))
        : 0,
    })),
    { onConflict: "time_entry_id,grant_id" }
  );

  if (linesErr) {
    return NextResponse.json({ error: linesErr.message }, { status: 500 });
  }

  // Write audit log
  await db.from("audit_log").insert({
    time_entry_id: entry.id,
    actor_id: employee.id,
    action: "submitted",
    new_data: { lines, notes },
  });

  return NextResponse.json({ entry }, { status: 200 });
}
