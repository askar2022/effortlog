export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import TimecardForm from "@/components/TimecardForm";
import type { Employee, PayPeriod, TimeEntry, TimeEntryLine, FundingAllocation, Grant } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All DB reads go through the admin client (server-only)
  const db = createAdminClient();

  const { data: employee } = await db
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .eq("is_active", true)
    .single<Employee>();

  if (!employee) redirect("/login");
  if (employee.role === "admin") redirect("/admin");
  if (employee.role === "supervisor") redirect("/supervisor");

  const today = new Date().toISOString().split("T")[0];

  const { data: payPeriod } = await db
    .from("pay_periods")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .eq("status", "open")
    .single<PayPeriod>();

  const { data: allocations } = await db
    .from("funding_allocations")
    .select("*, grant:grants(*)")
    .eq("employee_id", employee.id)
    .returns<FundingAllocation[]>();

  // All active grants (so employee can optionally add one they worked on)
  const { data: allGrants } = await db
    .from("grants")
    .select("*")
    .eq("is_active", true)
    .order("name")
    .returns<Grant[]>();

  let entry: TimeEntry | null = null;
  let entryLines: TimeEntryLine[] = [];

  if (payPeriod) {
    const { data: existingEntry } = await db
      .from("time_entries")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("pay_period_id", payPeriod.id)
      .single<TimeEntry>();

    if (existingEntry) {
      entry = existingEntry;
      const { data: lines } = await db
        .from("time_entry_lines")
        .select("*, grant:grants(*)")
        .eq("time_entry_id", existingEntry.id)
        .returns<TimeEntryLine[]>();
      entryLines = lines ?? [];
    }
  }

  return (
    <AppShell role={employee.role} name={employee.full_name}>
      <div className="py-6">
        <TimecardForm
          employee={employee}
          payPeriod={payPeriod ?? null}
          allocations={allocations ?? []}
          allGrants={allGrants ?? []}
          entry={entry}
          lines={entryLines}
        />
      </div>
    </AppShell>
  );
}
