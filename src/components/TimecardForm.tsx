"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Employee, PayPeriod, TimeEntry, TimeEntryLine, FundingAllocation } from "@/types";
import { CheckCircle, AlertCircle, Clock, Send, Loader2, Info } from "lucide-react";
import clsx from "clsx";

interface Props {
  employee: Employee;
  payPeriod: PayPeriod | null;
  allocations: FundingAllocation[];
  entry: TimeEntry | null;
  lines: TimeEntryLine[];
}

interface LineState {
  grantId: string;
  grantCode: string;
  grantName: string;
  defaultHours: number;
  actualHours: number;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TimecardForm({ employee, payPeriod, allocations, entry, lines }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Build initial line states from existing lines or allocations
  const initialLines: LineState[] = allocations.map((alloc) => {
    const existingLine = lines.find((l) => l.grant_id === alloc.grant_id);
    return {
      grantId: alloc.grant_id,
      grantCode: alloc.grant?.code ?? "",
      grantName: alloc.grant?.name ?? "",
      defaultHours: alloc.default_hours,
      actualHours: existingLine ? existingLine.actual_hours : alloc.default_hours,
    };
  });

  const [lineStates, setLineStates] = useState<LineState[]>(initialLines);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const totalActual = lineStates.reduce((sum, l) => sum + (l.actualHours || 0), 0);
  const totalDefault = lineStates.reduce((sum, l) => sum + l.defaultHours, 0);
  const hasChanges = lineStates.some((l) => l.actualHours !== l.defaultHours);
  const isSubmitted = entry?.status === "submitted" || entry?.status === "approved";
  const isApproved = entry?.status === "approved";
  const isReadOnly = isApproved;

  const updateHours = useCallback((index: number, value: string) => {
    const hours = parseFloat(value) || 0;
    setLineStates((prev) =>
      prev.map((l, i) => (i === index ? { ...l, actualHours: hours } : l))
    );
  }, []);

  const getPercent = (actualHours: number) => {
    if (!totalActual) return "0.00";
    return ((actualHours / totalActual) * 100).toFixed(2);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payPeriod) return;
    setError("");
    setLoading(true);

    try {
      let entryId = entry?.id;

      if (!entryId) {
        // Create new entry
        const { data: newEntry, error: entryErr } = await supabase
          .from("time_entries")
          .insert({
            employee_id: employee.id,
            pay_period_id: payPeriod.id,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            notes,
          })
          .select()
          .single();
        if (entryErr) throw entryErr;
        entryId = newEntry.id;
      } else {
        // Update existing
        const { error: updateErr } = await supabase
          .from("time_entries")
          .update({
            status: "submitted",
            submitted_at: new Date().toISOString(),
            notes,
          })
          .eq("id", entryId);
        if (updateErr) throw updateErr;
      }

      // Upsert lines
      const { error: linesErr } = await supabase.from("time_entry_lines").upsert(
        lineStates.map((l) => ({
          time_entry_id: entryId,
          grant_id: l.grantId,
          default_hours: l.defaultHours,
          actual_hours: l.actualHours,
        })),
        { onConflict: "time_entry_id,grant_id" }
      );
      if (linesErr) throw linesErr;

      // Audit log
      await supabase.from("audit_log").insert({
        time_entry_id: entryId,
        actor_id: employee.id,
        action: "submitted",
        new_data: { lines: lineStates, notes },
      });

      setSuccess(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!payPeriod) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-amber-800">No active pay period</p>
          <p className="text-sm text-amber-700 mt-1">
            There is no open pay period right now. Please check back when one is opened by your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-blue-800">No grant allocations set up</p>
          <p className="text-sm text-blue-700 mt-1">
            Your administrator needs to assign your grant allocations before you can submit a
            timecard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Period Header */}
      <div className="bg-[#1e3a5f] text-white rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-blue-300" />
          <span className="text-blue-300 text-xs font-medium uppercase tracking-wider">
            Current Pay Period
          </span>
        </div>
        <p className="text-xl font-bold">
          {formatDate(payPeriod.start_date)} – {formatDate(payPeriod.end_date)}
        </p>
        <p className="text-blue-200 text-sm mt-1">
          Submission due: <span className="font-semibold text-white">{formatDate(payPeriod.due_date)}</span>
        </p>
        {entry && (
          <div className="mt-3">
            <StatusBadge status={entry.status} />
          </div>
        )}
      </div>

      {/* Success banner */}
      {(success || isSubmitted) && !isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Timecard submitted!</p>
            <p className="text-sm text-green-700">Waiting for supervisor approval.</p>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Timecard approved!</p>
            <p className="text-sm text-green-700">
              Approved on {entry?.approved_at ? formatDate(entry.approved_at.split("T")[0]) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Hours Table */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Time &amp; Effort Entry</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter actual hours worked. Percentages calculate automatically.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Program / Grant</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600 w-32">Default Hrs</th>
                  <th className="text-center px-4 py-3 font-medium text-blue-700 w-36">
                    ★ Actual Hours
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600 w-28">% of Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineStates.map((line, idx) => (
                  <tr
                    key={line.grantId}
                    className={clsx(
                      "transition-colors",
                      line.actualHours !== line.defaultHours ? "bg-amber-50/50" : "hover:bg-slate-50/50"
                    )}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-700">{line.grantName}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{line.grantCode}</p>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-500">{line.defaultHours.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        step="0.5"
                        value={line.actualHours || ""}
                        onChange={(e) => updateHours(idx, e.target.value)}
                        disabled={isReadOnly}
                        className={clsx(
                          "w-full text-center px-3 py-2 rounded-lg border font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500",
                          isReadOnly
                            ? "bg-slate-50 border-slate-200 cursor-not-allowed"
                            : "border-blue-200 bg-blue-50 hover:border-blue-400"
                        )}
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={clsx(
                          "inline-block px-3 py-1 rounded-full text-xs font-bold",
                          line.actualHours !== line.defaultHours
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {getPercent(line.actualHours)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-5 py-3 font-bold text-slate-700">Total</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-500">
                    {totalDefault.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">
                    {totalActual.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={clsx(
                        "inline-block px-3 py-1 rounded-full text-xs font-bold",
                        totalActual === 0
                          ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-700"
                      )}
                    >
                      100.00%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {lineStates.map((line, idx) => (
              <div key={line.grantId} className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-slate-800">{line.grantName}</p>
                  <p className="text-xs text-slate-400 font-mono">{line.grantCode}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Default</p>
                    <p className="font-semibold text-slate-600">{line.defaultHours.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 font-medium mb-1">Actual ★</p>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="0.5"
                      value={line.actualHours || ""}
                      onChange={(e) => updateHours(idx, e.target.value)}
                      disabled={isReadOnly}
                      className="w-full text-center px-2 py-1.5 rounded-lg border border-blue-200 bg-blue-50 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">% of Time</p>
                    <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {getPercent(line.actualHours)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 bg-slate-50 flex justify-between items-center">
              <span className="font-bold text-slate-700">Total</span>
              <span className="font-bold text-slate-800">{totalActual.toFixed(2)} hrs</span>
            </div>
          </div>
        </div>

        {/* Changed hours notice */}
        {hasChanges && !isReadOnly && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>You changed some hours from the default. Your supervisor will review these changes.</span>
          </div>
        )}

        {/* Notes */}
        {!isReadOnly && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Explain any changes from your default hours…"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {!isReadOnly && (
          <button
            type="submit"
            disabled={loading || totalActual === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                {entry?.status === "submitted" ? "Update Submission" : "Submit Timecard"}
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-500/20 text-slate-200" },
    submitted: { label: "Submitted – Pending Approval", className: "bg-amber-400/20 text-amber-200" },
    approved: { label: "Approved", className: "bg-green-400/20 text-green-200" },
    flagged: { label: "Flagged – Review Required", className: "bg-red-400/20 text-red-200" },
  };
  const c = config[status] ?? config.draft;
  return (
    <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}
