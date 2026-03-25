"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Employee, Grant, FundingAllocation } from "@/types";
import {
  UserPlus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  employees: Employee[];
  grants: Grant[];
  allocations: FundingAllocation[];
}

const ROLES = ["staff", "supervisor", "admin"] as const;

const emptyForm = {
  full_name: "",
  email: "",
  role: "staff" as Employee["role"],
  supervisor_id: "",
};

export default function AdminEmployees({ employees, grants, allocations }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Allocations form for expanded employee
  const [allocForm, setAllocForm] = useState<
    Record<string, { default_hours: string; included: boolean }>
  >({});

  const supervisors = employees.filter((e) => e.role === "supervisor" || e.role === "admin");

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(emp: Employee) {
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      role: emp.role,
      supervisor_id: emp.supervisor_id ?? "",
    });
    setEditId(emp.id);
    setShowForm(true);
    setError("");
  }

  function openAllocations(emp: Employee) {
    if (expandedId === emp.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(emp.id);
    // Initialise allocForm from existing allocations
    const existing = allocations.filter((a) => a.employee_id === emp.id);
    const init: typeof allocForm = {};
    grants.forEach((g) => {
      const ex = existing.find((a) => a.grant_id === g.id);
      init[g.id] = { default_hours: ex ? String(ex.default_hours) : "0", included: !!ex };
    });
    setAllocForm(init);
  }

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      full_name: form.full_name,
      email: form.email.toLowerCase(),
      role: form.role,
      supervisor_id: form.supervisor_id || null,
    };

    if (editId) {
      const { error: err } = await supabase.from("employees").update(payload).eq("id", editId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from("employees").insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function deleteEmployee(id: string) {
    setDeleteId(id);
    await supabase.from("employees").update({ is_active: false }).eq("id", id);
    setDeleteId(null);
    startTransition(() => router.refresh());
  }

  async function saveAllocations(empId: string) {
    setSaving(true);
    for (const [grantId, val] of Object.entries(allocForm)) {
      if (val.included) {
        await supabase.from("funding_allocations").upsert(
          {
            employee_id: empId,
            grant_id: grantId,
            default_hours: parseFloat(val.default_hours) || 0,
          },
          { onConflict: "employee_id,grant_id" }
        );
      } else {
        await supabase
          .from("funding_allocations")
          .delete()
          .eq("employee_id", empId)
          .eq("grant_id", grantId);
      }
    }
    setSaving(false);
    setExpandedId(null);
    startTransition(() => router.refresh());
  }

  const activeEmployees = employees.filter((e) => e.is_active);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activeEmployees.length} active staff members</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">
            {editId ? "Edit Employee" : "New Employee"}
          </h2>
          <form onSubmit={saveEmployee} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))
                  }
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {form.role === "staff" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supervisor</label>
                  <select
                    value={form.supervisor_id}
                    onChange={(e) => setForm((f) => ({ ...f, supervisor_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— None —</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {activeEmployees.map((emp) => {
            const empAllocs = allocations.filter((a) => a.employee_id === emp.id);
            const totalDefaultHours = empAllocs.reduce((s, a) => s + a.default_hours, 0);

            return (
              <div key={emp.id}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800">{emp.full_name}</p>
                      <RoleBadge role={emp.role} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{emp.email}</p>
                    {emp.role === "staff" && (
                      <p className="text-xs text-slate-400">
                        {empAllocs.length} grant{empAllocs.length !== 1 ? "s" : ""} ·{" "}
                        {totalDefaultHours} default hrs
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {emp.role === "staff" && (
                      <button
                        onClick={() => openAllocations(emp)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Manage grant allocations"
                      >
                        {expandedId === emp.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(emp)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      disabled={deleteId === emp.id}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {deleteId === emp.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Grant Allocation Panel */}
                {expandedId === emp.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Grant Allocations (Default Hours)
                    </p>
                    <div className="space-y-2">
                      {grants.map((grant) => (
                        <div key={grant.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`alloc-${emp.id}-${grant.id}`}
                            checked={allocForm[grant.id]?.included ?? false}
                            onChange={(e) =>
                              setAllocForm((prev) => ({
                                ...prev,
                                [grant.id]: {
                                  ...prev[grant.id],
                                  included: e.target.checked,
                                },
                              }))
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor={`alloc-${emp.id}-${grant.id}`}
                            className={clsx(
                              "flex-1 text-sm",
                              allocForm[grant.id]?.included ? "text-slate-800" : "text-slate-400"
                            )}
                          >
                            {grant.name}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={allocForm[grant.id]?.default_hours ?? "0"}
                            disabled={!allocForm[grant.id]?.included}
                            onChange={(e) =>
                              setAllocForm((prev) => ({
                                ...prev,
                                [grant.id]: {
                                  ...prev[grant.id],
                                  default_hours: e.target.value,
                                },
                              }))
                            }
                            className="w-20 text-center px-2 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400 w-6">hrs</span>
                        </div>
                      ))}
                    </div>
                    {grants.length === 0 && (
                      <p className="text-sm text-slate-400">
                        No grants yet. Add grants first in the Grants tab.
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveAllocations(emp.id)}
                        disabled={saving}
                        className="flex items-center gap-2 bg-[#1e3a5f] text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Save Allocations
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="bg-slate-100 text-slate-700 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {activeEmployees.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No employees yet. Add your first employee above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, string> = {
    staff: "bg-blue-100 text-blue-700",
    supervisor: "bg-purple-100 text-purple-700",
    admin: "bg-slate-800 text-white",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${config[role] ?? ""}`}>
      {role}
    </span>
  );
}
