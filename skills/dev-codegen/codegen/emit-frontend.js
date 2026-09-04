#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段3 B · 前端页面生成器 · emit-frontend.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   输入：同 emit-contract.js（data_model + function_points.api）
   输出（照 _shared/dev-stack-spec.md 前端范式 · Vue3+TS+ElementPlus）：每个 fp 实体一套 —
     views/<entity>/index.vue   列表页：SearchBox+SearchSeleItem(查询) + el-table(列+状态标签+操作列) + 分页
     views/<entity>/form.vue    新增/编辑/查看 三态：el-form label-top·双态(pageDisabled)·按字段类型出控件+校验
     service/<entity>.ts        CRUD 请求（端点从 fp.api·Result 包装）
     types/<entity>.ts          TS 接口（VO/SaveReq/Query）
   控件映射：varchar→el-input · text→textarea · 数字→el-input-number · 枚举→el-select · 日期→el-date-picker · 外键→el-select(TODO options)
   用法：node emit-frontend.js <input.json> [outDir]
   L3：可跑列表/表单骨架；联动/远程下拉/权限/复杂校验那 20% 交研发+AI 接力（标 TODO）。
   前提：项目已有 SearchBox/SearchSeleItem/lang()/$service/axios 基座（真实项目地基·非每实体生成）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out', 'frontend');
if (!inPath) { console.error('用法: node emit-frontend.js <input.json> [outDir]'); process.exit(2); }
let doc; try { doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error('读取失败: ' + e.message); process.exit(2); }
const dm = doc.data_model || {}, entities = dm.entities || {}, enums = dm.enums || {}, fps = doc.function_points || {};
const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const cap = s => s[0].toUpperCase() + s.slice(1);
const tsType = c => (c.type === 'varchar' || c.type === 'char' || c.type === 'text' || c.type === 'date' || c.type === 'datetime') ? 'string' : 'number';
const isText = c => c.type === 'varchar' || c.type === 'char';
const listCols = ent => ent.columns.slice(0, 7); // 列表展示前若干业务列（骨架）

function optionsBlock(cols) {
  // 为枚举字段生成 options 常量（按字段名去重）
  const seen = new Set();
  return cols.filter(c => c.enum && enums[c.enum] && !seen.has(camel(c.col)) && seen.add(camel(c.col))).map(c =>
    `const ${camel(c.col)}Options = [\n` +
    enums[c.enum].values.map(v => `  { label: lang('${v.zh}'), value: ${v.code} }`).join(',\n') +
    `\n]`).join('\n');
}
function enumLabel(c) { // 列表里枚举/状态显示为文字
  return `(row: any) => (${camel(c.col)}Options.find(o => o.value === row.${camel(c.col)}) || {}).label || '--'`;
}

// ── service/<entity>.ts ──
function serviceFile(ek, api) {
  const Cap = cap(ek);
  return `import axios from '@/utils/axios'
import type { ${Cap}VO, ${Cap}SaveReq, ${Cap}Query } from '@/types/${ek}'
import type { Result, Page } from '@/types/common'

/** ${Cap} CRUD 请求（Result code 2000=成功） */
export default {
  list(query: ${Cap}Query) {
    return axios.get<Result<Page<${Cap}VO>>>('${(api.list || {}).path || `/api/${ek}`}', { params: query })
  },
  detail(id: number) {
    return axios.get<Result<${Cap}VO>>('${((api.detail || {}).path || `/api/${ek}/{id}`).replace('{id}', '')}' + id)
  },
  create(data: ${Cap}SaveReq) {
    return axios.post<Result<number>>('${(api.create || {}).path || `/api/${ek}`}', data)
  },
  update(id: number, data: ${Cap}SaveReq) {
    return axios.put<Result<void>>('${((api.update || {}).path || `/api/${ek}/{id}`).replace('{id}', '')}' + id, data)
  },
  remove(id: number) {
    return axios.delete<Result<void>>('${((api.delete || {}).path || `/api/${ek}/{id}`).replace('{id}', '')}' + id)
  }
}
`;
}

