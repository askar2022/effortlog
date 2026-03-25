import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TimecardForm from "@/components/TimecardForm";
import type { Employee, PayPeriod, TimeEntry, TimeEntryLine, FundingAllocation } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get employee record
  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .single<Employee>();

  if (!employee || employee.role === "admin") redirect("/admin");
  if (employee.role === "supervisor") redirect("/supervisor");

  // Get current open pay period
  const today = new Date().toISOString().split("T")[0];
  const { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .eq("status", "open")
    .single<PayPeriod>();

  // Get employee's funding allocations (default hours per grant)
  const { data: allocations } = await supabase
    .from("funding_allocations")
    .select("*, grant:grants(*)")
    .eq("employee_id", employee.id)
    .returns<FundingAllocation[]>();

  let entry: TimeEntry | null = null;
  let lines: TimeEntryLine[] = [];

  if (payPeriod) {
    // Try to get existing entry for this period
    const { data: existingEntry } = await supabase
      .from("time_entries")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("pay_period_id", payPeriod.id)
      .single<TimeEntry>();

    if (existingEntry) {
      entry = existingEntry;
      const { data: entryLines } = await supabase
        .from("time_entry_lines")
        .select("*, grant:grants(*)")
        .eq("time_entry_id", existingEntry.id)
        .returns<TimeEntryLine[]>();
      lines = entryLines ?? [];
    }
  }

  return (
    <AppShell role={employee.role} name={employee.full_name}>
      <div className="py-6">
        <TimecardForm
          employee={employee}
          payPeriod={payPeriod ?? null}
          allocations={allocations ?? []}
          entry={entry}
          lines={lines}
        />
      </div>
    </AppShell>
  );
}
