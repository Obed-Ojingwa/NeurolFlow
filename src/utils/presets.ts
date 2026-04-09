// src/utils/presets.ts
import type { BrainwavePreset, SessionPreset } from '../types';

export const BRAINWAVE_PRESETS: BrainwavePreset[] = [
  {
    id: 'delta',
    label: 'Delta',
    description: 'Deep sleep & restoration',
    minHz: 0.5,
    maxHz: 4,
    defaultHz: 2,
    color: '#4f46e5',
    glowColor: 'rgba(79,70,229,0.4)',
  },
  {
    id: 'theta',
    label: 'Theta',
    description: 'Meditation & creativity',
    minHz: 4,
    maxHz: 8,
    defaultHz: 6,
    color: '#7c3aed',
    glowColor: 'rgba(124,58,237,0.4)',
  },
  {
    id: 'alpha',
    label: 'Alpha',
    description: 'Relaxed alertness',
    minHz: 8,
    maxHz: 12,
    defaultHz: 10,
    color: '#0891b2',
    glowColor: 'rgba(8,145,178,0.4)',
  },
  {
    id: 'beta',
    label: 'Beta',
    description: 'Focus & cognition',
    minHz: 12,
    maxHz: 30,
    defaultHz: 18,
    color: '#059669',
    glowColor: 'rgba(5,150,105,0.4)',
  },
  {
    id: 'gamma',
    label: 'Gamma',
    description: 'Peak performance',
    minHz: 30,
    maxHz: 100,
    defaultHz: 40,
    color: '#d97706',
    glowColor: 'rgba(217,119,6,0.4)',
  },
];

export const SESSION_PRESETS: SessionPreset[] = [
  {
    id: 'deep-work',
    label: 'Deep Work',
    emoji: '⚡',
    description: 'Eliminate distractions, enter flow state',
    brainwave: 'beta',
    ambientTrack: 'brownoise',
    binauralVolume: 0.6,
    ambientVolume: 0.4,
    recommendedDuration: 90,
  },
  {
    id: 'study',
    label: 'Study',
    emoji: '📚',
    description: 'Absorb information efficiently',
    brainwave: 'alpha',
    ambientTrack: 'cafe',
    binauralVolume: 0.5,
    ambientVolume: 0.5,
    recommendedDuration: 50,
  },
  {
    id: 'reading',
    label: 'Reading',
    emoji: '📖',
    description: 'Calm focus for sustained reading',
    brainwave: 'alpha',
    ambientTrack: 'rain',
    binauralVolume: 0.45,
    ambientVolume: 0.55,
    recommendedDuration: 45,
  },
  {
    id: 'meditation',
    label: 'Meditation',
    emoji: '🧘',
    description: 'Quiet the mind, deepen awareness',
    brainwave: 'theta',
    ambientTrack: 'forest',
    binauralVolume: 0.7,
    ambientVolume: 0.3,
    recommendedDuration: 20,
  },
  {
    id: 'sleep',
    label: 'Sleep',
    emoji: '🌙',
    description: 'Drift into deep, restorative sleep',
    brainwave: 'delta',
    ambientTrack: 'ocean',
    binauralVolume: 0.55,
    ambientVolume: 0.45,
    recommendedDuration: 30,
  },
  {
    id: 'brain-awakening',
    label: 'Brain Boost',
    emoji: '🧠',
    description: 'Sharpen cognition, ignite creativity',
    brainwave: 'gamma',
    ambientTrack: 'wind',
    binauralVolume: 0.65,
    ambientVolume: 0.35,
    recommendedDuration: 25,
  },
];

export const AMBIENT_TRACK_URLS: Record<string, string> = {
  // Using royalty-free CDN URLs (Pixabay / public domain)
  rain:       'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
  ocean:      'https://cdn.pixabay.com/audio/2021/08/09/audio_dc39bede17.mp3',
  forest:     'https://cdn.pixabay.com/audio/2022/01/18/audio_d1718ab41b.mp3',
  wind:       'https://cdn.pixabay.com/audio/2022/09/07/audio_27e6cc3fce.mp3',
  whitenoise: 'https://cdn.pixabay.com/audio/2022/04/07/audio_d1f27adb72.mp3',
  brownoise:  'https://cdn.pixabay.com/audio/2023/01/05/audio_1ec0f1de42.mp3',
  cafe:       'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
  fire:       'https://cdn.pixabay.com/audio/2022/03/23/audio_febc508520.mp3',
  none:       '',
};

export const getBrainwavePreset = (id: string): BrainwavePreset =>
  BRAINWAVE_PRESETS.find(p => p.id === id) ?? BRAINWAVE_PRESETS[3];

export const getSessionPreset = (id: string): SessionPreset =>
  SESSION_PRESETS.find(p => p.id === id) ?? SESSION_PRESETS[0];