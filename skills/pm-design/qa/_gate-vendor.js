'use strict';
/* ════════════════════════════════════════════════════════════════════════
   闸·离线 vendor 缓存 · _gate-vendor.js · 仅维护者 QA 用（不随客户包·客户交付走离线版原型）
   ────────────────────────────────────────────────────────────────────────
   根治"浏览器隔离闸依赖 CDN 加载 916KB ElementPlus → headless 里加载慢/被限速 → window.ElementPlus
   迟迟不就绪 → Vue/标注层不挂载 → 圈选失效 → 闸假红"。
   做法：把 skeleton 用的 5 个 CDN 资产【下载一次、缓存到 .gate-vendor-cache/、以后永久复用】；
        browser gate 现装原型后调 localize() 把 unpkg URL 换成本地文件名，再把缓存文件拷进 gate 的
        静态目录 → headless 从 localhost 秒加载、彻底不依赖网络（首次下载失败才 SKIP）。
   注：.gate-vendor-cache/ 应加进 .gitignore——是 QA 本地缓存、不进版本库、不发客户。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), https = require('https');
/* §2026-09-16：改读【随包】的 ../vendor —— 原来放在 .gate-vendor-cache/ 且被 .gitignore 排除，
   等于每台新机器第一次都要联网下 1.75MB（实测慢链路上 ~190 秒），装完就慢一次、还必须能联网。
   随包后：新用户开箱即用、完全离线也能跑；升级版本时 URL 变 → marker 不匹配 → 自动重下并更新 vendor/。 */
const CACHE = path.join(__dirname, '..', 'vendor');
const ASSETS = [
  { file: 'vue.js',   url: 'https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js' },
  { file: 'ep.css',   url: 'https://unpkg.com/element-plus@2.6.3/dist/index.css' },
  { file: 'ep.js',    url: 'https://unpkg.com/element-plus@2.6.3/dist/index.full.min.js' },
  { file: 'icons.js', url: 'https://unpkg.com/@element-plus/icons-vue@2.3.1/dist/index.iife.min.js' },
  { file: 'eploc.js', url: 'https://unpkg.com/element-plus@2.6.3/dist/locale/zh-cn.min.js' },
  { file: 'html2canvas.js', url: 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js' },  // 截图闸㉙用：captureScreen 的截图库·预置到 window.html2canvas 免 CDN
];
function dl(url, dest, redir = 0) {
  return new Promise((res, rej) => {
    if (redir > 5) return rej(new Error('too many redirects'));
    const req = https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return dl(new URL(r.headers.location, url).href, dest, redir + 1).then(res, rej); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const f = fs.createWriteStream(dest); r.pipe(f);
      f.on('finish', () => f.close(() => res())); f.on('error', e => { try { fs.unlinkSync(dest); } catch (_) {} rej(e); });
    });
    req.on('error', e => { try { fs.unlinkSync(dest); } catch (_) {} rej(e); });
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}
// 确保缓存齐全（缺的才下·下失败重试3次）；全齐返回 {ok:true,dir}，缺任一返回 {ok:false,missing}
async function ensureVendor() {
  try { fs.mkdirSync(CACHE, { recursive: true }); } catch (_) {}
  for (const a of ASSETS) {
    const p = path.join(CACHE, a.file);
    const marker = p + '.url';  // §版本失效(2026-09-15)：缓存来源 URL 与当前声明不一致(升级/换版本)则重下·根治「升 EP 后仍用旧缓存→版本错配→标注层不挂载→⑯假红」
    let cachedUrl = ''; try { cachedUrl = fs.readFileSync(marker, 'utf8'); } catch (_) {}
    if (fs.existsSync(p) && fs.statSync(p).size > 1000 && cachedUrl === a.url) continue;
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) { try { await dl(a.url, p); ok = fs.existsSync(p) && fs.statSync(p).size > 1000; } catch (_) { ok = false; } }
    if (!ok) return { ok: false, missing: a.file };
    try { fs.writeFileSync(marker, a.url, 'utf8'); } catch (_) {}
  }
  return { ok: true, dir: CACHE };
}
// 原型 HTML 里的 unpkg <script>/<link> URL → 本地同名文件（gate 静态服务器需能服到这些文件）
function localize(html) {
  return String(html)
    .replace(/https:\/\/unpkg\.com\/vue@[^"'\s>]*/g, 'vue.js')
    .replace(/https:\/\/unpkg\.com\/element-plus@[\d.]+\/dist\/index\.css/g, 'ep.css')
    .replace(/https:\/\/unpkg\.com\/element-plus@[\d.]+\/dist\/index\.full\.min\.js/g, 'ep.js')
    .replace(/https:\/\/unpkg\.com\/@element-plus\/icons-vue@[^"'\s>]*/g, 'icons.js')
    .replace(/https:\/\/unpkg\.com\/element-plus@[\d.]+\/dist\/locale\/zh-cn\.min\.js/g, 'eploc.js');
}
// 把缓存里的 vendor 文件拷进目标目录（gate 静态服务器服该目录）
function copyVendorInto(dir) {
  for (const a of ASSETS) { try { fs.copyFileSync(path.join(CACHE, a.file), path.join(dir, a.file)); } catch (_) {} }
}
module.exports = { ensureVendor, localize, copyVendorInto, CACHE, ASSETS };
