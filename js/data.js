// ============ 怒海孤筏 · 游戏数据层 ============
// 全部静态定义：物品 / 配方 / 建筑 / 鱼类 / 任务 / 成就 / 调参常量

export const TILE = 48;              // 木筏格子像素
export const DAY_LEN = 480;          // 一天时长(秒) 8分钟
export const SAVE_KEY = 'nuhai-gufa-save-v1';

// ---------------- 物品 ----------------
// type: material材料 / food食物 / seed种子 / tool工具 / special特殊
// tags: fish(任鱼类), fuel(可作燃料), cookable
export const ITEMS = {
  // 材料
  wood:       { name: '木材',     emoji: '🪵', type: 'material', stack: 60, tags: ['fuel'], desc: '木筏与工具的基础材料。' },
  plastic:    { name: '塑料',     emoji: '🥤', type: 'material', stack: 60, desc: '海上漂来的瓶子与浮标。' },
  scrap:      { name: '金属废料', emoji: '⚙️', type: 'material', stack: 60, desc: '锈迹斑斑但依然有用。' },
  palm_leaf:  { name: '棕榈叶',   emoji: '🌿', type: 'material', stack: 60, tags: ['fuel'], desc: '可编织，也是好燃料。' },
  rope:       { name: '绳索',     emoji: '🪢', type: 'material', stack: 40, desc: '棕榈叶搓成的绳子。' },
  nail:       { name: '钉子',     emoji: '📌', type: 'material', stack: 40, desc: '金属废料敲出来的钉子。' },
  bolt:       { name: '螺栓',     emoji: '🔩', type: 'material', stack: 30, desc: '精密的紧固件。' },
  ingot:      { name: '金属锭',   emoji: '🔩', type: 'material', stack: 30, desc: '熔炉炼出的金属锭。' },
  brick:      { name: '砖块',     emoji: '🧱', type: 'material', stack: 40, desc: '黏土烧制的砖。' },
  glass:      { name: '玻璃',     emoji: '🪟', type: 'material', stack: 30, desc: '沙子熔炼的玻璃。' },
  cloth:      { name: '布料',     emoji: '🧵', type: 'material', stack: 30, desc: '棕榈纤维织的布。' },
  stone:      { name: '石头',     emoji: '🪨', type: 'material', stack: 60, desc: '岛屿与海底都能捡到。' },
  sand:       { name: '沙子',     emoji: '⏳', type: 'material', stack: 60, desc: '海底挖的细沙。' },
  clay:       { name: '黏土',     emoji: '🟤', type: 'material', stack: 60, desc: '海底的黏土，烧砖用。' },
  ore:        { name: '金属矿石', emoji: '⛰️', type: 'material', stack: 40, desc: '礁石岛与海底的矿石。' },
  seaweed:    { name: '海草',     emoji: '🥬', type: 'material', stack: 40, desc: '水下采集，可以吃也能入药。' },
  feather:    { name: '羽毛',     emoji: '🪶', type: 'material', stack: 30, desc: '海鸥掉落的羽毛。' },
  bait:       { name: '鱼饵',     emoji: '🪱', type: 'material', stack: 30, desc: '挂上鱼竿，稀有大鱼更容易上钩。' },
  vinegoo:    { name: '藤胶',     emoji: '🟢', type: 'material', stack: 30, desc: '丛林岛藤蔓的胶质。' },
  // 种子
  seed_berry:  { name: '浆果种子', emoji: '🌱', type: 'seed', stack: 20, plant: 'berry',  desc: '种在种植箱里，长出浆果。' },
  seed_potato: { name: '土豆苗',   emoji: '🌱', type: 'seed', stack: 20, plant: 'potato', desc: '种在种植箱里，长出土豆。' },
  // 食物 (val=饱食, wet=水分, hp=回血)
  berry:        { name: '浆果',     emoji: '🍓', type: 'food', stack: 20, val: 12, wet: 4,  desc: '酸甜的小果子。' },
  coconut:      { name: '椰子',     emoji: '🥥', type: 'food', stack: 20, val: 10, wet: 14, desc: '椰汁解渴，椰肉管饱。' },
  potato:       { name: '生土豆',   emoji: '🥔', type: 'food', stack: 20, val: 10, tags: ['food'], desc: '烤熟了更好吃。' },
  fish_sardine: { name: '沙丁鱼',   emoji: '🐠', type: 'food', stack: 20, val: 10, tags: ['fish'], desc: '常见的小鱼。' },
  fish_mackerel:{ name: '鲭鱼',     emoji: '🐟', type: 'food', stack: 20, val: 14, tags: ['fish'], desc: '成群巡游的鱼。' },
  fish_grouper: { name: '石斑鱼',   emoji: '🐡', type: 'food', stack: 20, val: 18, tags: ['fish'], desc: '礁石一带的美味。' },
  fish_tuna:    { name: '金枪鱼',   emoji: '🐬', type: 'food', stack: 20, val: 24, tags: ['fish'], desc: '有力的大家伙。' },
  fish_sword:   { name: '剑鱼',     emoji: '🗡️', type: 'food', stack: 20, val: 32, tags: ['fish'], desc: '稀有的深海猎手。' },
  fish_lantern: { name: '灯笼鱼',   emoji: '🏮', type: 'food', stack: 20, val: 26, tags: ['fish'], desc: '只在夜里上钩。' },
  fish_cooked:  { name: '烤鱼',     emoji: '🍢', type: 'food', stack: 20, val: 26, hp: 4, desc: '香喷喷的熟食。' },
  shark_raw:    { name: '鲨鱼肉',   emoji: '🥩', type: 'food', stack: 20, val: 16, desc: '生肉有腥味，建议烤熟。' },
  shark_cooked: { name: '鲨鱼排',   emoji: '🍖', type: 'food', stack: 20, val: 34, hp: 8, desc: '大块烤肉，恢复力惊人。' },
  potato_baked: { name: '烤土豆',   emoji: '🍠', type: 'food', stack: 20, val: 24, hp: 3, desc: '外焦里嫩。' },
  egg:          { name: '鸟蛋',     emoji: '🥚', type: 'food', stack: 20, val: 8, desc: '海鸥巢里的蛋。' },
  egg_cooked:   { name: '煎蛋',     emoji: '🍳', type: 'food', stack: 20, val: 18, hp: 3, desc: '营火的杰作。' },
  water:        { name: '纯净水',   emoji: '💧', type: 'food', stack: 20, wet: 40, desc: '净水器产出的饮用水。' },
  // 工具
  hook:        { name: '手钩',     emoji: '🪝', type: 'tool', stack: 1, desc: '甩出去钩住漂流物拉回来。' },
  spear:       { name: '木矛',     emoji: '🔱', type: 'tool', stack: 1, desc: '近战武器，能赶走鲨鱼。' },
  spear_metal: { name: '金属矛',   emoji: '⚔️', type: 'tool', stack: 1, desc: '更锋利更耐用，鲨鱼的噩梦。' },
  blade:       { name: '巨鲨战刃', emoji: '🗡️', type: 'tool', stack: 1, desc: '巨鲨之牙锻成的利刃，伤害惊人。' },
  tentacle:    { name: '克拉肯触手', emoji: '🦑', type: 'material', stack: 20, tags: ['food'], desc: '海怪的触手，能吃也能锻造。' },
  hammer:      { name: '锤子',     emoji: '🔨', type: 'tool', stack: 1, desc: '建造与拆除建筑必备。' },
  rod:         { name: '鱼竿',     emoji: '🎣', type: 'tool', stack: 1, desc: '在筏边钓鱼，夜里鱼更肥。' },
  // 特殊
  map_frag:    { name: '地图碎片', emoji: '🗺️', type: 'special', stack: 10, desc: '集齐3张可定位灯塔岛。' },
  radio_part:  { name: '无线电零件', emoji: '📻', type: 'special', stack: 10, desc: '修复无线电需要它。' },
  shark_tooth: { name: '鲨鱼牙',   emoji: '🦷', type: 'special', stack: 20, desc: '战胜鲨鱼的证明。' },
  pearl:       { name: '珍珠',     emoji: '🦪', type: 'special', stack: 10, desc: '深海的馈赠，闪着光。' },
  coin:        { name: '古币',     emoji: '🪙', type: 'special', stack: 30, desc: '沉船里的旧币。' },
};

