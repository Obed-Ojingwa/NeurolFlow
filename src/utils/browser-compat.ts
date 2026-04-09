// src/utils/browser-compat.ts
/**
 * Cross-browser WebExtensions API shim
 * Normalizes differences between Chrome/Edge/Brave (MV3) and Firefox (MV2/MV3)
 */

// Firefox exposes `browser`, Chrome/Edge/Brave expose `chrome`
// The `webextension-polyfill` package handles this automatically.
// This file provides manual shims for cases the polyfill misses.

declare const browser: typeof chrome | undefined;

export const ext = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

/**
 * Safe message sender — handles the case where the popup or background
 * may not be available (e.g., extension just installed)
 */
export async function safeSendMessage<T = unknown>(
  message: object
): Promise<T | null> {
  try {
    return await ext.runtime.sendMessage(message) as T;
  } catch (err) {
    // Runtime.lastError means no listeners — silently ignore
    if (ext.runtime.lastError) return null;
    console.error('[NeuroFlow] sendMessage error:', err);
    return null;
  }
}

/**
 * Detect browser type for minor behavioral differences
 */
export function detectBrowser(): 'chrome' | 'firefox' | 'edge' | 'brave' | 'opera' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();

  // Order matters — check specific browsers before generic ones
  if (ua.includes('edg/'))    return 'edge';
  if (ua.includes('opr/'))    return 'opera';
  if (ua.includes('firefox')) return 'firefox';

  // Brave detection via API (not UA)
  if ((navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave?.isBrave) return 'brave';

  if (ua.includes('chrome')) return 'chrome';
  return 'unknown';
}

/**
 * Firefox requires explicit audio context resume — wrap for safety
 */
export async function resumeAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

/**
 * MV3 service workers cannot use persistent connections.
 * Use this helper for reliable one-shot messaging.
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 200
): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise(resolve => setTimeout(resolve, delayMs))
      .then(() => withRetry(fn, retries - 1, delayMs));
  });
}