// ── types/<entity>.ts ──
function typesFile(ek, ent, api, detail) {
  const Cap = cap(ek);
  const voF = ent.columns.map(c => `  ${camel(c.col)}?: ${tsType(c)}`).join('\n');
  const reqF = ent.columns.map(c => `  ${camel(c.col)}${c.nullable ? '?' : ''}: ${tsType(c)}`).join('\n');
  const qF = ((api.list && api.list.query) || []).map(n => `  ${n}?: ${(entities[ek].columns.find(c => camel(c.col) === n) ? tsType(entities[ek].columns.find(c => camel(c.col) === n)) : 'string')}`).join('\n');
  let lineIface = '', voLines = '', reqLines = '';
  if (detail) {
    const DCap = cap(detail.entity), dcols = entities[detail.entity].columns.filter(c => c.col !== detail.fk);
    lineIface = `\n/** ${detail.label || DCap} 行 */\nexport interface ${DCap}VO {\n  id?: number\n${dcols.map(c => `  ${camel(c.col)}?: ${tsType(c)}`).join('\n')}\n}\n\nexport interface ${DCap}SaveReq {\n${dcols.map(c => `  ${camel(c.col)}${c.nullable ? '?' : ''}: ${tsType(c)}`).join('\n')}\n}\n`;
    voLines = `\n  lines?: ${DCap}VO[]`;
    reqLines = `\n  lines?: ${DCap}SaveReq[]`;
  }
  return `${lineIface}
/** ${Cap} 展示对象 */
export interface ${Cap}VO {
  id?: number
${voF}
  createTime?: string
  updateTime?: string${voLines}
}

/** ${Cap} 新增/编辑请求 */
export interface ${Cap}SaveReq {
${reqF}${reqLines}
}

/** ${Cap} 列表查询参数 */
export interface ${Cap}Query {
  page?: number
  size?: number
${qF}
}
`;
}

// ── views/<entity>/index.vue（列表）──
function listVue(ek, ent, api) {
  const Cap = cap(ek), q = (api.list && api.list.query) || [];
  const colByCamel = {}; ent.columns.forEach(c => colByCamel[camel(c.col)] = c);
  const searchItems = q.map(n => {
    const c = colByCamel[n];
    if (c && c.enum) return `      <SearchSeleItem type="select" v-model="search.${n}" :placeholder="lang('请选择')" :options="${n}Options" clearable filterable />`;
    return `      <SearchSeleItem type="input" v-model="search.${n}" :placeholder="lang('请输入')" clearable />`;
  }).join('\n');
  const cols = listCols(ent).map(c => c.enum
    ? `      <el-table-column :label="lang('${c.comment || camel(c.col)}')" min-width="120"><template #default="{ row }">{{ ${enumLabel(c).replace('(row: any) => ', '').replace(/row\./g, 'row.')} }}</template></el-table-column>`.replace(/\(\s*row\.[a-zA-Z]+.*?\)\s*\|\|/, m => m) // keep simple
    : `      <el-table-column prop="${camel(c.col)}" :label="lang('${c.comment || camel(c.col)}')" min-width="120" show-overflow-tooltip />`).join('\n');
  return `<template>
  <el-config-provider>
    <div class="page-list">
      <SearchBox @search="load" @reset="onReset">
${searchItems || '        <!-- 无查询字段 -->'}
      </SearchBox>

      <div class="toolbar">
        <el-button type="primary" @click="toForm('add')">{{ lang('新增') }}</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" border stripe>
${cols}
        <el-table-column :label="lang('操作')" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="toForm('view', row.id)">{{ lang('查看') }}</el-button>
            <el-button link type="primary" @click="toForm('edit', row.id)">{{ lang('编辑') }}</el-button>
            <el-button link type="danger" @click="onDelete(row)">{{ lang('删除') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        v-model:current-page="search.page"
        v-model:page-size="search.size"
        :page-sizes="[10, 25, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="load" @current-change="load" />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { lang } from '@/language'
import ${ek}Service from '@/service/${ek}'
import type { ${Cap}VO, ${Cap}Query } from '@/types/${ek}'

const router = useRouter()
const loading = ref(false)
const tableData = ref<${Cap}VO[]>([])
const total = ref(0)
const search = reactive<${Cap}Query>({ page: 1, size: 10 })
${optionsBlock(ent.columns)}

async function load() {
  loading.value = true
  try {
    const { data } = await ${ek}Service.list(search)
    tableData.value = data.data.records
    total.value = data.data.total
  } finally { loading.value = false }
}
function onReset() { Object.keys(search).forEach(k => { if (k !== 'page' && k !== 'size') (search as any)[k] = undefined }); search.page = 1; load() }
function toForm(mode: string, id?: number) { router.push({ path: '/${ek}/form', query: { mode, id } }) }
async function onDelete(row: ${Cap}VO) {
  await ElMessageBox.confirm(lang('确认删除该记录？'), lang('提示'), { type: 'warning' })
  await ${ek}Service.remove(row.id!)
  ElMessage.success(lang('删除成功'))
  load()
}
onMounted(load)
</script>
`;
}

