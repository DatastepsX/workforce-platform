'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTransitionsForStatus } from '@/lib/workflow/state-machine';
import type { DemandProcessStatus } from '@/lib/workflow/types';
import type { UserRole } from '@/types/database';

export async function transitionDemandStatus(
  demandId: string,
  action: string,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nicht angemeldet' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role as UserRole | undefined;
  if (!role) return { error: 'Rolle nicht gefunden' };

  const admin = createAdminClient();
  const { data: demand } = await admin
    .from('demands')
    .select('process_status, process_stage, created_by')
    .eq('id', demandId)
    .single();

  if (!demand) return { error: 'Demand nicht gefunden' };

  const currentStatus = demand.process_status as DemandProcessStatus;
  const availableTransitions = getTransitionsForStatus(currentStatus, role);
  const transition = availableTransitions.find(t => t.action === action);

  if (!transition) return { error: 'Aktion nicht erlaubt' };
  if (transition.requiresNote && !notes?.trim()) return { error: 'Notiz erforderlich' };

  const toStage = transition.toStage;
  const toStatus = transition.toStatus;

  // Update demands table
  const { error: updateError } = await admin
    .from('demands')
    .update({
      process_stage: toStage,
      process_status: toStatus,
      current_owner_role: transition.ownerRole,
      // Keep legacy status in sync where possible
      ...(transition.legacyStatus ? { status: transition.legacyStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', demandId);

  if (updateError) return { error: updateError.message };

  // Log to process_history
  await admin.from('process_history').insert({
    entity_type: 'demand',
    entity_id: demandId,
    from_stage: demand.process_stage,
    from_status: currentStatus,
    to_stage: toStage,
    to_status: toStatus,
    action,
    actor_id: user.id,
    actor_role: role,
    notes: notes?.trim() || null,
  });

  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/demands');

  return {};
}

export async function getDemandProcessHistory(demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('process_history')
    .select('*')
    .eq('entity_type', 'demand')
    .eq('entity_id', demandId)
    .order('created_at', { ascending: false });

  return data ?? [];
}
