"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
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
  supervisor,
  payPeriod,
  entries,
  missingStaff,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [flagNote, setFlagNote] = useState<Record<string, string>>({});

  const submitted = entries.filter((e) => e.status === "submitted");
  const approved = entries.filter((e) => e.status === "approved");
  const flagged = entries.filter((e) => e.status === "flagged");

  async function approveEntry(entryId: string) {
    setActionLoading(entryId);
    await supabase
      .from("time_entries")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: supervisor.id,
      })
      .eq("id", entryId);

    await supabase.from("audit_log").insert({
      time_entry_id: entryId,
      actor_id: supervisor.id,
      action: "approved",
    });

    setActionLoading(null);
    startTransition(() => router.refresh());
  }

  async function flagEntry(entryId: string) {
    setActionLoading(entryId + "-flag");
    await supabase
      .from("time_entries")
      .update({ status: "flagged", notes: flagNote[entryId] || undefined })
      .eq("id", entryId);

    await supabase.from("audit_log").insert({
      time_entry_id: entryId,
      actor_id: supervisor.id,
      action: "flagged",
      new_data: { note: flagNote[entryId] },
    });

    setActionLoading(null);
    startTransition(() => router.refresh());
  }

  async function approveAll() {
    setBulkLoading(true);
    const ids = submitted.map((e) => e.id);
    await supabase
      .from("time_entries")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: supervisor.id,
      })
      .in("id", ids);

    for (const id of ids) {
      await supabase.from("audit_log").insert({
        time_entry_id: id,
        actor_id: supervisor.id,
        action: "approved",
      });
    }
    setBulkLoading(false);
    startTransition(() => router.refresh());
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
          Due: <span className="font-semibold text-white">{formatDate(payPeriod.due_date)}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Staff", value: totalStaff, icon: <Users className="w-5 h-5" />, color: "text-slate-600 bg-slate-100" },
          { label: "Submitted", value: submitted.length, icon: <Clock className="w-5 h-5" />, color: "text-amber-600 bg-amber-100" },
          { label: "Approved", value: approved.length, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600 bg-green-100" },
          { label: "Missing", value: missingStaff.length, icon: <AlertCircle className="w-5 h-5" />, color: "text-red-600 bg-red-100" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk Approve */}
      {submitted.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-blue-900">
              {submitted.length} timecard{submitted.length !== 1 ? "s" : ""} ready to approve
            </p>
            <p className="text-sm text-blue-700 mt-0.5">All hours look correct? Approve all at once.</p>
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

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Staff Timecards</h2>
          <span className="text-xs text-slate-400">{totalStaff} employees</span>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Submitted entries */}
          {submitted.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onApprove={() => approveEntry(entry.id)}
              onFlag={() => flagEntry(entry.id)}
              approveLoading={actionLoading === entry.id}
              flagLoading={actionLoading === entry.id + "-flag"}
              flagNote={flagNote[entry.id] ?? ""}
              onFlagNoteChange={(v) => setFlagNote((prev) => ({ ...prev, [entry.id]: v }))}
            />
          ))}

          {/* Flagged entries */}
          {flagged.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onApprove={() => approveEntry(entry.id)}
              onFlag={() => flagEntry(entry.id)}
              approveLoading={actionLoading === entry.id}
              flagLoading={actionLoading === entry.id + "-flag"}
              flagNote={flagNote[entry.id] ?? ""}
              onFlagNoteChange={(v) => setFlagNote((prev) => ({ ...prev, [entry.id]: v }))}
            />
          ))}

          {/* Approved entries */}
          {approved.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
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
            <div key={staff.id} className="flex items-center justify-between px-5 py-4">
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
  const hasChanges = (entry.lines ?? []).some((l) => l.actual_hours !== l.default_hours);

  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium text-slate-800">{entry.employee?.full_name ?? "—"}</p>
            <p className="text-xs text-slate-400">{entry.employee?.email ?? "—"}</p>
          </div>
          {hasChanges && !isApproved && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Hours changed
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-bold text-slate-800">{totalHours.toFixed(1)} hrs</p>
            <StatusPill status={entry.status} />
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
          {/* Lines table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="text-left pb-2 font-medium">Program / Grant</th>
                <th className="text-center pb-2 font-medium w-24">Default</th>
                <th className="text-center pb-2 font-medium w-24">Actual</th>
                <th className="text-center pb-2 font-medium w-20">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(entry.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <td className="py-2 text-slate-700">{line.grant?.name ?? "—"}</td>
                  <td className="py-2 text-center text-slate-500">{line.default_hours.toFixed(2)}</td>
                  <td className="py-2 text-center">
                    <span
                      className={clsx(
                        "font-semibold",
                        line.actual_hours !== line.default_hours ? "text-amber-600" : "text-slate-800"
                      )}
                    >
                      {line.actual_hours.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2 text-center text-slate-500">
                    {line.percent_time?.toFixed(2) ?? "—"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {entry.notes && (
            <div className="flex gap-2 text-sm text-slate-600 bg-white rounded-lg border border-slate-200 p-3">
              <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{entry.notes}</span>
            </div>
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
                {!isFlagged && (
                  <button
                    onClick={onFlag}
                    disabled={flagLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {flagLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flag className="w-4 h-4" />
                    )}
                    Flag
                  </button>
                )}
              </div>

              {!isFlagged && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add note for employee (optional)…"
                    value={flagNote}
                    onChange={(e) => onFlagNoteChange(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {isApproved && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Approved{" "}
              {entry.approved_at ? formatDate(entry.approved_at.split("T")[0]) : ""}
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
