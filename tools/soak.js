// 浸泡测试：node tools/soak.js — 快进昼夜/天气/鲨鱼/航行/登岛，抓运行时错误
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8734/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.click('#btnNew');
  await page.waitForTimeout(500);

  const log = await page.evaluate(async () => {
    const out = [];
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const tick = () => new Promise(r => requestAnimationFrame(r));
    try {
      // 给足物资
      Object.assign(S.inv.slots[0] = { id: 'wood', n: 99 }, {});
      S.inv.slots[1] = { id: 'plastic', n: 60 };
      S.inv.slots[2] = { id: 'scrap', n: 60 };
      S.inv.slots[3] = { id: 'palm_leaf', n: 60 };
      S.inv.slots[4] = { id: 'cloth', n: 30 };
      S.inv.slots[5] = { id: 'rope', n: 30 };
      S.inv.slots[6] = { id: 'brick', n: 20 };
      // 建一批设施
      place('floor', 2, 0); place('floor', 0, 2); place('floor', -2, 0); place('floor', 0, -2);
      out.push('tiles=' + S.raft.tiles.size);
      place('smelter', -1, 0); place('farm', 1, 0); place('bed', -1, -1); place('chest', 1, -1);
      place('raincatcher', -1, 1); place('scarecrow', 0, 1); place('lamp', 1, 1); place('campfire', 0, -1);
      place('radio', 2, 0);
      out.push('built ok');
      // 种田
      const farmTile = [...S.raft.tiles.values()].find(t => t.b && t.b.type === 'farm');
      S.inv.slots[7] = { id: 'seed_berry', n: 2 };
      S.player.x = (farmTile.c + 0.5) * 48; S.player.y = (farmTile.r + 0.5) * 48 + 40;
      doUse();
      const fk = farmTile.c + ',' + farmTile.r;
      out.push('farm=' + JSON.stringify(S.farmPlots[fk]));
      // 熔炉炼锭
      startStationCook('smelter', 'ingot', '-1,0');
      // 生成一条鲨鱼直接快进攻击
      S.entities.sharks.push({ x: 100, y: 0, dir: 0, state: 'circle', circT: 0.05, radius: 120, phase: 0, hp: 99, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: 0, target: null });
      // === 快进循环：5 游戏天 ===
      let storms = 0, nights = 0, sharkEvents = 0;
      for (let i = 0; i < 300; i++) {
        S.time.frac += 0.02; // 每步28.8分钟
        if (S.time.frac >= 1) { S.time.frac -= 1; S.time.day++; }
        // 随机天气切换
        if (i % 20 === 0) {
          const types = ['sunny', 'cloudy', 'windy', 'rain', 'storm'];
          S.weather.type = types[(i / 20 | 0) % 5];
          S.weather.timer = 30;
          if (S.weather.type === 'storm') storms++;
        }
        if ((S.time.frac > 0.8 || S.time.frac < 0.2) && !S._n) { S._n = 1; nights++; }
        if (S.time.frac < 0.8 && S.time.frac > 0.2) S._n = 0;
        // 鲨鱼快进攻击
        for (const s of S.entities.sharks) {
          if (s.state === 'circle') { s.circT = Math.min(s.circT, 0.05); sharkEvents++; }
          if (s.state === 'approach') s.warnT = Math.min(s.warnT, 0.05);
        }
        await tick(); await tick();
        if (S.mode === 'dead') { out.push('DIED at iter ' + i); break; }
      }
      out.push(`days=${S.time.day} storms=${storms} sharkEvents=${sharkEvents} tiles=${S.raft.tiles.size} hpSum=${[...S.raft.tiles.values()].reduce((a, t) => a + t.hp, 0)}`);
      // 快进烹饪
      for (const c of Object.values(S.cooking)) c.t = c.time + 1;
      await tick(); await tick();
      out.push(`cooked=${S.stats.cooked} ingots=${S.stats.ingots} collected=${S.stats.collected}`);
      // 航行测试：升帆对准最近岛
      const worldMod = await import('./js/world.js');
      const nearestIsland = worldMod.nearestIsland;
      S.anchor = false; S.sailing.raised = true;
      const isl = nearestIsland();
      if (isl) {
        S.sailing.angle = Math.atan2(isl.y, isl.x);
        S.wind.strength = 1;
        for (let i = 0; i < 600 && !islandNear(); i++) {
          S.sailing.angle = Math.atan2(isl.y, isl.x); // 自动纠偏
          await tick();
        }
        out.push('sail dist=' + Math.round(dist(0, 0, isl.x, isl.y) - isl.r) + ' sailed=' + Math.round(S.stats.sailed) + 'm');
      }
      // 登岛：直接传送到岛上
      if (isl) {
        S.player.x = isl.x; S.player.y = isl.y; S.player.swimming = true;
        await tick(); await tick();
        out.push('onIsland=' + (S.player.onIsland ? S.player.onIsland.type : 'null') + ' islands=' + S.stats.islands);
        // 砍树
        const node = isl.nodes.find(n => n.hp > 0);
        if (node) {
          S.player.swimming = false; S.player.x = node.x + 10; S.player.y = node.y;
          S.player.onIsland = isl;
          const w0 = countItem('wood');
          S.input.attack = true;
          await tick(); await tick();
          out.push('chop wood+' + (countItem('wood') - w0));
        }
        // 开宝箱
        if (isl.chest && !isl.chest.open) {
          S.player.x = isl.chest.x; S.player.y = isl.chest.y;
          doUse();
          out.push('chest opened=' + isl.chest.open + ' chests=' + S.stats.chests);
        }
      }
      // 修无线电 → 灯塔岛
      S.inv.slots[8] = { id: 'map_frag', n: 3 };
      const radioTile = [...S.raft.tiles.values()].find(t => t.b && t.b.type === 'radio');
      if (radioTile) {
        S.player.x = (radioTile.c + 0.5) * 48; S.player.y = (radioTile.r + 0.5) * 48 + 40;
        doUse();
        await tick();
        out.push('lighthouse=' + S.lighthouseFound + ' islands=' + S.islands.length);
      }
      // 死亡测试
      S.player.invul = 0; S.player.hp = 5;
      damagePlayer(50, null);
      out.push('dead mode=' + S.mode);
      // 复活继续
      S.mode = 'play'; S.player.hp = 100;
      saveGame(true);
      out.push('load=' + loadGame());
    } catch (e) {
      out.push('EXC: ' + (e && e.stack || e));
    }
    return out;

    function islandNear() {
      return S.islands.some(i => Math.hypot(i.x, i.y) - i.r < 130);
    }
  });

  log.forEach(l => console.log('  ' + l));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/soak-end.png' });
  console.log('页面错误数:', errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ⚠️', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('soak crashed:', e); process.exit(2); });
