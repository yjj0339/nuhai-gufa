// ============ 钓鱼小游戏 ============
import { S, rand, randi, clamp, toast } from './state.js';
import { FISH, CFG } from './data.js';
import { addItem } from './inv.js';
import { grantXP, lucky } from './upgrades.js';
import { dailyProg } from './daily.js';
import { sfx } from './audio.js';

// bar: 0~1 垂直条；fishY 鱼位置(0~1)；barY 玩家条中心(0~1)；progress
export function startFishing() {
  const p = S.player;
  if (p.swimming) return;
  if (S.fishing) return;
  // 必须在筏/岛边缘附近
  const f = pickFish();
  S.fishing = {
    fishY: 0.5, fishV: 0, fishTarget: 0.5, fishT: 0,
    barY: 0.5, barV: 0, holding: false,
    progress: 0.35, escape: 0, time: 0,
    dur: 6 + f.diff * 3, fish: f, done: false,
  };
  sfx.open();
  toast('咬钩了！按住 收杆 让绿条追住鱼！', '🎣');
}
function pickFish() {
  const night = S.time.frac > 0.78 || S.time.frac < 0.24;
  const pool = FISH.filter(f => !f.nightOnly || night);
  let total = 0;
  for (const f of pool) total += f.w * (night && !f.nightOnly ? 0.7 : 1);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= f.w * (night && !f.nightOnly ? 0.7 : 1);
    if (r <= 0) return f;
  }
  return pool[0];
}
export function updateFishing(dt) {
  const g = S.fishing;
  if (!g) return;
  g.time += dt;
  // 鱼游动：随机目标点 + 缓动
  g.fishT -= dt;
  if (g.fishT <= 0) {
    g.fishT = rand(0.4, 1.4);
    g.fishTarget = rand(0.05, 0.95);
  }
  const fdiff = g.fish.diff;
  g.fishV += (g.fishTarget - g.fishY) * 9 * dt * (1 + fdiff * 0.4);
  g.fishV *= 0.9;
  g.fishY = clamp(g.fishY + g.fishV * dt * 2.2, 0.04, 0.96);
  // 玩家条：按住上升
  const inp = S.input;
  g.holding = !!(inp.attack || inp.fishingHold);
  const acc = g.holding ? -3.4 : 3.0;
  g.barV = clamp(g.barV + acc * dt, -1.6, 1.6);
  g.barY = clamp(g.barY + g.barV * dt, 0.08, 0.92);
  if (g.barY <= 0.08 || g.barY >= 0.92) g.barV = 0;
  // 重叠判定
  const inZone = Math.abs(g.fishY - g.barY) < 0.14;
  g.progress += (inZone ? 0.28 : -0.17) * dt * (1 / (0.7 + fdiff * 0.3));
  g.progress = clamp(g.progress, 0, 1);
  if (g.progress >= 1) return stopFishing(true);
  if (g.time > g.dur && g.progress <= 0.02) return stopFishing(false);
  if (g.time > g.dur + 14) return stopFishing(false);
}
export function stopFishing(success) {
  const g = S.fishing;
  S.fishing = null;
  if (!g) return;
  if (success) {
    const f = g.fish;
    if (lucky()) { addItem(f.id, 2, true); toast('🍀 幸运双咬，一竿双鱼！', '🍀'); }
    else addItem(f.id, 1, true);
    S.stats.fish++;
    if (f.id === 'fish_lantern') S.stats.lantern = 1;
    grantXP(8);
    dailyProg('fish');
    toast(`钓到了 ${f.name}！`, '🐟');
    sfx.fishOn();
    sfx.levelup();
  } else {
    toast('鱼跑掉了…', '💨');
    sfx.error();
  }
}

// 渲染（画布内）
export function drawFishing(ctx, view) {
  const g = S.fishing;
  if (!g) return;
  const W = 64, H = Math.min(300, view.h * 0.36);
  const x = S.isTouch ? 96 : view.w - W - 30, y = view.h * 0.42 - H / 2;
  ctx.save();
  // 底板
  ctx.fillStyle = 'rgba(252,248,238,0.94)';
  ctx.strokeStyle = '#D8CBAA'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - 12, y - 34, W + 24, H + 86, 12); ctx.fill(); ctx.stroke();
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#6A5A3A';
  ctx.fillText(g.fish.name, x + W / 2, y - 14);
  // 条槽
  ctx.fillStyle = 'rgba(120,180,200,0.25)';
  ctx.beginPath(); ctx.roundRect(x, y, W, H, 8); ctx.fill();
  // 进度
  ctx.fillStyle = 'rgba(80,200,130,0.25)';
  ctx.beginPath(); ctx.roundRect(x, y + H * (1 - g.progress), W, H * g.progress, 8); ctx.fill();
  // 玩家绿条
  const bh = H * 0.22;
  ctx.fillStyle = 'rgba(80,200,130,0.75)';
  ctx.beginPath(); ctx.roundRect(x + 4, y + g.barY * H - bh / 2, W - 8, bh, 6); ctx.fill();
  ctx.strokeStyle = '#2E9E5E'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x + 4, y + g.barY * H - bh / 2, W - 8, bh, 6); ctx.stroke();
  // 鱼
  ctx.font = '20px system-ui';
  ctx.fillText(g.fish.id === 'fish_lantern' ? '🏮' : '🐟', x + W / 2, y + g.fishY * H + 7);
  // 提示
  ctx.font = '11px system-ui'; ctx.fillStyle = '#8A7A5A';
  ctx.fillText(g.holding ? '松开下落' : '按住上升', x + W / 2, y + H + 16);
  // 倒计时
  ctx.fillStyle = '#C05A4A';
  ctx.fillText(`坚持 ${Math.max(0, Math.ceil(g.dur - g.time + 14))}s`, x + W / 2, y + H + 34);
  ctx.restore();
}