// ---------------- 手工配方（工作台=随身） ----------------
export const RECIPES = [
  { id: 'rope',       out: { rope: 1 },       in: { palm_leaf: 2 },                          desc: '搓绳' },
  { id: 'nail',       out: { nail: 2 },       in: { scrap: 1 },                              desc: '敲钉子' },
  { id: 'cloth',      out: { cloth: 1 },      in: { palm_leaf: 4 },                          desc: '织布' },
  { id: 'hook',       out: { hook: 1 },       in: { scrap: 2, rope: 1 },                     desc: '再做一个手钩' },
  { id: 'spear',      out: { spear: 1 },      in: { wood: 6, rope: 2, nail: 2 },             desc: '木矛' },
  { id: 'spear_metal',out: { spear_metal: 1 },in: { ingot: 2, wood: 4, rope: 2 },            desc: '金属矛' },
  { id: 'hammer',     out: { hammer: 1 },     in: { wood: 4, scrap: 2, rope: 1 },            desc: '锤子' },
  { id: 'rod',        out: { rod: 1 },        in: { wood: 5, rope: 3, nail: 1 },             desc: '鱼竿' },
  { id: 'seed_berry', out: { seed_berry: 1 }, in: { berry: 2 },                              desc: '留种' },
  { id: 'bait',       out: { bait: 2 },       in: { palm_leaf: 2 },                          desc: '鱼饵 ×2（钓鱼自动挂饵，稀有大鱼更易上钩）' },
  { id: 'gear_blade', out: { blade: 1 },      in: { shark_tooth: 2, ingot: 2, wood: 2 },     desc: '巨鲨战刃（伤害3，巨鲨掉牙锻造）' },
  { id: 'gear_sail',  out: {},                in: { shark_tooth: 3, cloth: 4, rope: 2 },     gear: 'sharkSail', desc: '鲨鱼皮帆：航行速度 +25%（消耗鲨鱼牙鞣制）' },
  { id: 'gear_amulet',out: {},                in: { tentacle: 2, pearl: 1, rope: 2 },        gear: 'krakenAmulet', desc: '海怪护符：潜水氧气消耗再 -35%（佩戴永久生效）' },
];

