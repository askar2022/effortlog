import { APP_URL } from "./resend";

// ─── Shared layout wrapper ───────────────────────────────────────────────────
function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EffortLog</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

          <!-- Logo / header -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <div style="display:inline-block;background:#1e3a5f;border-radius:14px;padding:10px 20px;">
                <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">EffortLog</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;color:#94a3b8;font-size:12px;">
              Federal Time &amp; Effort Reporting &nbsp;·&nbsp; EffortLog
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── 1. OTP Login Code ───────────────────────────────────────────────────────
export function otpEmail(code: string): { subject: string; html: string } {
  return {
    subject: `${code} — Your EffortLog sign-in code`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">Your sign-in code</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
        Use the code below to sign in to EffortLog. It expires in <strong>10 minutes</strong>.
      </p>

      <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#1e3a5f;font-family:monospace;">
          ${code}
        </span>
      </div>

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        If you didn't request this code, you can safely ignore this email.
        Someone may have entered your email address by mistake.
      </p>
    `),
  };
}

// ─── 2. Staff reminder: submit timecard ─────────────────────────────────────
export function staffReminderEmail(opts: {
  name: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): { subject: string; html: string } {
  return {
    subject: `Action Required: Submit your Time & Effort report by ${opts.dueDate}`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">
        Time &amp; Effort Submission Due
      </h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
        Hi <strong>${opts.name}</strong>,
      </p>
      <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
        Please submit your Time &amp; Effort report for the pay period
        <strong>${opts.periodStart} – ${opts.periodEnd}</strong>.
      </p>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">
          ⏰ Deadline: ${opts.dueDate}
        </p>
      </div>

      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        This report certifies the hours you worked on each federal grant program.
        Your default hours are pre-filled — simply review, adjust if needed, and submit.
      </p>

      <a href="${APP_URL}/dashboard"
         style="display:block;background:#1e3a5f;color:#ffffff;text-decoration:none;text-align:center;
                padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;">
        Submit My Timecard →
      </a>

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
        You can also open EffortLog on your phone using the app on your home screen.
      </p>
    `),
  };
}

// ─── 3. Supervisor: missing submissions alert ────────────────────────────────
export function supervisorAlertEmail(opts: {
  supervisorName: string;
  missingNames: string[];
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): { subject: string; html: string } {
  const listItems = opts.missingNames
    .map(
      (n) =>
        `<li style="padding:6px 0;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;">${n}</li>`
    )
    .join("");

  return {
    subject: `${opts.missingNames.length} employee${opts.missingNames.length !== 1 ? "s have" : " has"} not submitted their Time & Effort report`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">
        Missing Submissions Alert
      </h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
        Hi <strong>${opts.supervisorName}</strong>,
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:15px;line-height:1.6;">
        The following ${opts.missingNames.length === 1 ? "employee has" : `${opts.missingNames.length} employees have`}
        not yet submitted their Time &amp; Effort report for
        <strong>${opts.periodStart} – ${opts.periodEnd}</strong>:
      </p>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:24px;">
        <ul style="margin:0;padding:0;list-style:none;">
          ${listItems}
        </ul>
      </div>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">
          ⏰ Deadline: ${opts.dueDate}
        </p>
      </div>

      <a href="${APP_URL}/supervisor"
         style="display:block;background:#1e3a5f;color:#ffffff;text-decoration:none;text-align:center;
                padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;">
        View Approvals Dashboard →
      </a>
    `),
  };
}

// ─── 4. Employee: timecard approved ─────────────────────────────────────────
export function approvedEmail(opts: {
  name: string;
  periodStart: string;
  periodEnd: string;
  supervisorName: string;
}): { subject: string; html: string } {
  return {
    subject: `Your Time & Effort report has been approved`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">
        Timecard Approved ✓
      </h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
        Hi <strong>${opts.name}</strong>,
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#166534;font-size:24px;">✅</p>
        <p style="margin:0;color:#166534;font-size:15px;font-weight:600;">
          Your Time &amp; Effort report for
          <br />${opts.periodStart} – ${opts.periodEnd}
          <br />has been approved.
        </p>
      </div>

      <p style="margin:0 0 8px;color:#64748b;font-size:14px;line-height:1.6;">
        Approved by: <strong>${opts.supervisorName}</strong>
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        This approval is your certified record for federal grant compliance. You can view
        your submission history in the EffortLog app.
      </p>
    `),
  };
}

// ─── 5. Employee: timecard flagged ──────────────────────────────────────────
export function flaggedEmail(opts: {
  name: string;
  periodStart: string;
  periodEnd: string;
  supervisorNote: string;
}): { subject: string; html: string } {
  return {
    subject: `Action Required: Your Time & Effort report needs correction`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">
        Timecard Returned for Correction
      </h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
        Hi <strong>${opts.name}</strong>,
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:15px;line-height:1.6;">
        Your Time &amp; Effort report for <strong>${opts.periodStart} – ${opts.periodEnd}</strong>
        has been returned by your supervisor and needs to be corrected.
      </p>

      ${
        opts.supervisorNote
          ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
              <p style="margin:0 0 4px;color:#991b1b;font-size:12px;font-weight:600;text-transform:uppercase;">Supervisor note</p>
              <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6;">${opts.supervisorNote}</p>
             </div>`
          : ""
      }

      <a href="${APP_URL}/dashboard"
         style="display:block;background:#dc2626;color:#ffffff;text-decoration:none;text-align:center;
                padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;">
        Update &amp; Resubmit →
      </a>
    `),
  };
}
