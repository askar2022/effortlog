"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Grant } from "@/types";
import { Plus, Pencil, Check, X, Loader2, BookOpen, ToggleLeft, ToggleRight } from "lucide-react";

interface Props {
  grants: Grant[];
}

const emptyForm = { code: "", name: "" };

export default function AdminGrants({ grants }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(grant: Grant) {
    setForm({ code: grant.code, name: grant.name });
    setEditId(grant.id);
    setShowForm(true);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (editId) {
      const { error: err } = await supabase
        .from("grants")
        .update({ code: form.code, name: form.name })
        .eq("id", editId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from("grants").insert(form);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function toggleActive(grant: Grant) {
    setTogglingId(grant.id);
    await supabase.from("grants").update({ is_active: !grant.is_active }).eq("id", grant.id);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Grants</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {grants.filter((g) => g.is_active).length} active grants
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Grant
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">
            {editId ? "Edit Grant" : "New Grant"}
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Program Code
                </label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. 010 0571 08000 61 434 300 00"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Grant Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Safe & Drug Free Schools"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {grants.map((grant) => (
            <div key={grant.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${grant.is_active ? "bg-green-100" : "bg-slate-100"}`}>
                  <BookOpen className={`w-4 h-4 ${grant.is_active ? "text-green-600" : "text-slate-400"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`font-medium ${grant.is_active ? "text-slate-800" : "text-slate-400"}`}>
                    {grant.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{grant.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => toggleActive(grant)}
                  disabled={togglingId === grant.id}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={grant.is_active ? "Deactivate" : "Activate"}
                >
                  {togglingId === grant.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : grant.is_active ? (
                    <ToggleRight className="w-5 h-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={() => openEdit(grant)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {grants.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No grants yet. Add your first grant above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
