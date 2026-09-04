#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段2 A · 契约出料生成器 · emit-contract.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   输入：data_model（entities/enums）+ function_points.api（见 sample-goods.json）
   输出：① <表>.ddl.sql（照 dev-stack-spec：雪花 id + tenant_id + 审计列 + 逻辑删除
            + uk 含 tenant_id/scope/deleted + 每列 COMMENT + InnoDB utf8mb4）
         ② openapi.yaml（paths 从 fp.api·schemas 从 entities/enums 派生）
         ③ 料够不够检查（缺 comment/len/枚举ref/外键ref → ⚠️）
   用法：node emit-contract.js <input.json> [outDir]     退出码 0=OK · 1=检查有阻断
   本脚本 = 把 prd-data-codegen-layer.md §3 推导规则 + §5 派生逻辑变成确定性一键产出。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out');
const DB = (process.argv[4] || 'mysql').toLowerCase();   // 数据库方言：mysql(默认) | postgres/pg
const PG = (DB === 'postgres' || DB === 'pg');
if (!inPath) { console.error('用法: node emit-contract.js <input.json> [outDir] [db:mysql|postgres]'); process.exit(2); }
let doc;
try { doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error('读取/解析输入失败: ' + e.message); process.exit(2); }

const dm = doc.data_model || {};
const enums = dm.enums || {};
const entities = dm.entities || {};
const fps = doc.function_points || {};

const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length));

// ── 检查（料够不够）──
const warns = [], blocks = [];
for (const [ek, ent] of Object.entries(entities)) {
  if (!ent.table) blocks.push(`实体 ${ek} 缺 table`);
  for (const c of (ent.columns || [])) {
    if (!c.col) blocks.push(`实体 ${ek} 有列缺 col`);
    if (!c.comment) warns.push(`${ek}.${c.col || '?'} 缺 COMMENT`);
    if (c.type === 'varchar' && !c.len) warns.push(`${ek}.${c.col} varchar 无长度 → 兜底 varchar(64)`);
    if (c.enum && !enums[c.enum]) blocks.push(`${ek}.${c.col} 引用枚举 ${c.enum} 不存在`);
    if (c.fk && c.fk.entity && !entities[c.fk.entity]) warns.push(`${ek}.${c.col} 外键指向 ${c.fk.entity}（本次输入未含该实体·待确认）`);
  }
}

