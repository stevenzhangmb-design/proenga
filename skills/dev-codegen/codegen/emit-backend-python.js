#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段3 B · 后端生成器·Python 栈 · emit-backend-python.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   扇出多栈(后端第3套)：同一份 data_model → FastAPI + SQLAlchemy + Pydantic(对照 Java/NestJS)。
   每个 fp 实体：models/<e>.py(SQLAlchemy) + schemas/<e>.py(Pydantic Save/VO/Query) + routers/<e>.py(APIRouter CRUD)
   主子表(fp.detail)：子模型 + 主 Save 带 lines·crud 一个事务存头+批量存行。
   命名：全 snake_case(attr=列=DDL·Pythonic)。若配 camelCase 前端，给 Pydantic 加 alias_generator=to_camel(见注释)。
   类型映射：bigint→BigInteger/int · int/tinyint→Integer/int · decimal→Numeric(14,s)/float · varchar→String(len)/str · text→Text/str · date→Date/date · datetime→DateTime/datetime
   用法：node emit-backend-python.js <input.json> [outDir]
   前提：项目有 Base(declarative_base)+TenantBase(id/tenant_id/create_time…混入)+get_db 依赖。业务逻辑/权限标 TODO。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out', 'backend-python');
if (!inPath) { console.error('用法: node emit-backend-python.js <input.json> [outDir]'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, ''));
const entities = (doc.data_model || {}).entities || {}, fps = doc.function_points || {};
const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const cap = s => s[0].toUpperCase() + s.slice(1);
function pyType(c) { return (c.type === 'varchar' || c.type === 'char' || c.type === 'text') ? 'str' : (c.type === 'decimal') ? 'float' : (c.type === 'date') ? 'date' : (c.type === 'datetime') ? 'datetime' : 'int'; }
function saCol(c) {
  let t;
  if (c.type === 'varchar' || c.type === 'char') t = `String(${c.len || 255})`;
  else if (c.type === 'text') t = 'Text';
  else if (c.type === 'decimal') t = `Numeric(14, ${c.scale != null ? c.scale : 2})`;
  else if (c.type === 'bigint') t = 'BigInteger';
  else if (c.type === 'int' || c.type === 'tinyint') t = 'Integer';
  else if (c.type === 'date') t = 'Date';
  else if (c.type === 'datetime') t = 'DateTime';
  const opts = [];
  if (!c.nullable) opts.push('nullable=False');
  if (c.default != null && c.type !== 'varchar' && c.type !== 'text') opts.push(`default=${c.default}`);
  opts.push(`comment="${(c.comment || c.field || c.col).replace(/"/g, '')}"`);
  return `    ${c.col} = Column(${t}, ${opts.join(', ')})`;   // attr=列名(snake)=DDL
}
const saTypes = cols => { const s = new Set(); cols.forEach(c => { if (c.type === 'varchar' || c.type === 'char') s.add('String'); else if (c.type === 'text') s.add('Text'); else if (c.type === 'decimal') s.add('Numeric'); else if (c.type === 'bigint') s.add('BigInteger'); else if (c.type === 'int' || c.type === 'tinyint') s.add('Integer'); else if (c.type === 'date') s.add('Date'); else if (c.type === 'datetime') s.add('DateTime'); }); return [...s].sort(); };

