export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import AdminPeriods from "@/components/AdminPeriods";
import type { Employee, PayPeriod } from "@/types";

export default async function AdminPeriodsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();

  const { data: admin } = await db
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .single<Employee>();

  if (!admin || admin.role !== "admin") redirect("/dashboard");

  const { data: periods } = await db
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
