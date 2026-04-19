/**
 * Nodemailer Email Service — Gmail App Password
 * Used for sending OTP emails for the Owner forgot-password flow.
 *
 * Setup (one-time):
 *  1. Enable 2FA on your Gmail account.
 *  2. Go to myaccount.google.com → Security → App Passwords
 *  3. Create a new App Password named "LNM Bytes"
 *  4. Set SMTP_USER and SMTP_PASS in .env
 */

import nodemailer from "nodemailer";

function getTransporter() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        throw new Error("SMTP_USER and SMTP_PASS must be set in .env");
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
}

// ─── Send OTP Email ────────────────────────────────────────────────────────────
export async function sendOtpEmail(toEmail: string, otp: string, ownerName?: string): Promise<void> {
    const from = process.env.SMTP_FROM || `"LNM Bytes" <${process.env.SMTP_USER}>`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316,#ef4444);padding:36px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:16px;padding:12px 24px;">
                <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">LNM BYTES</span>
              </div>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">
                Partner Portal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
                Password Reset OTP
              </h2>
              <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.6;">
                Hi ${ownerName ? `<strong>${ownerName}</strong>` : "there"}, we received a request to reset your
                LNM Bytes Partner Portal password. Use the OTP below — it expires in
                <strong>10 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="text-align:center;margin:0 0 28px;">
                <div style="display:inline-block;background:#fff7ed;border:2px dashed #f97316;
                            border-radius:16px;padding:20px 48px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#f97316;
                             letter-spacing:3px;text-transform:uppercase;">Your OTP</p>
                  <p style="margin:0;font-size:42px;font-weight:900;color:#1e293b;letter-spacing:10px;">
                    ${otp}
                  </p>
                </div>
              </div>

              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">
                ⚠️ Do not share this OTP with anyone. If you didn't request a password reset,
                you can safely ignore this email — your password won't change.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} LNM Bytes • LNMIIT Campus Canteen Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await getTransporter().sendMail({
        from,
        to: toEmail,
        subject: `${otp} is your LNM Bytes password reset OTP`,
        html,
    });
}
