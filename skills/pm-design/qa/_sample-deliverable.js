'use strict';
/* ════════════════════════════════════════════════════════════════════════
   随包样例交付原型 · _sample-deliverable.js · 2026-11-14
   ────────────────────────────────────────────────────────────────────────
   为什么：以前好几道闸在 archive 里找不到别的原型时，实际一直拿用户自己的一份业务原型当测试样本。
   用户删掉那份原型后，这些闸要么找不到样本直接判红，要么悄悄跳过、等于没查。
   做法：archive 里没有用户原型时，用随包的中性数据 fixtures/sample-deliverable-data.json，
        当场用【当前】骨架 + 标注层装配一份，并把 vendor 里的 Vue / Element Plus 内联进去，
        得到一份和真实离线交付件同形的单文件（文件名带「装配版」「offline」）。
        每次都从当前标准件现装，所以测的永远是最新标注层，不会像旧 fixture 那样过时。
   产物放本进程临时目录（_tmp-sandbox 接管，进程退出自动删），同一进程只装一次。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
try { require('../../_shared/qa/_tmp-sandbox'); } catch (_) {}

const SAMPLE_DATA = path.join(__dirname, 'fixtures', 'sample-deliverable-data.json');
const SAMPLE_NAME = '样例系统-装配版-offline.html';
let _cached = null;

function inlineVendor(html) {
  const vdir = path.join(__dirname, '..', 'vendor');
  const read = f => fs.readFileSync(path.join(vdir, f), 'utf8');
  const tags = [
    [/<script src="https:\/\/unpkg\.com\/vue@[^"]*"><\/script>/, () => '<script>\n/* vue inlined */\n' + read('vue.js') + '\n</script>'],
    [/<link rel="stylesheet" href="https:\/\/unpkg\.com\/element-plus@[^"]*\/dist\/index\.css"\s*\/?>/, () => '<style>\n/* ep_css inlined */\n' + read('ep.css') + '\n</style>'],
    [/<script src="https:\/\/unpkg\.com\/element-plus@[^"]*\/dist\/index\.full\.min\.js"><\/script>/, () => '<script>\n/* ep_js inlined */\n' + read('ep.js') + '\n</script>'],
    [/<script src="https:\/\/unpkg\.com\/@element-plus\/icons-vue[^"]*"><\/script>/, () => '<script>\n/* icons inlined */\n' + read('icons.js') + '\n</script>'],
    [/<script src="https:\/\/unpkg\.com\/element-plus@[^"]*\/dist\/locale\/zh-cn\.min\.js"><\/script>/, () => '<script>\n/* ep_locale inlined */\n' + read('eploc.js') + '\n</script>'],
  ];
  /* 用函数做替换值：vendor 代码里有 $& / $1 之类字样，直接当替换串会被当成正则引用 */
  for (const [re, body] of tags) { const b = body(); html = html.replace(re, () => b); }
  return html;
}

/* 返回样例交付件的绝对路径；装配失败返回 null（调用方按"无样本"处理并打印原因） */
function sampleDeliverable() {
  if (_cached && fs.existsSync(_cached)) return _cached;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sample-deliv-'));
    const raw = path.join(dir, 'raw.html');
    execFileSync(process.execPath, [path.join(__dirname, 'assemble-prototype.js'), SAMPLE_DATA, raw, '--fast'], { stdio: 'pipe', timeout: 120000 });
    const out = path.join(dir, SAMPLE_NAME);
    fs.writeFileSync(out, inlineVendor(fs.readFileSync(raw, 'utf8')), 'utf8');
    try { fs.unlinkSync(raw); } catch (_) {}
    _cached = out;
    return out;
  } catch (e) {
    console.log('  ⚠ 随包样例交付件装配失败：' + String(e.message || e).split('\n')[0]);
    return null;
  }
}

/* 闸的自动探测结果为空时换成样例：有用户原型就照旧测用户原型，一份都没有才用样例（并打印说明，不悄悄换） */
function orSample(list) {
  if (list && list.length) return list;
  const s = sampleDeliverable();
  if (!s) return [];
  console.log('  （archive 里没有用户交付原型 → 改测随包样例「' + SAMPLE_NAME + '」，由当前骨架和标注层现装）');
  return [s];
}

module.exports = { sampleDeliverable, orSample, SAMPLE_DATA, SAMPLE_NAME };
