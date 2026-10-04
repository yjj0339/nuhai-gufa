// ============ 实体：鲨鱼 / 海鸥 / 鱼群 / 水下资源 / 钩子 / 粒子 ============
import { S, rand, randi, dist, clamp, key, toast } from './state.js';
import { TILE, CFG, ITEMS, FISH } from './data.js';
import { addItem, grantLoot } from './inv.js';
import { tileAt, edgeTiles, hasBuilding } from './raft.js';
import { floaterLoot } from './world.js';
import { sfx } from './audio.js';

// ---------------- 水下资源点 ----------------
const UNDER_KINDS = {
  seaweed: { name: '海草',   item: 'seaweed', color: '#3E9E5A', n: [1, 2] },
  clay:    { name: '黏土',   item: 'clay',    color: '#A8744A', n: [1, 2] },
  sand:    { name: '沙堆',   item: 'sand',    color: '#E8D8A0', n: [1, 3] },
  stone:   { name: '石头',   item: 'stone',   color: '#8E8A82', n: [1, 2] },
  ore:     { name: '矿石',   item: 'ore',     color: '#C0A060', n: [1, 1], rare: true },
  pearl:   { name: '珍珠贝', item: 'pearl',   color: '#F0D8E8', n: [1, 1], rare: true },
};
export function initUnderNodes() {
  S.underNodes = [];
  for (let i = 0; i < 9; i++) S.underNodes.push(makeUnderNode());
}
function makeUnderNode() {
  const r = Math.random();
  let kind;
  if (r < 0.3) kind = 'seaweed';
  else if (r < 0.5) kind = 'sand';
  else if (r < 0.68) kind = 'clay';
  else if (r < 0.86) kind = 'stone';
  else if (r < 0.96) kind = 'ore';
  else kind = 'pearl';
  const a = rand(0, Math.PI * 2), d = rand(180, 620);
  return { kind, x: Math.cos(a) * d, y: Math.sin(a) * d, taken: false, respawn: 0, bob: rand(0, 6) };
}
export function updateUnderNodes(dt) {
  for (let i = 0; i < S.underNodes.length; i++) {
    const nd = S.underNodes[i];
    if (nd.taken) {
      nd.respawn -= dt;
      if (nd.respawn <= 0) S.underNodes[i] = makeUnderNode();
    }
  }
}
export function tryTakeUnderNode() {
  const p = S.player;
  let best = null, bd = 52;
  for (const nd of S.underNodes) {
    if (nd.taken) continue;
    const d = dist(p.x, p.y, nd.x, nd.y);
    if (d < bd) { bd = d; best = nd; }
  }
  if (!best) return false;
  const def = UNDER_KINDS[best.kind];
  const n = randi(def.n[0], def.n[1]);
  addItem(def.item, n, true);
  toast(`采集 ${def.name} ×${n}`, ITEMS[def.item].emoji);
  best.taken = true; best.respawn = rand(60, 110);
  S.stats.diveTake++;
  sfx.pickup();
  spawnBubbles(p.x, p.y, 6);
  return true;
}

