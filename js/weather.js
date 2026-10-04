// ============ 天气 / 昼夜 / 风向 ============
import { S, rand, randi, toast, clamp } from './state.js';
import { DAY_LEN, CFG } from './data.js';
import { sfx } from './audio.js';

const WEATHERS = [
  { type: 'sunny', w: 34, dur: [90, 200] },
  { type: 'cloudy', w: 24, dur: [60, 140] },
  { type: 'windy', w: 14, dur: [50, 110] },
  { type: 'rain', w: 12, dur: [50, 110] },
  { type: 'storm', w: 7, dur: [35, 70] },
  { type: 'foggy', w: 9, dur: [40, 90] },
];
export const WEATHER_NAMES = { sunny: '☀️ 晴朗', cloudy: '⛅ 多云', windy: '🌬️ 大风', rain: '🌧️ 下雨', storm: '⛈️ 暴风雨', foggy: '🌫️ 薄雾' };

export function initWeather() {
  S.weather = { type: 'sunny', timer: rand(80, 140), intensity: 0, flash: 0, rainbow: 0, drops: [] };
  S.wind.dir = rand(0, Math.PI * 2);
  S.wind.strength = rand(0.4, 0.8);
  S.windTarget = 0;
  makeDrops();
}
function makeDrops() {
  S.weather.drops = [];
  for (let i = 0; i < 130; i++) {
    S.weather.drops.push({ x: Math.random(), y: Math.random(), spd: rand(0.7, 1.3), len: rand(8, 18) });
  }
}
function nextWeather() {
  let total = 0;
  for (const w of WEATHERS) total += w.w;
  let r = Math.random() * total;
  let pick = WEATHERS[0];
  for (const w of WEATHERS) { r -= w.w; if (r <= 0) { pick = w; break; } }
  const prev = S.weather.type;
  S.weather.type = pick.type;
  S.weather.timer = rand(pick.dur[0], pick.dur[1]);
  if (pick.type === 'storm' || pick.type === 'rain') {
    S.wind.strength = rand(0.7, 1);
    if (pick.type === 'storm') { S.wind.dir += rand(-1.2, 1.2); }
  } else S.wind.strength = pick.type === 'windy' ? rand(0.85, 1) : pick.type === 'foggy' ? rand(0.15, 0.35) : rand(0.35, 0.7);
  if (prev !== pick.type) {
    toast(`天气变化：${WEATHER_NAMES[pick.type]}`, pick.type === 'storm' ? '⛈️' : '🌤️');
    if (pick.type === 'rain' || pick.type === 'storm') sfx.rain();
    if (prev === 'rain' || prev === 'storm') {
      S.weather.rainbow = 7;
      toast('雨过天晴，彩虹升起来了！鱼儿也更活跃', '🌈');
    }
  }
}

export function updateWeather(dt) {
  const W = S.weather;
  // 昼夜
  S.time.frac += dt / DAY_LEN;
  if (S.time.frac >= 1) {
    S.time.frac -= 1;
    S.time.day++;
    toast(`第 ${S.time.day} 天开始了`, '📅');
    sfx.bell();
  }
  if (S.time.frac > 0.24 && S.time.frac < 0.3) S.stats.days = Math.max(S.stats.days, S.time.day);
  // 风向缓慢摆动
  S.wind.dir += Math.sin(S.t * 0.05) * dt * 0.05;
  // 天气切换
  W.timer -= dt;
  if (W.timer <= 0) nextWeather();
  W.intensity = W.type === 'rain' ? clamp(W.intensity + dt * 0.5, 0, 0.7) :
    W.type === 'storm' ? clamp(W.intensity + dt * 0.5, 0, 1) :
      clamp(W.intensity - dt * 0.4, 0, 1);
  if (W.rainbow > 0) W.rainbow -= dt;
  // 雷电
  if (W.type === 'storm') {
    W._thT = (W._thT || rand(4, 9)) - dt;
    if (W._thT <= 0) { W._thT = rand(5, 13); W.flash = 0.9; sfx.thunder(); S.shakeT = 0.3; }
  }
  if (W.flash > 0) W.flash -= dt * 1.6;
  // 暴风雨：未抛锚且帆未收 → 有概率咬/损坏？改为：风暴中木筏摇晃，玩家行走速度略降
}

// 夜晚系数 0~1
export function nightFactor() {
  const f = S.time.frac;
  // 18:30(0.77)~5:30(0.23) 为夜
  if (f > 0.8 || f < 0.2) return 1;
  if (f > 0.72) return (f - 0.72) / 0.08;
  if (f < 0.28) return 1 - (f - 0.2) / 0.08;
  return 0;
}

