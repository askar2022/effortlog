# EffortLog

Federal grant **Time & Effort Reporting** PWA for school staff.

Built with Next.js 15, Supabase, and Tailwind CSS. Deployable on Vercel.

---

## Features

- **Staff**: Email OTP login → see pre-filled hours by grant → enter actual hours (% auto-calculates) → submit
- **Supervisor**: Dashboard with Approve All or individual approve/flag per employee
- **Admin**: Manage employees, grant programs, funding allocations, and pay periods
- **PWA**: Installable on iPhone ("Add to Home Screen") and Android

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/askar2022/effortlog.git
cd effortlog
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. In the SQL Editor, paste and run the entire contents of `supabase/schema.sql`
3. In **Authentication → Email** settings:
   - Enable **Email OTP** (6-digit code)
   - Disable "Confirm email" (not needed for OTP flow)
   - Set OTP expiry to 600 seconds (10 min)

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in: Supabase → Project Settings → API

### 4. Create your first admin user

In the Supabase SQL Editor:

```sql
insert into employees (email, full_name, role)
values ('your@email.com', 'Your Name', 'admin');
```

Then go to `/login`, enter that email, and sign in with the 6-digit code.

### 5. Run locally

```bash
npm run dev
```

---

## Deploy to Vercel

1. Push to GitHub: `git remote add origin https://github.com/askar2022/effortlog.git && git push -u origin main`
2. Import the repo on [vercel.com](https://vercel.com)
3. Add your environment variables in Vercel project settings
4. Deploy!

---

## Database Schema

| Table | Purpose |
|---|---|
| `employees` | Staff, supervisors, admins |
| `grants` | Federal grant programs |
| `funding_allocations` | Default hours per employee per grant |
| `pay_periods` | Semi-monthly periods (open/closed) |
| `time_entries` | One per employee per period (draft → submitted → approved) |
| `time_entry_lines` | Hours per grant per entry (% auto-calculated) |
| `audit_log` | Full history for federal compliance |

---

## User Flows

### Staff
1. Open app → enter work email → receive 6-digit code
2. See current pay period with pre-filled hours
3. Adjust actual hours if needed (% updates live)
4. Click Submit

### Supervisor
1. Login → Supervisor dashboard
2. See all staff with status: Submitted / Missing / Approved
3. Click **Approve All** or expand any row to Approve / Flag individually
4. Flagged entries notify the employee to resubmit

### Admin
1. **Employees tab**: Add/edit staff and supervisors, set their supervisor, manage grant allocations
2. **Grants tab**: Add federal grant programs with program codes
3. **Pay Periods tab**: View/add/open/close semi-monthly periods

---

## PWA / iPhone Install

Since Apple doesn't allow PWAs from the App Store (for school-managed devices):

1. Open the app URL in Safari on iPhone
2. Tap the Share button → **Add to Home Screen**
3. The app installs with the EffortLog icon and opens full-screen

> Tip: Send staff a one-time email with the URL and these steps.
