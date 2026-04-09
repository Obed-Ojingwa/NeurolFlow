// src/background/service-worker.ts
/**
 * NeuroFlow Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Manages timer/alarms for focus and sleep sessions
 * - Routes messages between popup and offscreen audio context
 * - Handles cross-browser compat shims
 * - Manages state persistence in chrome.storage
 */

import type { AudioState, Message } from '../types';

// ── Default state ─────────────────────────────────────────────────────────────
const DEFAULT_STATE: AudioState = {
  isPlaying: false,
  activeSession: null,
  binauralFrequency: 18,
  carrierFrequency: 200,
  binauralVolume: 0.6,
  ambientVolume: 0.5,
  masterVolume: 0.8,
  activeAmbient: 'none',
  timerMinutes: 0,
  timerActive: false,
  timerRemaining: 0,
};

// ── State Management ──────────────────────────────────────────────────────────
async function getState(): Promise<AudioState> {
  const result = await chrome.storage.local.get('audioState');
  return result.audioState ?? DEFAULT_STATE;
}

async function setState(partial: Partial<AudioState>): Promise<AudioState> {
  const current = await getState();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ audioState: next });
  return next;
}

// ── Alarm / Timer ─────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'neuroflow-session-end') {
    await setState({ isPlaying: false, timerActive: false, timerRemaining: 0 });

    // Notify all popup instances
    chrome.runtime.sendMessage({
      type: 'STATE_UPDATE',
      payload: { isPlaying: false, timerActive: false, timerRemaining: 0 },
    } as Message).catch(() => {});

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'NeuroFlow — Session Complete',
      message: 'Your focus session has ended. Great work!',
      priority: 1,
    });
  }

  if (alarm.name === 'neuroflow-timer-tick') {
    const state = await getState();
    if (!state.timerActive || state.timerRemaining <= 0) {
      chrome.alarms.clear('neuroflow-timer-tick');
      return;
    }
    const remaining = Math.max(0, state.timerRemaining - 1);
    await setState({ timerRemaining: remaining });
    chrome.runtime.sendMessage({
      type: 'STATE_UPDATE',
      payload: { timerRemaining: remaining },
    } as Message).catch(() => {});
  }
});

// ── Message Handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(console.error);
    return true; // keep async channel open
  }
);

async function handleMessage(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'GET_STATE':
      return getState();

    case 'PLAY': {
      const state = await setState({ isPlaying: true });
      return state;
    }

    case 'PAUSE': {
      const state = await setState({ isPlaying: false });
      return state;
    }

    case 'STOP': {
      await chrome.alarms.clear('neuroflow-session-end');
      await chrome.alarms.clear('neuroflow-timer-tick');
      const state = await setState({
        isPlaying: false,
        timerActive: false,
        timerRemaining: 0,
      });
      return state;
    }

    case 'SET_SESSION': {
      const state = await setState({ activeSession: msg.payload?.session ?? null });
      return state;
    }

    case 'SET_FREQUENCY': {
      const state = await setState({ binauralFrequency: msg.payload?.frequency ?? 18 });
      return state;
    }

    case 'SET_BINAURAL_VOLUME': {
      const state = await setState({ binauralVolume: msg.payload?.binauralVolume ?? 0.6 });
      return state;
    }

    case 'SET_AMBIENT_VOLUME': {
      const state = await setState({ ambientVolume: msg.payload?.ambientVolume ?? 0.5 });
      return state;
    }

    case 'SET_MASTER_VOLUME': {
      const state = await setState({ masterVolume: msg.payload?.masterVolume ?? 0.8 });
      return state;
    }

    case 'SET_AMBIENT_TRACK': {
      const state = await setState({ activeAmbient: msg.payload?.track ?? 'none' });
      return state;
    }

    case 'SET_TIMER': {
      const minutes = msg.payload?.minutes ?? 0;
      if (minutes > 0) {
        await chrome.alarms.create('neuroflow-session-end', {
          delayInMinutes: minutes,
        });
        await chrome.alarms.create('neuroflow-timer-tick', {
          periodInMinutes: 1 / 60, // every second
        });
        const state = await setState({
          timerMinutes: minutes,
          timerActive: true,
          timerRemaining: minutes * 60,
        });
        return state;
      }
      return getState();
    }

    case 'CANCEL_TIMER': {
      await chrome.alarms.clear('neuroflow-session-end');
      await chrome.alarms.clear('neuroflow-timer-tick');
      const state = await setState({
        timerActive: false,
        timerRemaining: 0,
        timerMinutes: 0,
      });
      return state;
    }

    default:
      return getState();
  }
}

// ── Installation Handler ──────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({ audioState: DEFAULT_STATE });
    console.log('[NeuroFlow] Extension installed successfully.');
  }
});