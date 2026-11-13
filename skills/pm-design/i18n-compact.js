'use strict';
/* ════════════════════════════════════════════════════════════════════════
   i18n-compact.js · 多语标签「紧凑写法」展开器（提速·方案B 第1步·2026-10-07）
   ────────────────────────────────────────────────────────────────────────
   背景：project-data 里 53% 的行是 {zh,en,pt} 三元组。authoring 时逐个敲对象很费。
   做法：authoring 可把多语标签写成【一行紧凑串】，装配时自动展开成 {zh,en,pt[,spa]}。

   紧凑写法（opt-in·以竖线 | 打头、| 分隔）：
     "|<zh>|<en>|<pt>"            → {zh,en,pt}
     "|<zh>|<en>|<pt>|<spa>"      → {zh,en,pt,spa}
     "|<zh>|<en>"                 → {zh,en,pt:zh}   (缺的语言兜底成 zh)
     例 "|发票账号/CNPJ|Issuer/CNPJ|Emissor/CNPJ"
        → {zh:"发票账号/CNPJ", en:"Issuer/CNPJ", pt:"Emissor/CNPJ"}

   规则 / 边界（不吹·明说做不到的）：
   - 只认【首字符是 |】的字符串 → 现有数据没有这种前缀，展开对现有数据是【结构级 no-op】(安全)。
   - 三语相同的标签（NCM/CNPJ/数字…）：直接写普通字符串即可（L() 本就对纯串全语言返回原值），不必紧凑。
   - 标签内容本身含 | 的：用对象写法（退路），不要用紧凑串。
   - 它只省【敲多语对象的量】；列/字段/mock 数据/真实译文内容还得你写——不是"秒生成"。
   ════════════════════════════════════════════════════════════════════════ */
const LANGS = ['zh', 'en', 'pt', 'spa'];

/* 紧凑串 → 多语对象；不是紧凑串返回 null */
function parseCompact(s) {
  if (typeof s !== 'string' || s.charCodeAt(0) !== 124 /* '|' */) return null;
  const parts = s.slice(1).split('|');
  if (parts.length < 2) return null;                 // 至少 zh|en 两段才算（"|x" 不展开）
  const o = { zh: parts[0] };
  for (let i = 1; i < parts.length && i < LANGS.length; i++) o[LANGS[i]] = parts[i];
  if (o.en === undefined) o.en = o.zh;               // 缺 en/pt 兜底成 zh（BR 应写满 3 段）
  if (o.pt === undefined) o.pt = o.zh;
  return o;
}

/* 深 walk 整个 project-data：数组/对象结构原样克隆，匹配的叶子串换成多语对象 */
function expandI18n(node) {
  if (typeof node === 'string') { const c = parseCompact(node); return c || node; }
  if (Array.isArray(node)) { const a = new Array(node.length); for (let i = 0; i < node.length; i++) a[i] = expandI18n(node[i]); return a; }
  if (node && typeof node === 'object') { const out = {}; for (const k in node) if (Object.prototype.hasOwnProperty.call(node, k)) out[k] = expandI18n(node[k]); return out; }
  return node;
}

/* 迁移/测试辅助：{zh,en,pt} → 紧凑串；三语全同→返回纯串；含 | 或非纯多语对象→返回 null(不能紧凑) */
function toCompact(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const ks = Object.keys(o);
  if (!ks.length || !ks.every(k => LANGS.includes(k))) return null;
  const order = LANGS.filter(k => o[k] !== undefined);
  const vals = order.map(k => o[k]);
  if (vals.some(v => typeof v !== 'string' || v.indexOf('|') >= 0)) return null;
  if (vals.every(v => v === vals[0])) return vals[0];     // 三语相同 → 纯串即可
  return '|' + vals.join('|');
}

/* 扫一个对象里【首字符是 |】的字符串（安全检查：现有数据应为 0 处，否则展开会误伤） */
function scanLeadingPipe(node, hits, pathStr) {
  hits = hits || []; pathStr = pathStr || '$';
  if (typeof node === 'string') { if (node.charCodeAt(0) === 124) hits.push({ path: pathStr, val: node.slice(0, 40) }); }
  else if (Array.isArray(node)) node.forEach((v, i) => scanLeadingPipe(v, hits, pathStr + '[' + i + ']'));
  else if (node && typeof node === 'object') for (const k in node) if (Object.prototype.hasOwnProperty.call(node, k)) scanLeadingPipe(node[k], hits, pathStr + '.' + k);
  return hits;
}

module.exports = { expandI18n, parseCompact, toCompact, scanLeadingPipe, LANGS };