// ---------------- 渲染覆盖层（屏幕空间） ----------------
export function drawWeatherOverlay(ctx, view, t) {
  const W = S.weather;
  const { w, h } = view;
  // 云
  drawClouds(ctx, view, t);
  // 雨滴
  if (W.intensity > 0.05) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180,215,240,0.55)';
    ctx.lineWidth = 1.6;
    const n = W.type === 'storm' ? S.weather.drops.length : Math.floor(S.weather.drops.length * 0.6);
    const wx = Math.sin(S.wind.dir) * 120;
    for (let i = 0; i < n; i++) {
      const d = S.weather.drops[i];
      const yy = ((d.y + t * d.spd * 0.55) % 1) * (h + 60) - 30;
      const xx = ((d.x + t * 0.02 * d.spd) % 1) * (w + 200) - 100 + (yy / h) * wx;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - wx * 0.12, yy + d.len); ctx.stroke();
    }
    ctx.restore();
  }
  // 闪电
  if (W.flash > 0) {
    ctx.fillStyle = `rgba(240,245,255,${Math.min(0.55, W.flash * 0.55)})`;
    ctx.fillRect(0, 0, w, h);
    if (W.flash > 0.55) {
      ctx.strokeStyle = 'rgba(250,250,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let lx = w * (0.2 + Math.random() * 0.6), ly = 0;
      ctx.moveTo(lx, ly);
      for (let i = 0; i < 6; i++) { lx += (Math.random() - 0.5) * 70; ly += h / 7; ctx.lineTo(lx, ly); }
      ctx.stroke();
    }
  }
  // 彩虹
  if (W.rainbow > 0) {
    const a = Math.min(1, W.rainbow / 7) * 0.4;
    ctx.save();
    ctx.translate(w * 0.62, h * 0.9);
    ctx.rotate(-0.3);
    const colors = ['#FF8A8A', '#FFC46B', '#FFE88A', '#9FE8A0', '#8AC8FF', '#B49FFF'];
    colors.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.globalAlpha = a; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, 240 - i * 8, Math.PI, 0); ctx.stroke();
    });
    ctx.restore();
  }
  // 薄雾
  if (S.weather.type === 'foggy') {
    const fg = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.75);
    const fa = 0.5 + 0.06 * Math.sin(t * 0.7);
    fg.addColorStop(0, 'rgba(235,242,246,0.12)');
    fg.addColorStop(1, `rgba(226,236,242,${fa})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, w, h);
    // 飘雾带
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const fy = (i * 0.23 + 0.12) * h + Math.sin(t * 0.4 + i * 2) * 24;
      const fgx = ((t * (8 + i * 5)) % (w + 700)) - 350;
      const g2 = ctx.createLinearGradient(fgx - 320, 0, fgx + 320, 0);
      g2.addColorStop(0, 'rgba(238,244,248,0)');
      g2.addColorStop(0.5, 'rgba(238,244,248,0.34)');
      g2.addColorStop(1, 'rgba(238,244,248,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(fgx - 320, fy - 34, 640, 68);
    }
    ctx.restore();
  }
  // 夜幕
  const nf = nightFactor();
  if (nf > 0.01) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(24,38,92,${0.5 * nf})`);
    g.addColorStop(1, `rgba(16,28,70,${0.42 * nf})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 星星
    if (S.settings.quality !== 'low') {
      ctx.fillStyle = `rgba(255,255,240,${0.85 * nf})`;
      for (let i = 0; i < 40; i++) {
        const sx = (Math.abs(Math.sin(i * 78.233) * 43758.55) % 1) * w;
        const sy = (Math.abs(Math.sin(i * 12.9898) * 22578.14) % 1) * h * 0.55;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
        ctx.globalAlpha = tw * nf * 0.9;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // 月亮
    const mx = w * 0.82, my = h * 0.16;
    ctx.fillStyle = `rgba(250,245,220,${0.95 * nf})`;
    ctx.beginPath(); ctx.arc(mx, my, 26, 0, 6.29); ctx.fill();
    ctx.fillStyle = `rgba(210,205,180,${0.5 * nf})`;
    ctx.beginPath(); ctx.arc(mx - 8, my - 4, 5, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 7, my + 6, 3.4, 0, 6.29); ctx.fill();
    // 流星许愿
    if (nf > 0.9 && Math.random() < 0.002) {
      S.meteor = { x: Math.random() * w, y: Math.random() * h * 0.3, t: 0.8, a: rand(2.4, 2.9) };
      if (S.meteor) toast('流星划过夜空！', '💫');
    }
  }
  if (S.meteor) {
    const m = S.meteor;
    m.t -= 1 / 60;
    m.x += Math.cos(m.a) * 14; m.y += Math.sin(m.a) * 14;
    ctx.save();
    ctx.strokeStyle = `rgba(255,250,220,${m.t})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - Math.cos(m.a) * 60, m.y - Math.sin(m.a) * 60); ctx.stroke();
    ctx.restore();
    if (m.t <= 0) S.meteor = null;
  }
}
function drawClouds(ctx, view, t) {
  const W = S.weather;
  const density = W.type === 'storm' ? 9 : W.type === 'rain' ? 7 : W.type === 'cloudy' ? 5 : W.type === 'windy' ? 4 : 2;
  const dark = W.type === 'storm' ? 0.55 : W.type === 'rain' ? 0.4 : 0.22;
  ctx.save();
  const scroll = (t * (10 + S.wind.strength * 26)) % (view.w + 500);
  for (let i = 0; i < density; i++) {
    const seed = i * 97.13;
    const bx = ((Math.abs(Math.sin(seed) * 43758.5) % 1) * (view.w + 500) - scroll - 250 + view.w) % (view.w + 500) - 250;
    const by = 30 + (Math.abs(Math.sin(seed * 1.7) * 12578.5) % 1) * view.h * 0.3;
    const s = 0.7 + (Math.abs(Math.sin(seed * 2.3) * 34578.5) % 1) * 0.9;
    ctx.fillStyle = `rgba(${W.type === 'storm' ? '110,125,145' : '255,255,255'},${dark + 0.35})`;
    ctx.beginPath();
    ctx.arc(bx, by, 26 * s, 0, 6.29);
    ctx.arc(bx + 24 * s, by - 8 * s, 20 * s, 0, 6.29);
    ctx.arc(bx + 46 * s, by, 24 * s, 0, 6.29);
    ctx.arc(bx + 22 * s, by + 9 * s, 20 * s, 0, 6.29);
    ctx.fill();
  }
  ctx.restore();
}
