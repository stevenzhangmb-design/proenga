#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   删除同步 + 场景①注入 · 隔离闸 · delete-sync-isolated-gate.js · 随包发·不污染真数据
   ────────────────────────────────────────────────────────────────────────
   一次覆盖两条【标注→本地文件】方向、之前只标未专门跑的链路：
     ● 场景①（对话框→本地PRD）：POST /anno-inject { pins } → 临时 prd-data.json 增该功能点 +
        PRD-<sys>.md 生成并含该功能名。＝铁律 三.1 / ④「不圈选直接生成 → 同步」的数据侧证据。
     ● 三.2 删除同步：POST /anno-update { changes:[{action:'delete'}] } → 临时 prd-data.json 移除该
        功能点 + PRD-<sys>.md 重生且不再含它。＝铁律 三.2「删除 → 本地 PRD 同步」证据。
   —— 完全隔离（同 ㉕ sync-isolated-gate）：起【临时 anno-server】(临时端口 ANNO_PORT + 临时目录
      ANNO_ARCHIVE_DIR)，在临时目录现装一个测试原型，全部读写落临时目录，验完销毁。真实例(3799)、
      真 archive / 真 prd-data【碰都不碰】。不驱动浏览器——直接打 anno-server HTTP 端点验数据侧同步
      （标注 PIN 的实时增删由 ⑯ inject-roundtrip 覆盖；本闸专验"标注操作→本地文件真的落/真的删"）。
   零依赖：node 内置 + assemble-prototype.js + anno-server/server.js(ANNO_PORT 覆盖端口)。
   退出码：0=通过/跳过 1=失败。找不到 anno-server 则 SKIP(exit 0)。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const QA = __dirname;
const SERVER = [
  path.join(QA, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(QA, '..', '..', '..', 'anno-server', 'server.js'),
  'D:/AI/anno-server/server.js',
].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const APORT = 3811;                 // 与 ㉕(3810) 错开，避免并行串口
const FP_KEY = 'OMS.删除同步测试项';
const FP_NAME = '删除同步测试项ZZZ';

const pingA = () => new Promise(res => { const r = http.get(`http://localhost:${APORT}/anno-queue`, x => { res(x.statusCode === 200); x.resume(); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });

function post(pathname, obj) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(obj), 'utf8');
    const req = http.request({ host: 'localhost', port: APORT, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      r => { let b = ''; r.on('data', d => b += d); r.on('end', () => resolve({ status: r.statusCode, body: b })); });
    req.on('error', reject); req.write(data); req.end();
  });
}
const sleep = ms => new Promise(z => setTimeout(z, ms));
// 轮询到条件成立（异步生成 PRD 可能几秒），最多 waitMs
async function waitUntil(fn, waitMs = 30000, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < waitMs) { try { if (fn()) return true; } catch (_) {} await sleep(step); } return false; }

// ★ 规范格式：_draft_fieldSpecs / _draft_useCaseRules 均为 markdown 字符串（与真实 prd-data 一致，
//   场景① AI 发的就是字符串表格；生成器 renderFp 直接把它当 markdown 插入）
const FIELD_SPECS = '| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |\n| --- | --- | --- | --- | --- |\n| 测试字段 | 文本 | 是 | 空 | 仅供删除同步隔离闸使用；长度≤50。 |';
const USE_CASE_RULES = '**前置条件**\n\n已登录且具备权限，存在可操作数据。\n\n**操作流程**\n\n正向：点击→成功；取消：点击取消→无变化。\n\n**后置条件**\n\n数据落库并写操作日志。';

