// ============ 任务链 & 成就 ============
import { S, toast } from './state.js';
import { QUESTS, ACHIEVEMENTS, ACH_REWARDS } from './data.js';
import { grantLoot } from './inv.js';
import { grantXP } from './upgrades.js';
import { sfx } from './audio.js';

export function currentQuest() {
  if (S.quests.idx >= QUESTS.length) return null;
  return QUESTS[S.quests.idx];
}

export function updateQuests() {
  const q = currentQuest();
  if (q && q.check(S)) {
    S.quests.done.push(q.id);
    S.quests.idx++;
    grantXP(15);
    sfx.quest();
    toast(`主线任务完成：${q.name}`, '📜');
    if (q.reward && Object.keys(q.reward).length) grantLoot(q.reward, '任务奖励');
    if (q.id === 'q12') {
      S.stats.rescued = 1;
      S.mode = 'ending';
    }
  }
  // 成就（解锁即发奖励）
  for (const a of ACHIEVEMENTS) {
    if (S.achievements.has(a.id)) continue;
    try {
      if (a.check(S)) {
        S.achievements.add(a.id);
        sfx.achv();
        const reward = ACH_REWARDS[a.id] || { coin: 2 };
        grantLoot(reward, `🏆 ${a.name} 奖励`);
        toast(`🏆 成就解锁：${a.name}`, '🏆');
      }
    } catch (e) { /* 忽略单条成就错误 */ }
  }
}
