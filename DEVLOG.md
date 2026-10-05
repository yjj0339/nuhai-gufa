# DEVLOG · 怒海孤筏

## 2026-10-04 · v2.3 船员与续航版

- **🧑‍🤝‍🧑 船员系统**：第 2 天起岛屿随机刷求救幸存者（小地图绿点，240s 不救会漂走），E 救援上筏；最多 3 人，角色按顺序=渔手（85s 自动钓鱼）/杂工（100s 打捞物资）/厨师（40s 自动把生鱼烤熟，库存<10 才做）；CREW_NAMES 名字池；2D 俯视小人+名牌，3D 用 player GLB 克隆换 Torso 材质色（clone 共享材质必须 material.clone() 再染色）。
- **成就扩到 40**：船员×2/美观10/挂饵钓鱼，各配奖励。
- **🔋 续航与体验**：设置新增省电模式（3D 限 30 帧）；画质高/低改为实时生效（__applyQuality：阴影/像素比热切换）；切后台 visibilitychange 自动存档；升级时 2D 金星爆开 + 3D 金色光环。
- **性能**：overlay2d 水下渐变/低血晕影 gradient 按尺寸缓存（原来每帧新建）。
- 双端自测 2D 60 步 / 3D 22 步全绿。

## 2026-10-04 · v2.2 手感修复版（穿模/卡顿/节奏）

- **🐛 耳朵穿模根因**：build_models.py 给玩家每个部件单独 rotation -90°Z（本意转身朝向），但手臂原点在肩部——旋转后整条手臂水平戳出躯干两侧，看起来像两只"耳朵"。修复：部件零旋转直建（面朝 -Y），只把 root 转 +90°Z；顺带加了眼睛。player3d 朝向补偿 +π/2 同步移除（模型现在真朝 +X）。
- **⚡ 卡顿三连修**：
  1. **商筏招牌每帧重建 CanvasTexture 并 dispose**（GPU 纹理泄漏，越玩越卡的头号元凶）→ 只在秒数/折扣变化时重建；
  2. HUD 重 DOM 写入（任务/天气/文字）每帧执行 → 条类保留每帧，其余 5Hz 节流；
  3. 阴影 2048→1536+PCF、像素比 1.6→1.35、海面 128²→96² 网格；新增 **perfTick 自适应流畅模式**：连续 3 秒 <40fps 自动关阴影+降像素比+toast 提示。
- **🎮 手感调优**：移速 150→172/游泳 95→112、钩速 620→700、初始物资翻倍（木12/塑6/叶6/水2/饵2）、经验曲线 32+36(n-1) 更快升级、鲨鱼首现 50s→85s 且刷新间隔 70→95s、钓鱼更容易（初始进度 0.4/咬合区 0.16/消退 -0.14/时限+1s）。
- Blender 重导出 player.glb（37→80KB，含眼睛）。双端自测 2D 55 步 / 3D 22 步全绿。

## 2026-10-04 · v2.1 沉浸感与深度版

- **玩法新深度（2D/3D 共享逻辑）**：
  - 🪱 鱼饵：palm_leaf×2→bait×2；startFishing 自动消耗，稀有鱼权重×1.9；带走饵状态在结算 toast 提示。
  - ✨ 装饰系统：旗帜/盆栽/吊椅三种 decor 建筑，放置 beauty+1/+2、拆除与鲨鱼咬碎会回退；eff.hungerRate 按 beauty≥5/≥10 给 -5%/-10%。
  - 🎁 成就奖励：ACH_REWARDS 表（未列出默认古币×2），解锁即 grantLoot；成就面板显示奖励；36 个全部配置。
  - 旧存档兼容：loadGame 对 12 个新增 stats 字段做类型兜底（beauty 曾经 NaN 事故：Object.assign 后 undefined +1）。
