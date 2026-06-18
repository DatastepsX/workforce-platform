'use client';

import { useEffect } from 'react';
import { markDemandNotificationReadById } from '@/lib/actions/notifications';

export function DemandReadMarker({ demandId }: { demandId: string }) {
  useEffect(() => {
    markDemandNotificationReadById(demandId);
  }, [demandId]);
  return null;
}