// ---------------- 鲨鱼 ----------------
export function initSharks() {
  S.entities.sharks = [];
  S.sharkTimer = 50;
}
export function updateSharks(dt) {
  const sh = S.entities.sharks;
  // 补充鲨鱼
  S.sharkTimer -= dt;
  const maxSharks = S.time.day >= 5 ? 2 : 1;
  if (S.sharkTimer <= 0 && sh.length < maxSharks) {
    sh.push(makeShark());
    S.sharkTimer = CFG.sharkRespawn + rand(0, 40);
  }
  const p = S.player;
  for (const s of sh) {
    s.animT += dt;
    if (s.state === 'dead') { s.deadT -= dt; if (s.deadT <= 0) sh.splice(sh.indexOf(s), 1); continue; }
    if (s.state === 'flee') {
      s.x += Math.cos(s.fleeDir) * 260 * dt;
      s.y += Math.sin(s.fleeDir) * 260 * dt;
      s.fleeT -= dt;
      if (s.fleeT <= 0) s.state = 'circle';
      continue;
    }
    // 游泳的玩家 → 主动猎杀
    if (p.swimming && s.state !== 'lunge') s.state = 'hunt';
    if (s.state === 'circle') {
      s.circT -= dt;
      const a = s.animT * 0.5 + s.phase;
      const tx = Math.cos(a) * s.radius, ty = Math.sin(a) * s.radius * 0.8;
      s.x += (tx - s.x) * dt * 1.2; s.y += (ty - s.y) * dt * 1.2;
      s.dir = Math.atan2(ty - s.y || 0.01, tx - s.x || 0.01);
      if (s.circT <= 0 && !p.swimming) { s.state = 'approach'; s.target = pickEdgeTile(); s.warnT = 2.2; }
    } else if (s.state === 'approach') {
      s.warnT -= dt;
      if (!s.target || !S.raft.tiles.has(key(s.target.c, s.target.r))) { s.target = pickEdgeTile(); }
      if (s.target) {
        const tx = (s.target.c + 0.5) * TILE, ty = (s.target.r + 0.5) * TILE;
        s.dir = Math.atan2(ty - s.y, tx - s.x);
        s.x += Math.cos(s.dir) * 120 * dt; s.y += Math.sin(s.dir) * 120 * dt;
      }
      if (s.warnT <= 0 && s.target) { s.state = 'lunge'; s.lungeT = 0.55; sfx.sharkBite(); S.shakeT = 0.3; }
    } else if (s.state === 'lunge') {
      s.lungeT -= dt;
      s.x += Math.cos(s.dir) * 330 * dt; s.y += Math.sin(s.dir) * 330 * dt;
      if (s.lungeT <= 0) { doBite(s); s.state = 'circle'; s.circT = rand(24, 44); s.radius = rand(150, 250); }
    } else if (s.state === 'hunt') {
      s.dir = Math.atan2(p.y - s.y, p.x - s.x);
      s.x += Math.cos(s.dir) * 150 * dt; s.y += Math.sin(s.dir) * 150 * dt;
      if (dist(s.x, s.y, p.x, p.y) < 30) {
        bitePlayer(s);
        s.state = 'circle'; s.circT = rand(18, 30); s.radius = rand(180, 260);
      }
      if (!p.swimming) s.state = 'circle';
    }
  }
}
function makeShark() {
  const a = rand(0, Math.PI * 2);
  return {
    x: Math.cos(a) * 500, y: Math.sin(a) * 500, dir: 0,
    state: 'circle', circT: rand(20, 40), radius: rand(150, 250), phase: rand(0, 6.28),
    hp: CFG.sharkHp, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: rand(0, 6), target: null,
  };
}
function pickEdgeTile() {
  const edges = edgeTiles();
  if (!edges.length) return null;
  return edges[randi(0, edges.length - 1)];
}
function doBite(s) {
  const t = s.target;
  if (!t) return;
  const tile = S.raft.tiles.get(key(t.c, t.r));
  if (!tile) return;
  if (tile.net || tile.armor) {
    toast('鲨鱼咬到了防护，悻悻而回！', '🦈');
    spawnSplash((t.c + 0.5) * TILE, (t.r + 0.5) * TILE, 8);
    return;
  }
  tile.hp--;
  spawnSplash((t.c + 0.5) * TILE, (t.r + 0.5) * TILE, 12);
  sfx.sharkBite();
  S.shakeT = 0.45;
  // 咬到玩家站的格子
  const p = S.player;
  if (!p.swimming && Math.floor(p.x / TILE) === t.c && Math.floor(p.y / TILE) === t.r) {
    damagePlayer(CFG.sharkBiteDmg, '鲨鱼咬了你！');
  }
  if (tile.hp <= 0) {
    if (tile.b) { toast(`${BUILDING_NAME(tile.b.type)}随地板被鲨鱼咬碎了！`, '💥'); delete S.cooking[key(t.c, t.r)]; delete S.farmPlots[key(t.c, t.r)]; }
    S.raft.tiles.delete(key(t.c, t.r));
    S.stats.tiles = S.raft.tiles.size;
    toast('一块地板被咬碎了！', '💥');
  } else {
    toast('鲨鱼咬坏了地板！', '🦈');
  }
}
function BUILDING_NAME(type) { return (ITEMS[type] && ITEMS[type].name) || '建筑'; }
function bitePlayer(s) {
  if (S.player.invul > 0) return;
  damagePlayer(CFG.sharkBiteDmg + 6, '鲨鱼袭击了你！快游回木筏！');
  // 击退到最近地板边缘
  const p = S.player;
  const edges = edgeTiles();
  if (edges.length) {
    const t = edges[randi(0, edges.length - 1)];
    p.x = (t.c + 0.5) * TILE; p.y = (t.r + 0.5) * TILE;
  }
}
export function hitShark(s, dmg = 1) {
  s.hp -= dmg;
  sfx.hit();
  spawnSplash(s.x, s.y, 6);
  if (s.hp <= 0) {
    s.state = 'dead'; s.deadT = 1.2;
    S.stats.sharkKill++;
    addItem('shark_raw', 2, true);
    addItem('shark_tooth', 1, true);
    toast('击败了鲨鱼！获得鲨鱼肉 ×2、鲨鱼牙 ×1', '🏆');
    sfx.achv();
  } else {
    s.state = 'flee';
    s.fleeT = rand(14, 22);
    s.fleeDir = Math.atan2(s.y, s.x);
    S.stats.sharkFlee++;
    toast('鲨鱼被击退了！', '⚔️');
    sfx.sharkFlee();
  }
}
export function sharkNearPlayer(range = 64) {
  const p = S.player;
  for (const s of S.entities.sharks) {
    if (s.state !== 'dead' && dist(s.x, s.y, p.x, p.y) < range) return s;
  }
  return null;
}

