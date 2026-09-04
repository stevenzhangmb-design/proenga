#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   前端发射器（读原型 PAGECFG · 吐 Vue3+EP 工程代码）· emit-frontend-proto.js
   ────────────────────────────────────────────────────────────────────────
   输入：原型 project-data JSON（renderer 读的那份·含 pages{filters/columns/rows/
        actions/statusTabs/formDialog/detailView}）。
   输出：可 npm run build 的 Vue3+Element Plus+Vite 工程（每个列表页 → List/Detail/
        FormDialog .vue + api + mock + 路由 + 固定模板层）。
   区别于 emit-frontend.js（那个读 data_model/实体列）：本发射器读【原型 UI 配置】，
   1:1 还原原型的筛选/页签/列/操作/详情——即"参照工程-租户管理-vue"的自动化形态。
   天花板：CRUD/列表/表单/详情/状态流转确定性可出；复杂业务逻辑那 20% 需 AI 逐功能补。
   用法：node emit-frontend-proto.js <project-data.json> <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('用法: node emit-frontend-proto.js <project-data.json> <outDir>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const DEF = data.defaultLocale || 'zh';
const L = (o) => (o == null ? '' : typeof o === 'string' ? o : (o[DEF] || o.zh || Object.values(o)[0] || ''));
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const w = (rel, content) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content, 'utf8'); };
const theme = data.theme || {}; const PRIMARY = theme.primary || '#3363FF'; const SIDEBAR = theme.sidebarBg || '#122041';
const SYS = data.systemName || L(data.title) || '系统';

/* ── 收集"列表页"（有 columns 的 page） ── */
const pages = data.pagecfg || data.pages || {};
const listPages = Object.keys(pages)
  .filter(k => Array.isArray(pages[k].columns) && pages[k].columns.length)
  .map(k => ({ id: k, cfg: pages[k], menu: (data.page_menus && data.page_menus[k]) || [k] }));
if (!listPages.length) { console.error('未找到任何列表页(带 columns 的 page)'); process.exit(1); }
const routeName = (id) => id.replace(/[^a-zA-Z0-9]/g, '_');

/* ══ 固定模板层 ══ */
w('package.json', JSON.stringify({
  name: routeName(SYS).toLowerCase() + '-frontend', private: true, version: '0.1.0', type: 'module',
  scripts: { dev: 'vite --port 5180', build: 'vite build', preview: 'vite preview --port 4173' },
  dependencies: { vue: '^3.4.0', 'vue-router': '^4.3.0', 'element-plus': '^2.7.0', '@element-plus/icons-vue': '^2.3.0', axios: '^1.7.0' },
  devDependencies: { '@vitejs/plugin-vue': '^5.0.0', vite: '^5.2.0' },
}, null, 2) + '\n');

w('vite.config.js', [
  "import { defineConfig } from 'vite'",
  "import vue from '@vitejs/plugin-vue'",
  "import { fileURLToPath, URL } from 'node:url'",
  '',
  'export default defineConfig({',
  '  plugins: [vue()],',
  "  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },",
  '})',
  '',
].join('\n'));

w('index.html', [
  '<!doctype html>',
  '<html lang="zh">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>' + escH(SYS) + ' · 前端工程</title>',
  '</head>',
  '<body>',
  '  <div id="app"></div>',
  '  <script type="module" src="/src/main.js"></script>',
  '</body>',
  '</html>',
  '',
].join('\n'));

w('src/main.js', [
  "import { createApp } from 'vue'",
  "import ElementPlus from 'element-plus'",
  "import 'element-plus/dist/index.css'",
  "import * as Icons from '@element-plus/icons-vue'",
  "import router from './router'",
  "import App from './App.vue'",
  '',
  'const app = createApp(App)',
  'for (const [k, c] of Object.entries(Icons)) app.component(k, c)',
  'app.use(ElementPlus).use(router).mount(\"#app\")',
  '',
].join('\n'));

w('src/App.vue', [
  '<script setup>',
  "import AppLayout from './layout/AppLayout.vue'",
  '</script>',
  '',
  '<template><AppLayout /></template>',
  '',
].join('\n'));

