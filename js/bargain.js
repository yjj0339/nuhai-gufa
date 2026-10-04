// ============ 商筏砍价小游戏 ============
import { S, bus, toast } from './state.js';
import { sfx } from './audio.js';

export function startBargain() {
  const m = S.entities.merchant;
  if (!m || m.bargained) return false;
  if (S.bargain) return false;
  m.bargained = true;
  S.bargain = { pos: 0, dir: 1, t: 0, active: true, speed: 1.15 };
  bus.emit('closePanel');
  sfx.open();
  return true;
}
export function updateBargain(dt) {
  const b = S.bargain;
  if (!b || !b.active) return;
  b.t += dt;
  b.pos += b.dir * b.speed * dt;
  if (b.pos > 1) { b.pos = 1; b.dir = -1; }
  if (b.pos < 0) { b.pos = 0; b.dir = 1; }
  if (b.t > 9) stopBargain(); // 犹豫太久=砍崩
}
export function stopBargain() {
  const b = S.bargain;
  const m = S.entities.merchant;
  if (!b) return;
  S.bargain = null;
  if (!m) return;
  const d = Math.abs(b.pos - 0.5);
  if (d < 0.09) {
    m.discount = 0.75;
    S.stats.bargainWins++;
    toast('🤝 砍价成功！全场 7.5 折！', '🤝');
    sfx.achv();
  } else if (d < 0.22) {
    m.discount = 0.9;
    toast('🤝 小砍了一笔，9 折成交', '🤝');
    sfx.levelup();
  } else {
    m.discount = 1.1;
    toast('砍崩了，商人把价格抬了 10%…', '😤');
    sfx.error();
  }
  bus.emit('openPanel', 'shop');
}
export function drawBargain(ctx, view) {
  const b = S.bargain;
  if (!b) return;
  const W = 300, H = 26;
  const x = view.w / 2 - W / 2, y = view.h * 0.3;
  ctx.save();
  ctx.fillStyle = 'rgba(252,248,238,0.95)';
  ctx.strokeStyle = '#D8CBAA'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - 14, y - 44, W + 28, H + 74, 12); ctx.fill(); ctx.stroke();
  ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#5A4A30';
  ctx.fillText('🤝 砍价！让指针停在最绿的地方', x + W / 2, y - 20);
  // 底槽
  ctx.fillStyle = 'rgba(120,110,90,0.2)';
  ctx.beginPath(); ctx.roundRect(x, y, W, H, 8); ctx.fill();
  // 区域：中心绿=7.5折，次绿=9折，两端红=涨价
  const seg = (a, b2, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + a * W, y, (b2 - a) * W, H, 4); ctx.fill(); };
  seg(0, 0.28, 'rgba(230,90,80,0.5)');
  seg(0.28, 0.41, 'rgba(242,180,74,0.55)');
  seg(0.41, 0.59, 'rgba(80,200,120,0.75)');
  seg(0.59, 0.72, 'rgba(242,180,74,0.55)');
  seg(0.72, 1, 'rgba(230,90,80,0.5)');
  // 指针
  ctx.fillStyle = '#2A3A4A';
  ctx.beginPath();
  ctx.moveTo(x + b.pos * W, y - 8);
  ctx.lineTo(x + b.pos * W - 8, y - 18);
  ctx.lineTo(x + b.pos * W + 8, y - 18);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(x + b.pos * W - 2, y - 4, 4, H + 4);
  ctx.font = '12px system-ui'; ctx.fillStyle = '#8A7A5A';
  ctx.fillText('点击画面 / 按空格 停下', x + W / 2, y + H + 22);
  ctx.restore();
}
