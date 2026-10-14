import { AppState } from 'react-native';

/** Refresh visible catalogs without overlapping requests or polling in the background. */
export function startCatalogAutoRefresh(refresh: () => Promise<void>, intervalMs: number) {
  let disposed = false;
  let running = false;
  const run = async () => {
    if (disposed || running || (AppState.currentState && AppState.currentState !== 'active')) return;
    running = true;
    try { await refresh(); } finally { running = false; }
  };
  void run();
  const timer = setInterval(() => { void run(); }, intervalMs);
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') void run();
  });
  return () => { disposed = true; clearInterval(timer); subscription.remove(); };
}
