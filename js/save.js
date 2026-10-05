// ============ 存档 / 读档 ============
import { S, toast } from './state.js';
import { SAVE_KEY, CFG } from './data.js';
import { initWorld, spawnFloater } from './world.js';
import { initRaft } from './raft.js';
import { initSharks, initGulls, initFish, initUnderNodes } from './entities.js';
import { initWeather } from './weather.js';
import { rollDaily } from './daily.js';
import { addItem } from './inv.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveGame(silent = false) {
  if (S.mode !== 'play') return;
  const d = {
    v: 1,
    time: { ...S.time },
    weather: { type: S.weather.type, timer: S.weather.timer },
    wind: { ...S.wind },
    sailing: { ...S.sailing },
    anchor: S.anchor,
    player: {
      x: S.player.x, y: S.player.y, hp: S.player.hp, hunger: S.player.hunger,
      thirst: S.player.thirst, tool: S.player.tool, swimming: false,
    },
    raft: [...S.raft.tiles.values()].map(t => ({ c: t.c, r: t.r, hp: t.hp, armor: t.armor, net: t.net, b: t.b ? { type: t.b.type } : null })),
    inv: S.inv.slots,
    storage: S.storage,
    xp: S.xp, level: S.level, skillPts: S.skillPts,
    upgrades: S.upgrades,
    gear: S.gear,
    daily: S.daily,
    letters: S.letters,
    krakenTimerDay: S.krakenTimerDay,
    lastBossDay: S.lastBossDay,
    islands: S.islands.map(i => ({
      x: i.x, y: i.y, r: i.r, type: i.type, visited: i.visited,
      nodes: i.nodes.map(n => ({ kind: n.kind, x: n.x, y: n.y, hp: n.hp })),
      chest: i.chest ? { x: i.chest.x, y: i.chest.y, open: i.chest.open } : null,
    })),
    farmPlots: S.farmPlots,
    stats: S.stats,
    quests: { idx: S.quests.idx, done: S.quests.done },
    achievements: [...S.achievements],
    settings: S.settings,
    lighthouseFound: S.lighthouseFound,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    if (!silent) toast('游戏已保存', '💾');
  } catch (e) { if (!silent) toast('保存失败：存储不可用', '⚠️'); }
}

export function loadGame() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || !d.raft) return false;
  // 基础
  S.time = { ...S.time, ...d.time };
  S.weather = { type: d.weather.type, timer: d.weather.timer, intensity: 0, flash: 0, rainbow: 0, drops: [] };
  makeDropsSafe();
  S.wind = { ...S.wind, ...d.wind };
  S.sailing = { ...S.sailing, ...d.sailing };
  S.anchor = d.anchor;
  Object.assign(S.player, d.player, { swimming: false, onIsland: null, vx: 0, vy: 0, atkCd: 0, useCd: 0, invul: 0, sick: 0, walkT: 0, dir: 0 });
  // 木筏
  S.raft.tiles.clear();
  S.raft.nextId = 1;
  for (const t of d.raft) {
    S.raft.tiles.set(t.c + ',' + t.r, { c: t.c, r: t.r, hp: t.hp, armor: t.armor, net: t.net, b: t.b ? { type: t.b.type, c: t.c, r: t.r } : null, id: S.raft.nextId++ });
  }
  S.stats.tiles = S.raft.tiles.size;
  S.cooking = {}; S.farmPlots = d.farmPlots || {};
  S.inv.slots = (d.inv || []).map(s => s ? { ...s } : null);
  while (S.inv.slots.length < 30) S.inv.slots.push(null);
  S.storage = (d.storage || []).map(s => s ? { ...s } : null);
  while (S.storage.length < 24) S.storage.push(null);
  S.xp = d.xp || 0; S.level = d.level || 1; S.skillPts = d.skillPts || 0;
  S.upgrades = d.upgrades || {};
  S.gear = d.gear || { sharkSail: false };
  S.daily = d.daily || { day: 1, id: null, goal: 0, prog: 0, done: false };
  S.letters = d.letters || [];
  S.krakenTimerDay = d.krakenTimerDay || 10;
  S.kraken = null;
  S.lastBossDay = d.lastBossDay || 0;
  // 岛屿
  S.islands = (d.islands || []).map(i => ({
    x: i.x, y: i.y, r: i.r, type: i.type, visited: i.visited, id: ++S.islandMeta.counter,
    nodes: (i.nodes || []).map(n => ({ kind: n.kind, x: n.x, y: n.y, hp: n.hp, shake: 0, respawn: 0 })),
    chest: i.chest ? { ...i.chest } : null,
  }));
  Object.assign(S.stats, d.stats || {});
  // 旧存档字段兜底
  for (const k of ['beauty', 'krakenKill', 'gearBlade', 'dailyDone', 'whale', 'meteorWish', 'bargainWins', 'bought', 'wrecks', 'vortexLoot', 'dolphinTime', 'trades']) {
    if (typeof S.stats[k] !== 'number') S.stats[k] = 0;
  }
  S.quests = { idx: d.quests?.idx || 0, done: d.quests?.done || [] };
  S.achievements = new Set(d.achievements || []);
  Object.assign(S.settings, d.settings || {});
  S.lighthouseFound = !!d.lighthouseFound;
  // 实体重置
  S.entities.floaters = []; S.entities.sharks = []; S.entities.gulls = [];
  S.entities.fish = []; S.entities.parts = []; S.entities.bubbles = [];
  S.entities.vortices = []; S.entities.wrecks = [];
  S.entities.merchant = null; S.entities.dolphin = null;
  S.whale = null; S.meteors = []; S.meteorShower = 0; S.bargain = null; S.kraken = null;
  S.merchantTimer = 160; S.wreckTimer = 200; S.vortexTimer = 240; S.dolphinTimer = 140; S.whaleTimer = 220;
  S.hook = null; S.fishing = null;
  initTransient();
  return true;
}
function makeDropsSafe() {
  S.weather.drops = [];
  for (let i = 0; i < 130; i++) S.weather.drops.push({ x: Math.random(), y: Math.random(), spd: 1, len: 12 });
}
function initTransient() {
  // 世界补充漂浮物与水下节点
  S.entities.floaters = [];
  for (let i = 0; i < 11; i++) spawnFloater(true);
  initUnderNodes();
  initSharks();
  initGulls();
  initFish();
  S.sharkTimer = 60;
}

