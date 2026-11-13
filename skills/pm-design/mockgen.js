#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   mockgen.js —— 列表模拟数据生成器（2026-10-07 提速·方案B 第2步·治「详情/列表页 52% 是手敲的 mock 行」）
   ────────────────────────────────────────────────────────────────────────
   背景：实测一个列表/详情页里，占行数最多的就是 rows 模拟数据（逐格手敲 JSON·10 列×10 行=100 格）。
   做法：读这一页的 columns，按【列名】自动推断每列类型（金额/CNPJ/日期/单号/NCM/数量/状态/税种/…），
         一条命令生成 N 行符合地区格式的模拟数据。确定性（同 seed 同结果），便于复跑。

   用法：
     node mockgen.js <project-data.json> <页id> [N] [--apply] [--seed 7] [--region BR|CN]
       不带 --apply → 只【预览】生成的行（JSON），你看一眼满意再 --apply
       --apply      → 写进 pagecfg.<页id>.rows 并重装预览 _bld.html
       N 默认 8 · seed 默认 1 · region 默认按 project-data.region（没有则 BR）

   边界（不吹·明说）：
   - 这是【填充用模拟数据】，给【默认规范/新系统】原型撑出真实感用；
     **复刻真系统时不要用它**——复刻的行必须是 RPA 抓来的真数据（见 skills/rpa/extract.js）。
   - 类型靠列名关键词推断，拿不准的列给普通文本；可先预览、不对的列手改那一格。
   - 不碰 actions / 状态彩色药丸（真系统状态多为纯文字·见 UI 宪法）；状态列只给纯文字。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LOC = ['zh', 'en', 'pt', 'spa'];
const isI18n = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => LOC.includes(k));
const L = v => isI18n(v) ? (v.zh || Object.values(v)[0]) : v;
let parseCompact; try { ({ parseCompact } = require('./i18n-compact')); } catch (_) { parseCompact = () => null; }
const unc = s => { if (typeof s === 'string') { const c = parseCompact(s); return c ? c.zh : s; } return s; };  // 认 i18n 紧凑串 "|zh|en|pt" → 取 zh（与装配一致）
const colLabel = c => { const raw = c && typeof c === 'object' && !isI18n(c) ? (c.label != null ? c.label : '') : c; return String(unc(L(raw)) || '').trim(); };

