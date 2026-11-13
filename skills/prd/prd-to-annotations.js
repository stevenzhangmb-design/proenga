// PRD → 原型标注（不用圈选）：把 PRD 里每个功能点的【字段规范】【用例规则】原文放进原型对应按钮的标注。
// 用法：node prd-to-annotations.js <PRD.md> <映射.json> <输出 annotations.json> [--check]
//   映射.json：[{ "secs":["5.3.4.5.3"], "pages":["issuing","issuingR"], "tab":"近期发票" 或 ["异常发票","待处理"], "texts":["取消发票","更多"] }]
//     secs   PRD 功能点章节号（一个 sec 出一个标注；同一按钮多个 sec 会依次往右排开）
//     pages  原型页面 id（不分系统：电商、零售同名功能一个标注两边都显示）
//     tab    当前选中的页签/状态文字（数组=同时选中）；不配=不限
//     notTab 这些页签选中时不显示（可选）
//     texts  锚点按钮文字，按顺序找第一个看得见的（按钮收在【更多】里时可把“更多”放后面兜底）
//   输出文件放在 project-data 同目录、命名 <project-data 文件名去掉 .json>.annotations.json，装配时自动烤进原型。
//   映射不想手写：先跑 auto-anno-map.js 自动出草稿映射，再人工复核。
// 规则：只给 PRD 里写了字段规范或用例规则的功能点出标注；PRD 有、映射里没有的会列出来并以退出码 2 结束（防漏）。
// 也可当模块用：const { parsePrd, buildPins } = require('./prd-to-annotations.js')
const fs = require('fs');

const clean = s => s.replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1').replace(/\{custom-style="[^"]*"\}/g, '').replace(/\\([<>\[\]*_])/g, '$1');

// 解析 PRD：返回 { L, H, fpOf, body, kids, path, ancestors }
function parsePrd(mdPath) {
  const L = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
  // 1、标题表：# 标题 和 ::: {custom-style="Heading N"} 两种写法
  const H = [];
  for (let i = 0; i < L.length; i++) {
    let m = L[i].match(/^(#{1,6})\s+(.*)$/);
    if (m) { H.push({ lv: m[1].length, text: clean(m[2]).trim(), start: i, bodyFrom: i + 1 }); continue; }
    m = L[i].match(/^:::\s*\{custom-style="Heading (\d)"\}\s*$/);
    if (m) { let j = i + 1; const parts = []; while (j < L.length && !/^:::\s*$/.test(L[j])) parts.push(L[j++]); H.push({ lv: +m[1], text: clean(parts.join(' ')).trim(), start: i, bodyFrom: j + 1 }); i = j; }
  }
  H.forEach((h, k) => { h.num = (h.text.match(/^(\d+(?:\.\d+)*)\s/) || [])[1] || ''; h.name = h.text.replace(/^\d+(?:\.\d+)*\s*/, ''); h.end = k + 1 < H.length ? H[k + 1].start : L.length; h.k = k; });
  const body = h => clean(L.slice(h.bodyFrom, h.end).filter(l => !/^:::/.test(l)).join('\n')).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  const kids = h => { const out = []; for (let k = h.k + 1; k < H.length && H[k].lv > h.lv; k++) out.push(H[k]); return out; };
  const ancestors = h => { const p = [h]; let lv = h.lv; for (let k = h.k - 1; k >= 0 && lv > 1; k--) if (H[k].lv < lv) { p.unshift(H[k]); lv = H[k].lv; } return p.filter(x => x.lv > 1); };
  const path = h => ancestors(h).map(x => x.text).join(' › ');
  // 2、PRD 里所有带字段规范/用例规则的功能点
  const fpOf = new Map();
  H.forEach(h => { if (/^(字段规范|用例规则)$/.test(h.name)) { const par = [...H.slice(0, h.k)].reverse().find(x => x.lv < h.lv); if (par && par.num) fpOf.set(par.num, par); } });
  const directKids = h => kids(h).filter(x => [...H.slice(0, x.k)].reverse().find(y => y.lv < x.lv) === h);
  return { L, H, fpOf, body, kids, directKids, path, ancestors };
}

// 3、按映射出标注
function buildPins(prd, map) {
  const { fpOf, body, directKids, path } = prd;
  const pins = []; const mapped = new Set(); const problems = [];
  for (const e of map) for (const sec of e.secs) {
    const h = fpOf.get(sec);
    if (!h) { problems.push(`映射里的 ${sec} 在 PRD 里找不到，或它下面没有字段规范/用例规则`); continue; }
    mapped.add(sec);
    const ks = directKids(h);
    const fsH = ks.find(x => x.name === '字段规范'), ucH = ks.find(x => x.name === '用例规则');
    /* PRD 里写“请参考 x.x.x 的目录。不同之处：……”时，标注里把被引用那一节的原文接在后面（点开标注就能看全；PRD 本身不改） */
    const withRef = t => { const m = t.match(/请参考\s*([\d.]+\d)\s*的目录/); if (!m) return t;
      const ref = prd.H.find(x => x.num === m[1]); if (!ref) return t;
      return t + '\n\n（以下为 ' + ref.text + ' 原文）\n\n' + body(ref); };
    pins.push({
      id: 'prd-' + sec, x: 0, y: 0, number: pins.length + 1,
      title: h.name, content: '',
      fieldSpecs: fsH ? withRef(body(fsH)) : '', useCaseRules: ucH ? withRef(body(ucH)) : '',
      menuPath: path(h), prdSection: sec, type: '业务规则', selectorPath: '', pageKey: '',
      anchor: Object.assign({ pages: e.pages || [], tab: e.tab || '', texts: e.texts || [] }, e.notTab ? { notTab: e.notTab } : {}),
      zoneContext: { fpKey: '' }, isAIDraft: false, fromPrd: true,
    });
  }
  const unmapped = [...fpOf.keys()].filter(s => !mapped.has(s));
  return { pins, problems, unmapped };
}

module.exports = { parsePrd, buildPins, clean };

if (require.main === module) {
  const [, , mdPath, mapPath, outPath] = process.argv;
  if (!mdPath || !mapPath || !outPath) { console.error('用法：node prd-to-annotations.js <PRD.md> <映射.json> <输出.json>'); process.exit(1); }
  const prd = parsePrd(mdPath);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const { pins, problems, unmapped } = buildPins(prd, map);
  fs.writeFileSync(outPath, JSON.stringify(pins, null, 1));
  console.log(`PRD 带字段规范/用例规则的功能点 ${prd.fpOf.size} 个；生成标注 ${pins.length} 个 → ${outPath}`);
  if (problems.length) console.error(problems.join('\n'));
  if (unmapped.length) { console.error('PRD 有、映射里没有（要补映射）：\n' + unmapped.map(s => s + ' ' + prd.fpOf.get(s).name).join('\n')); }
  if (problems.length || unmapped.length) process.exit(2);
}
