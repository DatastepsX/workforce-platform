'use client';

import { useEffect } from 'react';
import { markAllDemandReceivedRead } from '@/lib/actions/notifications';

export function DemandsReadMarker() {
  useEffect(() => {
    markAllDemandReceivedRead();
  }, []);
  return null;
}
