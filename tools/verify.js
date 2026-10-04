// 无头验证：node tools/verify.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  // 1) 自测模式
  await page.goto('http://localhost:8734/?test=1', { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => document.title.startsWith('TEST-'), { timeout: 40000 });
  } catch (e) { errors.push('selftest timeout, title=' + await page.title()); }
  const title = await page.title();
  const test = await page.evaluate(() => window.__TEST || null).catch(() => null);
  console.log('==== 自测:', title);
  if (test) for (const s of test.steps) console.log(`  ${s.ok ? '✅' : '❌'} ${s.name} ${s.extra || ''}`);

  // 2) 菜单截图
  await page.goto('http://localhost:8734/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/menu.png' });

  // 3) 进入游戏跑一会
  await page.click('#btnNew');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/game-early.png' });
  // 模拟扔钩（自动瞄准）
  await page.evaluate(() => { S.input.hook = true; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { S.input.dive = true; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/game-dive.png' });
  await page.evaluate(() => { S.input.dive = true; });
  // 面板截图
  await page.evaluate(() => { S.input.use = false; });
  await page.keyboard.press('b');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/panel-build.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/panel-inv.png' });
  await page.keyboard.press('Escape');
  // 建造一块地板
  const built = await page.evaluate(() => {
    S.inv.slots[0] = { id: 'wood', n: 50 };
    return place('floor', 2, 0);
  }).catch(e => 'err:' + e.message);
  console.log('==== 建造地板:', built);
  // 钓鱼面板
  await page.evaluate(() => { S.player.tool = 'rod'; S.input.attack = true; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/fishing.png' });
  // 昼夜推进到夜晚
  await page.evaluate(() => { S.time.frac = 0.85; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/night.png' });
  await page.evaluate(() => { S.time.frac = 0.4; S.weather.type = 'storm'; S.weather.intensity = 1; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/storm.png' });

  // 4) 手机宽度
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mob.on('pageerror', e => errors.push('mob pageerror: ' + e.message));
  await mob.goto('http://localhost:8734/', { waitUntil: 'load' });
  await mob.waitForTimeout(1000);
  await mob.screenshot({ path: 'shots/mobile-menu.png' });
  await mob.tap('#btnNew');
  await mob.waitForTimeout(1800);
  await mob.screenshot({ path: 'shots/mobile-game.png' });

  console.log('==== 页面错误数:', errors.length);
  errors.slice(0, 12).forEach(e => console.log('  ⚠️', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('verify crashed:', e); process.exit(2); });
