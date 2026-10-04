// ============ 每日挑战 ============
import { S, bus, toast, randi } from './state.js';
import { DAILY_POOL } from './data.js';
import { addItem } from './inv.js';
import { grantXP } from './upgrades.js';
import { sfx } from './audio.js';

export function rollDaily(announce = true) {
  const d = DAILY_POOL[randi(0, DAILY_POOL.length - 1)];
  S.daily = { day: S.time.day, id: d.id, name: d.name, desc: d.desc, goal: d.goal, prog: 0, done: false };
  if (announce) toast(`📌 今日挑战：${d.name} — ${d.desc}`, '📌');
}

export function dailyProg(type) {
  const d = S.daily;
  if (!d || d.done || d.id !== type || d.day !== S.time.day) return;
  d.prog++;
  if (d.prog >= d.goal) {
    d.done = true;
    S.stats.dailyDone++;
    const coins = Math.min(10, 4 + Math.floor(S.time.day / 3));
    addItem('coin', coins, true);
    grantXP(20);
    toast(`✅ 今日挑战完成：${d.name}！奖励古币 ×${coins}`, '📌');
    sfx.quest();
  }
}
bus.on('newDay', () => { if (S.daily.day !== S.time.day || !S.daily.id) rollDaily(); });
