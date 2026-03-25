export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use admin client to check employees table (bypasses RLS on first login)
  const db = createAdminClient();
  const { data: employee } = await db
    .from("employees")
    .select("role")
    .eq("email", user.email!)
    .eq("is_active", true)
    .single();

  // If email not in employees table — sign them out and block access
  if (!employee) {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  if (employee.role === "admin") redirect("/admin");
  if (employee.role === "supervisor") redirect("/supervisor");
  redirect("/dashboard");
}
