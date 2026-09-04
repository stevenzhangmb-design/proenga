#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   前端工程脚手架发射器（React+AntD·配 emit-frontend-react.js）· emit-scaffold-frontend-react.js
   ────────────────────────────────────────────────────────────────────────
   emit-frontend-react.js 出的 views(*.tsx)/service/types 依赖 @/utils/axios + @/types/common。
   本脚手架补齐基座 + 工程配置，让产出【开箱即 npm i + tsc --noEmit / vite build】：
     · 搬 service/types/views → src/ ；补 src/{utils/axios,types/common,App.tsx,main.tsx,env.d.ts}
     · package.json（react/react-dom/antd/react-router-dom/axios + typescript）+ vite.config + tsconfig(jsx react-jsx) + index.html
   契约按 emit-frontend-react 产出实测对齐(service axios.get<T>·Result/Page·views 默认导出组件·react-router-dom useNavigate)。
   用法：node emit-scaffold-frontend-react.js <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
if (!outDir) { console.error('用法: node emit-scaffold-frontend-react.js <outDir>'); process.exit(2); }
const feDir = path.join(outDir, 'frontend');
if (!fs.existsSync(feDir)) { console.error('找不到 frontend 目录：' + feDir); process.exit(1); }
const src = path.join(feDir, 'src');
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };

// ① 搬 service/types/views → src/（cpSync+rmSync·避 Windows renameSync EPERM）
let moved = 0;
for (const sub of ['service', 'types', 'views']) {
  const from = path.join(feDir, sub);
  if (!fs.existsSync(from) || path.resolve(from).startsWith(path.resolve(src))) continue;
  const to = path.join(src, sub);
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true });
  moved++;
}

// 扫实体（src/views/<e>/List.tsx）
const entities = [];
try { for (const e of fs.readdirSync(path.join(src, 'views'), { withFileTypes: true })) { if (e.isDirectory() && fs.existsSync(path.join(src, 'views', e.name, 'List.tsx'))) entities.push(e.name); } } catch (e) {}

// ② 基座
w(path.join(src, 'utils', 'axios.ts'), `import axios from 'axios'
const inst = axios.create({ baseURL: (import.meta as any).env?.VITE_API_BASE || '/api', timeout: 15000 })
export default inst
`);
w(path.join(src, 'types', 'common.ts'), `export interface Result<T = any> { code: number; msg: string; data: T }
export interface Page<T = any> { records: T[]; total: number; current: number; size: number }
`);
w(path.join(src, 'env.d.ts'), `/// <reference types="vite/client" />
`);

// App.tsx —— react-router 路由到各实体 List/Form
const imps = [], routes = [];
entities.forEach((e, i) => {
  const L = 'List_' + i, F = 'Form_' + i;
  imps.push(`import ${L} from '@/views/${e}/List'`);
  routes.push(`        <Route path="/${e}" element={<${L} />} />`);
  if (fs.existsSync(path.join(src, 'views', e, 'Form.tsx'))) {
    imps.push(`import ${F} from '@/views/${e}/Form'`);
    routes.push(`        <Route path="/${e}/form" element={<${F} />} />`);
  }
});
const firstRoute = entities.length ? `        <Route path="/" element={<Navigate to="/${entities[0]}" replace />} />\n` : '';
w(path.join(src, 'App.tsx'), `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
${imps.join('\n')}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 16 }}>
        <Routes>
${firstRoute}${routes.join('\n')}
        </Routes>
      </div>
    </BrowserRouter>
  )
}
`);
w(path.join(src, 'main.tsx'), `import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`);

// ③ 工程配置
w(path.join(feDir, 'package.json'), JSON.stringify({
  name: 'frontend', private: true, version: '0.0.1', type: 'module',
  scripts: { dev: 'vite', build: 'tsc --noEmit && vite build', typecheck: 'tsc --noEmit' },
  dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0', antd: '^5.17.0', 'react-router-dom': '^6.23.0', axios: '^1.7.0' },
  devDependencies: { '@vitejs/plugin-react': '^4.3.0', typescript: '^5.4.0', vite: '^5.2.0', '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0', '@types/node': '^20.11.0' },
}, null, 2) + '\n');
w(path.join(feDir, 'vite.config.ts'), `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
`);
w(path.join(feDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2021', lib: ['ES2021', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler',
    jsx: 'react-jsx', strict: false, esModuleInterop: true, skipLibCheck: true, noEmit: true,
    baseUrl: '.', paths: { '@/*': ['src/*'] }, types: ['node'],
  },
  include: ['src'],
}, null, 2) + '\n');
w(path.join(feDir, 'index.html'), `<!doctype html>
<html lang="zh"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>生成前端</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`);

console.log('✅ 前端(React+AntD)工程脚手架已补 → ' + feDir);
console.log('   搬 service/types/views → src/(' + moved + ') · 补基座(utils/axios·types/common·App.tsx·main.tsx·env.d.ts) + package/vite/tsconfig/index.html · ' + entities.length + ' 个实体路由');
console.log('   下一步：cd ' + feDir + ' && npm install && npm run typecheck');
