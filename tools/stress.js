// 交互压力测试：node tools/stress.js — 遍历全部面板/设置开关/快速开闭，抓运行时错误
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const base = process.argv[2] || 'http://localhost:8734';
  for (const [name, url] of [['2D', base + '/'], ['3D', base + '/3d/']]) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await p.goto(url + '?v=' + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(3000);
    await p.click('#btnNew');
    await p.waitForTimeout(1000);
    const result = await p.evaluate(async () => {
      const out = [];
      const tick = () => new Promise(r => setTimeout(r, 60));
      try {
        // 物资
        S.inv.slots[0] = { id: 'wood', n: 60 }; S.inv.slots[1] = { id: 'plastic', n: 40 };
        S.inv.slots[2] = { id: 'scrap', n: 40 }; S.inv.slots[3] = { id: 'palm_leaf', n: 40 };
        S.inv.slots[4] = { id: 'cloth', n: 20 }; S.inv.slots[5] = { id: 'rope', n: 20 };
        S.inv.slots[6] = { id: 'coin', n: 50 }; S.inv.slots[7] = { id: 'pearl', n: 2 };
        S.inv.slots[8] = { id: 'bait', n: 5 };
        // 遍历全部面板
        const panels = ['inv', 'craft', 'build', 'upg', 'quests', 'achv', 'letters', 'map', 'stats', 'help', 'settings'];
        for (const pn of panels) {
          const ui = await import(location.pathname.includes('/3d') ? '../js/ui.js' : './js/ui.js');
          ui.openPanel(pn);
          await tick();
          const vis = document.getElementById('panelWrap').style.display !== 'none';
          if (!vis) out.push('面板未打开: ' + pn);
          ui.closePanel();
          await tick();
        }
        // 设置交互
        S.settings.eco30 = true; S.settings.eco30 = false;
        S.settings.quality = 'low';
        if (window.__applyQuality) window.__applyQuality('low');
        S.settings.quality = 'high';
        if (window.__applyQuality) window.__applyQuality('high');
        // 工具切换所有权校验
        S.player.tool = 'spear_metal'; // 未拥有 → 应无效（键盘路径已校验；直接赋值绕过，仅检查不崩溃）
        S.player.tool = 'hook';
        // 砍价小游戏快速开关
        const { spawnMerchant } = await import(location.pathname.includes('/3d') ? '../js/entities.js' : './js/entities.js');
        spawnMerchant();
        const { startBargain, stopBargain } = await import(location.pathname.includes('/3d') ? '../js/bargain.js' : './js/bargain.js');
        startBargain(); stopBargain();
        S.entities.merchant = null;
        // 商店无商筏时买卖
        const inv = await import(location.pathname.includes('/3d') ? '../js/inv.js' : './js/inv.js');
        const sold = inv.sellItem('pearl'); // 应失败（无商筏）
        if (sold) out.push('无商筏仍可出售');
        // 死亡→重开
        damagePlayer(9999, null);
        await tick();
        document.querySelector('#btnRestart')?.click();
        await tick();
        if (S.mode !== 'play') out.push('重开失败 mode=' + S.mode);
        // 昼夜快进 + 天气全遍历
        for (let i = 0; i < 300; i++) {
          S.time.frac += 0.01;
          if (S.time.frac >= 1) { S.time.frac -= 1; S.time.day++; }
        }
        const wtypes = ['sunny', 'cloudy', 'windy', 'rain', 'storm', 'foggy'];
        for (const wt of wtypes) { S.weather.type = wt; S.weather.intensity = 1; await tick(); }
        S.weather.type = 'sunny'; S.weather.rainbow = 5;
        await tick();
      } catch (e) {
        out.push('EXC: ' + (e && e.message));
      }
      return out;
    });
    if (result.length) errs.push(...result.map(r => 'logic: ' + r));
    console.log(name + ': ' + (errs.length ? '❌ ' + errs.slice(0, 6).join(' | ') : '✅ 无错误'));
    await p.close();
  }
  await browser.close();
})().catch(e => { console.error('stress crashed:', e.message); process.exit(2); });
