// ============ 背包 / 物品增删 ============
import { S, bus, toast, randi } from './state.js';
import { ITEMS, RECIPES, STATION_RECIPES, CHEST_LOOT } from './data.js';
import { sfx } from './audio.js';

export function countItem(id) {
  let n = 0;
  for (const s of S.inv.slots) if (s && s.id === id) n += s.n;
  if (S.ui.storageOpen || true) for (const s of S.storage) if (s && s.id === id) n += s.n;
  return n;
}

// 找一个能放的槽位（可堆叠优先）
export function addItem(id, n = 1, silent = false) {
  const def = ITEMS[id];
  if (!def || n <= 0) return false;
  let left = n;
  const trySlots = [...S.inv.slots.keys()];
  for (const i of trySlots) {
    const s = S.inv.slots[i];
    if (s && s.id === id && s.n < def.stack) {
      const add = Math.min(def.stack - s.n, left);
      s.n += add; left -= add;
      if (!left) break;
    }
  }
  if (left > 0) for (let i = 0; i < S.inv.slots.length; i++) {
    if (!S.inv.slots[i]) {
      const add = Math.min(def.stack, left);
      S.inv.slots[i] = { id, n: add };
      left -= add;
      if (!left) break;
    }
  }
  if (left > 0) {
    // 背包满 → 尝试木箱
    let left2 = left;
    for (let i = 0; i < S.storage.length; i++) {
      const s = S.storage[i];
      if (s && s.id === id && s.n < def.stack) { const add = Math.min(def.stack - s.n, left2); s.n += add; left2 -= add; if (!left2) break; }
    }
    if (left2 > 0) for (let i = 0; i < S.storage.length; i++) {
      if (!S.storage[i]) { const add = Math.min(def.stack, left2); S.storage[i] = { id, n: add }; left2 -= add; if (!left2) break; }
    }
    if (left2 > 0 && !silent) toast('背包和木箱都满了！', '😢');
    if (left - left2 > 0) { S.stats.collected += left - left2; bus.emit('inv'); return true; }
    return false;
  }
  S.stats.collected += n;
  if (!silent) sfx.pickup();
  bus.emit('inv');
  return true;
}

// 移除（背包+木箱统一扣）
export function removeItem(id, n = 1) {
  let left = n;
  const pools = [S.inv.slots, S.storage];
  for (const pool of pools) {
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      if (s && s.id === id) {
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) pool[i] = null;
        if (!left) { bus.emit('inv'); return true; }
      }
    }
  }
  bus.emit('inv');
  return left <= 0;
}
export function countTag(tag) {
  let n = 0;
  for (const [id, def] of Object.entries(ITEMS)) if (def.tags && def.tags.includes(tag)) n += countItem(id);
  return n;
}
export function removeTag(tag, n) {
  let left = n;
  for (const [id, def] of Object.entries(ITEMS)) {
    if (!def.tags || !def.tags.includes(tag)) continue;
    const have = countItem(id);
    const take = Math.min(have, left);
    if (take > 0) { removeItem(id, take); left -= take; }
    if (!left) return true;
  }
  return left <= 0;
}
export function hasAll(req, useTag) {
  if (useTag) return countTag(useTag) >= (req[useTag] || req.fish || 1);
  for (const [id, n] of Object.entries(req)) {
    if (id === 'fish') { if (countTag('fish') < n) return false; }
    else if (countItem(id) < n) return false;
  }
  return true;
}
export function takeAll(req, useTag) {
  if (useTag) return removeTag(useTag, req[useTag] || 1);
  for (const [id, n] of Object.entries(req)) {
    if (id === 'fish') removeTag('fish', n);
    else removeItem(id, n);
  }
  return true;
}

// 掉落物直接进包；不满足则生成飘字提示
export function grantLoot(loot, prefix = '获得') {
  for (const [id, n] of Object.entries(loot)) {
    if (addItem(id, n, true)) {
      toast(`${prefix} ${ITEMS[id].name} ×${n}`, ITEMS[id].emoji);
    }
  }
}

// 随机宝箱 loot
export function rollChest() {
  const got = {};
  for (const l of CHEST_LOOT) {
    if (Math.random() < l.p) got[l.id] = (got[l.id] || 0) + randi(l.n[0], l.n[1]);
  }
  if (!Object.keys(got).length) got.wood = 6;
  return got;
}

// 合成（手工）
export function craft(recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  if (!r || !hasAll(r.in)) { sfx.error(); return false; }
  takeAll(r.in);
  for (const [id, n] of Object.entries(r.out)) addItem(id, n, true);
  sfx.craft();
  toast(`合成 ${ITEMS[Object.keys(r.out)[0]].name}`, '✅');
  return true;
}

// 站点烹饪：返回消耗与时长
export function startStationCook(stationKey, recipeId, bkey) {
  const list = STATION_RECIPES[stationKey];
  const r = list && list.find(x => x.id === recipeId);
  if (!r) return false;
  const real = { ...r.in };
  if (r.useTag === 'fish') { if (countTag('fish') < 1) { sfx.error(); return false; } }
  else if (!hasAll(r.in)) { sfx.error(); return false; }
  takeAll(r.in);
  S.cooking[bkey] = { recipeId, station: stationKey, t: 0, time: r.time, out: r.out };
  sfx.open();
  return true;
}