// ── views/<entity>/form.vue（新增/编辑/查看 双态）──
function formControl(c) {
  const m = `formData.${camel(c.col)}`;
  if (c.enum) return `<el-select v-model="${m}" :placeholder="lang('请选择')" clearable filterable style="width:100%">\n            <el-option v-for="o in ${camel(c.col)}Options" :key="o.value" :label="o.label" :value="o.value" />\n          </el-select>`;
  if (c.fk) return `<el-select v-model="${m}" :placeholder="lang('请选择')" clearable filterable style="width:100%"><!-- TODO: options 来自 ${c.fk.entity} 远程/字典 --></el-select>`;
  if (c.type === 'text') return `<el-input v-model.trim="${m}" type="textarea" :rows="2" :maxlength="${c.len || 1000}" show-word-limit :placeholder="lang('请输入')" />`;
  if (c.type === 'decimal') return `<el-input-number v-model="${m}" :precision="${c.scale != null ? c.scale : 2}" :controls="false" style="width:100%" :placeholder="lang('请输入')" />`;
  if (c.type === 'int' || c.type === 'bigint' || c.type === 'tinyint') return `<el-input-number v-model="${m}" :controls="false" style="width:100%" :placeholder="lang('请输入')" />`;
  if (c.type === 'date') return `<el-date-picker v-model="${m}" type="date" value-format="YYYY-MM-DD" style="width:100%" :placeholder="lang('请选择')" />`;
  if (c.type === 'datetime') return `<el-date-picker v-model="${m}" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" :placeholder="lang('请选择')" />`;
  return `<el-input v-model.trim="${m}" :maxlength="${c.len || 255}" clearable :placeholder="lang('请输入')" />`;
}
function displayExpr(c) {
  const m = `formData.${camel(c.col)}`;
  if (c.enum) return `(${camel(c.col)}Options.find(o => o.value === ${m}) || {}).label || '--'`;
  return `${m} ?? '--'`;
}
function cellControl(c) {
  const m = `row.${camel(c.col)}`;
  if (c.enum) return `<el-select v-model="${m}" size="small" style="width:100%"><el-option v-for="o in ${camel(c.col)}Options" :key="o.value" :label="o.label" :value="o.value" /></el-select>`;
  if (c.fk) return `<el-select v-model="${m}" size="small" filterable style="width:100%"><!-- TODO options 来自 ${c.fk.entity} --></el-select>`;
  if (c.type === 'decimal') return `<el-input-number v-model="${m}" :precision="${c.scale != null ? c.scale : 2}" :controls="false" size="small" style="width:100%" />`;
  if (c.type === 'int' || c.type === 'bigint' || c.type === 'tinyint') return `<el-input-number v-model="${m}" :controls="false" size="small" style="width:100%" />`;
  return `<el-input v-model.trim="${m}" size="small" :maxlength="${c.len || 200}" />`;
}
function childTable(detail) {
  const dent = entities[detail.entity], cols = dent.columns.filter(c => c.col !== detail.fk);
  const cells = cols.map(c => `        <el-table-column :label="lang('${c.comment || camel(c.col)}')" min-width="130">
          <template #default="{ row }">
            <template v-if="!pageDisabled">${cellControl(c)}</template>
            <span v-else>{{ row.${camel(c.col)} ?? '--' }}</span>
          </template>
        </el-table-column>`).join('\n');
  return `
    <div class="form-header__title">{{ lang('${detail.label || '明细'}') }}</div>
    <el-button v-if="!pageDisabled" type="primary" plain size="small" style="margin-bottom:10px" @click="addLine">{{ lang('新增行') }}</el-button>
    <el-table :data="formData.lines" border size="small">
${cells}
      <el-table-column v-if="!pageDisabled" :label="lang('操作')" width="80">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeLine($index)">{{ lang('删除') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
`;
}
function formVue(ek, ent, detail) {
  const Cap = cap(ek);
  const items = ent.columns.map(c => {
    const name = camel(c.col);
    return `        <el-form-item :label="lang('${c.comment || name}')" prop="${name}"${c.nullable ? '' : ' required'} style="width:48%">
          <template v-if="!pageDisabled">${formControl(c)}</template>
          <span v-else class="form-box-text">{{ ${displayExpr(c)} }}</span>
        </el-form-item>`;
  }).join('\n');
  const rules = ent.columns.filter(c => !c.nullable || (c.type === 'varchar' && c.len)).map(c => {
    const rs = [];
    if (!c.nullable) rs.push(`{ required: true, message: lang('${c.comment || camel(c.col)}不能为空'), trigger: '${c.enum || c.fk ? 'change' : 'blur'}' }`);
    if (c.type === 'varchar' && c.len) rs.push(`{ max: ${c.len}, message: lang('超长'), trigger: 'blur' }`);
    return `  ${camel(c.col)}: [${rs.join(', ')}]`;
  }).join(',\n');
  const allCols = detail ? [...ent.columns, ...entities[detail.entity].columns] : ent.columns;
  const lineInit = detail ? "\nif (!formData.lines) formData.lines = []\nfunction addLine() { formData.lines!.push({} as any) }\nfunction removeLine(i: number) { formData.lines!.splice(i, 1) }" : '';
  return `<template>
  <div class="page-form">
    <div class="form-header__title">{{ lang('基本信息') }}</div>
    <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top" :inline="true" :disabled="pageDisabled">
${items}
    </el-form>
${detail ? childTable(detail) : ''}
    <div class="form-footer">
      <el-button @click="goBack">{{ pageDisabled ? lang('返回') : lang('取消') }}</el-button>
      <el-button v-if="!pageDisabled" type="primary" @click="onSave">{{ lang('保存') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { lang } from '@/language'
import ${ek}Service from '@/service/${ek}'
import type { ${Cap}SaveReq } from '@/types/${ek}'

const route = useRoute()
const router = useRouter()
const mode = (route.query.mode as string) || 'add'
const id = route.query.id ? Number(route.query.id) : undefined
const pageDisabled = ref(mode === 'view')   // 查看=只读
const formRef = ref<FormInstance>()
const formData = reactive<${Cap}SaveReq>({} as ${Cap}SaveReq)
${optionsBlock(allCols)}${lineInit}
const formRules = reactive<FormRules>({
${rules}
})

async function loadDetail() {
  if (!id) return
  const { data } = await ${ek}Service.detail(id)
  Object.assign(formData, data.data)
}
async function onSave() {
  await formRef.value?.validate()
  if (mode === 'edit' && id) await ${ek}Service.update(id, formData)
  else await ${ek}Service.create(formData)
  ElMessage.success(lang('保存成功'))
  goBack()
}
function goBack() { router.back() }
onMounted(loadDetail)
</script>
`;
}