// ---------------- 海鸥 ----------------
export function initGulls() { S.entities.gulls = []; S.gullTimer = 30; }
export function updateGulls(dt) {
  const night = S.time.frac > 0.78 || S.time.frac < 0.22;
  S.gullTimer -= dt;
  const farms = [];
  for (const t of S.raft.tiles.values()) {
    if (t.b && t.b.type === 'farm') {
      const f = S.farmPlots[key(t.c, t.r)];
      if (f && f.crop && !f.done) farms.push(t);
    }
  }
  if (S.gullTimer <= 0 && !night && farms.length && S.entities.gulls.length < 1) {
    S.gullTimer = rand(45, 90);
    const a = rand(0, 6.28);
    S.entities.gulls.push({ x: Math.cos(a) * 600, y: Math.sin(a) * 600, state: 'fly', t: 0, target: farms[randi(0, farms.length - 1)], alt: 120, dir: 0, bob: rand(0, 6) });
    sfx.gull();
  }
  for (const g of S.entities.gulls) {
    g.bob += dt * 3;
    if (g.state === 'fly') {
      const tx = (g.target.c + 0.5) * TILE, ty = (g.target.r + 0.5) * TILE;
      const d = dist(g.x, g.y, tx, ty);
      g.dir = Math.atan2(ty - g.y, tx - g.x);
      g.x += Math.cos(g.dir) * 140 * dt;
      g.y += Math.sin(g.dir) * 140 * dt;
      g.alt = 60 + Math.sin(g.bob) * 18;
      if (d < 40) {
        // 检查稻草人/营火
        let scared = false;
        for (const t of S.raft.tiles.values()) {
          if (t.b && (t.b.type === 'scarecrow' || t.b.type === 'campfire') &&
              Math.abs(t.c - g.target.c) <= 2 && Math.abs(t.r - g.target.r) <= 2) scared = true;
        }
        if (scared) { g.state = 'flee'; g.fleeT = 3; toast('稻草人吓退了海鸥！', '🎃'); }
        else { g.state = 'steal'; g.t = CFG.gullStealTime; sfx.gull(); }
      }
    } else if (g.state === 'steal') {
      g.t -= dt;
      g.alt = 26 + Math.sin(g.bob * 2) * 3;
      if (g.t <= 0) {
        const f = S.farmPlots[key(g.target.c, g.target.r)];
        if (f && f.crop && !f.done) {
          f.crop = null; f.t = 0;
          toast('海鸥偷走了你的作物！', '🐦');
          sfx.gull();
        }
        g.state = 'flee'; g.fleeT = 3;
      }
    } else if (g.state === 'flee') {
      g.fleeT -= dt;
      g.x += Math.cos(g.dir || 0.5) * 240 * dt;
      g.y += Math.sin(g.dir || 0.5) * 240 * dt;
      g.alt += 60 * dt;
      if (g.fleeT <= 0) g.done = true;
    }
  }
  S.entities.gulls = S.entities.gulls.filter(g => !g.done);
}
export function hitGull(g) {
  g.state = 'flee'; g.fleeT = 2.5;
  S.stats.gullShoo++;
  addItem('feather', 1, true);
  if (Math.random() < 0.6) addItem('egg', 1, true);
  toast('赶走了海鸥！掉落了羽毛' + (Math.random() < 0.6 ? '和鸟蛋' : ''), '🪶');
  sfx.hit();
}