- **3D 沉浸感（js3d）**：
  - 🤿 潜水相机：swimming 时 camTarget.y→-0.55、camDist×0.75、相机强制沉入水线以下；雾切水下深蓝（near1.5/far16）；overlay 加蓝色渐变滤镜+弧光框。
  - ⛈️ 雷暴闪电：复用 S.weather.flash，叠加 sun/hemi 强度爆闪与天空白化。
  - 🌈 彩虹：**天穹 shader 低空色带 + 海面倒影带双方案**（关键教训：俯视相机 FOV52/lookAt 低，任何仰角<26°的相机上缘都是负仰角——天上物体根本进不了画面！最终用海面 shader 的七色倒影带实现，从木筏向 -Z 铺开，绘制顺序放在雾之后防止被稀释）。
  - 🌠 流星：overlay2d 绘制 S.meteors（线段+✦）。
- 自测：2D 55 步全绿、3D 22 步全绿；verify/soak 0 报错。

## 2026-10-04 · v2.0 3D 版（three.js）

- 新增 `/3d/` 版本：three.js r170（vendored）渲染，与 2D 版**共享全部逻辑模块**（/js/ 下 data/state/inv/upgrades/daily/letters/bargain/quests/audio/save/fishing/player/world/raft/entities/weather/ui 逻辑不动），js3d/ 只写渲染层（scene3d/raft3d/world3d/entities3d/player3d/overlay2d/main3d）。
- **角色资产**：Blender 5.2 无头建模 8 个 GLB（player/shark/dolphin/whale/gull/fish/tentacle/palm），低多边形+flat shading；部件命名（Tail/WingL/WingR/LegL/ArmR/Fluke 等）供 three 侧按名做程序化动画（尾摆/翅膀扇/走路摆臂）。
- **海洋**：自定义 ShaderMaterial，三重正弦波顶点位移 + 深浅色混合 + 木筏边缘泡沫圈（uniform 传 bounds）+ 正弦波光（第一版用 hash 方块闪光，丑，已改条带波光）。
- **昼夜**：驱动天空穹顶渐变、太阳角度/强度/色温、雾色、海色、星空 opacity、月亮位置；夜晚灯柱 PointLight/营火 emissive 真实发光。
- **坑**：①GLTFLoader 还依赖 utils/BufferGeometryUtils.js（相对导入 404 断链全页面）；②GLB 相对路径相对页面而非模块 → '../assets/models/'；③initPlayer3d 必须等 GLB 加载完否则落兜底占位（玩家变红胶囊）；④无头 WebGL 帧率低，自测等待用 setTimeout 不用帧数；⑤three r170 无 three.core 拆分。
- 2D ui.js 三处兼容改造（_screenToWorld 回调 / _customWorldTap 自管点击 / export handleWorldTap），对 2D 行为零影响。
- 3D 自测 22 步全绿（含 GLB 加载数、渲染 drawcalls、3D 地板网格同步计数）；手机端摇杆正常。

## 2026-10-04 · v1.3 海怪与信件版

- **🦑 克拉肯**：第 10 天起每 7 天一次，4 条触手从木筏四周升起（紫色警戒圈）；触手 hunt→slam 循环：近了拍人下水、远了卷边缘地板；各 4 HP，全灭得战利品（触手/珍珠/古币/几率地图碎片）。攻击优先选触手。
- **🧿 海怪护符**：触手×2+珍珠+绳 → S.gear.krakenAmulet，潜水耗氧 ×0.65（与海豚护航叠乘）。
- **📖 信件册**：12 封航海故事（LETTERS 数据），漂流瓶开启时随机补一封未收集的；集齐奖古币15+珍珠2+80XP。S.letters 存 id 数组。
- **快捷键**：M 静音/恢复（记住 prevVolumes）、P 暂停（S.paused 冻结 update，画暂停遮罩）。
- 结局统计扩为 9 格（含信件/等级/海怪）。
- **真 bug**：entities.js 用 damagePlayer 却从未导入（鲨鱼咬玩家分支此前未触发过）——用动态 import 引用绕开与 player.js 的循环依赖。
- 自测扩至 46 步全绿；成就 36 个。

## 2026-10-04 · v1.2 装备与事件版

