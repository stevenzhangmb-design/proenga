#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段2/3 · 一键出料+代码 · emit-all.js · 零依赖
   一条命令跑通三生成器：契约(DDL+openapi) → 后端四层 → 前端页面。
   用法：node emit-all.js <input.json> [outDir] [basePackage]
   退出码：0=全成功 · 非0=某生成器阻断（如料不够）
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out');
const basePkg = process.argv[4] || 'com.tf.wms';
const feStack = (process.argv[5] || 'vue').toLowerCase();   // 前端栈：vue(默认·Vue3+EP) | react(React+AntD)·扇出多栈
const beStack = (process.argv[6] || 'java').toLowerCase();  // 后端栈：java(默认·Spring) | node(NestJS+TypeORM)·扇出多栈
const db = (process.argv[7] || 'mysql').toLowerCase();      // 数据库方言：mysql(默认) | postgres/pg —— 透传给 emit-contract 出对应 DDL
if (!inPath) { console.error('用法: node emit-all.js <input.json> [outDir] [basePackage] [前端栈:vue|react] [后端栈:java|node|python] [db:mysql|postgres]'); process.exit(2); }
const HERE = __dirname;
const feGen = feStack === 'react' ? 'emit-frontend-react.js' : 'emit-frontend.js';
const beDir = path.join(outDir, 'backend');
const beGen = beStack === 'node' ? 'emit-backend-node.js' : beStack === 'python' ? 'emit-backend-python.js' : 'emit-backend.js';
const beArgs = (beStack === 'node' || beStack === 'python') ? [inPath, beDir] : [inPath, beDir, basePkg];
const beName = beStack === 'node' ? 'NestJS+TypeORM' : beStack === 'python' ? 'FastAPI+SQLAlchemy' : 'Java+Spring';
const beVerify = beStack === 'node' ? ['④ 后端结构校验（TS·非 tsc）', 'verify-ts.js', [beDir]]
  : beStack === 'python' ? null   // Python 无内置静态校验器（真检查用本机 py -m py_compile）
  : ['④ Java 静态校验（前哨·非真 javac）', 'verify-java.js', [beDir]];
const steps = [
  ['① 契约（DDL[' + db + '] + openapi）', 'emit-contract.js', [inPath, outDir, db]],
  ['② 后端（' + beName + '）', beGen, beArgs],
  ['③ 前端页面（' + (feStack === 'react' ? 'React+AntD' : 'Vue3+EP') + '）', feGen, [inPath, path.join(outDir, 'frontend')]],
  ...(beVerify ? [beVerify] : []),
  ['⑤ 前端结构校验（前哨·非 vue-tsc）', 'verify-ts.js', [path.join(outDir, 'frontend')]],
  // ⑥ 后端工程脚手架：仅 Java 栈——把扁平片段搬进 Maven 布局 + 补 pom/启动类/base(TenantBasePO/Result/TextSearchHelper)/application.yml
  //    → 产出【开箱即 mvn compile】的工程（实测充值真数据 BUILD SUCCESS）。放最后（在 verify-java 之后·verify 走扁平层）。Node/Python 脚手架 TODO。
  ...(beStack === 'java' ? [['⑥ 后端工程脚手架（Maven·pom+启动类+base·开箱 mvn compile）', 'emit-scaffold-java.js', [outDir, basePkg]]]
    : beStack === 'python' ? [['⑥ 后端工程脚手架（FastAPI·db+main+requirements·开箱可 import/uvicorn）', 'emit-scaffold-python.js', [outDir]]]
    : beStack === 'node' ? [['⑥ 后端工程脚手架（NestJS·common base+app.module+main+package/tsconfig·开箱 tsc）', 'emit-scaffold-node.js', [outDir]]]
    : []),
  // ⑦ 前端工程脚手架：仅 Vue 栈——补 emit-frontend 依赖的内部基座(language/axios/common/SearchBox/SearchSeleItem/router/App/main)
  //    + package/vite/tsconfig → 产出【开箱即 npm i + vue-tsc】的前端(实测 vue-tsc 退出0)。放最后(在 ⑤ verify 之后·搬 views→src)。React 脚手架 TODO。
  ...(feStack === 'react' ? [['⑦ 前端工程脚手架（React+AntD·基座+router+package/vite/tsconfig·开箱 tsc）', 'emit-scaffold-frontend-react.js', [outDir]]]
    : [['⑦ 前端工程脚手架（Vue3+EP·基座+router+package/vite/tsconfig·开箱 vue-tsc）', 'emit-scaffold-frontend-vue.js', [outDir]]]),
];
console.log('\n██████ 一键生成：' + path.basename(inPath) + ' → ' + outDir + ' ██████');
for (const [title, script, args] of steps) {
  console.log('\n▶ ' + title);
  try { execFileSync('node', [path.join(HERE, script), ...args], { stdio: 'inherit' }); }
  catch (e) { console.error('✗ 该步阻断（退出码 ' + (e.status || 1) + '），停止。'); process.exit(e.status || 1); }
}
console.log('\n██████ 全部生成完成 → ' + outDir + '（下一步可跑 verify-java.js 静态校验）██████\n');