// ── 写出 ──
fs.mkdirSync(outDir, { recursive: true });
const write = (sub, name, content) => { const d = path.join(outDir, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), content); };
let count = 0;
for (const [fpk, fp] of Object.entries(fps)) {
  const ek = fp.entity, ent = entities[ek];
  if (!ent) { console.log(`  ⚠ ${fpk} 的 entity ${ek} 不存在，跳过`); continue; }
  const api = fp.api || {};
  const detail = fp.detail && entities[fp.detail.entity] ? fp.detail : null;
  write('service', `${ek}.ts`, serviceFile(ek, api));
  write('types', `${ek}.ts`, typesFile(ek, ent, api, detail));
  write(`views/${ek}`, 'index.vue', listVue(ek, ent, api));
  write(`views/${ek}`, 'form.vue', formVue(ek, ent, detail));
  count += 4;
  console.log(`  ✓ ${cap(ek)}: service.ts / types.ts / index.vue(列表) / form.vue(表单${detail ? '+明细子表' : '双态'}) (4)`);
}
console.log('\n════════ 前端页面生成器（阶段3B · Vue3+TS+EP）════════');
console.log(`  生成 ${count} 个文件 → ${outDir}`);
console.log('  L3：列表/表单/详情骨架·联动/远程下拉/权限标 TODO（研发+AI 接力）');
console.log('  前提：项目已有 SearchBox/SearchSeleItem/lang()/axios 基座');
console.log('════════════════════════════════════════════════════\n');
process.exit(0);
