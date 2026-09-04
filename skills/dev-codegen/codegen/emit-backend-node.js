#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段3 B · 后端生成器·Node 栈 · emit-backend-node.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   扇出多栈(后端)：同一份 data_model → NestJS + TypeORM + TypeScript(对照 emit-backend.js 的 Java+Spring)。
   每个 fp 实体：<e>.entity.ts + dto/<e>-save.dto.ts + dto/<e>-query.dto.ts + <e>.service.ts + <e>.controller.ts + <e>.module.ts
   主子表(fp.detail)：子实体出 entity·主 SaveDto 带 lines·主 service saveWithLines 事务(存头→设外键→批量存行)。
   类型映射：bigint→number@bigint · int/tinyint→number · decimal→number@decimal(p,s) · varchar→string@varchar(len) · text→string@text · date→string@date · datetime→Date@datetime
   用法：node emit-backend-node.js <input.json> [outDir]
   前提：项目有 TenantBaseEntity(id/租户/审计基类) + 统一返回拦截器。业务逻辑/权限/状态前置标 TODO。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out', 'backend-node');
if (!inPath) { console.error('用法: node emit-backend-node.js <input.json> [outDir]'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, ''));
const entities = (doc.data_model || {}).entities || {}, fps = doc.function_points || {};
const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const cap = s => s[0].toUpperCase() + s.slice(1);
const kebab = s => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
function tsType(c) { return (c.type === 'varchar' || c.type === 'char' || c.type === 'text' || c.type === 'date') ? 'string' : c.type === 'datetime' ? 'Date' : 'number'; }
function ormCol(c) {
  const o = [];
  if (c.type === 'varchar' || c.type === 'char') o.push(`type: 'varchar'`, `length: ${c.len || 255}`);
  else if (c.type === 'text') o.push(`type: 'text'`);
  else if (c.type === 'decimal') o.push(`type: 'decimal'`, `precision: 14`, `scale: ${c.scale != null ? c.scale : 2}`);
  else if (c.type === 'bigint') o.push(`type: 'bigint'`);
  else if (c.type === 'int') o.push(`type: 'int'`);
  else if (c.type === 'tinyint') o.push(`type: 'tinyint'`);
  else if (c.type === 'date') o.push(`type: 'date'`);
  else if (c.type === 'datetime') o.push(`type: 'datetime'`);
  if (c.nullable) o.push('nullable: true');
  if (c.default != null && c.type !== 'varchar' && c.type !== 'text') o.push(`default: ${c.default}`);
  o.push(`comment: '${(c.comment || c.field || c.col).replace(/'/g, '')}'`);
  return `{ ${o.join(', ')} }`;
}

