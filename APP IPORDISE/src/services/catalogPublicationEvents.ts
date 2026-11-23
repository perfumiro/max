import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { appConfig } from '../config';
import { loadSharedProducts } from '../sharedCatalog';

// One foreground subscription for the whole shopping app. Events invalidate
// the catalog; product data always comes from the public catalog reader.
export function watchCatalogPublications() {
  const client = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let channel: ReturnType<typeof client.channel> | undefined;
  let pending = false;
  let running = false;
  let disposed = false;

  async function refresh() {
    pending = true;
    if (running) return;
    running = true;
    try {
      while (pending && channel && !disposed) {
        pending = false;
        // Drain any read that started before the admin finished writing.
        await loadSharedProducts();
        if (channel && !disposed) await loadSharedProducts(true);
      }
    } catch {
      // Foreground polling remains available while connectivity recovers.
    } finally {
      running = false;
    }
  }

  function connect(state: string | null) {
    if (state && state !== 'active') {
      if (channel) void client.removeChannel(channel);
      channel = undefined;
      return;
    }
    if (channel || disposed) return;
    channel = client.channel('storefront-catalog', { config: { private: true } })
      .on('broadcast', { event: 'changed' }, () => { void refresh(); });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
  }

  connect(AppState.currentState);
  const subscription = AppState.addEventListener('change', connect);
  return () => {
    disposed = true;
    subscription.remove();
    if (channel) void client.removeChannel(channel);
    channel = undefined;
  };
}
