import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch role from employees table
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("email", user.email!)
    .single();

  if (!employee) {
    redirect("/login");
  }

  if (employee.role === "admin") redirect("/admin");
  if (employee.role === "supervisor") redirect("/supervisor");
  redirect("/dashboard");
}
