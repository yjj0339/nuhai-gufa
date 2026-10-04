// ============ WebAudio 程序化音效 & 环境 ============
import { S } from './state.js';

let AC = null, master = null, musicGain = null, sfxGain = null;
let musicTimer = 0, waveTimer = 0, started = false;

export function initAudio() {
  if (started) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    sfxGain = AC.createGain(); sfxGain.gain.value = S.settings.sfx; sfxGain.connect(master);
    musicGain = AC.createGain(); musicGain.gain.value = S.settings.music * 0.5; musicGain.connect(master);
    started = true;
  } catch (e) { /* 无音频环境 */ }
}
export function setVolumes() {
  if (!AC) return;
  sfxGain.gain.value = S.settings.sfx;
  musicGain.gain.value = S.settings.music * 0.5;
}
export function resumeAudio() { if (AC && AC.state === 'suspended') AC.resume(); }

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  if (!AC) return;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 800, q = 1, delay = 0) {
  if (!AC) return;
  const t0 = AC.currentTime + delay;
  const len = Math.max(1, Math.floor(AC.sampleRate * dur));
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0);
}

// ---------------- 具名音效 ----------------
export const sfx = {
  splash:  () => { noise(0.35, 0.5, 900, 0.8); tone(300, 0.2, 'sine', 0.15, -150); },
  hookOut: () => tone(500, 0.15, 'square', 0.12, 300),
  hookGot: () => { tone(660, 0.1, 'sine', 0.25); tone(880, 0.12, 'sine', 0.2, 0, 0.08); },
  pickup:  () => tone(720, 0.09, 'triangle', 0.22, 120),
  place:   () => { tone(220, 0.12, 'square', 0.2); noise(0.15, 0.25, 500, 1); },
  craft:   () => { tone(520, 0.1, 'triangle', 0.25); tone(700, 0.12, 'triangle', 0.22, 0, 0.09); tone(920, 0.14, 'triangle', 0.18, 0, 0.18); },
  eat:     () => { noise(0.12, 0.3, 1200, 2); noise(0.12, 0.25, 900, 2, 0.13); },
  drink:   () => { tone(400, 0.3, 'sine', 0.15, 250); },
  hit:     () => { noise(0.15, 0.5, 300, 0.7); tone(140, 0.18, 'square', 0.25, -60); },
  sharkBite: () => { noise(0.25, 0.6, 200, 0.5); tone(90, 0.3, 'sawtooth', 0.3, -30); },
  sharkFlee: () => tone(200, 0.5, 'sawtooth', 0.2, -120),
  gull:    () => { tone(1100, 0.14, 'sawtooth', 0.1, -250); tone(950, 0.12, 'sawtooth', 0.08, -200, 0.15); },
  fishOn:  () => { tone(880, 0.1, 'sine', 0.3); noise(0.4, 0.35, 1400, 0.6, 0.05); },
  quest:   () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, 0, i * 0.12)); },
  achv:    () => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.25, 'sine', 0.22, 0, i * 0.1)); },
  thunder: () => { noise(1.4, 0.8, 120, 0.4); noise(0.8, 0.5, 300, 0.3, 0.1); },
  rain:    () => noise(0.6, 0.12, 3000, 0.3),
  hurt:    () => tone(180, 0.25, 'sawtooth', 0.3, -80),
  dive:    () => { noise(0.5, 0.4, 600, 0.7); tone(200, 0.4, 'sine', 0.2, -100); },
  open:    () => { tone(440, 0.06, 'square', 0.12); tone(560, 0.06, 'square', 0.12, 0, 0.05); },
  error:   () => tone(160, 0.18, 'square', 0.2, -40),
  bell:    () => { tone(880, 0.8, 'sine', 0.3, -10); tone(1320, 0.6, 'sine', 0.15); },
  chest:   () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, 0, i * 0.09)); },
  levelup: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'square', 0.15, 0, i * 0.08)); },
};

// ---------------- 环境层（海浪白噪 + 音乐琶音） ----------------
export function updateAmbient(dt) {
  if (!AC || S.mode !== 'play') return;
  waveTimer -= dt;
  if (waveTimer <= 0) {
    waveTimer = 2.6 + Math.random() * 2;
    // 环境浪声直接接 musicGain，不受 sfx 开关影响
    const t0 = AC.currentTime;
    const len = Math.floor(AC.sampleRate * 2.2);
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.sin(p * Math.PI) * 0.35;
    }
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 300;
    const g = AC.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(t0);
  }
  if (S.weather.type === 'rain' || S.weather.type === 'storm') {
    musicTimer -= dt;
    if (musicTimer <= 0) { musicTimer = 0.8; sfx.rain(); }
  }
  // 悠闲 BGM（随天气/昼夜换调式）
  S._bgmT = (S._bgmT || 0) - dt;
  if (S._bgmT <= 0) {
    S._bgmT = 1.9 + Math.random() * 1.4;
    const night = S.time.frac > 0.75 || S.time.frac < 0.25;
    let scale;
    if (S.weather.type === 'storm') scale = [174.6, 196, 233.1, 261.6, 311.1];
    else if (S.weather.type === 'rain') scale = [196, 220, 246.9, 293.7, 329.6];
    else if (night) scale = [261.6, 311.1, 349.2, 392, 466.2];
    else scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    const n = scale[Math.floor(Math.random() * scale.length)];
    const t0 = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = n * (Math.random() < 0.3 ? 0.5 : 1);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(S.weather.type === 'storm' ? 0.07 : 0.09, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.4);
    o.connect(g); g.connect(musicGain);
    o.start(t0); o.stop(t0 + 2.5);
    if (Math.random() < 0.4) {
      const o2 = AC.createOscillator(), g2 = AC.createGain();
      o2.type = 'sine'; o2.frequency.value = n * 1.5;
      g2.gain.setValueAtTime(0.001, t0 + 0.15);
      g2.gain.linearRampToValueAtTime(0.05, t0 + 0.5);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 2);
      o2.connect(g2); g2.connect(musicGain);
      o2.start(t0 + 0.1); o2.stop(t0 + 2.2);
    }
  }
}