/* 确定性 PRNG（mulberry32）→ 同 seed 同结果，复跑一致 */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const COMPANIES = ['APAUL COM LTDA', 'NOVA DISTRIBUIDORA SA', 'COMERCIAL SAO PAULO ME', 'INDUSTRIA RIO VERDE LTDA', 'ATACADO BRASIL EIRELI', 'LOJA CENTRAL COMERCIO', 'GRUPO ANDRADE LTDA', 'TECH NORDESTE SA', 'LOGISTICA MINAS LTDA', 'MERCADO SUL COMERCIO ME'];
const PRODUCTS = ['Camiseta Básica', 'Notebook 14"', 'Cadeira Escritório', 'Café Torrado 500g', 'Mouse Sem Fio', 'Garrafa Térmica', 'Fone Bluetooth', 'Caderno A5', 'Teclado Mecânico', 'Mochila Executiva'];
const TAXES = ['ICMS', 'IPI', 'PIS', 'COFINS', 'ISS'];
const STATUSES = ['已启用', '已停用', '待提交', '已完成', '已取消'];
const NCMS = ['3924.90.00', '8471.30.12', '9401.30.00', '0901.21.00', '8471.60.53', '4820.10.00', '8518.30.00', '6109.10.00', '3926.10.00'];
const CATEGORIES = ['服饰', '数码', '家居', '食品', '美妆', '办公', '运动', '母婴'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Salvador', 'Recife'];

const pad = (n, w) => String(n).padStart(w, '0');

/* 列名 → 类型推断（顺序敏感·更具体的在前） */
function inferType(label) {
  const s = label.toLowerCase();
  const has = (...ws) => ws.some(w => label.includes(w) || s.includes(w.toLowerCase()));
  if (has('操作', 'action')) return 'blank';
  if (has('税率', '比例', '折扣') || /率|%/.test(label)) return 'percent';
  if (has('税额', 'tax amount')) return 'money';
  if (has('税种', '税目', 'imposto', 'tax')) return 'tax';
  if (has('CNPJ', 'cnpj')) return 'cnpj';
  if (has('CPF', 'cpf')) return 'cpf';
  if (has('NCM', 'ncm')) return 'ncm';
  if (has('金额', '价', '费', '总额', '合计', '单价', '成本', '余额', 'amount', 'valor', 'preço', 'price')) return 'money';
  if (has('数量', '件数', '库存', '件', 'qty', 'quant', '条数', '笔数') || /^数$/.test(label)) return 'int';
  if (has('时间', 'datetime', '创建于', '更新于')) return 'datetime';
  if (has('日期', 'date', 'data', '生效', '到期')) return 'date';
  if (has('单号', '编号', '流水号', '序列号', 'no.', 'número', 'código', 'code') || /号$/.test(label)) return 'code';
  if (has('状态', 'status', 'situação')) return 'status';
  if (has('邮箱', 'email', 'e-mail')) return 'email';
  if (has('电话', '手机', 'phone', 'tel', 'telefone')) return 'phone';
  if (has('商品', '产品', 'produto', 'product', 'item')) return 'product';
  if (has('公司', '供应商', '客户', '企业', '名称', '开票方', '收票方', 'empresa', 'fornecedor', 'cliente', 'razão', 'name', '发票账号')) return 'company';
  if (has('分类', '类目', '类别', 'categoria', 'category')) return 'category';
  if (has('城市', '地区', 'cidade', 'city')) return 'city';
  return 'text';
}

function genCell(type, rnd, i, label) {
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const num = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  switch (type) {
    case 'blank': return '';
    case 'company': return pick(COMPANIES);
    case 'product': return pick(PRODUCTS);
    case 'tax': return pick(TAXES);
    case 'category': return pick(CATEGORIES);
    case 'status': return pick(STATUSES);
    case 'ncm': return pick(NCMS);
    case 'city': return pick(CITIES);
    case 'cnpj': return `${num(10, 99)}.${pad(num(100, 999), 3)}.${pad(num(100, 999), 3)}/0001-${pad(num(10, 99), 2)}`;
    case 'cpf': return `${pad(num(100, 999), 3)}.${pad(num(100, 999), 3)}.${pad(num(100, 999), 3)}-${pad(num(10, 99), 2)}`;
    case 'percent': return num(1, 27) + '%';
    case 'int': return String(num(1, 999));
    case 'email': return 'contato' + num(1, 99) + '@empresa.com.br';
    case 'phone': return `(${num(11, 85)}) 9${num(1000, 9999)}-${num(1000, 9999)}`;
    case 'code': { let s = ''; const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; for (let k = 0; k < 6; k++) s += CH[Math.floor(rnd() * CH.length)]; return s; }
    case 'money': { const opt = { minimumFractionDigits: 2, maximumFractionDigits: 2 }; const MON = { BR: v => 'R$ ' + v.toLocaleString('pt-BR', opt), CN: v => '¥' + v.toLocaleString('en-US', opt) }; return (MON[REGION] || MON.BR)(num(10, 99999) + rnd()); }
    case 'datetime': { const d = baseDate(rnd); return `${d} ${pad(num(8, 19), 2)}:${pad(num(0, 59), 2)}:${pad(num(0, 59), 2)}`; }
    case 'date': return baseDate(rnd);
    default: return label.replace(/\s+/g, '') + '-' + (i + 1);
  }
}
function baseDate(rnd) { const m = 1 + Math.floor(rnd() * 12), day = 1 + Math.floor(rnd() * 28); return `2026-${pad(m, 2)}-${pad(day, 2)}`; }

/* ───────── 主流程 ───────── */
const PD = process.argv[2];
const PAGE = process.argv[3];
if (!PD || !PAGE || !fs.existsSync(PD)) { console.log(fs.readFileSync(__filename, 'utf8').split('════')[1]); process.exit(1); }
const argv = process.argv.slice(4);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; } else pos.push(a); }
const N = Number(pos[0] || 8);
const SEED = Number(flags.seed || 1);
const data = JSON.parse(fs.readFileSync(PD, 'utf8'));
let REGION = (flags.region && flags.region !== true) ? String(flags.region) : (data.region === 'CN' ? 'CN' : 'BR');
const pg = (data.pagecfg || {})[PAGE];
if (!pg) { console.error('✗ 没有这一页：' + PAGE + '（node p.js ' + PD + ' tree 看全部）'); process.exit(1); }
const cols = pg.columns || [];
if (!cols.length) { console.error('✗ 这一页没有 columns，无法按列生成'); process.exit(1); }

const types = cols.map(colLabel).map(inferType);
console.log('页「' + PAGE + '」· region=' + REGION + ' · 列→推断类型：');
cols.forEach((c, i) => console.log('  ' + String(colLabel(c) || '(空)').padEnd(16) + '→ ' + types[i]));

const rnd = rng(SEED);
const rows = [];
for (let r = 0; r < N; r++) rows.push(types.map((t, ci) => genCell(t, rnd, r, colLabel(cols[ci]))));

console.log('\n生成 ' + N + ' 行（预览前 3 行）：');
rows.slice(0, 3).forEach(r => console.log('  ' + JSON.stringify(r)));

if (flags.apply) {
  pg.rows = rows;
  fs.writeFileSync(PD, JSON.stringify(data), 'utf8');   // 2026-11-13 提速⑥：紧凑存盘
  console.log('\n✓ 已写进 pagecfg.' + PAGE + '.rows（' + N + ' 行），正在重装预览…');
  try {
    const out = path.join(path.dirname(PD), '_bld.html');
    execFileSync(process.execPath, [path.join(__dirname, 'qa', 'assemble-prototype.js'), PD, out, '--fast'], { stdio: 'pipe' });
    console.log('✓ 预览已重装 → ' + out);
  } catch (e) { console.error('重装失败（数据已写入）: ' + e.message); }
} else {
  console.log('\n（这是预览·没写回。满意就加 --apply 写进 rows 并重装；某格不对，--apply 后用 p.js set 改那一格）');
}