// ---------------- 漂流瓶信件（12封航海故事） ----------------
export const LETTERS = [
  { id: 'l1',  title: '远航的第一天',       text: '「风从东南来，我们满帆出港。甲板上的水手唱着歌，没人想到这是最后一次靠岸。」' },
  { id: 'l2',  title: '老船长的话',         text: '「孩子，海上最危险的不是风暴，是你忘了自己为什么出发。」——捡到这只瓶子的人，愿你还记得。' },
  { id: 'l3',  title: '半张航海图',         text: '图上标注着一片从未有人回来的海域。我用炭笔写下：如果有人捡到，别去。但如果非去不可，带上足够的水。' },
  { id: 'l4',  title: '给女儿的信',         text: '「小渔：爸爸给你抓了一只海星，它有五条腿。等你生日我就回家。爸爸在 very far 的船上。」' },
  { id: 'l5',  title: '灯塔守护者',         text: '「灯塔的灯油还够烧四十天。四十天后如果没有补给船……我宁愿不去想。至少今夜，光还亮着。」' },
  { id: 'l6',  title: '遇难的第三天',       text: '「淡水只剩两桶。我们开始接雨水喝。老李说，海上没有真正的绝路，只有不肯改航向的人。」' },
  { id: 'l7',  title: '海怪目击记录',       text: '「昨晚海面下有巨大的影子绕着船转了三圈。它有八条触手。大副说那是克拉肯。我不信。但今天我们绕道走了。」' },
  { id: 'l8',  title: '商人的账本',         text: '「珍珠十二颗，古币三十枚，皆沉于礁石之南。谁能取走便是谁的。——反正我上不了岸了。」' },
  { id: 'l9',  title: '一封没有寄出的信',   text: '「娘：儿在海上一切都好，吃得饱穿得暖。就是想你了。等挣够了钱……」信到这里就断了，墨迹被海水晕开。' },
  { id: 'l10', title: '鱼群的秘密',         text: '「灯笼鱼只在没有月亮的夜里浮上来，追着船头的灯光。想钓它们，就得学会在黑暗里等待。」' },
  { id: 'l11', title: '最后的泊船地',       text: '「我们决定在灯塔岛抛锚。那里有淡水，有野果，灯室够住下所有人。如果运气好，等来一艘船。」' },
  { id: 'l12', title: '给拾到瓶子的人',     text: '「恭喜你，集齐了这些信。它们没有宝藏图，只有一个真相：写这些信的人都活下来了。你也一样。——海上的朋友」' },
];

