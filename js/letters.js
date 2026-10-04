// ============ 漂流瓶信件收集 ============
import { S, toast } from './state.js';
import { LETTERS } from './data.js';
import { addItem } from './inv.js';
import { grantXP } from './upgrades.js';
import { sfx } from './audio.js';

// 漂流瓶开启时调用：随机获得一封未收集的信
export function grantLetter() {
  const missing = LETTERS.filter(l => !S.letters.includes(l.id));
  if (!missing.length) {
    addItem('coin', 1, true);
    return false;
  }
  const l = missing[Math.floor(Math.random() * missing.length)];
  S.letters.push(l.id);
  toast(`📖 捡到信件：${l.title}（${S.letters.length}/${LETTERS.length}）`, '📖');
  grantXP(10);
  sfx.pickup();
  if (S.letters.length === LETTERS.length) {
    toast('集齐了全部 12 封信！信的末尾藏着老水手的祝福：古币 ×15', '📚');
    addItem('coin', 15, true);
    addItem('pearl', 2, true);
    grantXP(80);
    sfx.achv();
  }
  return true;
}