w('src/api/request.js', [
  "import axios from 'axios'",
  "import { ElMessage } from 'element-plus'",
  '',
  '/* 请求封装（固定模板件·发射器不改这层）：后端契约 { code, data, msg }。 */',
  'const service = axios.create({ baseURL: import.meta.env.VITE_API_BASE || \"/api\", timeout: 15000 })',
  'service.interceptors.response.use(',
  '  (resp) => {',
  '    const body = resp.data',
  "    if (body && typeof body === 'object' && 'code' in body) {",
  '      if (body.code === 0 || body.code === 200) return body.data',
  "      ElMessage.error(body.msg || '请求失败'); return Promise.reject(new Error(body.msg || 'error'))",
  '    }',
  '    return body',
  '  },',
  "  (err) => { ElMessage.error(err?.response?.data?.msg || err.message || '网络错误'); return Promise.reject(err) },",
  ')',
  'export default service',
  '',
].join('\n'));

/* ── 布局：菜单 = 各列表页末级 page_menu ── */
const menuItems = listPages.map(p => {
  const label = L(p.cfg.listTitle) || p.menu[p.menu.length - 1] || p.id;
  return "          <el-menu-item index=\"/" + routeName(p.id) + "\"><span>" + escH(label) + "</span></el-menu-item>";
}).join('\n');
w('src/layout/AppLayout.vue', [
  '<script setup>',
  "import { useRoute } from 'vue-router'",
  'const route = useRoute()',
  '</script>',
  '',
  '<template>',
  '  <el-container class="app">',
  '    <el-header class="app-header">',
  '      <div class="brand"><span class="brand-logo">' + escH(SYS.slice(0, 1)) + '</span><span>' + escH(SYS) + '</span></div>',
  '      <div class="header-tag">Vue3 + Element Plus · 前端工程代码（发射器产出）</div>',
  '    </el-header>',
  '    <el-container>',
  '      <el-aside width="210px" class="app-aside">',
  '        <el-menu :default-active="route.path" router>',
  menuItems,
  '        </el-menu>',
  '      </el-aside>',
  '      <el-main class="app-main"><router-view /></el-main>',
  '    </el-container>',
  '  </el-container>',
  '</template>',
  '',
  '<style scoped>',
  '.app { height: 100vh; }',
  '.app-header { display:flex; align-items:center; justify-content:space-between; background:' + SIDEBAR + '; color:#fff; height:50px; padding:0 16px; }',
  '.brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; }',
  '.brand-logo { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:6px; background:' + PRIMARY + '; font-size:14px; }',
  '.header-tag { font-size:12px; opacity:.7; }',
  '.app-aside { background:#fff; border-right:1px solid #eef0f4; }',
  '.app-main { background:#f7f8fa; padding:16px; }',
  '</style>',
  '',
].join('\n'));

