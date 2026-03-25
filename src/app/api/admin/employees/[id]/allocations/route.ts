import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface AllocationItem {
  grant_id: string;
  default_hours: number;
  included: boolean;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("funding_allocations")
    .select("*, grant:grants(*)")
    .eq("employee_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { allocations } = body as { allocations: AllocationItem[] };

  const db = createAdminClient();

  const toUpsert = allocations
    .filter((a) => a.included)
    .map((a) => ({
      employee_id: id,
      grant_id: a.grant_id,
      default_hours: a.default_hours,
    }));

  const toDelete = allocations
    .filter((a) => !a.included)
    .map((a) => a.grant_id);

  if (toUpsert.length) {
    const { error } = await db
      .from("funding_allocations")
      .upsert(toUpsert, { onConflict: "employee_id,grant_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (toDelete.length) {
    const { error } = await db
      .from("funding_allocations")
      .delete()
      .eq("employee_id", id)
      .in("grant_id", toDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
