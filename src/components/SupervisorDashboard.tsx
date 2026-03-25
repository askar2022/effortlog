"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Employee, PayPeriod, TimeEntry } from "@/types";
import {
  CheckCircle,
  AlertCircle,
  Users,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Loader2,
  Flag,
  ShieldCheck,
  Clock,
  Bell,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  supervisor: Employee;
  payPeriod: PayPeriod | null;
  allPeriods: PayPeriod[];
  entries: TimeEntry[];
  missingStaff: Employee[];
  staffList: Employee[];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SupervisorDashboard({ payPeriod, entries, missingStaff }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Detail view: which entry are we reviewing?
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);
  const [apiError, setApiError] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: number; missingCount: number } | null>(null);

  const submitted = entries.filter((e) => e.status === "submitted");
  const approved = entries.filter((e) => e.status === "approved");
  const flagged = entries.filter((e) => e.status === "flagged");

  // All entries that need action (submitted + flagged), then approved at end
  const reviewList = [...flagged, ...submitted, ...approved];
  const selectedEntry = selectedIdx !== null ? reviewList[selectedIdx] ?? null : null;

  async function callApi(url: string, body?: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Request failed");
    }
    return res.json();
  }

  async function approveEntry(entryId: string) {
    setApiError("");
    setActionLoading(entryId);
    try {
      await callApi(`/api/entries/${entryId}/approve`);
      // Advance to next
      if (selectedIdx !== null && selectedIdx < reviewList.length - 1) {
        setSelectedIdx(selectedIdx + 1);
      } else {
        setSelectedIdx(null);
      }
      setShowFlagInput(false);
      setFlagNote("");
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  }

  async function flagEntry(entryId: string) {
    setApiError("");
    setActionLoading(entryId + "-flag");
    try {
      await callApi(`/api/entries/${entryId}/flag`, { note: flagNote });
      setShowFlagInput(false);
      setFlagNote("");
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to flag");
    } finally {
      setActionLoading(null);
    }
  }

  async function approveAll() {
    setApiError("");
    setBulkLoading(true);
    try {
      await callApi("/api/entries/approve-all", { entry_ids: submitted.map((e) => e.id) });
      setSelectedIdx(null);
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to approve all");
    } finally {
      setBulkLoading(false);
    }
  }

  async function sendReminders() {
    if (!payPeriod) return;
    setReminderLoading(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "remind_staff", pay_period_id: payPeriod.id }),
      });
      const data = await res.json();
      setReminderResult({ sent: data.sent, missingCount: data.missingCount });
    } catch {
      setApiError("Failed to send reminders");
    } finally {
      setReminderLoading(false);
    }
  }

  // ── No active period ────────────────────────────────────────────────────────
  if (!payPeriod) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-amber-800 font-medium">No active pay period open.</p>
      </div>
    );
  }

  const totalStaff = entries.length + missingStaff.length;

  // ── Detail view (reviewing one entry) ───────────────────────────────────────
  if (selectedEntry !== null && selectedIdx !== null) {
    return (
      <ApprovalDetail
        entry={selectedEntry}
        payPeriod={payPeriod}
        idx={selectedIdx}
        total={reviewList.length}
        flagNote={flagNote}
        showFlagInput={showFlagInput}
        actionLoading={actionLoading}
        apiError={apiError}
        onBack={() => { setSelectedIdx(null); setShowFlagInput(false); setFlagNote(""); }}
        onPrev={() => { setSelectedIdx(Math.max(0, selectedIdx - 1)); setShowFlagInput(false); setFlagNote(""); setApiError(""); }}
        onNext={() => { setSelectedIdx(Math.min(reviewList.length - 1, selectedIdx + 1)); setShowFlagInput(false); setFlagNote(""); setApiError(""); }}
        onApprove={() => approveEntry(selectedEntry.id)}
        onFlagToggle={() => setShowFlagInput((v) => !v)}
        onFlagNoteChange={setFlagNote}
        onFlagSubmit={() => flagEntry(selectedEntry.id)}
      />
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Period header */}
      <div className="bg-[#1e3a5f] text-white rounded-2xl p-5">
        <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">
          Current Pay Period
        </p>
        <p className="text-xl font-bold">
          {formatDate(payPeriod.start_date)} – {formatDate(payPeriod.end_date)}
        </p>
        <p className="text-blue-200 text-sm mt-1">
          Due:{" "}
          <span className="font-semibold text-white">{formatDate(payPeriod.due_date)}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Staff", value: totalStaff, color: "text-slate-600 bg-slate-100", icon: <Users className="w-5 h-5" /> },
          { label: "Submitted", value: submitted.length, color: "text-amber-600 bg-amber-100", icon: <Clock className="w-5 h-5" /> },
          { label: "Approved", value: approved.length, color: "text-green-600 bg-green-100", icon: <CheckCircle className="w-5 h-5" /> },
          { label: "Missing", value: missingStaff.length, color: "text-red-600 bg-red-100", icon: <AlertCircle className="w-5 h-5" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{apiError}</div>
      )}

      {/* Bulk approve */}
      {submitted.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-blue-900">
              {submitted.length} timecard{submitted.length !== 1 ? "s" : ""} ready to approve
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              All hours look correct? Approve all at once.
            </p>
          </div>
          <button
            onClick={approveAll}
            disabled={bulkLoading}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Approve All ({submitted.length})
          </button>
        </div>
      )}

      {/* Send reminders */}
      {missingStaff.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-800">
              {missingStaff.length} employee{missingStaff.length !== 1 ? "s" : ""} haven&apos;t submitted yet
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              Send them an email reminder with a link to submit.
            </p>
            {reminderResult && (
              <p className="text-sm text-green-700 font-medium mt-1">
                ✓ Sent {reminderResult.sent} reminder{reminderResult.sent !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={sendReminders}
            disabled={reminderLoading}
            className="flex items-center gap-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap text-sm"
          >
            {reminderLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            Send Reminders
          </button>
        </div>
      )}

      {/* Staff list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Staff Timecards</h2>
          <span className="text-xs text-slate-400">{totalStaff} employees</span>
        </div>
        <div className="divide-y divide-slate-100">
          {reviewList.map((entry, idx) => {
            const totalHours = (entry.lines ?? []).reduce((s, l) => s + l.actual_hours, 0);
            const hasChanges = (entry.lines ?? []).some((l) => l.actual_hours !== l.default_hours);
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedIdx(idx)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusDot status={entry.status} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {entry.employee?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{entry.employee?.email ?? "—"}</p>
                  </div>
                  {hasChanges && entry.status !== "approved" && (
                    <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Hours changed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-slate-800 tabular-nums">{totalHours.toFixed(1)} hrs</p>
                    <StatusLabel status={entry.status} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            );
          })}

          {/* Missing staff (not clickable — no entry yet) */}
          {missingStaff.map((staff) => (
            <div key={staff.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <div>
                  <p className="font-medium text-slate-700">{staff.full_name}</p>
                  <p className="text-xs text-slate-400">{staff.email}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                Not Submitted
              </span>
            </div>
          ))}

          {totalStaff === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No staff assigned to you yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Approval Detail View ─────────────────────────────────────────────────────

interface DetailProps {
  entry: TimeEntry;
  payPeriod: PayPeriod;
  idx: number;
  total: number;
  flagNote: string;
  showFlagInput: boolean;
  actionLoading: string | null;
  apiError: string;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onApprove: () => void;
  onFlagToggle: () => void;
  onFlagNoteChange: (v: string) => void;
  onFlagSubmit: () => void;
}

function ApprovalDetail({
  entry,
  payPeriod,
  idx,
  total,
  flagNote,
  showFlagInput,
  actionLoading,
  apiError,
  onBack,
  onPrev,
  onNext,
  onApprove,
  onFlagToggle,
  onFlagNoteChange,
  onFlagSubmit,
}: DetailProps) {
  const isApproved = entry.status === "approved";
  const isFlagged = entry.status === "flagged";
  const totalHours = (entry.lines ?? []).reduce((s, l) => s + l.actual_hours, 0);

  // Compute % for each line
  const getPercent = (hrs: number) =>
    totalHours ? ((hrs / totalHours) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to list
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={idx === 0}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 font-medium px-1">
            {idx + 1} of {total}
          </span>
          <button
            onClick={onNext}
            disabled={idx === total - 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Official form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e3a5f] text-white px-6 py-5 text-center">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-widest mb-1">
            Federal Time &amp; Effort Report
          </p>
          <h2 className="text-lg font-bold">Semi-Annual Certification</h2>
          <p className="text-sm text-blue-200 mt-1">
            Activity Report — Fiscal Year {new Date(payPeriod.start_date).getFullYear()}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status banner */}
          {isApproved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-green-800">
                Approved — {entry.approved_at ? formatDate(entry.approved_at.split("T")[0]) : ""}
              </span>
            </div>
          )}
          {isFlagged && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Flag className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-sm font-semibold text-red-800">Flagged — returned to employee</span>
            </div>
          )}

          {/* Employee info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border border-slate-100 rounded-xl p-4 bg-slate-50">
            <div>
              <p className="text-xs text-slate-400 font-medium">Employee</p>
              <p className="font-semibold text-slate-800">{entry.employee?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Email</p>
              <p className="text-slate-700">{entry.employee?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Pay Period</p>
              <p className="text-slate-700">
                {formatDateLong(payPeriod.start_date)} – {formatDateLong(payPeriod.end_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Submitted</p>
              <p className="text-slate-700">
                {entry.submitted_at ? formatDate(entry.submitted_at.split("T")[0]) : "—"}
              </p>
            </div>
          </div>

          {/* Programs / Hours table */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Federal Program Hours
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1e3a5f] text-white">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-blue-100 text-xs">
                      Program / Grant
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-blue-100 text-xs w-28">
                      Default Hrs
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-blue-100 text-xs w-28">
                      Actual Hrs
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-blue-100 text-xs w-24">
                      % of Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(entry.lines ?? []).map((line) => {
                    const changed =
                      line.actual_hours !== line.default_hours && line.default_hours > 0;
                    return (
                      <tr key={line.id} className={changed ? "bg-amber-50" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{line.grant?.name ?? "—"}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {line.grant?.code ?? ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500 tabular-nums">
                          {line.default_hours > 0 ? line.default_hours.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          <span
                            className={clsx(
                              "font-bold",
                              changed ? "text-amber-700" : "text-slate-800"
                            )}
                          >
                            {line.actual_hours.toFixed(2)}
                          </span>
                          {changed && (
                            <span className="block text-xs text-amber-600 font-medium">changed</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            {getPercent(line.actual_hours)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-4 py-3 font-bold text-slate-700">Total</td>
                    <td />
                    <td className="px-3 py-3 text-center font-bold text-slate-800 tabular-nums">
                      {totalHours.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        100.00%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Employee note */}
          {entry.notes && (
            <div className="flex gap-2 text-sm text-slate-600 bg-blue-50 rounded-xl border border-blue-100 p-3">
              <MessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-600 mb-0.5">Employee note</p>
                <p>{entry.notes}</p>
              </div>
            </div>
          )}

          {/* Certification statement */}
          {!isApproved && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Supervisor Certification
                </p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Approval serves as your <strong>electronic signature</strong> verifying that this
                data is correct to the best of your knowledge. Once approved, you will not be able
                to make changes.
              </p>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">
                I certify that the employee listed above worked the hours shown on activities
                authorized by the federal program(s) stated above, and that this time &amp; effort
                report is accurate.
              </p>
            </div>
          )}

          {apiError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {apiError}
            </p>
          )}

          {/* Action buttons */}
          {!isApproved && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={onApprove}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-base shadow-sm"
                >
                  {actionLoading === entry.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  APPROVE
                </button>
                <button
                  onClick={onFlagToggle}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold px-5 py-3.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  <Flag className="w-4 h-4" />
                  Flag
                </button>
              </div>

              {showFlagInput && (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={flagNote}
                    onChange={(e) => onFlagNoteChange(e.target.value)}
                    placeholder="Explain why this is being returned to the employee…"
                    className="w-full px-3 py-2.5 text-sm border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    autoFocus
                  />
                  <button
                    onClick={onFlagSubmit}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {actionLoading === entry.id + "-flag" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flag className="w-4 h-4" />
                    )}
                    Send Back to Employee
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation at bottom */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={onPrev}
              disabled={idx === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-xs text-slate-400">
              {idx + 1} of {total} employees
            </span>
            <button
              onClick={onNext}
              disabled={idx === total - 1}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    submitted: "bg-amber-400",
    approved: "bg-green-400",
    flagged: "bg-red-400",
    draft: "bg-slate-300",
  };
  return <div className={`w-2 h-2 rounded-full shrink-0 ${colors[status] ?? "bg-slate-300"}`} />;
}

function StatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    submitted: { label: "Pending", className: "text-amber-600" },
    approved: { label: "Approved", className: "text-green-600" },
    flagged: { label: "Flagged", className: "text-red-600" },
    draft: { label: "Draft", className: "text-slate-400" },
  };
  const c = config[status] ?? config.draft;
  return <p className={`text-xs font-medium ${c.className}`}>{c.label}</p>;
}
