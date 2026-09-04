#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   assemble-once.js · 一次性装配器（重活隔离层）
   ────────────────────────────────────────────────────────────────────────
   为什么存在：常驻 anno-server 反复崩的根，是它在自己进程里同步跑 Chrome(流程图/截图)
   + pandoc(docx)——这些超时/被占用/没装就把常驻带崩。本文件把这三样重活隔离成一个
   【一次性子进程】：常驻只管写 prd-data.json + 广播 SSE（纯 fs·永不崩），然后 detached
   spawn 本脚本去出图/docx；本脚本崩了只崩自己，常驻照常服务、数据不丢。

   运行：node assemble-once.js "<systemName>"
     · require('./server.js') 因 require.main 守卫【不会启动 HTTP 服务】，只拿导出函数。
     · 跑完 assembleArtifacts 即自然退出；若 docx 被 Word 锁，会因有界重试定时器多活一会儿，
       重试成功/放弃后定时器清空，进程自然退出（不常驻、不泄漏）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const systemName = process.argv.slice(2).join(' ').trim();
try {
  const S = require('./server.js');
  if (typeof S.assembleArtifacts !== 'function') {
    console.error('[ASSEMBLE-ONCE] server.js 未导出 assembleArtifacts');
    process.exit(2);
  }
  const status = S.assembleArtifacts(systemName) || { ok: true };
  // 回报常驻 → 广播 SSE → 原型弹提示（docx/流程图没出让用户知道·可重生）。失败静默：常驻可能在重启，数据/文件已落盘不受影响。
  try {
    const http = require('http');
    const payload = JSON.stringify(status);
    const req = http.request({ host: 'localhost', port: 3799, path: '/anno-assemble-status', method: 'POST', timeout: 2500,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (r) => { r.resume(); });
    req.on('error', () => {}); req.on('timeout', () => { try { req.destroy(); } catch (_) {} });
    req.write(payload); req.end();
  } catch (_) {}
} catch (e) {
  // 隔离：本子进程失败绝不影响常驻（常驻已把数据落盘）。仅记日志、非零退出，供监督/排查。
  console.error('[ASSEMBLE-ONCE] 装配失败（已隔离·不影响常驻·数据已落盘）:', (e && e.stack) || String(e));
  process.exit(1);
}