function entityFile(ek, ent) {
  const Cap = cap(ek);
  const cols = ent.columns.map(c => `  @Column(${ormCol(c)})\n  ${camel(c.col)}: ${tsType(c)}`).join('\n\n');
  return `import { Entity, Column } from 'typeorm'
import { TenantBaseEntity } from '../common/tenant-base.entity'

/** ${ent.label || Cap} · ${ent.comment || ''}（只声明业务字段·id/租户/审计走基类 TenantBaseEntity） */
@Entity('${ent.table}')
export class ${Cap} extends TenantBaseEntity {

${cols}
}
`;
}
function saveDtoFile(ek, ent, opts) {
  const Cap = cap(ek), ex = (opts && opts.exclude) || null, md = opts && opts.detail;
  const cols = ent.columns.filter(c => c.col !== ex);
  const used = new Set();
  const lines = cols.map(c => {
    const ann = [];
    if (!c.nullable) ann.push(`  @IsNotEmpty({ message: '${(c.comment || camel(c.col)).replace(/'/g, '')}不能为空' })`, used.add('IsNotEmpty'));
    else ann.push(`  @IsOptional()`, used.add('IsOptional'));
    if (c.type === 'varchar' && c.len) { ann.push(`  @MaxLength(${c.len})`); used.add('MaxLength'); }
    return ann.filter(a => typeof a === 'string').join('\n') + `\n  ${camel(c.col)}${c.nullable ? '?' : ''}: ${tsType(c)}`;
  }).join('\n\n');
  let imp = `import { ${[...used].sort().join(', ')} } from 'class-validator'`;
  let lineField = '';
  if (md) { const DCap = cap(md.entity); lineField = `\n\n  /** ${md.label || '明细行'} */\n  @IsOptional()\n  lines?: ${DCap}SaveDto[]`; imp += `\nimport { ${DCap}SaveDto } from './${kebab(md.entity)}-save.dto'`; }
  return `${imp}

/** ${ent.label || Cap} 新增/编辑请求 */
export class ${Cap}SaveDto {

${lines}${lineField}
}
`;
}
function queryDtoFile(ek, ent, api) {
  const Cap = cap(ek), byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const qs = ((api.list && api.list.query) || []).filter(n => byCamel[n]);
  const fields = qs.map(n => `  ${n}?: ${tsType(byCamel[n])}`).join('\n');
  return `/** ${Cap} 列表查询参数 */
export class ${Cap}QueryDto {
  page: number = 1
  size: number = 10
${fields}
}
`;
}
function serviceFile(ek, ent, api, opts) {
  const Cap = cap(ek), md = opts && opts.detail;
  const byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const conds = ((api.list && api.list.query) || []).filter(n => byCamel[n]).map(n => {
    const c = byCamel[n];
    if (c.type === 'varchar' || c.type === 'text' || c.type === 'char')
      return `    if (q.${n}) qb.andWhere('t.${n} LIKE :${n}', { ${n}: \`%\${q.${n}}%\` })`;
    return `    if (q.${n} != null) qb.andWhere('t.${n} = :${n}', { ${n}: q.${n} })`;
  }).join('\n');
  const imp = [`import { Injectable } from '@nestjs/common'`, `import { InjectRepository } from '@nestjs/typeorm'`, `import { Repository${md ? ', DataSource' : ''} } from 'typeorm'`,
    `import { ${Cap} } from './${kebab(ek)}.entity'`, `import { ${Cap}SaveDto } from './dto/${kebab(ek)}-save.dto'`, `import { ${Cap}QueryDto } from './dto/${kebab(ek)}-query.dto'`];
  if (md) imp.push(`import { ${cap(md.entity)} } from './${kebab(md.entity)}.entity'`);
  let ctor = `constructor(@InjectRepository(${Cap}) private readonly repo: Repository<${Cap}>${md ? ', private readonly ds: DataSource' : ''}) {}`;
  let mdMethods = '';
  if (md) {
    const DCap = cap(md.entity), fkCamel = camel(md.fk);
    mdMethods = `
  /** 主子表：一个事务里 存头 → 设外键 → 批量存明细 */
  async saveWithLines(dto: ${Cap}SaveDto, id?: number) {
    return this.ds.transaction(async (m) => {
      const head = m.getRepository(${Cap}).create(dto as any); if (id) (head as any).id = id;
      await m.getRepository(${Cap}).save(head);
      const hid = (head as any).id;
      if (id) await m.getRepository(${DCap}).delete({ ${fkCamel}: hid });  // TODO 行级 diff 而非全删重插
      if (dto.lines?.length) {
        const rows = dto.lines.map((l) => m.getRepository(${DCap}).create({ ...l, ${fkCamel}: hid } as any));
        await m.getRepository(${DCap}).save(rows);
      }
      return hid;
    });
  }`;
  }
  return `${imp.join('\n')}

@Injectable()
export class ${Cap}Service {
  ${ctor}

  async pageList(q: ${Cap}QueryDto) {
    const qb = this.repo.createQueryBuilder('t')
${conds || '    // 无列表查询条件'}
    qb.orderBy('t.createTime', 'DESC').skip((q.page - 1) * q.size).take(q.size)
    const [records, total] = await qb.getManyAndCount()
    return { records, total, current: q.page, size: q.size }
  }

  detail(id: number) { return this.repo.findOneBy({ id } as any) }
${md ? `
  create(dto: ${Cap}SaveDto) { return this.saveWithLines(dto) }
  update(id: number, dto: ${Cap}SaveDto) { return this.saveWithLines(dto, id) }
` : `
  async create(dto: ${Cap}SaveDto) { const e = this.repo.create(dto as any); await this.repo.save(e); return (e as any).id }  // TODO 业务校验/唯一性
  async update(id: number, dto: ${Cap}SaveDto) { await this.repo.update(id, dto as any) }  // TODO 状态前置校验
`}
  remove(id: number) { return this.repo.softDelete(id) }  // 逻辑删除
${mdMethods}
}
`;
}
function controllerFile(ek, fpk, ent, api) {
  const Cap = cap(ek), base = ((api.list || api.create || {}).path || `/api/${ek}`).replace(/^\//, '');
  return `import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common'
import { ${Cap}Service } from './${kebab(ek)}.service'
import { ${Cap}SaveDto } from './dto/${kebab(ek)}-save.dto'
import { ${Cap}QueryDto } from './dto/${kebab(ek)}-query.dto'

/** ${fpk} · ${ent.label || Cap}（生成 CRUD 骨架·业务逻辑 TODO 交研发/AI 补） */
@Controller('${base}')
export class ${Cap}Controller {
  constructor(private readonly svc: ${Cap}Service) {}

  @Get()
  list(@Query() q: ${Cap}QueryDto) { return this.svc.pageList(q) }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) { return this.svc.detail(id) }

  @Post()
  create(@Body() dto: ${Cap}SaveDto) { return this.svc.create(dto) }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ${Cap}SaveDto) { return this.svc.update(id, dto) }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id) }  // TODO 状态前置：状态不符应拦截
}
`;
}
function moduleFile(ek, opts) {
  const Cap = cap(ek), md = opts && opts.detail;
  const feats = [Cap]; if (md) feats.push(cap(md.entity));
  const imps = [`import { Module } from '@nestjs/common'`, `import { TypeOrmModule } from '@nestjs/typeorm'`,
    `import { ${Cap} } from './${kebab(ek)}.entity'`, `import { ${Cap}Service } from './${kebab(ek)}.service'`, `import { ${Cap}Controller } from './${kebab(ek)}.controller'`];
  if (md) imps.push(`import { ${cap(md.entity)} } from './${kebab(md.entity)}.entity'`);
  return `${imps.join('\n')}

@Module({
  imports: [TypeOrmModule.forFeature([${feats.join(', ')}])],
  controllers: [${Cap}Controller],
  providers: [${Cap}Service],
})
export class ${Cap}Module {}
`;
}

fs.mkdirSync(outDir, { recursive: true });
const write = (sub, name, content) => { const d = path.join(outDir, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), content); };
let count = 0;
for (const [fpk, fp] of Object.entries(fps)) {
  const ek = fp.entity, ent = entities[ek];
  if (!ent) { console.log(`  ⚠ ${fpk} 的 entity ${ek} 不存在，跳过`); continue; }
  const api = fp.api || {}, detail = fp.detail && entities[fp.detail.entity] ? fp.detail : null;
  const mod = kebab(ek);
  write(mod, `${kebab(ek)}.entity.ts`, entityFile(ek, ent));
  write(`${mod}/dto`, `${kebab(ek)}-save.dto.ts`, saveDtoFile(ek, ent, { detail }));
  write(`${mod}/dto`, `${kebab(ek)}-query.dto.ts`, queryDtoFile(ek, ent, api));
  write(mod, `${kebab(ek)}.service.ts`, serviceFile(ek, ent, api, { detail }));
  write(mod, `${kebab(ek)}.controller.ts`, controllerFile(ek, fpk, ent, api));
  write(mod, `${kebab(ek)}.module.ts`, moduleFile(ek, { detail }));
  count += 6;
  console.log(`  ✓ ${cap(ek)}(主): entity/save-dto/query-dto/service/controller/module (6)`);
  if (detail) {
    const dk = detail.entity, dent = entities[dk];
    write(mod, `${kebab(dk)}.entity.ts`, entityFile(dk, dent));
    write(`${mod}/dto`, `${kebab(dk)}-save.dto.ts`, saveDtoFile(dk, dent, { exclude: detail.fk }));
    count += 2;
    console.log(`  ✓ ${cap(dk)}(子): entity/save-dto (2)`);
  }
}
console.log('\n════════ 后端生成器·Node 栈（阶段3B·扇出多栈）════════');
console.log(`  生成 ${count} 个 .ts → ${outDir}`);
console.log('  NestJS + TypeORM + TypeScript·同一份 data_model·换栈=换生成器');
process.exit(0);