// ── DDL ──
function sqlType(c) {
  switch (c.type) {
    case 'varchar': return `VARCHAR(${c.len || 64})`;
    case 'char':    return `CHAR(${c.len || 32})`;
    case 'text':    return 'TEXT';
    case 'bigint':  return 'BIGINT';
    case 'int':     return PG ? 'INTEGER' : 'INT';
    case 'tinyint': return PG ? 'SMALLINT' : 'TINYINT';
    case 'decimal': return `${PG ? 'NUMERIC' : 'DECIMAL'}(${c.precision || 14},${c.scale != null ? c.scale : 2})`;
    case 'date':    return 'DATE';
    case 'datetime':return PG ? 'TIMESTAMP' : 'DATETIME';
    case 'json':    return PG ? 'JSONB' : 'JSON';
    default: warns.push(`未知类型 ${c.type} → 兜底 VARCHAR(255)`); return 'VARCHAR(255)';
  }
}
function colComment(c) {
  let cm = c.comment || '';
  if (c.enum && enums[c.enum]) cm += '(' + enums[c.enum].values.map(v => v.code + v.zh).join('') + ')';
  return cm;
}
function emitDDL(ek, ent) {
  const q = PG ? (s) => s : (s) => '`' + s + '`';      // 标识符：MySQL 反引号·PG 裸(snake_case 小写安全)
  const esc = (s) => String(s).replace(/'/g, "''");
  const L = [], comments = [];
  const line = (name, type, extra, cm) => {
    if (PG) { L.push(`  ${pad(q(name), 18)} ${pad(type, 14)} ${extra}`); if (cm) comments.push(`COMMENT ON COLUMN ${ent.table}.${name} IS '${esc(cm)}';`); }
    else { L.push(`  ${pad(q(name), 18)} ${pad(type, 14)} ${extra}${cm ? ` COMMENT '${esc(cm)}'` : ''}`); }
  };
  line('id', 'BIGINT', 'NOT NULL', '主键(雪花)');
  line('tenant_id', 'BIGINT', 'NOT NULL', '租户ID');
  for (const c of ent.columns) {
    let extra = c.nullable ? '    NULL' : 'NOT NULL';
    if (c.default != null) extra += ` DEFAULT ${c.default}`;
    line(c.col, sqlType(c), extra, colComment(c));
  }
  line('create_time', PG ? 'TIMESTAMP' : 'DATETIME', PG ? 'NOT NULL DEFAULT now()' : 'NOT NULL DEFAULT CURRENT_TIMESTAMP', '创建时间');
  line('update_time', PG ? 'TIMESTAMP' : 'DATETIME', PG ? 'NOT NULL DEFAULT now()' : 'NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', '更新时间' + (PG ? '(自动更新需触发器)' : ''));
  line('create_by', 'BIGINT', '    NULL', '创建人');
  line('update_by', 'BIGINT', '    NULL', '更新人');
  line('deleted', PG ? 'SMALLINT' : 'TINYINT', 'NOT NULL DEFAULT 0', '逻辑删除(0否1是)');
  const inTable = ['  PRIMARY KEY (' + q('id') + ')'];
  const idxStmts = [];
  for (const c of ent.columns) {
    if (c.unique) {
      const scope = (typeof c.unique === 'object' && c.unique.scope) ? c.unique.scope : [];
      const cols = ['tenant_id', ...scope, c.col, 'deleted'].map(q).join(', ');
      if (PG) inTable.push(`  CONSTRAINT uk_${c.col} UNIQUE (${cols})`);
      else inTable.push('  UNIQUE KEY `uk_' + c.col + '` (' + cols + ')');
    }
  }
  for (const c of ent.columns) {
    if (c.index || c.fk) {
      if (PG) idxStmts.push(`CREATE INDEX idx_${c.col} ON ${ent.table} (${q('tenant_id')}, ${q(c.col)});`);
      else inTable.push('  KEY `idx_' + c.col + '` (`tenant_id`, `' + c.col + '`)');
    }
  }
  if (PG) {
    return `CREATE TABLE ${ent.table} (\n${L.join(',\n')},\n${inTable.join(',\n')}\n);\n`
      + (idxStmts.length ? idxStmts.join('\n') + '\n' : '')
      + `COMMENT ON TABLE ${ent.table} IS '${esc(ent.comment || ent.label || ek)}';\n`
      + (comments.length ? comments.join('\n') + '\n' : '');
  }
  return `CREATE TABLE \`${ent.table}\` (\n${L.join(',\n')},\n${inTable.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='${esc(ent.comment || ent.label || ek)}';\n`;
}

// ── openapi ──
function oaType(c) {
  switch (c.type) {
    case 'bigint':  return { type: 'integer', format: 'int64' };
    case 'int': case 'tinyint': return { type: 'integer' };
    case 'decimal': return { type: 'number', format: 'decimal' };
    case 'date':    return { type: 'string', format: 'date' };
    case 'datetime':return { type: 'string', format: 'date-time' };
    case 'json':    return { type: 'object' };
    default:        return { type: 'string', maxLength: c.len };
  }
}
function schemaLines(props, indent) {
  const p = ' '.repeat(indent);
  return Object.entries(props).map(([k, v]) => {
    const parts = Object.entries(v).filter(([, x]) => x != null).map(([kk, vv]) => `${kk}: ${Array.isArray(vv) ? '[' + vv.join(', ') + ']' : vv}`);
    return `${p}${k}: { ${parts.join(', ')} }`;
  }).join('\n');
}
function emitOpenapi() {
  const out = ['openapi: 3.0.3', 'info: { title: 生成契约(阶段2A试跑), version: 0.1.0 }', 'paths:'];
  const colByCamel = {};
  for (const ent of Object.values(entities)) for (const c of ent.columns) colByCamel[camel(c.col)] = c;
  for (const [fpk, fp] of Object.entries(fps)) {
    const api = fp.api || {}, ent = entities[fp.entity];
    const Cap = fp.entity ? fp.entity[0].toUpperCase() + fp.entity.slice(1) : 'X';
    if (api.list) {
      out.push(`  ${api.list.path}:`);
      out.push(`    get:`, `      summary: ${fpk} 列表`, `      parameters:`);
      for (const q of (api.list.query || [])) {
        const c = colByCamel[q];
        let sc = c ? oaType(c) : { type: 'string' };
        if (c && c.enum && enums[c.enum]) sc = { type: 'integer', enum: enums[c.enum].values.map(v => v.code) };
        out.push(`        - { name: ${q}, in: query, schema: { ${Object.entries(sc).filter(([, x]) => x != null).map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`).join(', ')} } }`);
      }
      out.push(`      responses: { '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Page${Cap}VO' } } } } }`);
    }
    if (api.create) {
      const p = api.create.path;
      if (!api.list || api.list.path !== p) out.push(`  ${p}:`);
      out.push(`    post:`, `      summary: ${fpk} 新增`, `      requestBody: { content: { application/json: { schema: { $ref: '#/components/schemas/${Cap}SaveReq' } } } }`, `      responses: { '200': { description: 主键 } }`);
    }
    if (api.detail) out.push(`  ${api.detail.path}:`, `    get: { summary: ${Cap} 详情, responses: { '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/${Cap}VO' } } } } } }`);
  }
  // schemas
  out.push('components:', '  schemas:');
  for (const [ek, ent] of Object.entries(entities)) {
    const Cap = ek[0].toUpperCase() + ek.slice(1);
    const req = ent.columns.filter(c => !c.nullable).map(c => camel(c.col));
    const props = {};
    for (const c of ent.columns) { const t = oaType(c); props[camel(c.col)] = (c.enum && enums[c.enum]) ? { type: 'integer', enum: enums[c.enum].values.map(v => v.code) } : t; }
    out.push(`    ${Cap}SaveReq:`, `      type: object`, req.length ? `      required: [${req.join(', ')}]` : '      # 无必填', `      properties:`);
    out.push(schemaLines(props, 8));
    // VO（读模型：业务字段 + id + 审计时间）
    const voProps = Object.assign({ id: { type: 'integer', format: 'int64' } }, props, { createTime: { type: 'string', format: 'date-time' }, updateTime: { type: 'string', format: 'date-time' } });
    out.push(`    ${Cap}VO:`, `      type: object`, `      properties:`);
    out.push(schemaLines(voProps, 8));
    // 分页包装
    out.push(`    Page${Cap}VO:`, `      type: object`, `      properties:`, `        total: { type: integer, format: int64 }`, `        records: { type: array, items: { $ref: '#/components/schemas/${Cap}VO' } }`);
  }
  return out.join('\n') + '\n';
}

// ── 阻断则先停（不产出半成品）──
if (blocks.length) {
  console.log('\n════════ 契约出料生成器（阶段2A）════════');
  console.log('  ❌ 料不够·阻断（先补齐再生成·未产出文件）：');
  blocks.forEach(b => console.log('    ✗ ' + b));
  if (warns.length) { console.log('  ⚠ 另有待确认：'); warns.forEach(w => console.log('    ⚠ ' + w)); }
  console.log('════════════════════════════════════════════\n');
  process.exit(1);
}

// ── 写出 ──
fs.mkdirSync(outDir, { recursive: true });
let ddlAll = '';
for (const [ek, ent] of Object.entries(entities)) { const ddl = emitDDL(ek, ent); ddlAll += ddl + '\n'; fs.writeFileSync(path.join(outDir, ent.table + '.ddl.sql'), ddl); }
fs.writeFileSync(path.join(outDir, 'schema.sql'), ddlAll);
fs.writeFileSync(path.join(outDir, 'openapi.yaml'), emitOpenapi());

console.log('\n════════ 契约出料生成器（阶段2A试跑）════════');
console.log(`  输入：${path.basename(inPath)} · 实体 ${Object.keys(entities).length} · 功能点 ${Object.keys(fps).length}`);
console.log(`  产出 → ${outDir}`);
console.log(`    · schema.sql（${Object.keys(entities).length} 张表 DDL）`);
console.log(`    · openapi.yaml`);
console.log('  ── 料够不够检查 ──');
if (blocks.length) { console.log('  ❌ 阻断：'); blocks.forEach(b => console.log('    ✗ ' + b)); }
if (warns.length) { console.log('  ⚠ 待确认（研发/DBA 过一遍）：'); warns.forEach(w => console.log('    ⚠ ' + w)); }
if (!blocks.length && !warns.length) console.log('  ✓ 全清');
console.log('════════════════════════════════════════════\n');
process.exit(blocks.length ? 1 : 0);
