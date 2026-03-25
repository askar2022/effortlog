"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PayPeriod } from "@/types";
import { Plus, Check, X, Loader2, Lock, Unlock } from "lucide-react";
import clsx from "clsx";

interface Props {
  periods: PayPeriod[];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPeriods({ periods }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", due_date: "" });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  async function callApi(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await callApi("/api/admin/periods", "POST", form);
      setShowForm(false);
      setForm({ start_date: "", end_date: "", due_date: "" });
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(period: PayPeriod) {
    setTogglingId(period.id);
    try {
      await callApi(`/api/admin/periods/${period.id}`, "PUT", {
        status: period.status === "open" ? "closed" : "open",
      });
      startTransition(() => router.refresh());
    } catch { /* ignore */ }
    setTogglingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pay Periods</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {periods.filter((p) => p.status === "open").length} open ·{" "}
            {periods.filter((p) => p.status === "closed").length} closed
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); }}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Period
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">New Pay Period</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input type="date" required value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input type="date" required value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Submission Due</label>
                <input type="date" required value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-200">
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <span>Pay Period</span>
          <span>Due Date</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-slate-100">
          {periods.map((period) => {
            const isCurrent = period.start_date <= today && period.end_date >= today;
            return (
              <div key={period.id}
                className={clsx(
                  "px-5 py-4 flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2",
                  isCurrent && "bg-blue-50/50"
                )}>
                <div>
                  <p className="font-medium text-slate-800">
                    {formatDate(period.start_date)} – {formatDate(period.end_date)}
                  </p>
                  {isCurrent && (
                    <span className="text-xs font-semibold text-blue-600">● Current</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{formatDate(period.due_date)}</p>
                <span className={clsx(
                  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full w-fit",
                  period.status === "open" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                )}>
                  {period.status === "open" ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {period.status === "open" ? "Open" : "Closed"}
                </span>
                <div className="sm:text-right">
                  <button onClick={() => toggleStatus(period)} disabled={togglingId === period.id}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40">
                    {togglingId === period.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                    ) : period.status === "open" ? "Close Period" : "Re-open"}
                  </button>
                </div>
              </div>
            );
          })}
          {periods.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No pay periods yet. Add one above or check the schema seed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
