export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import type { Employee, TimeEntry } from "@/types";
import { CheckCircle, Clock, AlertCircle, FileText } from "lucide-react";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft: { label: "Draft", icon: <FileText className="w-4 h-4" />, className: "bg-slate-100 text-slate-600" },
  submitted: { label: "Pending Approval", icon: <Clock className="w-4 h-4" />, className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", icon: <CheckCircle className="w-4 h-4" />, className: "bg-green-100 text-green-700" },
  flagged: { label: "Flagged", icon: <AlertCircle className="w-4 h-4" />, className: "bg-red-100 text-red-700" },
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();

  const { data: employee } = await db
    .from("employees")
    .select("*")
    .eq("email", user.email!)
    .single<Employee>();
  if (!employee) redirect("/login");

  const { data: entries } = await db
    .from("time_entries")
    .select("*, pay_period:pay_periods(*), lines:time_entry_lines(*, grant:grants(*))")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .returns<TimeEntry[]>();

  return (
    <AppShell role={employee.role} name={employee.full_name}>
      <div className="py-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Submission History</h1>

        {!entries?.length && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            No submissions yet.
          </div>
        )}

        {entries?.map((entry) => {
          const sc = statusConfig[entry.status] ?? statusConfig.draft;
          const pp = entry.pay_period;
          return (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="font-semibold text-slate-800">
                    {pp ? `${formatDate(pp.start_date)} – ${formatDate(pp.end_date)}` : "—"}
                  </p>
                  {entry.submitted_at && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted {formatDate(entry.submitted_at.split("T")[0])}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${sc.className}`}>
                  {sc.icon}
                  {sc.label}
                </span>
              </div>

              {entry.lines && entry.lines.length > 0 && (
                <div className="px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left pb-2 font-medium">Program</th>
                        <th className="text-center pb-2 font-medium w-24">Actual Hrs</th>
                        <th className="text-center pb-2 font-medium w-20">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {entry.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-1.5 text-slate-700">{line.grant?.name ?? "—"}</td>
                          <td className="py-1.5 text-center font-semibold text-slate-800 tabular-nums">
                            {line.actual_hours.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-center text-slate-500 tabular-nums">
                            {line.percent_time != null ? `${Number(line.percent_time).toFixed(2)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {entry.notes && (
                <div className="px-5 pb-4">
                  <p className="text-xs text-slate-400 italic">Note: {entry.notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
