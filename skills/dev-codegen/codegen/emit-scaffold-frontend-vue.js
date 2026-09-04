#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   前端工程脚手架发射器（Vue3+EP·配 emit-frontend.js）· emit-scaffold-frontend-vue.js
   ────────────────────────────────────────────────────────────────────────
   emit-frontend.js 出的 views/service/types 依赖一套内部约定(@/language·@/utils/axios·
   @/types/common·全局组件 SearchBox/SearchSeleItem)——非自包含。本脚手架把这套基座补齐，
   让产出【开箱即 npm i + vue-tsc / vite build】：
     · 搬 service/types/views → src/ ；补 src/{language,utils/axios,types/common,components/*,router,App,main,components.d.ts}
     · package.json（vue/element-plus/vue-router/axios + vue-tsc）+ vite.config + tsconfig + index.html
   契约按 emit-frontend.js 产出实测对齐(SearchBox @search/@reset+slot · SearchSeleItem type/v-model/options/clearable/filterable · lang(s) · axios.get<T> · Result/Page)。
   用法：node emit-scaffold-frontend-vue.js <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
if (!outDir) { console.error('用法: node emit-scaffold-frontend-vue.js <outDir>'); process.exit(2); }
const feDir = path.join(outDir, 'frontend');
if (!fs.existsSync(feDir)) { console.error('找不到 frontend 目录：' + feDir); process.exit(1); }
const src = path.join(feDir, 'src');
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };

// ① 搬 service/types/views → src/
let moved = 0;
for (const sub of ['service', 'types', 'views']) {
  const from = path.join(feDir, sub);
  if (!fs.existsSync(from) || path.resolve(from).startsWith(path.resolve(src))) continue;
  const to = path.join(src, sub);
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });          // copy+rm 比 renameSync 稳（Windows 对含句柄/已存在目标的 rename 会 EPERM）
  fs.rmSync(from, { recursive: true, force: true });
  moved++;
}

// 扫实体（src/views/<e>/index.vue）
const entities = [];
try { for (const e of fs.readdirSync(path.join(src, 'views'), { withFileTypes: true })) { if (e.isDirectory() && fs.existsSync(path.join(src, 'views', e.name, 'index.vue'))) entities.push(e.name); } } catch (e) {}

// ② 基座
w(path.join(src, 'language', 'index.ts'), `// i18n 占位：真接入换成查表。生成码统一 lang() 包裹，方便后续多语。
export function lang(s: string): string { return s }
`);
w(path.join(src, 'utils', 'axios.ts'), `import axios from 'axios'
const inst = axios.create({ baseURL: (import.meta as any).env?.VITE_API_BASE || '/api', timeout: 15000 })
export default inst
`);
w(path.join(src, 'types', 'common.ts'), `export interface Result<T = any> { code: number; msg: string; data: T }
export interface Page<T = any> { records: T[]; total: number; current: number; size: number }
`);
w(path.join(src, 'components', 'SearchBox.vue'), `<template>
  <div class="search-box">
    <slot />
    <el-button type="primary" @click="$emit('search')">查询</el-button>
    <el-button @click="$emit('reset')">重置</el-button>
  </div>
</template>
<script setup lang="ts">
defineEmits<{ (e: 'search'): void; (e: 'reset'): void }>()
</script>
<style scoped>.search-box{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:#f7f8fa;padding:16px;border-radius:6px}</style>
`);
w(path.join(src, 'components', 'SearchSeleItem.vue'), `<template>
  <el-select v-if="type === 'select'" :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
    :placeholder="placeholder" :clearable="clearable" :filterable="filterable" style="width:200px">
    <el-option v-for="o in (options || [])" :key="String(o.value)" :label="o.label" :value="o.value" />
  </el-select>
  <el-input v-else :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
    :placeholder="placeholder" :clearable="clearable" style="width:200px" />
</template>
<script setup lang="ts">
defineProps<{ type?: string; modelValue?: any; placeholder?: string; options?: { label: string; value: any }[]; clearable?: boolean; filterable?: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: any): void }>()
</script>
`);
// 全局组件声明（让 vue-tsc 认识模板里的 SearchBox/SearchSeleItem）
w(path.join(src, 'components.d.ts'), `import SearchBox from './components/SearchBox.vue'
import SearchSeleItem from './components/SearchSeleItem.vue'
declare module 'vue' {
  export interface GlobalComponents {
    SearchBox: typeof SearchBox
    SearchSeleItem: typeof SearchSeleItem
  }
}
export {}
`);
// router
const routeLines = [];
if (entities.length) routeLines.push(`  { path: '/', redirect: '/${entities[0]}' },`);
for (const e of entities) {
  routeLines.push(`  { path: '/${e}', component: () => import('@/views/${e}/index.vue') },`);
  if (fs.existsSync(path.join(src, 'views', e, 'form.vue'))) routeLines.push(`  { path: '/${e}/form', component: () => import('@/views/${e}/form.vue') },`);
}
w(path.join(src, 'router', 'index.ts'), `import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
const routes: RouteRecordRaw[] = [
${routeLines.join('\n')}
]
export default createRouter({ history: createWebHistory(), routes })
`);
w(path.join(src, 'App.vue'), `<template><router-view /></template>
`);
w(path.join(src, 'main.ts'), `import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'
import App from './App.vue'
import SearchBox from './components/SearchBox.vue'
import SearchSeleItem from './components/SearchSeleItem.vue'

const app = createApp(App)
app.component('SearchBox', SearchBox)
app.component('SearchSeleItem', SearchSeleItem)
app.use(ElementPlus).use(router).mount('#app')
`);
w(path.join(src, 'env.d.ts'), `/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const c: DefineComponent<{}, {}, any>
  export default c
}
`);

// ③ 工程配置
w(path.join(feDir, 'package.json'), JSON.stringify({
  name: 'frontend', private: true, version: '0.0.1', type: 'module',
  scripts: { dev: 'vite', build: 'vue-tsc --noEmit && vite build', typecheck: 'vue-tsc --noEmit' },
  dependencies: { vue: '^3.4.0', 'vue-router': '^4.3.0', 'element-plus': '^2.7.0', '@element-plus/icons-vue': '^2.3.0', axios: '^1.7.0' },
  devDependencies: { '@vitejs/plugin-vue': '^5.0.0', typescript: '^5.4.0', 'vue-tsc': '^2.0.0', vite: '^5.2.0', '@types/node': '^20.11.0' },
}, null, 2) + '\n');
w(path.join(feDir, 'vite.config.ts'), `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
`);
w(path.join(feDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2021', module: 'ESNext', moduleResolution: 'bundler', lib: ['ES2021', 'DOM', 'DOM.Iterable'],
    strict: false, jsx: 'preserve', esModuleInterop: true, skipLibCheck: true, noEmit: true,
    types: ['node'], baseUrl: '.', paths: { '@/*': ['src/*'] },
  },
  include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
}, null, 2) + '\n');
w(path.join(feDir, 'index.html'), `<!doctype html>
<html lang="zh"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>生成前端</title></head>
<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>
`);

console.log('✅ 前端(Vue3+EP)工程脚手架已补 → ' + feDir);
console.log('   搬 service/types/views → src/(' + moved + ') · 补基座(language/axios/common/SearchBox/SearchSeleItem/router/App/main/*.d.ts) + package/vite/tsconfig/index.html · ' + entities.length + ' 个实体路由');
console.log('   下一步：cd ' + feDir + ' && npm install && npm run typecheck');