export function newGame() {
  S.msg = [];
  S.xp = 0; S.level = 1; S.skillPts = 0; S.upgrades = {};
  S.gear = { sharkSail: false };
  S.daily = { day: 1, id: null, goal: 0, prog: 0, done: false };
  S.letters = [];
  S.kraken = null;
  S.krakenTimerDay = 10;
  S.lastBossDay = 0;
  S.merchantTimer = 160; S.wreckTimer = 200; S.vortexTimer = 240; S.dolphinTimer = 140; S.whaleTimer = 220;
  S.time = { day: 1, frac: 0.28 };
  S.stats = {
    days: 1, collected: 0, fish: 0, cooked: 0, drank: 0, ingots: 0,
    sharkFlee: 0, sharkKill: 0, harvest: 0, islands: 0, chests: 0,
    sailed: 0, radioFixed: 0, rescued: 0, rainTime: 0, gullShoo: 0,
    diveTake: 0, tiles: 9, lantern: 0, deaths: 0, playTime: 0, lighthouse: 0,
    bossKill: 0, trades: 0, dolphinTime: 0, vortexLoot: 0, wrecks: 0, bought: 0,
    gearBlade: 0, dailyDone: 0, whale: 0, meteorWish: 0, bargainWins: 0, krakenKill: 0, beauty: 0,
  };
  S.quests = { idx: 0, done: [] };
  S.achievements = new Set();
  S.lighthouseFound = false;
  Object.assign(S.player, {
    x: 0, y: 0, hp: 100, hunger: 88, thirst: 84, tool: 'hook',
    swimming: false, onIsland: null, oxygen: CFG.oxygenMax, atkCd: 0, useCd: 0, invul: 0, sick: 0, walkT: 0, dir: 0,
  });
  S.inv.slots = new Array(30).fill(null);
  S.storage = new Array(24).fill(null);
  S.anchor = true;
  S.sailing = { raised: false, angle: 0 };
  initRaft();
  initWorld();
  initUnderNodes();
  initSharks();
  initGulls();
  initFish();
  initWeather();
  // 初始物资
  addItem('wood', 6, true); addItem('plastic', 4, true); addItem('palm_leaf', 4, true);
  addItem('water', 1, true); addItem('seed_potato', 1, true);
  S.mode = 'play';
  rollDaily();
  toast('欢迎来到怒海孤筏！用手钩收集漂流物活下去吧', '🌊');
}
