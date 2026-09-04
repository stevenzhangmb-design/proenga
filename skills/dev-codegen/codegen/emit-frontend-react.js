#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段3 B · 前端生成器·React 栈 · emit-frontend-react.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   证明【扇出多栈】：同一份 data_model(桥的产出·栈无关) → 换下游生成器 = 换栈。
   本器出 React18 + TypeScript + Ant Design（对照 emit-frontend.js 的 Vue3+EP）。
   每个 fp 实体：views/<e>/List.tsx(列表) + Form.tsx(新增/编辑/查看·双态) + service/<e>.ts + types/<e>.ts
   控件映射：varchar→Input · text→Input.TextArea · 数字→InputNumber · 枚举→Select · 日期→DatePicker · 外键→Select(TODO)
   用法：node emit-frontend-react.js <input.json> [outDir]
   前提：项目已有 axios 基座 @/utils/axios、antd。业务逻辑/远程下拉/权限标 TODO。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out', 'frontend-react');
if (!inPath) { console.error('用法: node emit-frontend-react.js <input.json> [outDir]'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, ''));
const dm = doc.data_model || {}, entities = dm.entities || {}, enums = dm.enums || {}, fps = doc.function_points || {};
const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const cap = s => s[0].toUpperCase() + s.slice(1);
const tsType = c => (c.type === 'varchar' || c.type === 'char' || c.type === 'text' || c.type === 'date' || c.type === 'datetime') ? 'string' : 'number';
const listCols = ent => ent.columns.slice(0, 7);
function optionsConst(cols) {
  const seen = new Set();
  return cols.filter(c => c.enum && enums[c.enum] && !seen.has(camel(c.col)) && seen.add(camel(c.col))).map(c =>
    `const ${camel(c.col)}Options = [\n` + enums[c.enum].values.map(v => `  { label: '${v.zh}', value: ${v.code} },`).join('\n') + `\n]`).join('\n');
}

