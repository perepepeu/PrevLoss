import { useEffect, useState, useSyncExternalStore } from 'react';
import { Monitor } from '../state/monitor';
export function usePrevLoss() {
  const [monitor] = useState(() => new Monitor());
  const snapshot = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot);
  useEffect(() => { monitor.start(); return monitor.stop; }, [monitor]);
  return { ...snapshot, monitor };
}
