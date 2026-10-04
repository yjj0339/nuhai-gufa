# DEVLOG · 怒海孤筏

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