- **⚔️ 装备锻造线**：巨鲨掉牙→合成「巨鲨战刃」（伤害3/距离95，工具栏第4格）与「鲨鱼皮帆」（gear 配方：无产出、直接置 S.gear 标志，eff.sailSpeed ×1.25）。
- **📌 每日挑战**：6 目标池（打捞/钓鱼/烹饪/斗鲨/潜水/收获），跨天（weather day++ 或睡觉）bus.emit('newDay') 自动换题；奖励古币（随天数成长）+XP。
- **🐋 观鲸**：鲸鱼横穿海面、喷水，被看见（<640px）记 stats.whale+XP。
- **✨ 流星雨**：深夜 0.25% 概率触发 18 秒流星雨，流星带 wish 标记随机加 hunger/thirst/hp；S.meteor 单体改 S.meteors 数组；**推进/生成必须在 updateWeather（有 dt），draw 只画**——曾错插进 draw 函数报 ctx undefined。
- **🤝 砍价小游戏**（bargain.js）：每桌一次，指针停在绿区 7.5 折/黄区 9 折/红区涨价 1.1 倍；buyStock 按 m.discount 取整结算。**面板是 DOM 会挡 canvas 小游戏——开砍价必须关面板，结束后 bus 重开**。
- 自测扩至 39 步全绿；成就 32 个。

## 2026-10-04 · v1.1 强化版

- **⭐ 船长成长**：经验（收集/钓鱼/烹饪/战斗/探岛）→ 等级 → 升级点，7 项升级：神钩/肺活量/泳技/操帆/抗饿/矛术/幸运（幸运=打捞采集钓鱼几率双倍）。
- **🛒 商筏集市**：商筏定期到港 110 秒，随机 5 种商品用古币购买（含地图碎片/无线电零件），珍珠、鲨鱼牙可出售——古币/珍珠有了完整经济循环。
- **🐙 深渊巨鲨**：每 5 天出现，HP 14、咬 2 点、不逃跑，击杀掉古币+珍珠+鲨鱼牙+几率无线电零件。
- **🌀 漩涡**：向木筏漂移，卷入会持续绞碎地板；潜水进中心可拿宝藏（风险回报）。
- **🚢 沉船**：海底残骸 3-4 个搜刮点（废铁/螺栓/古币/几率地图碎片），搜完消失。
- **🐬 海豚**：第 2 天起偶尔来访，潜水护航：氧气消耗 ×0.55、鲨鱼不敢进入猎杀状态。
- **🌫️ 薄雾天气** + BGM 随天气/昼夜换调式（雷暴低沉小调/夜晚宁静）。
- **📊 航海统计面板**：20 项数据；新成就 6 个（共 26）。
- 自测扩至 31 步全绿。教训：updatePlayer 游泳分支会自动上浮，测试把玩家放水里要放离木筏远点；面板 toggle 式 openPanel 重复调用会关闭。

## 2026-10-04 · v1.0 首版交付

- 全新 2D 等距海上木筏生存游戏（区别于旧 3D 版 yjj0339.github.io/nuhai）。
- 模块化 ES Modules：data/state/audio/inv/world/raft/entities/player/fishing/weather/quests/save/ui/main。
- 完整系统：网格建造(16建筑)、鲨鱼AI、海鸥偷菜、潜水采集、钓鱼小游戏、农耕、航行风向、五类天气、昼夜、12环任务、20成就、灯塔结局+无尽模式、存档、程序化音频、手机摇杆。

### 测试基建
- `?test=1` 页面内自测（21 步），`tools/verify.js` playwright 全流程+截图，`tools/soak.js` 快进5游戏天浸泡。
- 自测暴露并修复的问题：ERRS 数组误当函数、测试脚本自覆盖物资槽、净水产出断言。

### 浸泡测试抓到的真 bug（游戏代码）
1. **帆航行时岛屿资源节点/宝箱不随岛移动**——会脱落在海里。updateWorld 里补齐 nodes/chest 位移。
2. **q12 结局判定死循环**（check 依赖 rescued，rescued 又只在 q12 完成时置位）——改为 stats.lighthouse 标志驱动。
3. **无线电建造费与修复费重复收 3 张地图碎片**——建造不再收碎片，修复时收。
4. **手机动作按钮/摇杆不显示**——CSS `display:none` 吞掉内联 `style.display=''`，需显式设 flex/block。
5. **无鼠标无头环境被误判触屏**——触屏判定收紧为 maxTouchPoints>0 且 pointer:coarse。

### 待办/思路
- 商筏交易、海豚 buff、漩涡等旧 3D 版特色可考虑移植。
- 存档版本号 v1，改动结构时注意兼容。