/* ── 每页：mock + api + List/Detail/FormDialog + route ── */
const routes = [];
for (const p of listPages) {
  const { id, cfg } = p;
  const rn = routeName(id);
  const cols = cfg.columns.map(c => L(c));
  const rows = (cfg.rows || []).slice(0, 60).map(r => Array.isArray(r) ? r.map(cell => (cell && typeof cell === 'object') ? L(cell.t || cell) : cell) : r);
  const hasDetail = !!cfg.detailView;
  const hasForm = !!cfg.formDialog;
  const acts = (cfg.actions || []).map(a => ({ label: L(a.label || a), opens: a.opens || '' }));
  const tabs = (cfg.statusTabs || []).map(t => ({ key: t.key, label: L(t.label), count: t.count || 0 }));
  const filters = (cfg.filters || []).map(f => {
    const label = L(f.label); const ph = L(f.ph || {});
    let kind = 'input';
    if (f.type === 'select') kind = 'select';
    else if (/至|YYYY|日期|时间/.test(ph) || /时间|日期/.test(label)) kind = 'date';
    return { label, ph, kind, options: (f.options || []).map(o => L(o)) };
  });

  // mock
  w('src/mock/' + rn + '.js', [
    '/* mock 种子（发射器从原型 rows 生成）· 联真后端删本文件 */',
    'export const columns = ' + JSON.stringify(cols) + ';',
    'export const rows = ' + JSON.stringify(rows) + ';',
    'export const statusTabs = ' + JSON.stringify(tabs) + ';',
    '',
  ].join('\n'));

  // api
  w('src/api/' + rn + '.js', [
    "import request from './request'",
    "import { rows as _rows, statusTabs as _tabs } from '@/mock/" + rn + "'",
    'const USE_MOCK = true',
    'const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))',
    '',
    'export async function listRows(params) {',
    "  if (!USE_MOCK) return request({ url: '/" + rn + "', method: 'get', params })",
    '  await delay()',
    '  let rows = _rows.slice()',
    '  if (params.kw) rows = rows.filter((r) => r.join(\" \").includes(params.kw))',
    '  const total = rows.length',
    '  const start = (params.page - 1) * params.size',
    '  return { rows: rows.slice(start, start + params.size), total, statusTabs: _tabs }',
    '}',
    'export async function doAction(idx, action) {',
    "  if (!USE_MOCK) return request({ url: '/" + rn + "/' + idx + '/' + action, method: 'post' })",
    '  await delay(160); return true',
    '}',
    'export async function saveRow(payload) {',
    "  if (!USE_MOCK) return request({ url: '/" + rn + "', method: payload.__idx==null?'post':'put', data: payload })",
    '  await delay(180); return true',
    '}',
    '',
  ].join('\n'));

  // List.vue
  const filterEls = filters.map((f, i) => {
    const model = 'flt.f' + i;
    if (f.kind === 'select') {
      const opts = f.options.length ? f.options : ['全部'];
      return [
        '      <el-form-item label="' + escH(f.label) + '">',
        '        <el-select v-model="' + model + '" style="width:210px">',
        opts.map(o => '          <el-option label="' + escH(o) + '" value="' + escH(o) + '" />').join('\n'),
        '        </el-select>',
        '      </el-form-item>',
      ].join('\n');
    }
    if (f.kind === 'date') {
      return [
        '      <el-form-item label="' + escH(f.label) + '">',
        '        <el-date-picker v-model="' + model + '" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width:564px" value-format="YYYY-MM-DD" />',
        '      </el-form-item>',
      ].join('\n');
    }
    return [
      '      <el-form-item label="' + escH(f.label) + '">',
      '        <el-input v-model="' + model + '" placeholder="' + escH(f.ph || ('请输入' + f.label)) + '" clearable style="width:210px" @keyup.enter="onSearch" />',
      '      </el-form-item>',
    ].join('\n');
  }).join('\n');

  const kwIdx = filters.findIndex(f => f.kind === 'input');
  const colEls = cols.map((c, i) => '      <el-table-column label="' + escH(c) + '" min-width="140"><template #default="{ row }"><span>{{ row[' + i + '] }}</span></template></el-table-column>').join('\n');

  const actBtns = acts.map(a => {
    const lbl = escH(a.label);
    if (a.opens === 'detailView' && hasDetail) return '          <el-button link type="primary" @click="onDetail(row)">' + lbl + '</el-button>';
    if (a.opens === 'formDialog' && hasForm) return '          <el-button link type="primary" @click="onEdit(row)">' + lbl + '</el-button>';
    return '          <el-button link type="primary" @click="onCfm(row, \'' + esc(a.label) + '\')">' + lbl + '</el-button>';
  }).join('\n');
  const actWidth = Math.max(120, acts.length * 56);

  const primaryLabel = cfg.primaryBtn ? L(cfg.primaryBtn.label) : '';
  const toolbarBtns = [
    (cfg.primaryBtn && hasForm) ? '      <el-button type="primary" @click="onAdd">' + escH(primaryLabel) + '</el-button>' : '',
    ...(cfg.toolbar || []).map(t => '      <el-button plain @click="ElMessage.info(\'' + esc(L(t)) + '（示意）\')">' + escH(L(t)) + '</el-button>'),
  ].filter(Boolean).join('\n');

  const tabEls = tabs.length ? [
    '    <el-tabs v-model="tab" @tab-change="onSearch" class="status-tabs">',
    tabs.map(t => '      <el-tab-pane name="' + esc(t.key) + '" label="' + escH(t.label) + ' (' + t.count + ')" />').join('\n'),
    '    </el-tabs>',
  ].join('\n') : '';

  w('src/views/' + rn + '/List.vue', [
    '<script setup>',
    "import { ref, reactive, onMounted } from 'vue'",
    hasDetail ? "import { useRouter } from 'vue-router'" : '',
    "import { ElMessage, ElMessageBox } from 'element-plus'",
    "import { listRows, doAction } from '@/api/" + rn + "'",
    hasForm ? "import FormDialog from './FormDialog.vue'" : '',
    hasDetail ? 'const router = useRouter()' : '',
    'const flt = reactive({ ' + filters.map((f, i) => 'f' + i + ': ' + (f.kind === 'date' ? '[]' : (f.kind === 'select' && f.options[0] ? "'" + esc(f.options[0]) + "'" : "''")) + '').join(', ') + ' })',
    'const tab = ref(' + (tabs[0] ? "'" + esc(tabs[0].key) + "'" : "'all'") + ')',
    'const rows = ref([]); const total = ref(0); const loading = ref(false)',
    'const page = reactive({ current: 1, size: 10 })',
    'async function load() {',
    '  loading.value = true',
    '  try {',
    '    const res = await listRows({ page: page.current, size: page.size, kw: ' + (kwIdx >= 0 ? 'flt.f' + kwIdx : "''") + ', tab: tab.value })',
    '    rows.value = res.rows; total.value = res.total',
    '  } finally { loading.value = false }',
    '}',
    'function onSearch() { page.current = 1; load() }',
    'function onReset() { ' + filters.map((f, i) => 'flt.f' + i + ' = ' + (f.kind === 'date' ? '[]' : (f.kind === 'select' && f.options[0] ? "'" + esc(f.options[0]) + "'" : "''"))).join('; ') + '; onSearch() }',
    hasDetail ? 'function onDetail(row) { router.push({ name: \"' + rn + 'Detail\", query: { i: rows.value.indexOf(row) } }) }' : '',
    hasForm ? 'const dialogRef = ref(); function onAdd() { dialogRef.value.open(null) } function onEdit(row) { dialogRef.value.open(row) }' : '',
    'async function onCfm(row, label) {',
    '  await ElMessageBox.confirm(`确认执行「${label}」？`, label, { type: \"warning\" })',
    '  await doAction(rows.value.indexOf(row), label); ElMessage.success(`${label}成功`); load()',
    '}',
    'onMounted(load)',
    '</script>',
    '',
    '<template>',
    '  <div class="page">',
    filters.length ? '    <el-form class="filter-bar" inline>\n' + filterEls + '\n      <el-form-item class="filter-actions"><el-button type="primary" @click="onSearch">查询</el-button><el-button @click="onReset">重置</el-button></el-form-item>\n    </el-form>' : '',
    toolbarBtns ? '    <div class="toolbar">\n' + toolbarBtns + '\n    </div>' : '',
    tabEls,
    '    <el-table v-loading="loading" :data="rows" border stripe style="width:100%">',
    colEls,
    acts.length ? '      <el-table-column label="操作" width="' + actWidth + '" fixed="right"><template #default="{ row }">\n' + actBtns + '\n        </template></el-table-column>' : '',
    '    </el-table>',
    '    <el-pagination class="pager" background v-model:current-page="page.current" v-model:page-size="page.size" :page-sizes="[10,25,50,100]" :total="total" layout="total, sizes, prev, pager, next, jumper" @size-change="load" @current-change="load" />',
    hasForm ? '    <FormDialog ref="dialogRef" @saved="load" />' : '',
    '  </div>',
    '</template>',
    '',
    '<style scoped>',
    '.page { background:#fff; padding:16px; border-radius:8px; }',
    '.filter-bar { background:#f7f8fa; border-radius:6px; padding:24px 24px 6px; }',
    '.filter-bar :deep(.el-form-item__label) { width:112px; }',
    '.filter-actions { margin-left:auto; }',
    '.toolbar { display:flex; gap:8px; margin:14px 0 4px; }',
    '.pager { margin-top:14px; display:flex; justify-content:flex-end; }',
    '</style>',
    '',
  ].filter(l => l !== '').join('\n'));

  // Detail.vue
  if (hasDetail) {
    const dtItems = cols.map((c, i) => '      <el-descriptions-item label="' + escH(c) + '">{{ row[' + i + '] }}</el-descriptions-item>').join('\n');
    w('src/views/' + rn + '/Detail.vue', [
      '<script setup>',
      "import { ref, onMounted } from 'vue'",
      "import { useRoute, useRouter } from 'vue-router'",
      "import { rows as _rows } from '@/mock/" + rn + "'",
      'const route = useRoute(); const router = useRouter()',
      'const row = ref([])',
      'onMounted(() => { const i = Number(route.query.i || 0); row.value = _rows[i] || [] })',
      '</script>',
      '',
      '<template>',
      '  <div class="detail">',
      '    <div class="detail-head"><span class="dt-title">' + escH(L(cfg.detailView.title) || '详情') + '</span><el-button @click="router.back()">返回</el-button></div>',
      '    <el-descriptions :column="2" border>',
      dtItems,
      '    </el-descriptions>',
      '  </div>',
      '</template>',
      '',
      '<style scoped>',
      '.detail { background:#fff; padding:16px; border-radius:8px; }',
      '.detail-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }',
      '.dt-title { font-size:16px; font-weight:600; }',
      '</style>',
      '',
    ].join('\n'));
  }

  // FormDialog.vue（字段取列头·回显；标题按新增/编辑切换）
  if (hasForm) {
    const editable = cols.filter(c => !/编号|时间|数$|状态/.test(c)).slice(0, 8);
    const fldItems = editable.map((c, i) => '        <el-col :span="12"><el-form-item label="' + escH(c) + '"><el-input v-model="form.k' + i + '" placeholder="请输入' + escH(c) + '" /></el-form-item></el-col>').join('\n');
    w('src/views/' + rn + '/FormDialog.vue', [
      '<script setup>',
      "import { ref, reactive, computed } from 'vue'",
      "import { ElMessage } from 'element-plus'",
      "import { saveRow } from '@/api/" + rn + "'",
      "const emit = defineEmits(['saved'])",
      'const visible = ref(false); const saving = ref(false); const editing = ref(false)',
      'const form = reactive({ ' + editable.map((c, i) => 'k' + i + ": ''").join(', ') + ' })',
      "const title = computed(() => (editing.value ? '编辑" + esc(L(cfg.primaryBtn ? {} : {}) || '') + "记录' : '" + esc(primaryLabel || '新增') + "'))",
      'function open(row) {',
      '  editing.value = !!row',
      editable.map((c, i) => '  form.k' + i + " = row ? (row[" + cols.indexOf(c) + "] ?? '') : ''").join('\n'),
      '  visible.value = true',
      '}',
      'defineExpose({ open })',
      'async function onSave() { saving.value = true; try { await saveRow({ ...form }); ElMessage.success(editing.value ? \"已保存\" : \"已新增\"); visible.value = false; emit(\"saved\") } finally { saving.value = false } }',
      '</script>',
      '',
      '<template>',
      '  <el-dialog v-model="visible" :title="title" width="680px" append-to-body>',
      '    <el-form label-width="110px">',
      '      <el-row :gutter="16">',
      fldItems,
      '      </el-row>',
      '    </el-form>',
      '    <template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="onSave">保存</el-button></template>',
      '  </el-dialog>',
      '</template>',
      '',
    ].join('\n'));
  }

  routes.push({ id: rn, hasDetail });
}

