import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { demand_id, supplier_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: demand }, { data: supplier }] = await Promise.all([
      supabase.from('demands').select('*').eq('id', demand_id).single(),
      supabase.from('suppliers').select('*').eq('id', supplier_id).single(),
    ]);

    if (!demand || !supplier) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://workforce-platform-omega.vercel.app';
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!resendKey) {
      console.warn('RESEND_API_KEY not set — skipping email');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const skillsList = demand.skills?.length
      ? `<p><strong>Required skills:</strong> ${demand.skills.join(', ')}</p>`
      : '';

    const budgetLine = demand.budget_max
      ? `<p><strong>Budget:</strong> ${demand.budget_min ? `€${demand.budget_min.toLocaleString()} – ` : 'up to '}€${demand.budget_max.toLocaleString()}</p>`
      : '';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #000;">
        <h1 style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px;">New Requirement</h1>
        <h2 style="font-size: 22px; font-weight: 600; color: #007AFF; margin-top: 0; margin-bottom: 24px;">${demand.title}</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #8E8E93; font-size: 14px; width: 140px;">Contract Type</td>
            <td style="padding: 8px 0; font-size: 14px; text-transform: capitalize;">${demand.contract_type}</td>
          </tr>
          ${demand.location ? `<tr>
            <td style="padding: 8px 0; color: #8E8E93; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; font-size: 14px;">${demand.location}${demand.remote_allowed ? ' (Remote OK)' : ''}</td>
          </tr>` : ''}
          ${demand.experience_years != null ? `<tr>
            <td style="padding: 8px 0; color: #8E8E93; font-size: 14px;">Experience</td>
            <td style="padding: 8px 0; font-size: 14px;">${demand.experience_years}+ years</td>
          </tr>` : ''}
        </table>

        ${budgetLine}
        ${skillsList}

        ${demand.description ? `<p style="font-size: 15px; line-height: 1.6; color: #3C3C43; margin-top: 16px;">${demand.description}</p>` : ''}

        <div style="margin-top: 32px;">
          <a href="${appUrl}/supplier"
             style="display: inline-block; background: #007AFF; color: white; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px; text-decoration: none;">
            View in Supplier Portal →
          </a>
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: #8E8E93;">
          You received this because your company is registered as a supplier on WorkforceX.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'WorkforceX <onboarding@resend.dev>',
        to: supplier.email,
        subject: `New requirement: ${demand.title}`,
        html,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
