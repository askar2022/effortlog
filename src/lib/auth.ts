import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { Employee, Role } from "@/types";

export interface AuthResult {
  employee: Employee;
  error?: never;
}
export interface AuthError {
  employee?: never;
  error: NextResponse;
}

/**
 * Verifies the session and returns the employee record.
 * Returns a 401 NextResponse if unauthenticated or not found.
 * Optionally enforces a minimum role.
 */
export async function requireAuth(
  allowedRoles?: Role[]
): Promise<AuthResult | AuthError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("*")
    .eq("email", user.email)
    .eq("is_active", true)
    .single<Employee>();

  if (!employee) {
    return {
      error: NextResponse.json({ error: "Employee not found" }, { status: 403 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(employee.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { employee };
}
