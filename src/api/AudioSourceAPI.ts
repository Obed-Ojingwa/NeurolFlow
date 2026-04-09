// src/api/AudioSourceAPI.ts
/**
 * NeuroFlow Audio Source Integrations
 *
 * Free & legal audio sources:
 * 1. Pixabay Audio CDN  — royalty-free, no API key needed
 * 2. Freesound.org API  — requires free account API key
 * 3. Archive.org API    — public domain audio
 * 4. Custom Backend     — optional self-hosted tracks
 */

export interface AudioTrackResult {
  id: string;
  name: string;
  url: string;
  duration: number;
  source: 'pixabay' | 'freesound' | 'archive' | 'custom';
  license: string;
}

// ── 1. Pixabay (no API key, CDN direct) ──────────────────────────────────────
// Tracks are referenced by direct CDN URL — see presets.ts AMBIENT_TRACK_URLS

// ── 2. Freesound.org API ──────────────────────────────────────────────────────
export class FreesoundAPI {
  private readonly baseURL = 'https://api.freesound.org/v2';
  // Store API key securely in browser storage, NOT hardcoded
  private apiKey: string | null = null;

  async loadApiKey(): Promise<void> {
    const result = await chrome.storage.local.get('freesoundApiKey');
    this.apiKey = result.freesoundApiKey ?? null;
  }

  async saveApiKey(key: string): Promise<void> {
    await chrome.storage.local.set({ freesoundApiKey: key });
    this.apiKey = key;
  }

  async searchAmbient(query: string, limit = 5): Promise<AudioTrackResult[]> {
    if (!this.apiKey) {
      console.warn('[NeuroFlow] Freesound API key not configured');
      return [];
    }

    const params = new URLSearchParams({
      query,
      filter: 'duration:[30 TO 300] license:"Creative Commons 0"',
      fields: 'id,name,previews,duration,license',
      page_size: String(limit),
      token: this.apiKey,
    });

    try {
      const response = await fetch(`${this.baseURL}/search/text/?${params}`);
      if (!response.ok) throw new Error(`Freesound API error: ${response.status}`);

      const data = await response.json();
      return (data.results ?? []).map((r: Record<string, unknown>) => ({
        id: String(r['id']),
        name: String(r['name']),
        url: (r['previews'] as Record<string, string>)['preview-hq-mp3'],
        duration: Number(r['duration']),
        source: 'freesound' as const,
        license: String(r['license']),
      }));
    } catch (err) {
      console.error('[NeuroFlow] Freesound search failed:', err);
      return [];
    }
  }
}

// ── 3. Archive.org (Public Domain) ───────────────────────────────────────────
export class ArchiveOrgAPI {
  private readonly baseURL = 'https://archive.org';

  async searchAmbient(query: string): Promise<AudioTrackResult[]> {
    const params = new URLSearchParams({
      q: `${query} AND mediatype:audio AND licenseurl:*creativecommons*`,
      fl: 'identifier,title,avg_rating',
      sort: 'downloads desc',
      rows: '5',
      output: 'json',
    });

    try {
      const response = await fetch(`${this.baseURL}/advancedsearch.php?${params}`);
      const data = await response.json();

      return (data.response?.docs ?? []).map((r: Record<string, string>) => ({
        id: r['identifier'],
        name: r['title'],
        url: `${this.baseURL}/download/${r['identifier']}/${r['identifier']}.mp3`,
        duration: 180,
        source: 'archive' as const,
        license: 'Creative Commons',
      }));
    } catch (err) {
      console.error('[NeuroFlow] Archive.org search failed:', err);
      return [];
    }
  }
}

// ── 4. Custom Backend API ─────────────────────────────────────────────────────
export class NeuroFlowBackendAPI {
  // Replace with your Vercel/Railway/Fly.io deployment URL
  private readonly baseURL = 'https://api.neuroflow.app';

  async getPremiumTracks(category: string, userToken: string): Promise<AudioTrackResult[]> {
    try {
      const response = await fetch(`${this.baseURL}/tracks/${category}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Premium API error');
      const data = await response.json();
      return data.tracks ?? [];
    } catch (err) {
      console.error('[NeuroFlow] Backend API failed:', err);
      return [];
    }
  }

  async getSubscriptionStatus(userToken: string): Promise<{ isPremium: boolean; expiresAt: string }> {
    const response = await fetch(`${this.baseURL}/subscription`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    return response.json();
  }
}

// ── Audio Caching (Service Worker + IndexedDB) ────────────────────────────────
export class AudioCache {
  private readonly DB_NAME = 'neuroflow-audio';
  private readonly STORE  = 'tracks';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(this.STORE, { keyPath: 'url' });
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async cacheTrack(url: string, blob: Blob): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).put({ url, blob, cachedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getCachedTrack(url: string): Promise<Blob | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx  = this.db!.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).get(url);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  async fetchWithCache(url: string): Promise<string> {
    const cached = await this.getCachedTrack(url);
    if (cached) {
      return URL.createObjectURL(cached);
    }

    const response = await fetch(url);
    const blob = await response.blob();
    await this.cacheTrack(url, blob);
    return URL.createObjectURL(blob);
  }
}

// Singleton exports
export const freesoundAPI = new FreesoundAPI();
export const archiveAPI = new ArchiveOrgAPI();
export const audioCache = new AudioCache();
export const backendAPI = new NeuroFlowBackendAPI();