// ---------------- 每日挑战 ----------------
export const DAILY_POOL = [
  { id: 'loot',   name: '拾荒达人', desc: '打捞 8 件漂流物', goal: 8 },
  { id: 'fish',   name: '今日渔获', desc: '钓上 3 条鱼', goal: 3 },
  { id: 'cook',   name: '大厨当班', desc: '烹饪 3 份食物', goal: 3 },
  { id: 'shark',  name: '斗鲨操练', desc: '击退或猎杀 1 条鲨鱼', goal: 1 },
  { id: 'dive',   name: '深潜训练', desc: '潜水采集 5 次', goal: 5 },
  { id: 'harvest',name: '田间管理', desc: '收获 1 次作物', goal: 1 },
];

// ---------------- 建筑 ----------------
// needsFloor: 必须建在地板上; edgeOnly: 只能建在最外圈
export const BUILDINGS = {
  floor:       { name: '木地板',   emoji: '🟫', cost: { wood: 2 },                        desc: '扩建木筏的基础。' },
  floor_armor: { name: '加固地板', emoji: '⬛', cost: { wood: 1, ingot: 1 },              desc: '升级地板，鲨鱼咬不动。', upgrade: true },
  purifier:    { name: '净水器',   emoji: '🚰', cost: { plastic: 6, scrap: 2, palm_leaf: 4 }, desc: '棕榈叶当燃料，把海水蒸馏成能喝的淡水。' },
  grill:       { name: '烤架',     emoji: '🍢', cost: { plastic: 4, scrap: 2, wood: 4 },  desc: '把生食烤熟，价值翻倍。' },
  smelter:     { name: '熔炉',     emoji: '🏭', cost: { scrap: 10, brick: 4, wood: 6 },   desc: '炼金属锭、烧砖、熔玻璃。' },
  farm:        { name: '种植箱',   emoji: '🪴', cost: { wood: 8, palm_leaf: 6 },          desc: '种下种子，收获作物。' },
  bed:         { name: '吊床',     emoji: '🛏️', cost: { cloth: 4, palm_leaf: 6, wood: 2 },desc: '睡到天亮，跳过黑夜。' },
  chest:       { name: '木箱',     emoji: '🧰', cost: { wood: 8, rope: 2 },               desc: '+24 格共享仓储。' },
  sail:        { name: '帆',       emoji: '⛵', cost: { cloth: 6, wood: 4, rope: 4 },     desc: '升起帆乘风航行，Q/E 调帆向。' },
  anchor:      { name: '船锚',     emoji: '⚓', cost: { scrap: 6, rope: 4, stone: 4 },    desc: '抛锚停船，停在岛屿旁采集。' },
  campfire:    { name: '营火',     emoji: '🔥', cost: { wood: 4, stone: 2 },              desc: '夜晚照明，吓退海鸥。' },
  raincatcher: { name: '雨水收集器', emoji: '☔', cost: { plastic: 6, cloth: 2, rope: 2 }, desc: '下雨时自动积水。' },
  scarecrow:   { name: '稻草人',   emoji: '🎃', cost: { wood: 4, palm_leaf: 4, cloth: 1 },desc: '保护周围农田不被海鸥偷。' },
  lamp:        { name: '灯柱',     emoji: '🏮', cost: { glass: 2, scrap: 4, rope: 1 },    desc: '夜晚照亮周围，夜钓更安全。' },
  net:         { name: '防鲨网',   emoji: '🕸️', cost: { rope: 4, palm_leaf: 8 },          desc: '护住这块地板，鲨鱼咬不了。' },
  radio:       { name: '无线电',   emoji: '📻', cost: { scrap: 8, bolt: 4, glass: 2 }, desc: '建好后用3张地图碎片修复，定位灯塔岛。' },
  // 装饰（提升美观度：≥5 饥饿-5%，≥10 饥饿-10%）
  flag:        { name: '旗帜',     emoji: '🚩', cost: { wood: 2, cloth: 1 }, decor: true, desc: '装饰+1美观。让木筏有个家的样子。' },
  plant:       { name: '盆栽',     emoji: '🌷', cost: { plastic: 2, palm_leaf: 2 }, decor: true, desc: '装饰+1美观。木筏上的一点绿意。' },
  chair:       { name: '吊椅',     emoji: '🪑', cost: { wood: 3, rope: 2, cloth: 1 }, decor: true, desc: '装饰+2美观。午后摇一摇很惬意。' },
};

