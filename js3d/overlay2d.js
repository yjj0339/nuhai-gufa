// ============ 2D 叠加层：钓鱼条 / 砍价条 / 低血晕影 / 氧气表 / 提示 ============
import { S } from '../js/state.js';
import { CFG } from '../js/data.js';
import { drawFishing } from '../js/fishing.js';
import { drawBargain } from '../js/bargain.js';

let cv, ctx;

export function initOverlay() {
  cv = document.getElementById('overlay');
  ctx = cv.getContext('2d');
  resizeOverlay();
  window.addEventListener('resize', resizeOverlay);
}
function resizeOverlay() {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = window.innerWidth * dpr;
  cv.height = window.innerHeight * dpr;
  cv.style.width = window.innerWidth + 'px';
  cv.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function drawOverlay(view) {
  if (!ctx) return;
  const w = window.innerWidth, h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  if (S.mode !== 'play') return;
  // 钓鱼 / 砍价
  drawFishing(ctx, { w, h });
  drawBargain(ctx, { w, h });
  // 氧气表（游泳时）
  const p = S.player;
  if (p.swimming) {
    const frac = Math.max(0, p.oxygen / CFG.oxygenMax);
    const bw = 190, bx = w / 2 - bw / 2, by = h - 130;
    ctx.fillStyle = 'rgba(20,50,70,0.6)';
    ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, bw + 8, 22, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill();
    ctx.fillStyle = frac > 0.3 ? '#6ed0f0' : '#f0655a';
    ctx.beginPath(); ctx.roundRect(bx, by, bw * frac, 14, 7); ctx.fill();
    ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`🫧 氧气 ${(frac * 100 | 0)}%`, w / 2, by + 11.5);
  }
  // 低血量晕影
  if (p.hp < 35) {
    const a = (1 - p.hp / 35) * (0.28 + 0.1 * Math.sin(S.t * 4));
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.75);
    g.addColorStop(0, 'rgba(200,40,30,0)');
    g.addColorStop(1, `rgba(200,40,30,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // 克拉肯警报
  if (S.kraken) {
    ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(190,60,190,${0.7 + 0.3 * Math.sin(S.t * 5)})`;
    ctx.fillText('🦑 克拉肯来袭——斩断所有触手！', w / 2, 64);
  }
  // 商筏近了提示
  const m = S.entities.merchant;
  if (m) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < 110 && !S.ui.panel) {
      ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(90,74,48,0.9)';
      ctx.fillText('🛒 按 使用 键和商筏交易', w / 2, h - 160);
    }
  }
}
