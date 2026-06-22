// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-opus-4-8':   { input: 15.00, output: 75.00 },
  'claude-haiku-4-5':  { input: 0.25,  output: 1.25  },
};

interface TrackOptions {
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  context?: string;
}

export function trackApiCall(opts: TrackOptions): void {
  void (async () => {
    try {
      const key = process.env.RESEND_API_KEY;
      if (!key) return;

      const p = PRICING[opts.model] ?? PRICING['claude-sonnet-4-6'];
      const inputCost  = (opts.inputTokens  / 1_000_000) * p.input;
      const outputCost = (opts.outputTokens / 1_000_000) * p.output;
      const totalCost  = inputCost + outputCost;

      const subject = `⚡ API: ${opts.purpose} — $${totalCost.toFixed(5)}`;

      const row = (label: string, value: string, highlight = false) =>
        `<tr style="background:${highlight ? '#F2F2F7' : 'white'}">
           <td style="padding:5px 10px;color:#8E8E93;white-space:nowrap">${label}</td>
           <td style="padding:5px 10px;font-weight:${highlight ? '400' : '600'}">${value}</td>
         </tr>`;

      const html = `
<div style="font-family:system-ui,sans-serif;max-width:480px;color:#1c1c1e">
  <h2 style="font-size:15px;font-weight:700;color:#007AFF;margin:0 0 12px">WorkforceX · API Call</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #E5E5EA;border-radius:8px;overflow:hidden;font-size:13px">
    ${row('Purpose',      `<strong>${opts.purpose}</strong>`)}
    ${row('Model',        opts.model, true)}
    ${row('Input tokens', opts.inputTokens.toLocaleString())}
    ${row('Output tokens',opts.outputTokens.toLocaleString(), true)}
    ${row('Input cost',   `$${inputCost.toFixed(6)}`)}
    ${row('Output cost',  `$${outputCost.toFixed(6)}`, true)}
    <tr style="border-top:2px solid #E5E5EA">
      <td style="padding:7px 10px;font-weight:700">Total cost</td>
      <td style="padding:7px 10px;font-weight:700;color:#34C759">$${totalCost.toFixed(6)}</td>
    </tr>
  </table>
  ${opts.context
    ? `<p style="margin:10px 0 0;padding:8px 10px;background:#F2F2F7;border-radius:6px;font-size:12px;color:#8E8E93">${opts.context}</p>`
    : ''}
  <p style="font-size:11px;color:#C7C7CC;margin:8px 0 0">${new Date().toISOString()}</p>
</div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'WorkforceX <onboarding@resend.dev>',
          to: ['micciche.alessandro@gmail.com'],
          subject,
          html,
        }),
      });
    } catch { /* never fail the caller */ }
  })();
}