// 建筑界面配方（按站点分组）
export const STATION_RECIPES = {
  purifier: [
    { id: 'water', out: { water: 1 },    in: { palm_leaf: 1 }, time: 22, desc: '蒸馏淡水' },
  ],
  grill: [
    { id: 'fish_cooked',  out: { fish_cooked: 1 },  in: { fish: 1 },      time: 12, desc: '烤任意鱼', useTag: 'fish' },
    { id: 'shark_cooked', out: { shark_cooked: 1 }, in: { shark_raw: 1 }, time: 16, desc: '鲨鱼排' },
    { id: 'potato_baked', out: { potato_baked: 1 }, in: { potato: 1 },    time: 10, desc: '烤土豆' },
    { id: 'egg_cooked',   out: { egg_cooked: 1 },   in: { egg: 1 },       time: 8,  desc: '煎蛋' },
  ],
  smelter: [
    { id: 'ingot', out: { ingot: 1 }, in: { scrap: 3, wood: 1 },  time: 20, desc: '金属锭' },
    { id: 'ore_ingot', out: { ingot: 2 }, in: { ore: 2, wood: 1 }, time: 26, desc: '矿石炼锭' },
    { id: 'brick', out: { brick: 2 }, in: { clay: 2, wood: 1 },   time: 18, desc: '烧砖' },
    { id: 'glass', out: { glass: 1 }, in: { sand: 2, wood: 1 },   time: 18, desc: '熔玻璃' },
  ],
};

// 燃料价值（秒）：熔炉/净水器烧棕榈叶或木材
export const FUEL = { wood: 14, palm_leaf: 9 };

// ---------------- 鱼类 ----------------
export const FISH = [
  { id: 'fish_sardine',  w: 34, diff: 0.9, name: '沙丁鱼' },
  { id: 'fish_mackerel', w: 28, diff: 1.1, name: '鲭鱼' },
  { id: 'fish_grouper',  w: 18, diff: 1.4, name: '石斑鱼' },
  { id: 'fish_tuna',     w: 12, diff: 1.7, name: '金枪鱼' },
  { id: 'fish_sword',    w: 5,  diff: 2.2, name: '剑鱼' },
  { id: 'fish_lantern',  w: 3,  diff: 1.9, name: '灯笼鱼', nightOnly: true },
];

