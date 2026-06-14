import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FieldInfo {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { path, fields } = (await req.json()) as { path: string; fields: FieldInfo[] };

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const fieldDescriptions = fields.map(f => {
    let line = `  - name="${f.name}" type="${f.type}"`;
    if (f.label) line += ` label="${f.label}"`;
    if (f.placeholder) line += ` placeholder="${f.placeholder}"`;
    if (f.options?.length) {
      line += ` options=[${f.options.map(o => `"${o.value}"`).join(', ')}]`;
    }
    return line;
  }).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are generating realistic test data for WorkforceX — a Workforce Management Platform used by European enterprises, primarily in the DACH region (Germany, Austria, Switzerland).

Current page: ${path}
Today's date: ${today}

Form fields to fill:
${fieldDescriptions}

Rules:
- Use German/European professional context: German names, DACH cities (München, Berlin, Hamburg, Frankfurt, Wien, Zürich, Stuttgart, Köln), realistic company names (GmbH, AG, SE style)
- select fields: return EXACTLY one of the provided option values (no other values)
- date fields (type="date"): return YYYY-MM-DD format; start dates should be around ${soon}; end dates 6-12 months after start
- number fields: budget fields 600–1500 for daily rates; experience 2–15; use integers
- skills / specializations / comma-separated fields: return 4–6 realistic values joined by ", "
- email fields: use realistic German business email (firstname.lastname@company.de)
- phone fields: use German format (+49 XX XXXXXXXX)
- description / textarea: write 2–3 professional sentences in English appropriate for the page context
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
    // Strip possible markdown code fences
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to extract JSON object from anywhere in the response
    const match = raw.text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: 'Could not parse Claude response as JSON' }, { status: 500 });
    }
    parsed = JSON.parse(match[0]);
  }

  return NextResponse.json(parsed);
}
