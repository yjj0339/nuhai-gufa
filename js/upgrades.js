// ============ 经验 / 等级 / 升级系统 ============
import { S, toast } from './state.js';
import { CFG } from './data.js';
import { sfx } from './audio.js';

export const UPG = [
  { id: 'hook',    name: '神钩',   emoji: '🪝', max: 3, desc: '手钩射程 +18%/级' },
  { id: 'oxygen',  name: '肺活量', emoji: '🫧', max: 3, desc: '氧气上限 +25%/级' },
  { id: 'swim',    name: '泳技',   emoji: '🏊', max: 3, desc: '游泳速度 +14%/级' },
  { id: 'sail',    name: '操帆',   emoji: '⛵', max: 3, desc: '航行速度 +16%/级' },
  { id: 'stomach', name: '抗饿',   emoji: '🍗', max: 3, desc: '饥饿消耗 -14%/级' },
  { id: 'spear',   name: '矛术',   emoji: '🔱', max: 2, desc: '长矛伤害 +1/级' },
  { id: 'luck',    name: '幸运',   emoji: '🍀', max: 2, desc: '打捞/采集/钓鱼有几率双倍' },
];

export function lv(id) { return S.upgrades[id] || 0; }

// ---- 生效数值 ----
export const eff = {
  hookRange: () => CFG.hookRange * (1 + 0.18 * lv('hook')),
  oxygenMax: () => CFG.oxygenMax * (1 + 0.25 * lv('oxygen')),
  swimSpeed: () => CFG.swimSpeed * (1 + 0.14 * lv('swim')),
  sailSpeed: () => CFG.sailSpeed * (1 + 0.16 * lv('sail')) * (S.gear.sharkSail ? 1.25 : 1),
  hungerRate: () => CFG.hungerRate * (1 - 0.14 * lv('stomach')),
  spearDmg: base => base + lv('spear'),
};

// 幸运判定
export function lucky() { return Math.random() < 0.12 * lv('luck'); }

export function xpNeed(level) { return 40 + 45 * (level - 1); }

export function grantXP(n) {
  if (S.mode !== 'play') return;
  S.xp += n;
  let leveled = false;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    S.skillPts++;
    leveled = true;
  }
  if (leveled) {
    toast(`⭐ 升到 Lv.${S.level}！获得 1 升级点（打开 ⭐ 面板使用）`, '🌟');
    sfx.levelup();
  }
}

export function buyUpgrade(id) {
  const u = UPG.find(x => x.id === id);
  if (!u) return false;
  if (lv(id) >= u.max) return false;
  if (S.skillPts <= 0) { toast('没有升级点，继续攒经验吧', '⚠️'); sfx.error(); return false; }
  S.skillPts--;
  S.upgrades[id] = lv(id) + 1;
  toast(`${u.emoji} ${u.name} 升到 ${lv(id)} 级！`, '⬆️');
  sfx.craft();
  return true;
}