// ---------------- 商筏 ----------------
export const SHOP_STOCK = [
  { id: 'seed_berry', coin: 2 }, { id: 'seed_potato', coin: 2 }, { id: 'rope', coin: 2 },
  { id: 'nail', coin: 2 }, { id: 'cloth', coin: 3 }, { id: 'glass', coin: 3 },
  { id: 'brick', coin: 3 }, { id: 'bolt', coin: 4 }, { id: 'ingot', coin: 5 },
  { id: 'radio_part', coin: 12 }, { id: 'map_frag', coin: 15, rare: true },
];
export const SELL_PRICES = { pearl: 10, shark_tooth: 5 };

// ---------------- 主线任务 ----------------
export const QUESTS = [
  { id: 'q1',  name: '拾荒新手',   desc: '用手钩收集 8 件漂流物',            check: s => s.stats.collected >= 8,   reward: { wood: 4, rope: 2 } },
  { id: 'q2',  name: '第一口水',   desc: '建造净水器并喝到纯净水',           check: s => s.stats.drank >= 1,       reward: { plastic: 6 } },
  { id: 'q3',  name: '热乎饭',     desc: '建造烤架并烤出一份熟食',           check: s => s.stats.cooked >= 1,      reward: { wood: 8, nail: 4 } },
  { id: 'q4',  name: '扬帆起航',   desc: '建造帆并航行累计 200 米',          check: s => s.stats.sailed >= 200,    reward: { cloth: 4, rope: 4 } },
  { id: 'q5',  name: '初登孤岛',   desc: '航行抵达一座岛屿并登岛',           check: s => s.stats.islands >= 1,     reward: { wood: 10, scrap: 6 } },
  { id: 'q6',  name: '铁器时代',   desc: '建造熔炉并炼出一块金属锭',         check: s => s.stats.ingots >= 1,      reward: { scrap: 8, clay: 4 } },
  { id: 'q7',  name: '斗鲨勇士',   desc: '用长矛击退鲨鱼 3 次',              check: s => s.stats.sharkFlee >= 3,   reward: { ingot: 2 } },
  { id: 'q8',  name: '自给自足',   desc: '种植并收获 3 份作物',              check: s => s.stats.harvest >= 3,     reward: { seed_potato: 2, seed_berry: 2 } },
  { id: 'q9',  name: '渔翁',       desc: '钓上 5 条鱼',                      check: s => s.stats.fish >= 5,        reward: { cloth: 4, glass: 2 } },
  { id: 'q10', name: '藏宝猎人',   desc: '打开 3 个岛屿宝箱',                check: s => s.stats.chests >= 3,      reward: { pearl: 1 } },
  { id: 'q11', name: '地图拼图',   desc: '收集 3 张地图碎片并修复无线电',    check: s => s.stats.radioFixed >= 1,  reward: { shark_cooked: 2, water: 2 } },
  { id: 'q12', name: '灯塔之光',   desc: '航行抵达灯塔岛，呼叫救援',         check: s => s.stats.lighthouse >= 1,  reward: {} },
];

