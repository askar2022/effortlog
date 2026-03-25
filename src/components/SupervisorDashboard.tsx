"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Employee, PayPeriod, TimeEntry } from "@/types";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Loader2,
  Flag,
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

export default function SupervisorDashboard({
  payPeriod,
  entries,
  missingStaff,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [flagNotes, setFlagNotes] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const submitted = entries.filter((e) => e.status === "submitted");
  const approved = entries.filter((e) => e.status === "approved");
  const flagged = entries.filter((e) => e.status === "flagged");

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
      await callApi(`/api/entries/${entryId}/flag`, { note: flagNotes[entryId] ?? "" });
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
      await callApi("/api/entries/approve-all", {
        entry_ids: submitted.map((e) => e.id),
      });
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to approve all");
    } finally {
      setBulkLoading(false);
    }
  }

  if (!payPeriod) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-amber-800 font-medium">No active pay period open.</p>
      </div>
    );
  }

  const totalStaff = entries.length + missingStaff.length;

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Staff",
            value: totalStaff,
            icon: <Users className="w-5 h-5" />,
            color: "text-slate-600 bg-slate-100",
          },
          {
            label: "Submitted",
            value: submitted.length,
            icon: <Clock className="w-5 h-5" />,
            color: "text-amber-600 bg-amber-100",
          },
          {
            label: "Approved",
            value: approved.length,
            icon: <CheckCircle className="w-5 h-5" />,
            color: "text-green-600 bg-green-100",
          },
          {
            label: "Missing",
            value: missingStaff.length,
            icon: <AlertCircle className="w-5 h-5" />,
            color: "text-red-600 bg-red-100",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}
            >
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* API error */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Bulk Approve */}
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
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Approve All ({submitted.length})
          </button>
        </div>
      )}

      {/* Staff table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Staff Timecards</h2>
          <span className="text-xs text-slate-400">{totalStaff} employees</span>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Flagged — needs attention first */}
          {flagged.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onApprove={() => approveEntry(entry.id)}
              onFlag={() => flagEntry(entry.id)}
              approveLoading={actionLoading === entry.id}
              flagLoading={actionLoading === entry.id + "-flag"}
              flagNote={flagNotes[entry.id] ?? ""}
              onFlagNoteChange={(v) =>
                setFlagNotes((p) => ({ ...p, [entry.id]: v }))
              }
            />
          ))}

          {/* Submitted — waiting for action */}
          {submitted.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onApprove={() => approveEntry(entry.id)}
              onFlag={() => flagEntry(entry.id)}
              approveLoading={actionLoading === entry.id}
              flagLoading={actionLoading === entry.id + "-flag"}
              flagNote={flagNotes[entry.id] ?? ""}
              onFlagNoteChange={(v) =>
                setFlagNotes((p) => ({ ...p, [entry.id]: v }))
              }
            />
          ))}

          {/* Approved — read-only */}
          {approved.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onApprove={() => {}}
              onFlag={() => {}}
              approveLoading={false}
              flagLoading={false}
              flagNote=""
              onFlagNoteChange={() => {}}
            />
          ))}

          {/* Missing staff */}
          {missingStaff.map((staff) => (
            <div
              key={staff.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <p className="font-medium text-slate-700">{staff.full_name}</p>
                <p className="text-xs text-slate-400">{staff.email}</p>
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

// ─── Entry row component ────────────────────────────────────────────────────

interface EntryRowProps {
  entry: TimeEntry;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onFlag: () => void;
  approveLoading: boolean;
  flagLoading: boolean;
  flagNote: string;
  onFlagNoteChange: (v: string) => void;
}

function EntryRow({
  entry,
  expanded,
  onToggle,
  onApprove,
  onFlag,
  approveLoading,
  flagLoading,
  flagNote,
  onFlagNoteChange,
}: EntryRowProps) {
  const isApproved = entry.status === "approved";
  const isFlagged = entry.status === "flagged";
  const totalHours = (entry.lines ?? []).reduce((s, l) => s + l.actual_hours, 0);
  const hasChanges = (entry.lines ?? []).some(
    (l) => l.actual_hours !== l.default_hours
  );

  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {entry.employee?.full_name ?? "—"}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {entry.employee?.email ?? "—"}
            </p>
          </div>
          {hasChanges && !isApproved && (
            <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Hours changed
            </span>
          )}
          {isFlagged && (
            <span className="shrink-0 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              Flagged
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-3 shrink-0">
          <div className="text-right">
            <p className="font-bold text-slate-800 tabular-nums">
              {totalHours.toFixed(1)} hrs
            </p>
            <StatusPill status={entry.status} />
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
          {/* Lines table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="text-left px-4 py-2.5 font-medium">Program / Grant</th>
                  <th className="text-center px-3 py-2.5 font-medium w-24">Default</th>
                  <th className="text-center px-3 py-2.5 font-medium w-24">Actual</th>
                  <th className="text-center px-3 py-2.5 font-medium w-20">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(entry.lines ?? []).map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-700 font-medium">
                        {line.grant?.name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {line.grant?.code ?? ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">
                      {line.default_hours > 0 ? line.default_hours.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      <span
                        className={clsx(
                          "font-semibold",
                          line.actual_hours !== line.default_hours && line.default_hours > 0
                            ? "text-amber-600"
                            : "text-slate-800"
                        )}
                      >
                        {line.actual_hours.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">
                      {line.percent_time != null ? `${Number(line.percent_time).toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-2 font-bold text-slate-700">Total</td>
                  <td />
                  <td className="px-3 py-2 text-center font-bold text-slate-800 tabular-nums">
                    {totalHours.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-bold text-green-700">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Employee note */}
          {entry.notes && (
            <div className="flex gap-2 text-sm text-slate-600 bg-white rounded-lg border border-slate-200 p-3">
              <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{entry.notes}</span>
            </div>
          )}

          {/* Submission date */}
          {entry.submitted_at && (
            <p className="text-xs text-slate-400">
              Submitted: {formatDate(entry.submitted_at.split("T")[0])}
            </p>
          )}

          {/* Actions */}
          {!isApproved && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  disabled={approveLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  {approveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={onFlag}
                  disabled={flagLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  {flagLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Flag className="w-4 h-4" />
                  )}
                  Flag
                </button>
              </div>

              <input
                type="text"
                placeholder="Add note for employee (shown when flagged)…"
                value={flagNote}
                onChange={(e) => onFlagNoteChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          )}

          {isApproved && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Approved{" "}
              {entry.approved_at
                ? formatDate(entry.approved_at.split("T")[0])
                : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    submitted: { label: "Pending", className: "text-amber-600" },
    approved: { label: "Approved", className: "text-green-600" },
    flagged: { label: "Flagged", className: "text-red-600" },
    draft: { label: "Draft", className: "text-slate-400" },
  };
  const c = config[status] ?? config.draft;
  return <p className={`text-xs font-medium ${c.className}`}>{c.label}</p>;
}
