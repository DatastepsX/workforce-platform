import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import type { OptimizationIdea } from '@/lib/workflow/scenarios';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'WorkforceX <onboarding@resend.dev>';
const DEVELOPER_EMAIL = 'micciche.alessandro@gmail.com';

export async function POST(req: Request) {
  // Auth: super_admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { idea: OptimizationIdea; comment?: string; tenantName: string };
  const { idea, comment, tenantName } = body;
  if (!idea) return NextResponse.json({ error: 'Missing idea' }, { status: 400 });

  // Read CLAUDE.md for codebase context
  let claudeMd = '';
  try {
    const mdPath = path.join(process.cwd(), 'CLAUDE.md');
    claudeMd = fs.readFileSync(mdPath, 'utf-8').slice(0, 12000); // cap tokens
  } catch {
    claudeMd = 'CLAUDE.md not available.';
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const systemPrompt = `You are a senior software engineer working on WorkforceX, a Workforce Operating System built with Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

Below is the project documentation (CLAUDE.md). Use it to give contextually accurate implementation plans.

<project_docs>
${claudeMd}
</project_docs>

The Super Admin has identified an optimisation idea from running workflow test scenarios. Your job is to produce a concise, actionable engineering specification so a developer can immediately implement it.`;

  const userPrompt = `Optimisation idea from tenant "${tenantName}":

**Title:** ${idea.title}
**Category:** ${idea.category}
**Priority:** ${idea.priority}
**Description:** ${idea.description}
**Business Impact:** ${idea.impact}
**Initial Requirement:** ${idea.requirement}
${comment ? `\n**Super Admin Additional Context:** ${comment}` : ''}

Produce a specification in this exact format:

## Specification: ${idea.title}

### Why
One paragraph explaining the business/technical motivation.

### Acceptance Criteria
Bulleted list of verifiable outcomes (what "done" looks like).

### Implementation Plan
Numbered list of concrete steps. For each step: which file(s) to modify or create, what exactly to change, and why.

### Database Changes
Any new migrations needed (or "None required").

### Testing
How to verify the change works end-to-end.

Keep it concise and direct — no fluff, no marketing language. Write as if briefing a developer who will implement this in the next session.`;

  let spec = '';
  let cost = 0;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    spec = (msg.content[0] as { type: string; text: string }).text ?? '';
    cost = (msg.usage.input_tokens * 3 + msg.usage.output_tokens * 15) / 1_000_000;
  } catch (err) {
    return NextResponse.json({ error: `Claude API error: ${err}` }, { status: 500 });
  }

  // Send email to developer
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const priorityColor = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' }[idea.priority] ?? '#8E8E93';
      const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#F2F2F7;padding:32px 0">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <p style="font-size:13px;font-weight:600;color:#8E8E93;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">WorkforceX · Optimisation Request</p>
  <h1 style="font-size:22px;font-weight:700;color:#000;margin:0 0 4px">${idea.title}</h1>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
    <span style="background:${priorityColor};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">${idea.priority.toUpperCase()}</span>
    <span style="background:#F2F2F7;color:#8E8E93;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">${idea.category.toUpperCase()}</span>
    <span style="background:#007AFF18;color:#007AFF;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">Client: ${tenantName}</span>
    <span style="background:#5856D618;color:#5856D6;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px">Requested by: ${profile?.full_name ?? 'Super Admin'}</span>
  </div>
  <p style="font-size:13px;color:#3C3C43;margin:12px 0">${idea.description}</p>
  <p style="font-size:12px;color:#8E8E93">💰 ${idea.impact}</p>
  ${comment ? `<div style="background:#F2F2F7;border-radius:10px;padding:12px;margin:16px 0"><p style="font-size:11px;font-weight:600;color:#8E8E93;margin:0 0 4px">SUPER ADMIN COMMENT</p><p style="font-size:12px;color:#3C3C43;margin:0">${comment}</p></div>` : ''}
  <hr style="border:none;border-top:1px solid #F2F2F7;margin:20px 0">
  <div style="background:#F9F9FB;border-radius:10px;padding:16px">
    <pre style="font-size:12px;color:#1C1C1E;white-space:pre-wrap;font-family:system-ui,sans-serif;margin:0">${spec}</pre>
  </div>
</div></body></html>`;
      await resend.emails.send({
        from: FROM,
        to: DEVELOPER_EMAIL,
        subject: `[WorkforceX Optimise] ${idea.title} · ${idea.priority.toUpperCase()} · ${tenantName}`,
        html,
      });
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Spec generated and emailed to developer.',
    spec,
    cost,
  });
}