/* ── router ── */
const routeLines = [];
routeLines.push("  { path: '/', redirect: '/" + routes[0].id + "' },");
for (const r of routes) {
  routeLines.push("  { path: '/" + r.id + "', name: '" + r.id + "', component: () => import('@/views/" + r.id + "/List.vue') },");
  if (r.hasDetail) routeLines.push("  { path: '/" + r.id + "/detail', name: '" + r.id + "Detail', component: () => import('@/views/" + r.id + "/Detail.vue') },");
}
w('src/router/index.js', [
  "import { createRouter, createWebHistory } from 'vue-router'",
  '',
  'const routes = [',
  routeLines.join('\n'),
  ']',
  '',
  'export default createRouter({ history: createWebHistory(), routes })',
  '',
].join('\n'));

w('README.md', [
  '# ' + SYS + ' · 前端工程代码（发射器产出）',
  '',
  '> 由 `emit-frontend-proto.js` 读原型 PAGECFG 自动生成。Vue3 + Element Plus + Vite。',
  '',
  '```bash',
  'npm install && npm run dev   # http://localhost:5180',
  '```',
  '',
  '默认走内存 mock，无需后端。联真后端：各 `src/api/*.js` 顶部 `USE_MOCK=false`。',
  '',
  '共 ' + listPages.length + ' 个列表页：' + listPages.map(p => L(p.cfg.listTitle) || p.id).join(' / '),
  '',
].join('\n'));

console.log('✅ 前端工程已生成 → ' + OUT);
console.log('   列表页 ' + listPages.length + ' 个：' + listPages.map(p => L(p.cfg.listTitle) || p.id).join(' / '));
console.log('   下一步：cd ' + OUT + ' && npm install && npm run build');
