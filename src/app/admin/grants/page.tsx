import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AdminGrants from "@/components/AdminGrants";
import type { Employee, Grant } from "@/types";

export default async function AdminGrantsPage() {
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

  const { data: grants } = await supabase
    .from("grants")
    .select("*")
    .order("name")
    .returns<Grant[]>();

  return (
    <AppShell role={admin.role} name={admin.full_name}>
      <div className="py-6">
        <AdminGrants grants={grants ?? []} />
      </div>
    </AppShell>
  );
}