// ---------------- 成就 ----------------
export const ACHIEVEMENTS = [
  { id: 'a_day1',  name: '活过第一夜',   desc: '存活 1 天',            check: s => s.stats.days >= 1 },
  { id: 'a_day7',  name: '老水手',       desc: '存活 7 天',            check: s => s.stats.days >= 7 },
  { id: 'a_day15', name: '海洋之子',     desc: '存活 15 天',           check: s => s.stats.days >= 15 },
  { id: 'a_wood',  name: '木材大亨',     desc: '累计收集 120 件物品',  check: s => s.stats.collected >= 120 },
  { id: 'a_fish',  name: '钓鱼佬',       desc: '累计钓鱼 20 条',       check: s => s.stats.fish >= 20 },
  { id: 'a_night', name: '夜光垂钓',     desc: '钓上一条灯笼鱼',       check: s => !!s.stats.lantern },
  { id: 'a_shark', name: '屠鲨者',       desc: '击杀一条鲨鱼',         check: s => s.stats.sharkKill >= 1 },
  { id: 'a_shark3',name: '海洋霸主',     desc: '击杀 3 条鲨鱼',        check: s => s.stats.sharkKill >= 3 },
  { id: 'a_isle3', name: '环游者',       desc: '造访 3 座岛屿',        check: s => s.stats.islands >= 3 },
  { id: 'a_isle6', name: '哥伦布',       desc: '造访 6 座岛屿',        check: s => s.stats.islands >= 6 },
  { id: 'a_raft',  name: '海上庄园',     desc: '木筏达到 30 块地板',   check: s => s.stats.tiles >= 30 },
  { id: 'a_farm',  name: '快乐农夫',     desc: '累计收获 15 份作物',   check: s => s.stats.harvest >= 15 },
  { id: 'a_chef',  name: '米其林大厨',   desc: '累计烹饪 20 次',       check: s => s.stats.cooked >= 20 },
  { id: 'a_rain',  name: '暴雨淋浴',     desc: '在暴雨中淋雨 20 秒',   check: s => s.stats.rainTime >= 20 },
  { id: 'a_sail',  name: '千里航行',     desc: '累计航行 2000 米',     check: s => s.stats.sailed >= 2000 },
  { id: 'a_chest', name: '寻宝家',       desc: '打开 6 个宝箱',        check: s => s.stats.chests >= 6 },
  { id: 'a_gull',  name: '护菜卫士',     desc: '赶走一只偷菜海鸥',     check: s => s.stats.gullShoo >= 1 },
  { id: 'a_dive',  name: '深潜者',       desc: '潜水采集 20 次',       check: s => s.stats.diveTake >= 20 },
  { id: 'a_full',  name: '酒足饭饱',     desc: '饱食度与水分同时 ≥90', check: s => s.player.hunger >= 90 && s.player.thirst >= 90 },
  { id: 'a_lv5',   name: '老练船长',     desc: '等级达到 5 级',        check: s => s.level >= 5 },
  { id: 'a_trade', name: '商路通四海',   desc: '与商筏完成一次交易',   check: s => s.stats.trades >= 1 },
  { id: 'a_boss',  name: '屠戮深渊',     desc: '猎杀一头巨鲨',         check: s => s.stats.bossKill >= 1 },
  { id: 'a_dolph', name: '海豚之友',     desc: '与海豚同游累计 30 秒', check: s => s.stats.dolphinTime >= 30 },
  { id: 'a_vortex',name: '漩涡淘金者',   desc: '从漩涡中心取得宝藏',   check: s => s.stats.vortexLoot >= 1 },
  { id: 'a_wreck', name: '沉船猎手',     desc: '搜刮完一艘沉船',       check: s => s.stats.wrecks >= 1 },
  { id: 'a_blade', name: '鲨牙之刃',     desc: '锻造巨鲨战刃',         check: s => s.stats.gearBlade >= 1 },
  { id: 'a_ssail', name: '乘风破浪',     desc: '鞣制鲨鱼皮帆',         check: s => s.gear.sharkSail === true },
  { id: 'a_daily5',name: '持之以恒',     desc: '完成 5 次每日挑战',    check: s => s.stats.dailyDone >= 5 },
  { id: 'a_whale', name: '鲸奇相遇',     desc: '目睹一次鲸鱼巡游',     check: s => s.stats.whale >= 1 },
  { id: 'a_meteor',name: '对流星许愿',   desc: '流星雨夜许下愿望',     check: s => s.stats.meteorWish >= 1 },
  { id: 'a_barg',  name: '砍价鬼才',     desc: '在商筏砍价成功',       check: s => s.stats.bargainWins >= 1 },
  { id: 'a_kraken',name: '触手克星',     desc: '击退克拉肯海怪',       check: s => s.stats.krakenKill >= 1 },
  { id: 'a_amulet',name: '深渊祝福',     desc: '佩戴海怪护符',         check: s => s.gear.krakenAmulet === true },
  { id: 'a_let6',  name: '故事搜集者',   desc: '收集 6 封漂流瓶信件',  check: s => s.letters.length >= 6 },
  { id: 'a_let12', name: '海上史官',     desc: '集齐全部 12 封信件',   check: s => s.letters.length >= 12 },
  { id: 'a_end',   name: '灯塔之约',     desc: '完成主线：获救',       check: s => s.stats.rescued >= 1 },
];

