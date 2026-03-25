-- EffortLog Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────
create table if not exists employees (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  full_name     text not null,
  role          text not null check (role in ('staff', 'supervisor', 'admin')),
  supervisor_id uuid references employees(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────
create table if not exists grants (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,         -- e.g. "010 0571 08000 61 434 300 00"
  name        text not null,               -- e.g. "Safe & Drug Free Schools"
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- FUNDING ALLOCATIONS (default split per employee)
-- ─────────────────────────────────────────────
create table if not exists funding_allocations (
  id          uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  grant_id    uuid not null references grants(id) on delete cascade,
  default_hours numeric(6,2) not null default 0,
  unique (employee_id, grant_id)
);

-- ─────────────────────────────────────────────
-- PAY PERIODS (semi-monthly, auto-generated)
-- ─────────────────────────────────────────────
create table if not exists pay_periods (
  id          uuid primary key default uuid_generate_v4(),
  start_date  date not null,
  end_date    date not null,
  due_date    date not null,               -- submission deadline
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  unique (start_date, end_date)
);

-- ─────────────────────────────────────────────
-- TIME ENTRIES (one per employee per pay period)
-- ─────────────────────────────────────────────
create table if not exists time_entries (
  id             uuid primary key default uuid_generate_v4(),
  employee_id    uuid not null references employees(id) on delete cascade,
  pay_period_id  uuid not null references pay_periods(id) on delete cascade,
  status         text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'flagged')),
  submitted_at   timestamptz,
  approved_at    timestamptz,
  approved_by    uuid references employees(id),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, pay_period_id)
);

-- ─────────────────────────────────────────────
-- TIME ENTRY LINES (one per grant per entry)
-- ─────────────────────────────────────────────
create table if not exists time_entry_lines (
  id             uuid primary key default uuid_generate_v4(),
  time_entry_id  uuid not null references time_entries(id) on delete cascade,
  grant_id       uuid not null references grants(id) on delete cascade,
  default_hours  numeric(6,2) not null default 0,
  actual_hours   numeric(6,2) not null default 0,
  percent_time   numeric(5,2) generated always as (
    case when actual_hours = 0 then 0
         else round(actual_hours / nullif(
           (select sum(l2.actual_hours) from time_entry_lines l2 where l2.time_entry_id = time_entry_id), 0
         ) * 100, 2)
    end
  ) stored,
  unique (time_entry_id, grant_id)
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────
create table if not exists audit_log (
  id             uuid primary key default uuid_generate_v4(),
  time_entry_id  uuid references time_entries(id) on delete set null,
  actor_id       uuid references employees(id) on delete set null,
  action         text not null,   -- 'submitted', 'approved', 'flagged', 'edited'
  old_data       jsonb,
  new_data       jsonb,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger time_entries_updated_at
  before update on time_entries
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table employees          enable row level security;
alter table grants             enable row level security;
alter table funding_allocations enable row level security;
alter table pay_periods        enable row level security;
alter table time_entries       enable row level security;
alter table time_entry_lines   enable row level security;
alter table audit_log          enable row level security;

-- Helper: get current employee record
create or replace function current_employee_id()
returns uuid language sql security definer as $$
  select id from employees where email = auth.jwt() ->> 'email' limit 1;
$$;

create or replace function current_employee_role()
returns text language sql security definer as $$
  select role from employees where email = auth.jwt() ->> 'email' limit 1;
$$;

-- Employees: everyone can read active employees; only admin can write
create policy "employees_read" on employees for select using (true);
create policy "employees_write" on employees for all using (current_employee_role() = 'admin');

-- Grants: everyone can read; only admin can write
create policy "grants_read" on grants for select using (true);
create policy "grants_write" on grants for all using (current_employee_role() = 'admin');

-- Funding allocations: everyone can read; only admin can write
create policy "allocations_read" on funding_allocations for select using (true);
create policy "allocations_write" on funding_allocations for all using (current_employee_role() = 'admin');

-- Pay periods: everyone can read
create policy "periods_read" on pay_periods for select using (true);
create policy "periods_write" on pay_periods for all using (current_employee_role() = 'admin');

-- Time entries: staff see their own; supervisors see their team; admin sees all
create policy "entries_staff_read" on time_entries for select using (
  employee_id = current_employee_id()
  or current_employee_role() in ('supervisor', 'admin')
);
create policy "entries_staff_write" on time_entries for insert with check (
  employee_id = current_employee_id()
);
create policy "entries_staff_update" on time_entries for update using (
  employee_id = current_employee_id()
  or current_employee_role() in ('supervisor', 'admin')
);

-- Time entry lines follow same rules as entries
create policy "lines_read" on time_entry_lines for select using (
  exists (
    select 1 from time_entries te
    where te.id = time_entry_id
    and (
      te.employee_id = current_employee_id()
      or current_employee_role() in ('supervisor', 'admin')
    )
  )
);
create policy "lines_write" on time_entry_lines for all using (
  exists (
    select 1 from time_entries te
    where te.id = time_entry_id
    and (
      te.employee_id = current_employee_id()
      or current_employee_role() in ('supervisor', 'admin')
    )
  )
);

-- Audit log: supervisors and admin can read
create policy "audit_read" on audit_log for select using (
  current_employee_role() in ('supervisor', 'admin')
);
create policy "audit_write" on audit_log for insert with check (true);

-- ─────────────────────────────────────────────
-- SEED: sample pay periods (semi-monthly 2025)
-- ─────────────────────────────────────────────
insert into pay_periods (start_date, end_date, due_date) values
  ('2025-01-01', '2025-01-15', '2025-01-06'),
  ('2025-01-16', '2025-01-31', '2025-01-22'),
  ('2025-02-01', '2025-02-15', '2025-02-05'),
  ('2025-02-16', '2025-02-28', '2025-02-19'),
  ('2025-03-01', '2025-03-15', '2025-03-05'),
  ('2025-03-16', '2025-03-31', '2025-03-20'),
  ('2025-04-01', '2025-04-15', '2025-04-04'),
  ('2025-04-16', '2025-04-30', '2025-04-21'),
  ('2025-05-01', '2025-05-15', '2025-05-06'),
  ('2025-05-16', '2025-05-31', '2025-05-21'),
  ('2025-06-01', '2025-06-15', '2025-06-04'),
  ('2025-06-16', '2025-06-30', '2025-06-19'),
  ('2025-07-01', '2025-07-15', '2025-07-03')
on conflict do nothing;