// ---------------- 鱼群（装饰 + 钓鱼对象） ----------------
export function initFish() { S.entities.fish = []; }
export function updateFish(dt) {
  const want = 5;
  while (S.entities.fish.length < want) {
    const a = rand(0, 6.28), d = rand(120, 500);
    S.entities.fish.push({
      x: Math.cos(a) * d, y: Math.sin(a) * d, dir: rand(0, 6.28),
      spd: rand(14, 34), t: rand(2, 6), size: rand(0.7, 1.3), rare: Math.random() < 0.15,
    });
  }
  for (const f of S.entities.fish) {
    f.t -= dt;
    if (f.t <= 0) { f.t = rand(2, 6); f.dir += rand(-1.4, 1.4); }
    f.x += Math.cos(f.dir) * f.spd * dt;
    f.y += Math.sin(f.dir) * f.spd * dt;
    if (dist(f.x, f.y, 0, 0) > 620) f.dir = Math.atan2(-f.y, -f.x) + rand(-0.6, 0.6);
  }
}

// ---------------- 钩子 ----------------
export function throwHook(tx, ty) {
  const p = S.player;
  const d = dist(p.x, p.y, tx, ty);
  if (d > CFG.hookRange) { toast('太远了，够不着', '⚠️'); sfx.error(); return false; }
  if (isOnRaftPoint(tx, ty)) { sfx.error(); return false; }
  // 找目标漂流物
  let target = null, bd = 46;
  for (const f of S.entities.floaters) {
    const dd = dist(tx, ty, f.x, f.y);
    if (dd < bd) { bd = dd; target = f; }
  }
  S.hook = { sx: p.x, sy: p.y - 8, x: p.x, y: p.y - 8, tx, ty, phase: 'fly', target, t: 0 };
  sfx.hookOut();
  return true;
}
function isOnRaftPoint(x, y) { return !!tileAt(x, y); }
export function updateHook(dt) {
  const h = S.hook;
  if (!h) return;
  const speed = CFG.hookSpeed;
  if (h.phase === 'fly') {
    const d = dist(h.x, h.y, h.tx, h.ty);
    const step = speed * dt;
    if (d <= step) {
      h.x = h.tx; h.y = h.ty;
      if (h.target) { h.phase = 'reel'; sfx.splash(); spawnSplash(h.tx, h.ty, 7); }
      else { spawnSplash(h.tx, h.ty, 5); sfx.splash(); S.hook = null; }
    } else {
      h.x += (h.tx - h.x) / d * step;
      h.y += (h.ty - h.y) / d * step;
    }
  } else if (h.phase === 'reel') {
    const p = S.player;
    // 目标被拉向玩家
    if (h.target) {
      const f = h.target;
      f.x += (p.x - f.x) * dt * 3.2;
      f.y += (p.y - f.y) * dt * 3.2;
    }
    const d = dist(h.x, h.y, p.x, p.y);
    const step = speed * 1.15 * dt;
    if (d <= 26) {
      if (h.target) {
        const f = h.target;
        const i = S.entities.floaters.indexOf(f);
        if (i >= 0) {
          S.entities.floaters.splice(i, 1);
          grantLoot(floaterLoot(f.type));
          sfx.hookGot();
        }
      }
      S.hook = null;
    } else {
      h.x += (p.x - h.x) / d * step;
      h.y += (p.y - h.y) / d * step;
    }
  }
}