// 成就解锁奖励（未列出的默认古币×2）
export const ACH_REWARDS = {
  a_day1: { coin: 3 }, a_day7: { coin: 8, water: 2 }, a_day15: { coin: 15, pearl: 1 },
  a_wood: { nail: 4 }, a_fish: { bait: 4 }, a_night: { coin: 6 },
  a_shark: { coin: 5 }, a_shark3: { coin: 10, ingot: 1 }, a_isle3: { coin: 5 },
  a_isle6: { coin: 12 }, a_raft: { coin: 8, nail: 6 }, a_farm: { seed_potato: 2, seed_berry: 2 },
  a_chef: { coin: 6 }, a_rain: { water: 2 }, a_sail: { coin: 8 }, a_chest: { coin: 8 },
  a_gull: { feather: 3 }, a_dive: { coin: 6 }, a_full: { coin: 4 }, a_lv5: { coin: 8, glass: 2 },
  a_trade: { coin: 4 }, a_boss: { coin: 12 }, a_dolph: { coin: 8 },
  a_vortex: { coin: 6 }, a_wreck: { coin: 6 }, a_blade: { coin: 8 }, a_ssail: { coin: 8 },
  a_daily5: { coin: 10 }, a_whale: { coin: 6 }, a_meteor: { coin: 5 }, a_barg: { coin: 5 },
  a_kraken: { coin: 15, pearl: 1 }, a_amulet: { coin: 8 }, a_let6: { coin: 8 }, a_let12: { coin: 20 },
  a_end: { coin: 30 },
};

// ---------------- 岛屿类型 ----------------
export const ISLAND_TYPES = {
  sand:   { name: '白沙岛', r: [110, 150], color: '#F5E3B3', palm: 4, rock: 0, bush: 2, chest: 0.5, loot: ['sand', 'sand', 'coconut'] },
  jungle: { name: '丛林岛', r: [140, 190], color: '#A8D78A', palm: 3, rock: 1, bush: 4, chest: 0.6, loot: ['wood', 'berry', 'vinegoo'] },
  rock:   { name: '礁石岛', r: [120, 170], color: '#C9C3B8', palm: 1, rock: 4, bush: 1, chest: 0.7, loot: ['stone', 'ore', 'scrap'] },
};

// 岛屿宝箱掉落表
export const CHEST_LOOT = [
  { id: 'map_frag', n: [1, 1], p: 0.55 },
  { id: 'radio_part', n: [1, 1], p: 0.4 },
  { id: 'ingot', n: [1, 3], p: 0.5 },
  { id: 'coin', n: [2, 6], p: 0.5 },
  { id: 'pearl', n: [1, 2], p: 0.35 },
  { id: 'seed_berry', n: [1, 3], p: 0.4 },
  { id: 'seed_potato', n: [1, 3], p: 0.4 },
  { id: 'cloth', n: [2, 4], p: 0.4 },
  { id: 'glass', n: [1, 2], p: 0.3 },
];

// ---------------- 常量调参 ----------------
export const CFG = {
  playerSpeed: 172,          // px/s 筏上
  swimSpeed: 112,            // px/s 游泳
  hookRange: 330,            // 手钩射程
  hookSpeed: 700,
  oxygenMax: 22,             // 潜水氧气秒数
  hungerRate: 100 / 700,     // 每秒掉
  thirstRate: 100 / 560,
  hpRegen: 0.6,              // 满状态回血
  starveDmg: 1.2,
  sharkBiteDmg: 16,
  tileHp: 3,
  sharkHp: 5,
  sharkRespawn: 95,          // 秒
  sailSpeed: 46,             // px/s 帆速
  currentSpeed: 9,           // 洋流(漂流物相对速度)
  gullStealTime: 9,
  saveEvery: 25,
};
