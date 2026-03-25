import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import AdminEmployees from "@/components/AdminEmployees";
import type { Employee, Grant, FundingAllocation } from "@/types";

export default async function AdminPage() {
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

  const [{ data: employees }, { data: grants }, { data: allocations }] = await Promise.all([
    db.from("employees").select("*").order("full_name").returns<Employee[]>(),
    db.from("grants").select("*").eq("is_active", true).order("name").returns<Grant[]>(),
    db.from("funding_allocations").select("*, grant:grants(*)").returns<FundingAllocation[]>(),
  ]);

  return (
    <AppShell role={admin.role} name={admin.full_name}>
      <div className="py-6">
        <AdminEmployees
          employees={employees ?? []}
          grants={grants ?? []}
          allocations={allocations ?? []}
        />
      </div>
    </AppShell>
  );
}