function serviceFile(ek, api) {
  const Cap = cap(ek);
  const clean = p => (p || '').replace('{id}', '');
  return `import axios from '@/utils/axios'
import type { ${Cap}VO, ${Cap}SaveReq, ${Cap}Query } from '@/types/${ek}'
import type { Result, Page } from '@/types/common'

/** ${Cap} CRUD 请求（Result code 2000=成功） */
export default {
  list(query: ${Cap}Query) { return axios.get<Result<Page<${Cap}VO>>>('${(api.list || {}).path || `/api/${ek}`}', { params: query }) },
  detail(id: number) { return axios.get<Result<${Cap}VO>>('${clean((api.detail || {}).path) || `/api/${ek}/`}' + id) },
  create(data: ${Cap}SaveReq) { return axios.post<Result<number>>('${(api.create || {}).path || `/api/${ek}`}', data) },
  update(id: number, data: ${Cap}SaveReq) { return axios.put<Result<void>>('${clean((api.update || {}).path) || `/api/${ek}/`}' + id, data) },
  remove(id: number) { return axios.delete<Result<void>>('${clean((api.delete || {}).path) || `/api/${ek}/`}' + id) },
}
`;
}
function typesFile(ek, ent, api) {
  const Cap = cap(ek);
  const vo = ent.columns.map(c => `  ${camel(c.col)}?: ${tsType(c)}`).join('\n');
  const req = ent.columns.map(c => `  ${camel(c.col)}${c.nullable ? '?' : ''}: ${tsType(c)}`).join('\n');
  const byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const q = ((api.list && api.list.query) || []).map(n => `  ${n}?: ${byCamel[n] ? tsType(byCamel[n]) : 'string'}`).join('\n');
  return `export interface ${Cap}VO {\n  id?: number\n${vo}\n  createTime?: string\n  updateTime?: string\n}\n\nexport interface ${Cap}SaveReq {\n${req}\n}\n\nexport interface ${Cap}Query {\n  page?: number\n  size?: number\n${q}\n}\n`;
}
function listTsx(ek, ent, api) {
  const Cap = cap(ek), q = (api.list && api.list.query) || [];
  const byCamel = {}; ent.columns.forEach(c => byCamel[camel(c.col)] = c);
  const searchItems = q.map(n => { const c = byCamel[n];
    if (c && c.enum) return `        <Form.Item name="${n}"><Select allowClear placeholder="${c.comment || n}" options={${n}Options} style={{ width: 160 }} /></Form.Item>`;
    return `        <Form.Item name="${n}"><Input allowClear placeholder="${(c && c.comment) || n}" /></Form.Item>`;
  }).join('\n');
  const cols = listCols(ent).map(c => c.enum
    ? `    { title: '${c.comment || camel(c.col)}', dataIndex: '${camel(c.col)}', render: (v: number) => (${camel(c.col)}Options.find(o => o.value === v)?.label ?? '--') },`
    : `    { title: '${c.comment || camel(c.col)}', dataIndex: '${camel(c.col)}', ellipsis: true },`).join('\n');
  return `import React, { useEffect, useState } from 'react'
import { Table, Form, Input, Select, Button, Space, Modal, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import ${ek}Service from '@/service/${ek}'
import type { ${Cap}VO, ${Cap}Query } from '@/types/${ek}'

${optionsConst(ent.columns)}

const columns = [
${cols}
]

export default function ${Cap}List() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [data, setData] = useState<${Cap}VO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<${Cap}Query>({ page: 1, size: 10 })

  const load = async (q: ${Cap}Query) => {
    setLoading(true)
    try { const { data: r } = await ${ek}Service.list(q); setData(r.data.records); setTotal(r.data.total) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(query) }, [])
  const onSearch = () => { const q = { ...query, ...form.getFieldsValue(), page: 1 }; setQuery(q); load(q) }
  const onReset = () => { form.resetFields(); const q = { page: 1, size: 10 }; setQuery(q); load(q) }
  const toForm = (mode: string, id?: number) => nav(\`/${ek}/form?mode=\${mode}\${id ? '&id=' + id : ''}\`)
  const onDelete = (row: ${Cap}VO) => Modal.confirm({ title: '确认删除该记录？', onOk: async () => { await ${ek}Service.remove(row.id!); message.success('删除成功'); load(query) } })

  return (
    <div className="page-list">
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
${searchItems || '        {/* 无查询字段 */}'}
        <Button type="primary" onClick={onSearch}>查询</Button>
        <Button onClick={onReset} style={{ marginLeft: 8 }}>重置</Button>
      </Form>
      <div style={{ marginBottom: 12 }}><Button type="primary" onClick={() => toForm('add')}>新增</Button></div>
      <Table
        rowKey="id" loading={loading} dataSource={data}
        columns={[...columns, {
          title: '操作', width: 180, fixed: 'right', render: (_: any, row: ${Cap}VO) => (
            <Space>
              <a onClick={() => toForm('view', row.id)}>查看</a>
              <a onClick={() => toForm('edit', row.id)}>编辑</a>
              <a style={{ color: '#e15b5b' }} onClick={() => onDelete(row)}>删除</a>
            </Space>
          )
        }]}
        pagination={{ current: query.page, pageSize: query.size, total, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100],
          onChange: (page, size) => { const q = { ...query, page, size }; setQuery(q); load(q) } }}
      />
    </div>
  )
}
`;
}
function formControl(c) {
  if (c.enum) return `<Select options={${camel(c.col)}Options} placeholder="请选择" allowClear />`;
  if (c.fk) return `<Select placeholder="请选择" allowClear /* TODO options 来自 ${c.fk.entity} */ />`;
  if (c.type === 'text') return `<Input.TextArea rows={2} maxLength={${c.len || 1000}} showCount placeholder="请输入" />`;
  if (c.type === 'decimal') return `<InputNumber precision={${c.scale != null ? c.scale : 2}} style={{ width: '100%' }} placeholder="请输入" />`;
  if (c.type === 'int' || c.type === 'bigint' || c.type === 'tinyint') return `<InputNumber style={{ width: '100%' }} placeholder="请输入" />`;
  if (c.type === 'date') return `<DatePicker style={{ width: '100%' }} />`;
  if (c.type === 'datetime') return `<DatePicker showTime style={{ width: '100%' }} />`;
  return `<Input maxLength={${c.len || 255}} allowClear placeholder="请输入" />`;
}
function formTsx(ek, ent) {
  const Cap = cap(ek);
  const items = ent.columns.map(c => {
    const name = camel(c.col);
    const rules = [];
    if (!c.nullable) rules.push(`{ required: true, message: '${c.comment || name}不能为空' }`);
    if (c.type === 'varchar' && c.len) rules.push(`{ max: ${c.len}, message: '超长' }`);
    return `      <Form.Item label="${c.comment || name}" name="${name}"${rules.length ? ` rules={[${rules.join(', ')}]}` : ''}>${formControl(c)}</Form.Item>`;
  }).join('\n');
  return `import React, { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Space, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ${ek}Service from '@/service/${ek}'
import type { ${Cap}SaveReq } from '@/types/${ek}'

${optionsConst(ent.columns)}

export default function ${Cap}Form() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const mode = sp.get('mode') || 'add'
  const id = sp.get('id') ? Number(sp.get('id')) : undefined
  const disabled = mode === 'view'
  const [form] = Form.useForm<${Cap}SaveReq>()

  useEffect(() => { if (id) ${ek}Service.detail(id).then(({ data }) => form.setFieldsValue(data.data as any)) }, [id])
  const onSave = async () => {
    const v = await form.validateFields()
    if (mode === 'edit' && id) await ${ek}Service.update(id, v); else await ${ek}Service.create(v)
    message.success('保存成功'); nav(-1)
  }

  return (
    <div className="page-form">
      <div className="form-header__title">基本信息</div>
      <Form form={form} layout="vertical" disabled={disabled}>
${items}
      </Form>
      <Space style={{ marginTop: 12 }}>
        <Button onClick={() => nav(-1)}>{disabled ? '返回' : '取消'}</Button>
        {!disabled && <Button type="primary" onClick={onSave}>保存</Button>}
      </Space>
    </div>
  )
}
`;
}

fs.mkdirSync(outDir, { recursive: true });
const write = (sub, name, content) => { const d = path.join(outDir, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), content); };
let count = 0;
for (const [fpk, fp] of Object.entries(fps)) {
  const ek = fp.entity, ent = entities[ek];
  if (!ent) { console.log(`  ⚠ ${fpk} 的 entity ${ek} 不存在，跳过`); continue; }
  const api = fp.api || {};
  write('service', `${ek}.ts`, serviceFile(ek, api));
  write('types', `${ek}.ts`, typesFile(ek, ent, api));
  write(`views/${ek}`, 'List.tsx', listTsx(ek, ent, api));
  write(`views/${ek}`, 'Form.tsx', formTsx(ek, ent));
  count += 4;
  console.log(`  ✓ ${cap(ek)}: service.ts / types.ts / List.tsx / Form.tsx (React+AntD·4)`);
}
console.log('\n════════ 前端生成器·React 栈（阶段3B·扇出多栈）════════');
console.log(`  生成 ${count} 个文件 → ${outDir}`);
console.log('  React18 + TS + Ant Design·同一份 data_model·换栈=换生成器');
process.exit(0);
