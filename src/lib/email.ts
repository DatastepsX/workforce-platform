import { Resend } from 'resend';

const APP_URL = process.env.APP_URL ?? 'https://workforce-platform-omega.vercel.app';
const FROM = 'WorkforceX <onboarding@resend.dev>';

let resend: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function send(to: string | string[], subject: string, html: string) {
  const client = getResend();
  if (!client) return; // silently skip if not configured
  try {
    await client.emails.send({ from: FROM, to, subject, html });
  } catch {
    // non-blocking — never fail the main action
  }
}

function btn(label: string, href: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#007AFF;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">${label}</a></p>`;
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#F2F2F7;padding:32px 0">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
<p style="font-size:13px;font-weight:700;color:#007AFF;letter-spacing:.5px;text-transform:uppercase;margin:0 0 8px">WorkforceX</p>
<h1 style="font-size:22px;font-weight:700;margin:0 0 20px;color:#000">${title}</h1>
${body}
<hr style="border:none;border-top:1px solid #E5E5EA;margin:28px 0">
<p style="font-size:12px;color:#8E8E93;margin:0">You received this because you are part of this hiring process.</p>
</div></body></html>`;
}

// ── Notification types ─────────────────────────────────────────────────────────

export async function emailDemandSentToSupplier(opts: {
  supplierEmail: string;
  supplierName: string;
  demandTitle: string;
  demandId: string;
  deadline?: string | null;
}) {
  const link = `${APP_URL}/supplier`;
  const body = `
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Hi ${opts.supplierName},</p>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">A new requirement has been shared with you:</p>
<div style="background:#F2F2F7;border-radius:10px;padding:16px;margin:16px 0">
  <p style="font-size:17px;font-weight:600;margin:0 0 4px;color:#000">${opts.demandTitle}</p>
  ${opts.deadline ? `<p style="font-size:13px;color:#8E8E93;margin:0">Deadline: ${new Date(opts.deadline).toLocaleDateString('de-DE')}</p>` : ''}
</div>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Please review the details and submit suitable candidates.</p>
${btn('View Requirement →', link)}`;
  await send(opts.supplierEmail, `New Requirement: ${opts.demandTitle}`, layout(`New Requirement`, body));
}

export async function emailCandidatesSubmitted(opts: {
  recruiterEmails: string[];
  supplierName: string;
  demandTitle: string;
  demandId: string;
  candidateNames: string[];
}) {
  const link = `${APP_URL}/dashboard/demands/${opts.demandId}/submissions`;
  const names = opts.candidateNames.map(n => `<li style="margin:4px 0;color:#3C3C43">${n}</li>`).join('');
  const body = `
<p style="color:#3C3C43;font-size:15px;line-height:1.6"><strong>${opts.supplierName}</strong> has submitted ${opts.candidateNames.length} candidate${opts.candidateNames.length !== 1 ? 's' : ''} for:</p>
<div style="background:#F2F2F7;border-radius:10px;padding:16px;margin:16px 0">
  <p style="font-size:17px;font-weight:600;margin:0 0 8px;color:#000">${opts.demandTitle}</p>
  <ul style="margin:0;padding-left:20px">${names}</ul>
</div>
${btn('Review Submissions →', link)}`;
  await send(opts.recruiterEmails, `${opts.candidateNames.length} Candidate${opts.candidateNames.length !== 1 ? 's' : ''} Submitted for ${opts.demandTitle}`, layout('New Candidate Submissions', body));
}

export async function emailSubmissionStatusChanged(opts: {
  toEmail: string;
  toName: string;
  candidateName: string;
  demandTitle: string;
  demandId: string;
  status: string;
  isSupplier?: boolean;
}) {
  const STATUS_LABELS: Record<string, string> = {
    shortlisted: 'Shortlisted ✓',
    interview:   'Interview Scheduled',
    offer:       'Offer Extended',
    hired:       'Hired 🎉',
    rejected:    'Not Selected',
  };
  const label = STATUS_LABELS[opts.status] ?? opts.status;
  const link = opts.isSupplier
    ? `${APP_URL}/supplier`
    : `${APP_URL}/dashboard/demands/${opts.demandId}/submissions`;

  const body = `
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Hi ${opts.toName},</p>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Status update for <strong>${opts.candidateName}</strong>:</p>
<div style="background:#F2F2F7;border-radius:10px;padding:16px;margin:16px 0">
  <p style="font-size:13px;color:#8E8E93;margin:0 0 4px">Demand</p>
  <p style="font-size:15px;font-weight:600;margin:0 0 12px;color:#000">${opts.demandTitle}</p>
  <p style="font-size:13px;color:#8E8E93;margin:0 0 4px">New Status</p>
  <p style="font-size:17px;font-weight:700;margin:0;color:#007AFF">${label}</p>
</div>
${btn('View Details →', link)}`;
  await send(opts.toEmail, `${opts.candidateName} — ${label}`, layout('Status Update', body));
}

export async function emailApplicationConfirmation(opts: {
  candidateEmail: string;
  candidateName: string;
  demandTitle: string;
  demandId: string;
}) {
  const body = `
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Hi ${opts.candidateName},</p>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Thank you for your application! We have received it and our team will be in touch shortly.</p>
<div style="background:#F2F2F7;border-radius:10px;padding:16px;margin:16px 0">
  <p style="font-size:13px;color:#8E8E93;margin:0 0 4px">Applied for</p>
  <p style="font-size:17px;font-weight:600;margin:0;color:#000">${opts.demandTitle}</p>
</div>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Sign in to your account to complete your profile and track your application status.</p>
${btn('Sign in to WorkforceX →', `${APP_URL}/login`)}`;
  await send(opts.candidateEmail, `Application received: ${opts.demandTitle}`, layout('Application Received', body));
}

export async function emailEngagementCreated(opts: {
  supplierEmail: string;
  supplierName: string;
  candidateName: string;
  demandTitle: string;
  startDate?: string | null;
  endDate?: string | null;
  rate?: number | null;
  currency?: string;
}) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rateStr = opts.rate ? `${opts.currency ?? 'EUR'} ${opts.rate.toLocaleString()} / ${opts.currency === 'EUR' ? 'Tag' : 'day'}` : null;
  const body = `
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Hi ${opts.supplierName},</p>
<p style="color:#3C3C43;font-size:15px;line-height:1.6">Great news! Your candidate has been selected:</p>
<div style="background:#F2F2F7;border-radius:10px;padding:16px;margin:16px 0">
  <p style="font-size:17px;font-weight:600;margin:0 0 10px;color:#000">${opts.candidateName}</p>
  <p style="font-size:13px;color:#8E8E93;margin:0 0 4px">Position</p>
  <p style="font-size:15px;font-weight:500;margin:0 0 10px;color:#000">${opts.demandTitle}</p>
  ${opts.startDate ? `<p style="font-size:13px;color:#8E8E93;margin:0 0 2px">Start: ${fmt(opts.startDate)}</p>` : ''}
  ${opts.endDate ? `<p style="font-size:13px;color:#8E8E93;margin:0 0 2px">End: ${fmt(opts.endDate)}</p>` : ''}
  ${rateStr ? `<p style="font-size:13px;color:#8E8E93;margin:4px 0 0">Rate: <strong style="color:#000">${rateStr}</strong></p>` : ''}
</div>
${btn('View in Supplier Portal →', `${APP_URL}/supplier`)}`;
  await send(opts.supplierEmail, `Candidate Commissioned: ${opts.candidateName}`, layout('Candidate Selected 🎉', body));
}