// ---------------- 粒子 ----------------
export function spawnSplash(x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), sp = rand(40, 150);
    S.entities.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, t: rand(0.4, 0.8), max: 0.8, kind: 'drop' });
  }
}
export function spawnBubbles(x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    S.entities.bubbles.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vy: -rand(20, 45), t: rand(0.8, 1.6), r: rand(2, 4.5) });
  }
}
export function spawnHitStar(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = rand(0, 6.28), sp = rand(60, 160);
    S.entities.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.35, max: 0.35, kind: 'star' });
  }
}
export function updateParticles(dt) {
  for (const p of S.entities.parts) {
    p.t -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.kind === 'drop' ? 300 : 60) * dt;
  }
  S.entities.parts = S.entities.parts.filter(p => p.t > 0);
  for (const b of S.entities.bubbles) {
    b.t -= dt; b.y += b.vy * dt; b.vy -= 8 * dt;
  }
  S.entities.bubbles = S.entities.bubbles.filter(b => b.t > 0);
}

// ---------------- 渲染 ----------------
export function drawUnder(ctx, t) {
  // 鱼影
  for (const f of S.entities.fish) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.dir);
    ctx.fillStyle = f.rare ? 'rgba(240,190,90,0.5)' : 'rgba(30,70,90,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13 * f.size, 5 * f.size, 0, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11 * f.size, 0); ctx.lineTo(-17 * f.size, -4 * f.size); ctx.lineTo(-17 * f.size, 4 * f.size); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 水下资源点
  for (const nd of S.underNodes) {
    if (nd.taken) continue;
    const def = UNDER_KINDS[nd.kind];
    const bob = Math.sin(t * 1.4 + nd.bob) * 2;
    ctx.save();
    ctx.translate(nd.x, nd.y + bob);
    ctx.globalAlpha = 0.85;
    if (nd.kind === 'seaweed') {
      ctx.strokeStyle = def.color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 5, 6);
        ctx.quadraticCurveTo(i * 5 + Math.sin(t * 2 + i) * 4, -6, i * 5 + Math.sin(t * 2 + i + 1) * 6, -16);
        ctx.stroke();
      }
    } else if (nd.kind === 'pearl') {
      ctx.fillStyle = '#C8B8D0';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#F8F0F8';
      ctx.beginPath(); ctx.arc(0, -2, 4, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-1.4, -3.4, 1.3, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(-10, 6); ctx.lineTo(-6, -6); ctx.lineTo(4, -8); ctx.lineTo(10, 3); ctx.lineTo(4, 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(-2, -3, 3, 0, 6.29); ctx.fill();
    }
    if (nd.kind === 'ore' || nd.kind === 'pearl') {
      ctx.strokeStyle = `rgba(255,220,100,${0.35 + 0.3 * Math.sin(t * 3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.29); ctx.stroke();
    }
    ctx.restore();
  }
}
export function drawOver(ctx, t) {
  // 鲨鱼
  for (const s of S.entities.sharks) {
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.state === 'dead') {
      ctx.globalAlpha = Math.max(0, s.deadT / 1.2);
      ctx.rotate(0.6);
    }
    ctx.rotate(s.dir + Math.PI / 2);
    const wig = Math.sin(s.animT * 8) * 0.25;
    // 身体阴影
    ctx.fillStyle = 'rgba(15,50,70,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 11, 22, 0, 0, 6.29); ctx.fill();
    // 身体
    ctx.fillStyle = s.state === 'dead' ? '#7A8A90' : '#5A7A8A';
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.quadraticCurveTo(12, -6, 9, 14);
    ctx.quadraticCurveTo(0, 20 + wig * 4, -9, 14);
    ctx.quadraticCurveTo(-12, -6, 0, -26);
    ctx.fill();
    // 背鳍
    ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(0, -24); ctx.lineTo(6, -12); ctx.closePath(); ctx.fill();
    // 尾
    ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(-7 + wig * 6, 27); ctx.lineTo(7 + wig * 6, 27); ctx.closePath(); ctx.fill();
    // 警示
    if (s.state === 'approach') {
      ctx.rotate(-s.dir - Math.PI / 2);
      ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(230,60,50,${0.6 + 0.4 * Math.sin(t * 10)})`;
      ctx.fillText('!', 0, -36);
      ctx.font = '11px system-ui';
      ctx.fillStyle = 'rgba(230,60,50,0.9)';
      ctx.fillText('要咬这里！', 0, -52);
    }
    if (s.state === 'hunt') {
      ctx.rotate(-s.dir - Math.PI / 2);
      ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(230,60,50,${0.6 + 0.4 * Math.sin(t * 12)})`;
      ctx.fillText('🦈!', 0, -36);
    }
    ctx.restore();
  }
  // 海鸥
  for (const g of S.entities.gulls) {
    ctx.save();
    ctx.translate(g.x, g.y - g.alt);
    // 地面影
    ctx.fillStyle = 'rgba(20,60,80,0.2)';
    ctx.beginPath(); ctx.ellipse(0, g.alt, 7, 3, 0, 0, 6.29); ctx.fill();
    const flap = Math.sin(g.bob * 4) * 0.5;
    ctx.fillStyle = '#F4F6F8';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#E2E8EC'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -1); ctx.quadraticCurveTo(-11, -6 - flap * 8, -17, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -1); ctx.quadraticCurveTo(11, -6 - flap * 8, 17, -2); ctx.stroke();
    ctx.fillStyle = '#5A6270'; ctx.beginPath(); ctx.arc(7, -1, 2.6, 0, 6.29); ctx.fill();
    if (g.state === 'steal') {
      ctx.strokeStyle = `rgba(230,60,50,${0.5 + 0.4 * Math.sin(t * 8)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.29 * (g.t / CFG.gullStealTime)); ctx.stroke();
      ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(230,60,50,0.95)';
      ctx.fillText('在偷菜！打它！', 0, -14);
    }
    ctx.restore();
  }
  // 钩子与绳
  if (S.hook) {
    const h = S.hook, p = S.player;
    ctx.strokeStyle = 'rgba(90,70,40,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 8);
    ctx.quadraticCurveTo((p.x + h.x) / 2, (p.y + h.y) / 2 - 24, h.x, h.y);
    ctx.stroke();
    ctx.fillStyle = '#C8D0D8';
    ctx.beginPath(); ctx.arc(h.x, h.y, 4.5, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#8A929C'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x + 2, h.y + 4, 4, -0.5, 2.6); ctx.stroke();
  }
  // 粒子
  for (const p of S.entities.parts) {
    const a = p.t / p.max;
    ctx.globalAlpha = a;
    if (p.kind === 'drop') {
      ctx.fillStyle = '#CFF2F0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = '#FFD54A';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 10);
      ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  for (const b of S.entities.bubbles) {
    ctx.strokeStyle = 'rgba(230,250,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.stroke();
  }
}
