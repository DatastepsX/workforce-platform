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

async function fetchExistingContext(supabase: Awaited<ReturnType<typeof createClient>>, path: string): Promise<string> {
  try {
    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
    const lines: string[] = [];

    if (path.includes('/demands') || path.includes('/careers')) {
      const { data } = await admin.from('demands').select('title').order('created_at', { ascending: false }).limit(30);
      if (data?.length) {
        lines.push(`Existing demand titles (DO NOT duplicate): ${data.map(d => `"${d.title}"`).join(', ')}`);
      }
    }
    if (path.includes('/candidates') || path.includes('/profile') || path.includes('/careers')) {
      const { data } = await admin.from('candidate_profiles').select('full_name').not('full_name', 'is', null).limit(30);
      if (data?.length) {
        lines.push(`Existing candidate names (generate different names): ${data.map(d => `"${d.full_name}"`).join(', ')}`);
      }
    }
    if (path.includes('/suppliers')) {
      const { data } = await admin.from('suppliers').select('company_name').limit(30);
      if (data?.length) {
        lines.push(`Existing supplier companies (generate different ones): ${data.map(d => `"${d.company_name}"`).join(', ')}`);
      }
    }
    return lines.length ? `\n${lines.join('\n')}\n` : '';
  } catch {
    return '';
  }
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

  const { path, fields, pageContext, searchParams: rawSearchParams } = body as typeof body & { searchParams?: string };

  // Determine the right email for this form before calling Claude
  const prefix = prefixFromPath(path);
  const n = await nextNumber(prefix);
  const testEmail = `${BASE_EMAIL}+${prefix}${n}@gmail.com`;

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Extract demand ID from URL params (e.g. return_to=/supplier/demands/UUID/submit)
  let demandContext = '';
  if (rawSearchParams) {
    try {
      const sp = new URLSearchParams(rawSearchParams);
      const returnTo = sp.get('return_to') ?? '';
      const demandIdMatch = returnTo.match(/\/demands\/([0-9a-f-]{36})/i)
        ?? path.match(/\/demands\/([0-9a-f-]{36})/i);
      if (demandIdMatch) {
        const demandId = demandIdMatch[1];
        const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
        const { data: demand } = await admin.from('demands').select('title, description, skills').eq('id', demandId).single();
        if (demand) {
          demandContext = `\nLinked demand (generate candidate data that matches this position):
Title: "${demand.title}"
Skills required: ${(demand.skills ?? []).join(', ') || 'not specified'}
${demand.description ? `Description: ${demand.description}` : ''}
`;
        }
      }
    } catch { /* non-blocking */ }
  }

  const existingContext = await fetchExistingContext(supabase, path);

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

  const pageContextSection = (pageContext || demandContext)
    ? `\n${demandContext || `Page context (current demand / job title shown on screen): "${pageContext}"\nThis is the most important signal — generate ALL data to match this role/position exactly.`}\n`
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
${pageContextSection}${contextSection}${existingContext}
Form fields to fill:
${fieldDescriptions}

Industry/Sector context — rotate across these to create diverse, realistic data:
- Positions to fill: Technology & IT, Finance & Controlling, Construction & Property, Engineering, HR & People, Life Sciences & Pharma
- Client companies come from: Aerospace & Defence, Consumer & Retail, Energy & Resources, Financial Services, Health & Pharmaceuticals, Infrastructure & Real Estate, Technology/Telecoms/Media
- Company name style: German GmbH, AG, SE (e.g. "Siemens Energy AG", "DHL Group SE", "Allianz SE", "Bosch GmbH") — not generic names
- Use the current page context and any existing data context (above) to pick an industry that is NOT yet represented or is underrepresented

Rules:
- CRITICAL: If existing data is listed above, generate DIFFERENT names/titles that don't duplicate what already exists
- Candidate names: use realistic full German/Austrian/Swiss names (first + last name). Be creative — vary ethnicity (German, Turkish, Italian, Eastern European) for realism. Never repeat a name from the existing list.
- DACH cities: München, Berlin, Hamburg, Frankfurt, Wien, Zürich, Stuttgart, Köln, Düsseldorf, Dresden, Leipzig, Graz, Basel
- IMPORTANT: If the user already entered values (marked with [ALREADY FILLED]), return them unchanged and let them inspire everything else
- select fields: return EXACTLY one of the provided option values (no other values)
- date fields (type="date"): return YYYY-MM-DD format; start dates should be around ${soon}; end dates 6-12 months after start
- number fields: budget fields 700–1800 for daily rates; experience 2–18; use integers
- skills / specializations / comma-separated fields / fields with type "tags": return a comma-separated string of 4–6 realistic values relevant to the specific role and industry
- email fields: generate a placeholder — it will be replaced automatically
- phone fields: use German format (+49 XX XXXXXXXX)
- description / textarea: write 2–3 professional sentences in GERMAN fitting the specific role/context (use formal German, e.g. "Wir suchen einen erfahrenen...")
- Do NOT fill hidden, submit, or button fields

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
