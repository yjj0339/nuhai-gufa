// ============ 全局共享状态 & 事件总线 ============
// 所有模块通过 import { S, bus } 读写，避免循环依赖

export const S = {
  mode: 'menu',            // menu | play | dead | ending
  t: 0,                    // 总运行时间
  time: { day: 1, frac: 0.32 },   // 游戏天数 + 当天进度0~1
  weather: { type: 'sunny', timer: 60, intensity: 0, flash: 0, rainbow: 0 },
  wind: { dir: 0, strength: 0.6 },   // 风向弧度 + 强度0~1
  sailing: { raised: false, angle: 0 },
  anchor: true,
  worldDX: 0, worldDY: 0,  // 岛屿/漂流物相对木筏的累计位移
  player: {
    x: 0, y: 0, vx: 0, vy: 0, dir: 0, walkT: 0, moving: false,
    onRaft: true, swimming: false, oxygen: 22,
    hp: 100, hunger: 88, thirst: 84,
    tool: 'hook', atkCd: 0, useCd: 0, sick: 0, invul: 0,
    diveTake: 0,
  },
  raft: { tiles: new Map(), nextId: 1 },   // "c,r" -> {c,r,hp,armor,net,building:{...}}
  inv: { slots: new Array(30).fill(null), sel: 0 },
  storage: new Array(24).fill(null),       // 木箱共享仓
  entities: { sharks: [], gulls: [], floaters: [], fish: [], parts: [], bubbles: [], birds: [], vortices: [], wrecks: [], merchant: null, dolphin: null },
  hook: null,              // {x,y,tx,ty,phase:'fly'|'reel',target}
  islands: [],
  fishing: null,           // 钓鱼小游戏状态
  cooking: {},             // buildingKey -> {recipeId, t, time}
  farmPlots: {},           // buildingKey -> {crop, t, time, watered}
  xp: 0, level: 1, skillPts: 0,
  upgrades: {},
  gear: { sharkSail: false },
  daily: { day: 1, id: null, goal: 0, prog: 0, done: false },
  merchantTimer: 160, wreckTimer: 200, vortexTimer: 240, dolphinTimer: 140, whaleTimer: 220,
  lastBossDay: 0,
  whale: null,
  meteors: [], meteorShower: 0,
  bargain: null,
  kraken: null,            // {tentacles:[], t, nextDay}
  krakenTimerDay: 10,      // 首次出现天数
  letters: [],             // 已收集信件 id
  paused: false,
  prevVolumes: null,
  stats: {
    days: 1, collected: 0, fish: 0, cooked: 0, drank: 0, ingots: 0,
    sharkFlee: 0, sharkKill: 0, harvest: 0, islands: 0, chests: 0,
    sailed: 0, radioFixed: 0, rescued: 0, rainTime: 0, gullShoo: 0,
    diveTake: 0, tiles: 0, lantern: 0, deaths: 0, playTime: 0,
    bossKill: 0, trades: 0, dolphinTime: 0, vortexLoot: 0, wrecks: 0, bought: 0,
    gearBlade: 0, dailyDone: 0, whale: 0, meteorWish: 0, bargainWins: 0, krakenKill: 0,
  },
  quests: { idx: 0, done: [] },
  achievements: new Set(),
  questDoneFlash: 0,
  islandMeta: { counter: 0 },
  pendingLoot: [],         // 面板拾取暂存
  msg: [],                 // toasts {text, t, icon}
  ui: { panel: null, buildSel: null, storageOpen: false, stationOpen: null, helpTab: 0 },
  settings: { sfx: 0.8, music: 0.5, shake: true, quality: 'high' },
  input: { moveX: 0, moveY: 0, attack: false, use: false, dive: false, hook: false, fishingHold: false, sailL: false, sailR: false },
  isTouch: false,
  mouseX: undefined, mouseY: undefined,
  paused: false,
  dead: false,
  lighthouseFound: false,
  docking: null,           // 当前靠近的岛
  shakeT: 0,
  nightLamp: [],
  tutorial: 0,
};

// 极简事件总线
export const bus = {
  m: {},
  on(e, f) { (this.m[e] = this.m[e] || []).push(f); },
  emit(e, ...a) { (this.m[e] || []).forEach(f => { try { f(...a); } catch (err) { console.error('[bus]', e, err); S.err = err; } }); },
};

// 运行期错误收集（自测用）
export const ERRS = [];
window.addEventListener('error', e => ERRS.push(String(e.message || e)));
window.addEventListener('unhandledrejection', e => ERRS.push('rej:' + (e.reason && e.reason.message || e.reason)));

// ---------------- 工具函数 ----------------
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const angLerp = (a, b, t) => { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; };
export const key = (c, r) => c + ',' + r;
export const now = () => performance.now() / 1000;

export function toast(text, icon = '') {
  S.msg.push({ text, icon, t: 4 });
  if (S.msg.length > 5) S.msg.shift();
  bus.emit('toast');
}

export function fmtTime(frac) {
  const h = Math.floor(frac * 24), m = Math.floor((frac * 24 - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
