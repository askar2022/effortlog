import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AdminPeriods from "@/components/AdminPeriods";
import type { Employee, PayPeriod } from "@/types";

export default async function AdminPeriodsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .single<Employee>();

  if (!admin || admin.role !== "admin") redirect("/dashboard");

  const { data: periods } = await supabase
    .from("pay_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .returns<PayPeriod[]>();

  return (
    <AppShell role={admin.role} name={admin.full_name}>
      <div className="py-6">
        <AdminPeriods periods={periods ?? []} />
      </div>
    </AppShell>
  );
}