function modelFile(ek, ent) {
  const Cap = cap(ek), imp = saTypes(ent.columns);
  return `from sqlalchemy import Column, ${imp.join(', ')}
from app.db import Base, TenantBase


class ${Cap}(Base, TenantBase):
    """${ent.label || Cap}·${ent.comment || ''}（只声明业务字段·id/租户/审计走 TenantBase 混入）"""
    __tablename__ = "${ent.table}"

${ent.columns.map(saCol).join('\n')}
`;
}
function schemaFile(ek, ent, api, opts) {
  const Cap = cap(ek), md = opts && opts.detail, ex = (opts && opts.exclude) || null;
  const cols = ent.columns.filter(c => c.col !== ex);
  const need = new Set();
  const saveFields = cols.map(c => {
    const nm = c.col, opt = c.nullable;
    if (c.type === 'varchar' && c.len) { need.add('Field'); return `    ${nm}: ${opt ? 'Optional[' + pyType(c) + ']' : pyType(c)} = Field(${opt ? 'None' : '...'}, max_length=${c.len})`; }
    return `    ${nm}: ${opt ? 'Optional[' + pyType(c) + '] = None' : pyType(c)}`;
  });
  let lineField = '';
  if (md) { const DCap = cap(md.entity); lineField = `\n    lines: Optional[List["${DCap}Save"]] = None`; need.add('List'); }
  const voFields = ent.columns.map(c => `    ${c.col}: Optional[${pyType(c)}] = None`);
  const byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const qFields = ((api && api.list && api.list.query) || []).filter(n => byCamel[n]).map(n => `    ${byCamel[n].col}: Optional[${pyType(byCamel[n])}] = None`);
  const typingImp = ['Optional', ...(need.has('List') ? ['List'] : [])];
  const dateImp = ent.columns.some(c => c.type === 'date' || c.type === 'datetime');
  return `from typing import ${typingImp.join(', ')}
${dateImp ? 'from datetime import date, datetime\n' : ''}from pydantic import BaseModel${need.has('Field') ? ', Field' : ''}

# 注：API 用 snake_case；若前端要 camelCase，给下面各类加：
#   model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)  (from pydantic.alias_generators import to_camel)


class ${Cap}Save(BaseModel):
    """新增/编辑请求"""
${saveFields.join('\n')}${lineField}


class ${Cap}VO(BaseModel):
    id: Optional[int] = None
${voFields.join('\n')}

    class Config:
        from_attributes = True


class ${Cap}Query(BaseModel):
    page: int = 1
    size: int = 10
${qFields.join('\n') || '    pass'}
`;
}
function routerFile(ek, fpk, ent, api, opts) {
  const Cap = cap(ek), base = ((api.list || api.create || {}).path || `/api/${ek}`), md = opts && opts.detail;
  const byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const conds = ((api.list && api.list.query) || []).filter(n => byCamel[n]).map(n => {
    const c = byCamel[n], col = c.col;
    if (c.type === 'varchar' || c.type === 'text' || c.type === 'char') return `    if q.${col} is not None:\n        stmt = stmt.where(${Cap}.${col}.like(f"%{q.${col}}%"))`;
    return `    if q.${col} is not None:\n        stmt = stmt.where(${Cap}.${col} == q.${col})`;
  }).join('\n');
  const md_imp = md ? `\nfrom app.models.${md.entity_snake || (md.entity.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''))} import ${cap(md.entity)}` : '';
  const dsnake = md ? md.entity.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') : '';
  const esnake = ek.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  const createBody = md
    ? `    head = ${Cap}(**dto.model_dump(exclude={"lines"}))\n    db.add(head)\n    db.flush()  # 拿到 head.id\n    for l in (dto.lines or []):\n        db.add(${cap(md.entity)}(**l.model_dump(), ${md.fk}=head.id))  # 设外键\n    db.commit()\n    return head.id`
    : `    obj = ${Cap}(**dto.model_dump())\n    db.add(obj)\n    db.commit()\n    db.refresh(obj)  # TODO 业务校验/唯一性\n    return obj.id`;
  const updateBody = md
    ? `    db.query(${Cap}).filter(${Cap}.id == id).update(dto.model_dump(exclude={"lines"}))\n    db.query(${cap(md.entity)}).filter(${cap(md.entity)}.${md.fk} == id).delete()  # TODO 行级 diff\n    for l in (dto.lines or []):\n        db.add(${cap(md.entity)}(**l.model_dump(), ${md.fk}=id))\n    db.commit()`
    : `    db.query(${Cap}).filter(${Cap}.id == id).update(dto.model_dump())  # TODO 状态前置校验\n    db.commit()`;
  return `from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.${esnake} import ${Cap}${md_imp}
from app.schemas.${esnake} import ${Cap}Save, ${Cap}VO, ${Cap}Query

# ${fpk} · ${ent.label || Cap}（生成 CRUD 骨架·业务逻辑 TODO 交研发/AI 补）
router = APIRouter(prefix="${base}", tags=["${ek}"])


@router.get("")
def list_(q: ${Cap}Query = Depends(), db: Session = Depends(get_db)):
    stmt = select(${Cap})
${conds || '    pass'}
    total = db.query(${Cap}).count()
    records = db.execute(stmt.order_by(${Cap}.create_time.desc()).offset((q.page - 1) * q.size).limit(q.size)).scalars().all()
    return {"records": records, "total": total, "current": q.page, "size": q.size}


@router.get("/{id}")
def detail(id: int, db: Session = Depends(get_db)):
    return db.get(${Cap}, id)


@router.post("")
def create(dto: ${Cap}Save, db: Session = Depends(get_db)):
${createBody}


@router.put("/{id}")
def update(id: int, dto: ${Cap}Save, db: Session = Depends(get_db)):
${updateBody}
    return {"ok": True}


@router.delete("/{id}")
def remove(id: int, db: Session = Depends(get_db)):
    db.query(${Cap}).filter(${Cap}.id == id).update({"deleted": 1})  # 逻辑删除·TODO 状态前置
    db.commit()
    return {"ok": True}
`;
}

fs.mkdirSync(outDir, { recursive: true });
const snake = s => s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
const write = (sub, name, content) => { const d = path.join(outDir, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), content); };
let count = 0;
for (const [fpk, fp] of Object.entries(fps)) {
  const ek = fp.entity, ent = entities[ek];
  if (!ent) { console.log(`  ⚠ ${fpk} 的 entity ${ek} 不存在，跳过`); continue; }
  const api = fp.api || {}, detail = fp.detail && entities[fp.detail.entity] ? fp.detail : null;
  write('app/models', `${snake(ek)}.py`, modelFile(ek, ent));
  write('app/schemas', `${snake(ek)}.py`, schemaFile(ek, ent, api, { detail }));
  write('app/routers', `${snake(ek)}.py`, routerFile(ek, fpk, ent, api, { detail }));
  count += 3;
  console.log(`  ✓ ${cap(ek)}(主): models/schemas/routers (3)`);
  if (detail) {
    const dk = detail.entity, dent = entities[dk];
    write('app/models', `${snake(dk)}.py`, modelFile(dk, dent));
    write('app/schemas', `${snake(dk)}.py`, schemaFile(dk, dent, {}, { exclude: detail.fk }));
    count += 2;
    console.log(`  ✓ ${cap(dk)}(子): models/schemas (2)`);
  }
}
console.log('\n════════ 后端生成器·Python 栈（阶段3B·扇出多栈）════════');
console.log(`  生成 ${count} 个 .py → ${outDir}`);
console.log('  FastAPI + SQLAlchemy + Pydantic·全 snake_case·同一份 data_model·换栈=换生成器');
process.exit(0);
