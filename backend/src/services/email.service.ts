/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ EMAIL SERVICE — Transactional Emails via Resend
 * ═══════════════════════════════════════════════════════════
 *
 *  3 emails:
 *  1. Booking confirmation  — when state → CONFIRMED
 *  2. Booking cancellation  — when state → CANCELLED
 *  3. Compensation credit   — when ₹100 credit is issued
 *
 *  No-op when RESEND_API_KEY is not set (dev / CI).
 *  Sign up at resend.com → API Keys → create key → paste in .env
 * ═══════════════════════════════════════════════════════════
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM = `MOVZZ <${process.env.RESEND_FROM_EMAIL || 'noreply@movzz.in'}>`;

function isReady(): boolean {
    return !!resend;
}

// ─── Shared layout ───────────────────────────────────────

function layout(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MOVZZ</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

        <!-- Header -->
        <tr>
          <td style="background:#0d1d35;padding:20px 32px;">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.04em;">
              MOV<span style="color:#60a5fa;">ZZ</span>
            </span>
            <span style="font-size:12px;color:rgba(255,255,255,0.5);margin-left:10px;">Reliable Rides · Chennai</span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              MOVZZ Reliability-Orchestrated Mobility · Chennai, India<br/>
              You received this because you have an active MOVZZ account.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;width:140px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${value}</td>
    </tr>`;
}

// ─── 1. Booking Confirmation ─────────────────────────────

interface ConfirmationParams {
    toEmail: string;
    userName: string;
    bookingId: string;
    pickup: string;
    dropoff: string;
    providerName: string;
    transportMode: string;
    fareRupees: number;
}

export async function sendBookingConfirmation(params: ConfirmationParams): Promise<void> {
    if (!isReady()) {
        console.log(`[Email] (no-op) Confirmation → ${params.toEmail} | booking ${params.bookingId}`);
        return;
    }

    const html = layout(`
        <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a;">Your ride is confirmed!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
          Hi ${params.userName || 'there'}, your MOVZZ booking has been confirmed and a driver is on the way.
        </p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Booking ID',    params.bookingId.slice(0, 8).toUpperCase())}
            ${detailRow('From',          params.pickup)}
            ${detailRow('To',            params.dropoff)}
            ${detailRow('Mode',          params.transportMode)}
            ${detailRow('Provider',      params.providerName)}
            ${detailRow('Fare estimate', `₹${params.fareRupees}`)}
          </table>
        </div>

        <div style="background:#d1fae5;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#065f46;">
            <strong>Need help?</strong> Reply to this email or open the MOVZZ app to track your ride in real time.
          </p>
        </div>

        <p style="margin:0;font-size:12px;color:#94a3b8;">Safe travels!</p>
    `);

    await resend!.emails.send({
        from: FROM,
        to: [params.toEmail],
        subject: `Ride confirmed — ${params.pickup} → ${params.dropoff}`,
        html,
    });

    console.log(`[Email] Confirmation sent → ${params.toEmail}`);
}

// ─── 2. Booking Cancellation ─────────────────────────────

interface CancellationParams {
    toEmail: string;
    userName: string;
    bookingId: string;
    pickup: string;
    dropoff: string;
    reason?: string;
}

export async function sendBookingCancellation(params: CancellationParams): Promise<void> {
    if (!isReady()) {
        console.log(`[Email] (no-op) Cancellation → ${params.toEmail} | booking ${params.bookingId}`);
        return;
    }

    const html = layout(`
        <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a;">Booking cancelled</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
          Hi ${params.userName || 'there'}, your MOVZZ booking has been cancelled.
          ${params.reason ? `Reason: ${params.reason}.` : ''}
        </p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Booking ID', params.bookingId.slice(0, 8).toUpperCase())}
            ${detailRow('From',       params.pickup)}
            ${detailRow('To',         params.dropoff)}
          </table>
        </div>

        <div style="background:#fee2e2;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#991b1b;">
            No charges have been made. Book a new ride anytime from the MOVZZ app.
          </p>
        </div>
    `);

    await resend!.emails.send({
        from: FROM,
        to: [params.toEmail],
        subject: `Booking cancelled — ${params.pickup} → ${params.dropoff}`,
        html,
    });

    console.log(`[Email] Cancellation sent → ${params.toEmail}`);
}

// ─── 3. Compensation Credit ──────────────────────────────

interface CompensationParams {
    toEmail: string;
    userName: string;
    bookingId: string;
    amountRupees: number;
    expiryDays: number;
}

export async function sendCompensationCredit(params: CompensationParams): Promise<void> {
    if (!isReady()) {
        console.log(`[Email] (no-op) Compensation ₹${params.amountRupees} → ${params.toEmail} | booking ${params.bookingId}`);
        return;
    }

    const html = layout(`
        <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a;">We're sorry — here's ₹${params.amountRupees} credit</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
          Hi ${params.userName || 'there'}, we couldn't find a driver for your recent booking
          and we're sorry for the inconvenience.
        </p>

        <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
          <div style="font-size:36px;font-weight:800;color:#92400e;">₹${params.amountRupees}</div>
          <div style="font-size:14px;color:#92400e;margin-top:4px;">wallet credit added to your account</div>
          <div style="font-size:12px;color:#b45309;margin-top:8px;">
            Valid for ${params.expiryDays} days · applies automatically on your next booking
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Booking ID', params.bookingId.slice(0, 8).toUpperCase())}
            ${detailRow('Credit',     `₹${params.amountRupees}`)}
            ${detailRow('Expires in', `${params.expiryDays} days`)}
          </table>
        </div>

        <p style="margin:0;font-size:13px;color:#64748b;">
          We're constantly improving our reliability. Thank you for choosing MOVZZ.
        </p>
    `);

    await resend!.emails.send({
        from: FROM,
        to: [params.toEmail],
        subject: `₹${params.amountRupees} credit added to your MOVZZ wallet`,
        html,
    });

    console.log(`[Email] Compensation ₹${params.amountRupees} sent → ${params.toEmail}`);
}
