export type Role = "staff" | "supervisor" | "admin";

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  supervisor_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Grant {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface FundingAllocation {
  id: string;
  employee_id: string;
  grant_id: string;
  default_hours: number;
  grant?: Grant;
}

export interface PayPeriod {
  id: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: "open" | "closed";
  created_at: string;
}

export type EntryStatus = "draft" | "submitted" | "approved" | "flagged";

export interface TimeEntry {
  id: string;
  employee_id: string;
  pay_period_id: string;
  status: EntryStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  pay_period?: PayPeriod;
  lines?: TimeEntryLine[];
}

export interface TimeEntryLine {
  id: string;
  time_entry_id: string;
  grant_id: string;
  default_hours: number;
  actual_hours: number;
  percent_time: number;
  grant?: Grant;
}

export interface AuditLog {
  id: string;
  time_entry_id: string | null;
  actor_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
