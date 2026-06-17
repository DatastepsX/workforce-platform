import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_EMAIL = 'micciche.alessandro';

interface FieldInfo {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  currentValue?: string;
  options?: { value: string; label: string }[];
}

// Derive a role-based email prefix from the page path
function prefixFromPath(path: string): string {
  if (/\/careers/.test(path))   return 'applicant';
  if (/\/suppliers/.test(path)) return 'supplier';
  if (/\/candidates/.test(path)) return 'candidate';
  if (/\/profile/.test(path))   return 'candidate';
  if (/\/demands/.test(path))   return 'hiring';
  if (/\/recruiter/.test(path)) return 'recruiter';
  return 'user';
}

// Find the next unused sequential number for a given prefix
async function nextNumber(prefix: string): Promise<number> {
  const pattern = new RegExp(`^${BASE_EMAIL}\\+${prefix}(\\d+)@gmail\\.com$`);
  const allNumbers: number[] = [];

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Check auth users (full registered accounts)
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of data?.users ?? []) {
        const m = u.email?.match(pattern);
        if (m) allNumbers.push(parseInt(m[1], 10));
      }

      // Also check supplier_candidates table (not auth users)
      const { data: scRows } = await admin
        .from('supplier_candidates')
        .select('email')
        .like('email', `${BASE_EMAIL}+${prefix}%@gmail.com`);
      for (const row of scRows ?? []) {
        const m = (row.email as string | null)?.match(pattern);
        if (m) allNumbers.push(parseInt(m[1], 10));
      }

      // Also check profiles table for any stragglers
      const { data: profileRows } = await admin
        .from('profiles')
        .select('email')
        .like('email', `${BASE_EMAIL}+${prefix}%@gmail.com`);
      for (const row of profileRows ?? []) {
        const m = (row.email as string | null)?.match(pattern);
        if (m) allNumbers.push(parseInt(m[1], 10));
      }
    }
  } catch {
    // ignore — fall through to default
  }

  return allNumbers.length ? Math.max(...allNumbers) + 1 : 1;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (await req.json()) as { path: string; fields: FieldInfo[]; pageContext?: string };
  const isPublicPath = body?.path?.startsWith('/careers/');

  if (!user && !isPublicPath) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { path, fields, pageContext } = body;

  // Determine the right email for this form before calling Claude
  const prefix = prefixFromPath(path);
  const n = await nextNumber(prefix);
  const testEmail = `${BASE_EMAIL}+${prefix}${n}@gmail.com`;

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const prefilledContext = fields
    .filter(f => f.currentValue)
    .map(f => `  - ${f.label || f.name}: "${f.currentValue}"`)
    .join('\n');

  const fieldDescriptions = fields.map(f => {
    let line = `  - name="${f.name}" type="${f.type}"`;
    if (f.label) line += ` label="${f.label}"`;
    if (f.placeholder) line += ` placeholder="${f.placeholder}"`;
    if (f.currentValue) line += ` [ALREADY FILLED: "${f.currentValue}" — keep this value]`;
    if (f.options?.length) {
      line += ` options=[${f.options.map(o => `"${o.value}"`).join(', ')}]`;
    }
    return line;
  }).join('\n');

  const pageContextSection = pageContext
    ? `\nPage context (current demand / job title shown on screen): "${pageContext}"\nThis is the most important signal — generate ALL data to match this role/position exactly.\n`
    : '';

  const contextSection = prefilledContext
    ? `\nUser has already entered the following — treat this as the central theme and generate everything else to match it:\n${prefilledContext}\n`
    : '';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are generating realistic test data for WorkforceX — a Workforce Management Platform used by European enterprises, primarily in the DACH region (Germany, Austria, Switzerland).

Current page: ${path}
Today's date: ${today}
${pageContextSection}${contextSection}
Form fields to fill:
${fieldDescriptions}

Rules:
- Use German/European professional context: German names, DACH cities (München, Berlin, Hamburg, Frankfurt, Wien, Zürich, Stuttgart, Köln), realistic company names (GmbH, AG, SE style)
- IMPORTANT: If the user already entered values (marked with [ALREADY FILLED]), return them unchanged and let them inspire everything else (e.g. if title is "SAP-Berater", generate SAP-relevant skills, budget, description, etc.)
- select fields: return EXACTLY one of the provided option values (no other values)
- date fields (type="date"): return YYYY-MM-DD format; start dates should be around ${soon}; end dates 6-12 months after start
- number fields: budget fields 600–1500 for daily rates; experience 2–15; use integers
- skills / specializations / comma-separated fields / fields with type "tags": return a comma-separated string of 4–6 realistic values (e.g. "SAP FI, SAP CO, ABAP, S/4HANA") relevant to the job/context
- email fields: generate a placeholder — it will be replaced automatically
- phone fields: use German format (+49 XX XXXXXXXX)
- description / textarea: write 2–3 professional sentences in English fitting the specific role/context entered
- Do NOT fill hidden, submit, or button fields
- Vary the data — make it sound like a real enterprise scenario

Return ONLY a valid JSON object with field names as keys and string values. No markdown, no code blocks, no explanation.`,
    }],
  });

  const raw = message.content.find(b => b.type === 'text');
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: 'No text response from Claude' }, { status: 500 });
  }

  let parsed: Record<string, string>;
  try {
    const text = raw.text.trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    const match = raw.text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: 'Could not parse Claude response as JSON' }, { status: 500 });
    }
    parsed = JSON.parse(match[0]);
  }

  // Replace all email fields with the context-aware sequential address
  for (const key of Object.keys(parsed)) {
    if (key === 'email' || key.endsWith('_email') || key.startsWith('email_')) {
      parsed[key] = testEmail;
    }
  }
  for (const field of fields as FieldInfo[]) {
    if (field.type === 'email') {
      parsed[field.name] = testEmail;
    }
  }

  return NextResponse.json(parsed);
}
