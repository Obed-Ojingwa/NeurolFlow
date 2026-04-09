// src/types/index.ts

export type BrainwaveCategory =
  | 'delta'
  | 'theta'
  | 'alpha'
  | 'beta'
  | 'gamma';

export type SessionMode =
  | 'deep-work'
  | 'study'
  | 'reading'
  | 'meditation'
  | 'sleep'
  | 'brain-awakening';

export type AmbientTrack =
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'wind'
  | 'whitenoise'
  | 'brownoise'
  | 'cafe'
  | 'fire'
  | 'none';

export interface BrainwavePreset {
  id: BrainwaveCategory;
  label: string;
  description: string;
  minHz: number;
  maxHz: number;
  defaultHz: number;
  color: string;
  glowColor: string;
}

export interface SessionPreset {
  id: SessionMode;
  label: string;
  emoji: string;
  description: string;
  brainwave: BrainwaveCategory;
  ambientTrack: AmbientTrack;
  binauralVolume: number; // 0–1
  ambientVolume: number;  // 0–1
  recommendedDuration: number; // minutes
}

export interface AudioState {
  isPlaying: boolean;
  activeSession: SessionMode | null;
  binauralFrequency: number;    // Hz offset (beat frequency)
  carrierFrequency: number;     // Base carrier (e.g. 200 Hz)
  binauralVolume: number;       // 0–1
  ambientVolume: number;        // 0–1
  masterVolume: number;         // 0–1
  activeAmbient: AmbientTrack;
  timerMinutes: number;
  timerActive: boolean;
  timerRemaining: number;       // seconds
}

export interface Message {
  type:
    | 'PLAY'
    | 'PAUSE'
    | 'STOP'
    | 'SET_FREQUENCY'
    | 'SET_BINAURAL_VOLUME'
    | 'SET_AMBIENT_VOLUME'
    | 'SET_MASTER_VOLUME'
    | 'SET_AMBIENT_TRACK'
    | 'SET_SESSION'
    | 'SET_TIMER'
    | 'CANCEL_TIMER'
    | 'GET_STATE'
    | 'STATE_UPDATE';
  payload?: Partial<AudioState> & {
    frequency?: number;
    track?: AmbientTrack;
    session?: SessionMode;
    minutes?: number;
  };
}

export interface CachedAudio {
  url: string;
  blob: Blob;
  cachedAt: number;
  trackId: AmbientTrack;
}