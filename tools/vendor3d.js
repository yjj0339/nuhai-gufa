// 把 three.js 运行时复制进 vendor/（构建步骤）：node tools/vendor3d.js
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../node_modules/three');
const DEST = path.resolve(__dirname, '../vendor');

const files = [
  ['build/three.module.min.js', 'three.module.min.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'utils/BufferGeometryUtils.js'],
];

let ok = true;
for (const [rel, dest] of files) {
  const src = path.join(SRC, rel);
  if (!fs.existsSync(src)) { console.error('缺少源文件: ' + src); ok = false; continue; }
  const out = path.join(DEST, dest);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(src, out);
  console.log(`✅ ${rel} → vendor/${dest} (${(fs.statSync(out).size / 1024).toFixed(0)}KB)`);
}
// 检查 three.module.min.js 是否引用 three.core（r170+ 拆分构建）
const main = fs.readFileSync(path.join(DEST, 'three.module.min.js'), 'utf8').slice(0, 2000);
if (/three\.core/.test(main)) {
  const core = path.join(SRC, 'build/three.core.min.js');
  if (fs.existsSync(core)) {
    fs.copyFileSync(core, path.join(DEST, 'three.core.min.js'));
    console.log('✅ build/three.core.min.js → vendor/ (three.module 依赖)');
  } else { console.error('❌ three.module 需要 three.core 但未找到'); ok = false; }
} else {
  console.log('ℹ️ three.module.min.js 自包含，无需 three.core');
}
process.exit(ok ? 0 : 1);
