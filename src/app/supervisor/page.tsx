import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import SupervisorDashboard from "@/components/SupervisorDashboard";
import type { Employee, PayPeriod, TimeEntry } from "@/types";

export default async function SupervisorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: supervisor } = await supabase
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .single<Employee>();

  if (!supervisor) redirect("/login");
  if (supervisor.role === "staff") redirect("/dashboard");

  // Get current open pay period
  const today = new Date().toISOString().split("T")[0];
  const { data: payPeriod } = await supabase
    .from("pay_periods")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .eq("status", "open")
    .single<PayPeriod>();

  // Get all pay periods for the filter
  const { data: allPeriods } = await supabase
    .from("pay_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(12)
    .returns<PayPeriod[]>();

  // Get staff under this supervisor (or all staff if admin)
  const staffQuery = supabase
    .from("employees")
    .select("*")
    .eq("role", "staff")
    .eq("is_active", true);

  if (supervisor.role === "supervisor") {
    staffQuery.eq("supervisor_id", supervisor.id);
  }

  const { data: staffList } = await staffQuery.returns<Employee[]>();
  const staffIds = (staffList ?? []).map((s) => s.id);

  // Get entries for current period
  let entries: TimeEntry[] = [];
  if (payPeriod && staffIds.length) {
    const { data } = await supabase
      .from("time_entries")
      .select("*, employee:employees(*), lines:time_entry_lines(*, grant:grants(*))")
      .eq("pay_period_id", payPeriod.id)
      .in("employee_id", staffIds)
      .returns<TimeEntry[]>();
    entries = data ?? [];
  }

  // Build complete list including staff with no entry yet
  const entryEmployeeIds = new Set(entries.map((e) => e.employee_id));
  const missingStaff = (staffList ?? []).filter((s) => !entryEmployeeIds.has(s.id));

  return (
    <AppShell role={supervisor.role} name={supervisor.full_name}>
      <div className="py-6">
        <SupervisorDashboard
          supervisor={supervisor}
          payPeriod={payPeriod ?? null}
          allPeriods={allPeriods ?? []}
          entries={entries}
          missingStaff={missingStaff}
          staffList={staffList ?? []}
        />
      </div>
    </AppShell>
  );
}
