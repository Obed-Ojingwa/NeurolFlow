// src/popup/App.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { engine } from '../audio/BinauralEngine';
import { SESSION_PRESETS, BRAINWAVE_PRESETS, AMBIENT_TRACK_URLS } from '../utils/presets';
import type { SessionMode, AudioState, AmbientTrack } from '../types';

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function sendBg(type: string, payload?: object) {
  return chrome.runtime.sendMessage({ type, payload });
}

// ── Waveform Visualizer ───────────────────────────────────────────────────────
function WaveformViz({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const data = engine.getAnalyserData();
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!isPlaying || !data) {
        // Flat line when idle
        ctx.strokeStyle = 'rgba(99,102,241,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, 'rgba(99,102,241,0.8)');
      gradient.addColorStop(0.5, 'rgba(139,92,246,1)');
      gradient.addColorStop(1, 'rgba(99,102,241,0.8)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(139,92,246,0.6)';
      ctx.beginPath();

      const slice = W / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128;
        const y = (v * H) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={48}
      style={{ width: '100%', height: 48, borderRadius: 8, display: 'block' }}
    />
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionMode>('deep-work');
  const [beatHz, setBeatHz] = useState(18);
  const [binVol, setBinVol] = useState(0.6);
  const [ambVol, setAmbVol] = useState(0.5);
  const [masterVol, setMasterVol] = useState(0.8);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [tab, setTab] = useState<'sessions' | 'tune' | 'timer'>('sessions');
  const [loading, setLoading] = useState(false);

  const activePreset = SESSION_PRESETS.find(p => p.id === activeSession)!;
  const brainwave = BRAINWAVE_PRESETS.find(p => p.id === activePreset.brainwave)!;

  // Sync with background on mount
  useEffect(() => {
    sendBg('GET_STATE').then((state: AudioState) => {
      if (!state) return;
      setIsPlaying(state.isPlaying);
      if (state.activeSession) setActiveSession(state.activeSession as SessionMode);
      setBeatHz(state.binauralFrequency);
      setBinVol(state.binauralVolume);
      setAmbVol(state.ambientVolume);
      setMasterVol(state.masterVolume);
      setTimerActive(state.timerActive);
      setTimerRemaining(state.timerRemaining);
    }).catch(() => {});

    // Listen for background timer ticks
    const listener = (msg: { type: string; payload: Partial<AudioState> }) => {
      if (msg.type === 'STATE_UPDATE') {
        if (msg.payload.timerRemaining !== undefined)
          setTimerRemaining(msg.payload.timerRemaining);
        if (msg.payload.timerActive !== undefined)
          setTimerActive(msg.payload.timerActive);
        if (msg.payload.isPlaying !== undefined)
          setIsPlaying(msg.payload.isPlaying);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handlePlayPause = useCallback(async () => {
    setLoading(true);
    try {
      if (isPlaying) {
        await engine.pause();
        await sendBg('PAUSE');
        setIsPlaying(false);
      } else {
        const preset = SESSION_PRESETS.find(p => p.id === activeSession)!;
        const bwPreset = BRAINWAVE_PRESETS.find(p => p.id === preset.brainwave)!;
        const ambUrl = AMBIENT_TRACK_URLS[preset.ambientTrack] ?? '';

        engine.applyPreset(bwPreset.defaultHz, ambUrl, preset.binauralVolume, preset.ambientVolume);
        setBeatHz(bwPreset.defaultHz);
        setBinVol(preset.binauralVolume);
        setAmbVol(preset.ambientVolume);

        await engine.play();
        await sendBg('PLAY');
        await sendBg('SET_SESSION', { session: activeSession });
        setIsPlaying(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isPlaying, activeSession]);

  const handleSessionChange = useCallback(async (id: SessionMode) => {
    setActiveSession(id);
    if (isPlaying) {
      const preset = SESSION_PRESETS.find(p => p.id === id)!;
      const bwPreset = BRAINWAVE_PRESETS.find(p => p.id === preset.brainwave)!;
      const ambUrl = AMBIENT_TRACK_URLS[preset.ambientTrack] ?? '';
      engine.applyPreset(bwPreset.defaultHz, ambUrl, preset.binauralVolume, preset.ambientVolume);
      setBeatHz(bwPreset.defaultHz);
      setBinVol(preset.binauralVolume);
      setAmbVol(preset.ambientVolume);
    }
    await sendBg('SET_SESSION', { session: id });
  }, [isPlaying]);

  const handleBeatHz = useCallback((v: number) => {
    setBeatHz(v);
    engine.setBeatFrequency(v);
    sendBg('SET_FREQUENCY', { frequency: v });
  }, []);

  const handleBinVol = useCallback((v: number) => {
    setBinVol(v);
    engine.setBinauralVolume(v);
    sendBg('SET_BINAURAL_VOLUME', { binauralVolume: v });
  }, []);

  const handleAmbVol = useCallback((v: number) => {
    setAmbVol(v);
    engine.setAmbientVolume(v);
    sendBg('SET_AMBIENT_VOLUME', { ambientVolume: v });
  }, []);

  const handleMasterVol = useCallback((v: number) => {
    setMasterVol(v);
    engine.setMasterVolume(v);
    sendBg('SET_MASTER_VOLUME', { masterVolume: v });
  }, []);

  const handleSetTimer = useCallback(async (mins: number) => {
    setTimerMinutes(mins);
    if (mins > 0) {
      setTimerRemaining(mins * 60);
      setTimerActive(true);
      await sendBg('SET_TIMER', { minutes: mins });
    } else {
      setTimerActive(false);
      setTimerRemaining(0);
      await sendBg('CANCEL_TIMER');
    }
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">NeuroFlow</span>
        </div>
        <div className="badge" style={{ background: brainwave.glowColor, color: brainwave.color }}>
          {brainwave.label} · {beatHz.toFixed(1)} Hz
        </div>
      </header>

      {/* Waveform */}
      <div className="waveform-container">
        <WaveformViz isPlaying={isPlaying} />
      </div>

      {/* Play Control */}
      <div className="play-section">
        <button
          className={`play-btn ${isPlaying ? 'playing' : ''} ${loading ? 'loading' : ''}`}
          onClick={handlePlayPause}
          disabled={loading}
          style={{ '--glow': brainwave.glowColor, '--accent': brainwave.color } as React.CSSProperties}
        >
          {loading ? (
            <span className="spinner" />
          ) : isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z"/>
            </svg>
          )}
          <span>{loading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {timerActive && (
          <div className="timer-display">
            <span className="timer-icon">⏱</span>
            {fmtTime(timerRemaining)}
          </div>
        )}
      </div>

      {/* Master Volume (always visible) */}
      <div className="master-vol">
        <span className="vol-icon">🔊</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={masterVol}
          onChange={e => handleMasterVol(+e.target.value)}
          className="slider master-slider"
        />
        <span className="vol-pct">{Math.round(masterVol * 100)}%</span>
      </div>

      {/* Tab Bar */}
      <div className="tabs">
        {(['sessions', 'tune', 'timer'] as const).map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'sessions' ? '⚡ Sessions' : t === 'tune' ? '🎚 Tune' : '⏱ Timer'}
          </button>
        ))}
      </div>

      {/* ── Sessions Tab ── */}
      {tab === 'sessions' && (
        <div className="panel sessions-panel">
          {SESSION_PRESETS.map(p => {
            const bw = BRAINWAVE_PRESETS.find(b => b.id === p.brainwave)!;
            return (
              <button
                key={p.id}
                className={`session-card ${activeSession === p.id ? 'active' : ''}`}
                onClick={() => handleSessionChange(p.id)}
                style={activeSession === p.id
                  ? { borderColor: bw.color, boxShadow: `0 0 0 1px ${bw.color}, 0 4px 20px ${bw.glowColor}` }
                  : {}}
              >
                <span className="session-emoji">{p.emoji}</span>
                <div className="session-info">
                  <span className="session-label">{p.label}</span>
                  <span className="session-desc">{p.description}</span>
                </div>
                <span className="session-bw" style={{ color: bw.color }}>{bw.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tune Tab ── */}
      {tab === 'tune' && (
        <div className="panel tune-panel">
          <div className="tune-row">
            <label className="tune-label">
              Beat Frequency
              <span className="tune-val">{beatHz.toFixed(1)} Hz</span>
            </label>
            <input
              type="range"
              min={brainwave.minHz} max={brainwave.maxHz} step={0.5}
              value={beatHz}
              onChange={e => handleBeatHz(+e.target.value)}
              className="slider"
            />
            <div className="range-labels">
              <span>{brainwave.minHz} Hz</span>
              <span>{brainwave.maxHz} Hz</span>
            </div>
          </div>

          <div className="tune-row">
            <label className="tune-label">
              Binaural Intensity
              <span className="tune-val">{Math.round(binVol * 100)}%</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.01}
              value={binVol}
              onChange={e => handleBinVol(+e.target.value)}
              className="slider"
            />
          </div>

          <div className="tune-row">
            <label className="tune-label">
              Ambient Level
              <span className="tune-val">{Math.round(ambVol * 100)}%</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.01}
              value={ambVol}
              onChange={e => handleAmbVol(+e.target.value)}
              className="slider"
            />
          </div>

          {/* Brainwave quick-select */}
          <div className="bw-chips">
            {BRAINWAVE_PRESETS.map(bw => (
              <button
                key={bw.id}
                className={`bw-chip ${brainwave.id === bw.id ? 'active' : ''}`}
                style={brainwave.id === bw.id
                  ? { background: bw.glowColor, borderColor: bw.color, color: bw.color }
                  : {}}
                onClick={() => handleBeatHz(bw.defaultHz)}
              >
                {bw.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Timer Tab ── */}
      {tab === 'timer' && (
        <div className="panel timer-panel">
          <p className="timer-hint">
            {timerActive
              ? `Session ends in ${fmtTime(timerRemaining)}`
              : 'Set a focus session duration'}
          </p>
          <div className="timer-grid">
            {[5, 10, 15, 20, 25, 30, 45, 60, 90].map(m => (
              <button
                key={m}
                className={`timer-btn ${timerMinutes === m && timerActive ? 'active' : ''}`}
                onClick={() => handleSetTimer(timerActive && timerMinutes === m ? 0 : m)}
              >
                {m}m
              </button>
            ))}
          </div>
          {timerActive && (
            <button className="cancel-timer" onClick={() => handleSetTimer(0)}>
              Cancel Timer
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>Use headphones for binaural effect</span>
      </footer>
    </div>
  );
}