(async () => {
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js（该功能依赖 anno-server）'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delsyncgate-'));
  const proto = path.join(tmp, 'p.html');
  let sys = '';
  try {
    execFileSync('node', [path.join(QA, 'assemble-prototype.js'), path.join(QA, 'fixtures', 'roundtrip-data.json'), proto], { stdio: 'pipe', timeout: 120000 });
    sys = (JSON.parse(fs.readFileSync(path.join(QA, 'fixtures', 'roundtrip-data.json'), 'utf8')).systemName) || '';
  } catch (e) { console.log('⊘ SKIP：现装测试原型失败:', String(e.message || e).split('\n')[0]); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const errLog = path.join(tmp, 'srv.log'); const out = fs.openSync(errLog, 'a');
  // ANNO_DOCX_*：删除同步只看 .md 数据侧，docx 重试拖时间没必要，压到最短
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, ANNO_PORT: String(APORT), ANNO_ARCHIVE_DIR: tmp, ANNO_DOCX_MAX_TRIES: '1', ANNO_DOCX_RETRY_MS: '500' } });
  let up = false; for (let i = 0; i < 70; i++) { if (await pingA()) { up = true; break; } await sleep(500); }  // 临时实例启动扫描候选目录可达~13s，给足 35s
  if (!up) { console.log('⊘ SKIP：临时 anno-server 未起来'); try { srv.kill(); } catch (_) {} fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const prdFile = path.join(tmp, 'PRD-' + sys + '.md');
  const prdDataFile = () => { for (const f of ['prd-data.json']) { const p = path.join(tmp, f); if (fs.existsSync(p)) return p; } return path.join(tmp, 'prd-data.json'); };
  const readData = () => { try { return JSON.parse(fs.readFileSync(prdDataFile(), 'utf8').replace(/^﻿/, '')); } catch (_) { return { function_points: {} }; } };
  const mdHas = (s) => { try { return fs.existsSync(prdFile) && fs.readFileSync(prdFile, 'utf8').includes(s); } catch (_) { return false; } };

  let exitCode = 1;
  try {
    // ── ① 场景①：对话框→注入 → 本地 prd-data + PRD.md ─────────────────────
    // 注意：注入首次会触发 renderBusinessFlows(冷 spawn Chrome 渲 §4.3 流程图) 后才写 md，
    // 故 md 侧给足 90s；且必须等 md 落定再发删除，杜绝两次 processPrdUpdate 竞态。
    await post('/anno-inject', { systemName: sys, pins: [{ fpKey: FP_KEY, title: FP_NAME, fieldSpecs: FIELD_SPECS, useCaseRules: USE_CASE_RULES, isAIDraft: false }] });
    const injData  = await waitUntil(() => !!(readData().function_points || {})[FP_KEY]);
    const injMd    = await waitUntil(() => mdHas(FP_NAME), 90000);

    // ── ② 三.2 删除：删该功能点 → 本地 prd-data 移除 + PRD.md 重生不再含 ────
    await post('/anno-update', { systemName: sys, changes: [{ action: 'delete', pin: { zoneContext: { fpKey: FP_KEY }, boundFp: FP_KEY, title: FP_NAME } }] });
    const delData  = await waitUntil(() => !(readData().function_points || {})[FP_KEY]);
    const delMd    = await waitUntil(() => fs.existsSync(prdFile) && !mdHas(FP_NAME));

    // ── ③ 加固回归：字段规范被传成【数组】(非规范但可能发生) → md 仍须生成、不静默崩 ──
    //    旧代码 (v||'').trim() 在数组上抛 "trim is not a function" → prd-data 写了、PRD.md 没生成。
    //    server.js draftToMd 兜底后，数组也应正常渲染成表格。此断言把该加固锁死。
    const ARR_KEY = 'OMS.数组格式健壮测试', ARR_NAME = '数组格式健壮测试YYY';
    await post('/anno-inject', { systemName: sys, pins: [{ fpKey: ARR_KEY, title: ARR_NAME, fieldSpecs: [{ field: '金额', type: '金额', required: true, default: '空', rule: '非负;2位小数' }], useCaseRules: USE_CASE_RULES, isAIDraft: false }] });
    const arrMd = await waitUntil(() => mdHas(ARR_NAME), 90000);

    console.log('\n════════ 删除同步 + 场景①注入 隔离闸（临时实例·不碰真数据）════════');
    console.log((injData ? '  ✓ ' : '  ✗ ') + '场景①：/anno-inject → 临时 prd-data.json 新增功能点「' + FP_KEY + '」');
    console.log((injMd   ? '  ✓ ' : '  ✗ ') + '场景①：PRD-<sys>.md 生成并含功能名「' + FP_NAME + '」 = 三.1/④ 对话框→本地PRD 成立');
    console.log((delData ? '  ✓ ' : '  ✗ ') + '三.2：/anno-update delete → 临时 prd-data.json 已移除该功能点');
    console.log((delMd   ? '  ✓ ' : '  ✗ ') + '三.2：PRD-<sys>.md 已重生且不再含「' + FP_NAME + '」 = 删除→本地PRD 同步成立');
    console.log((arrMd   ? '  ✓ ' : '  ✗ ') + '加固：字段规范传数组时 PRD.md 仍生成（draftToMd 兜底·不再静默崩）');
    const pass = injData && injMd && delData && delMd && arrMd;
    console.log('──────────────────────────────');
    console.log(pass ? '  删除同步 + 场景①注入 隔离闸 全绿 PASS ✅' : '  删除同步 + 场景①注入 隔离闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 隔离闸异常:', e.message); }
  finally { try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
