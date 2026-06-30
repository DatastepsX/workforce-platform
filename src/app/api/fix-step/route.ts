import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import type { ExtendedScenarioStep } from '@/lib/workflow/scenarios';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'WorkforceX <onboarding@resend.dev>';
const DEVELOPER_EMAIL = 'micciche.alessandro@gmail.com';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    step: ExtendedScenarioStep;
    error?: string;
    comment?: string;
    tenantName: string;
  };
  const { step, error, comment, tenantName } = body;
  if (!step) return NextResponse.json({ error: 'Missing step' }, { status: 400 });

  let claudeMd = '';
  try {
    const mdPath = path.join(process.cwd(), 'CLAUDE.md');
    claudeMd = fs.readFileSync(mdPath, 'utf-8').slice(0, 12000);
  } catch {
    claudeMd = 'CLAUDE.md not available.';
  }

  const pathLabel = {
    happy: 'Happy path (should PASS — correct actor at correct status)',
    unhappy_wrong_role: 'Security check — wrong role (should be BLOCKED)',
    unhappy_wrong_status: 'Security check — wrong status (should be BLOCKED)',
    operational: 'Operational check',
  }[step.pathType] ?? step.pathType;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const systemPrompt = `You are a senior software engineer working on WorkforceX, a Workforce Operating System built with Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

<project_docs>
${claudeMd}
</project_docs>

A workflow test scenario is FAILING. Your job is to diagnose the root cause and write a concise, actionable fix specification.`;

  const userPrompt = `Failing test step for tenant "${tenantName}":

**Step name:** ${step.name}
**Path type:** ${pathLabel}
**Phase:** ${step.phase}
**Action:** ${step.action}
**From status:** ${step.fromStatus ?? 'any'}
**To status:** ${step.toStatus}
**Test role:** ${step.testRole}
**Allowed roles:** ${step.allowedRoles.join(', ')}
**Expected outcome:** ${step.expectedOutcome}${step.conditionalFlag ? `\n**Conditional flag:** ${step.conditionalFlag}` : ''}${step.wrongRole ? `\n**Wrong role used:** ${step.wrongRole}` : ''}${step.wrongFromStatus ? `\n**Wrong from-status used:** ${step.wrongFromStatus}` : ''}
**Actual error:** ${error ?? 'No error message — outcome did not match expected'}
${comment ? `\n**Developer context:** ${comment}` : ''}

Produce a fix in this exact format:

## Fix: ${step.name}

### Root Cause
One paragraph: what is failing and exactly why (be specific about which file/function/RLS policy/workflow transition is the problem).

### Fix Plan
Numbered steps. For each: the exact file path, what to change, and why.

### Database Changes
SQL migration if needed, or "None required."

### Verification
How to confirm the fix: which test step should now pass, and what to check manually.

Be direct and specific — cite actual file paths from the project docs where known.`;

  let spec = '';
  let cost = 0;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    spec = (msg.content[0] as { type: string; text: string }).text ?? '';
    cost = (msg.usage.input_tokens * 3 + msg.usage.output_tokens * 15) / 1_000_000;
  } catch (err) {
    return NextResponse.json({ error: `Claude API error: ${err}` }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const pathColor = step.pathType === 'happy' ? '#34C759' : '#FF9500';
      const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#F2F2F7;padding:32px 0">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <p style="font-size:13px;font-weight:600;color:#8E8E93;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">WorkforceX · Fix Request</p>
  <h1 style="font-size:22px;font-weight:700;color:#FF3B30;margin:0 0 4px">✗ ${step.name}</h1>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
    <span style="background:#FF3B3018;color:#FF3B30;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">FAILING</span>
    <span style="background:${pathColor}18;color:${pathColor};font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">${step.pathType.replace(/_/g, ' ').toUpperCase()}</span>
    <span style="background:#007AFF18;color:#007AFF;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">Client: ${tenantName}</span>
    <span style="background:#5856D618;color:#5856D6;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">Requested by: ${profile?.full_name ?? 'Super Admin'}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px">
    <tr><td style="padding:4px 8px 4px 0;color:#8E8E93;white-space:nowrap">Action</td><td style="padding:4px 0;color:#1C1C1E;font-weight:600">${step.action}</td></tr>
    <tr><td style="padding:4px 8px 4px 0;color:#8E8E93">Transition</td><td style="padding:4px 0;color:#1C1C1E">${step.fromStatus ?? 'any'} → ${step.toStatus}</td></tr>
    <tr><td style="padding:4px 8px 4px 0;color:#8E8E93">Test role</td><td style="padding:4px 0;color:#1C1C1E">${step.testRole}</td></tr>
    <tr><td style="padding:4px 8px 4px 0;color:#8E8E93">Expected</td><td style="padding:4px 0;color:#1C1C1E">${step.expectedOutcome}</td></tr>
  </table>
  ${error ? `<div style="background:#FF3B3008;border:1px solid #FF3B3030;border-radius:8px;padding:10px;margin:12px 0"><p style="font-size:11px;font-family:monospace;color:#FF3B30;margin:0">⚠ ${error}</p></div>` : ''}
  ${comment ? `<div style="background:#F2F2F7;border-radius:10px;padding:12px;margin:12px 0"><p style="font-size:11px;font-weight:600;color:#8E8E93;margin:0 0 4px">DEVELOPER CONTEXT</p><p style="font-size:12px;color:#3C3C43;margin:0">${comment}</p></div>` : ''}
  <p style="font-size:11px;color:#8E8E93;margin:8px 0 4px">Estimated fix cost: <strong style="color:#1C1C1E">$${cost.toFixed(4)}</strong></p>
  <hr style="border:none;border-top:1px solid #F2F2F7;margin:20px 0">
  <div style="background:#F9F9FB;border-radius:10px;padding:16px">
    <pre style="font-size:12px;color:#1C1C1E;white-space:pre-wrap;font-family:system-ui,sans-serif;margin:0">${spec}</pre>
  </div>
</div></body></html>`;
      await resend.emails.send({
        from: FROM,
        to: DEVELOPER_EMAIL,
        subject: `[WorkforceX Fix] ✗ ${step.name} · ${tenantName}`,
        html,
      });
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json({ success: true, message: 'Fix spec emailed to developer.', cost });
}
