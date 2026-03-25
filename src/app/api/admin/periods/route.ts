import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAuth(["admin", "supervisor"]);
  if (auth.error) return auth.error;

  const db = createAdminClient();
  const { data, error } = await db
    .from("pay_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(24);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { start_date, end_date, due_date } = body;
  if (!start_date || !end_date || !due_date) {
    return NextResponse.json({ error: "All date fields are required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("pay_periods")
    .insert({ start_date, end_date, due_date, status: "open" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
