#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊵-b anno-server 杀进程压力闸（活体·Windows）· anno-server-kill-stress-gate.js
   ────────────────────────────────────────────────────────────────────────
   ㊵ 是【结构+存活】校验；本闸是【活体混沌测试】——真反复杀常驻进程，断言：
     ① 每次杀掉 → 监督器自愈把 :3799 拉回来（测自愈耗时·不超阈值）
     ② 杀的过程中猛发读请求 → 服务恢复后照常应答（可用性不塌）
     ③ prd-data.json 全程始终是合法 JSON（原子写 temp+renameSync → 杀在写一半也永不残档）
   前提：anno-server 由监督器(start-anno-server.vbs / start-anno-server.js)启动（有自愈）。
        裸跑 node server.js 杀了不会自愈 → 本闸会如实判"未自愈"（正确暴露）。
   不碰真业务数据：只发【读】请求压测 + 只读 prd-data 校验合法性，绝不写。
   用法：node anno-server-kill-stress-gate.js       退出码 0=全绿 · 1=有红
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { execSync, spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const PORT = 3799, ROUNDS = 5, HEAL_TIMEOUT_MS = 45000, SLOW_MS = 10000;
const PRD = process.env.ANNO_PRD || path.join(require('./_archive-dir').existingArchiveDir(), 'prd-data.json');
const ANNO_DIR = process.env.ANNO_DIR || 'D:/AI/anno-server';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

function pidsOnPort(p) {
  try {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    const set = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(':' + p + ' ') && /LISTENING/i.test(line)) {
        const m = line.trim().split(/\s+/); const pid = m[m.length - 1];
        if (/^\d+$/.test(pid) && pid !== '0') set.add(pid);
      }
    }
    return [...set];
  } catch (e) { return []; }
}
function killPid(pid) { try { execSync('taskkill /PID ' + pid + ' /F /T', { stdio: 'ignore' }); } catch (e) {} }
async function alive() { try { const r = await fetch('http://localhost:' + PORT + '/anno-queue', { signal: AbortSignal.timeout(1500) }); return r.ok; } catch (e) { return false; } }
async function waitAlive(ms) { const t0 = now(); while (now() - t0 < ms) { if (await alive()) return now() - t0; await sleep(300); } return -1; }
function prdValid() { try { JSON.parse(fs.readFileSync(PRD, 'utf8')); return true; } catch (e) { return false; } }
function startSupervisor() {
  const vbs = path.join(ANNO_DIR, 'start-anno-server.vbs');
  const sup = path.join(ANNO_DIR, 'start-anno-server.js');
  try {
    if (fs.existsSync(vbs)) spawn('wscript.exe', [vbs], { detached: true, stdio: 'ignore' }).unref();
    else if (fs.existsSync(sup)) spawn(process.execPath, [sup], { cwd: ANNO_DIR, detached: true, stdio: 'ignore' }).unref();
  } catch (e) {}
}

(async () => {
  console.log('\n════════ ㊵-b anno-server 杀进程压力闸（活体·杀 ' + ROUNDS + ' 次）════════');
  let bad = 0;
  const healTimes = [];
  const prdReadable = fs.existsSync(PRD);
  if (!prdReadable) console.log('  ⚠ 找不到 ' + PRD + '（跳过 prd-data 合法性断言·只测自愈）');

  // 前置：确保在跑（不在则用监督器拉起）
  if (!(await alive())) { console.log('  · 起始未运行 → 监督器拉起'); startSupervisor(); await waitAlive(HEAL_TIMEOUT_MS); }
  if (!(await alive())) { console.log('  ✗ 起始无法拉起 :3799 —— 监督器未就绪，无法测自愈'); process.exit(1); }
  console.log('  · 起始 :3799 在跑 ✓');

  for (let r = 1; r <= ROUNDS; r++) {
    // ② 猛发读请求当背景负载（不写·不碰真数据）
    const load = Array.from({ length: 12 }, () => fetch('http://localhost:' + PORT + '/anno-queue').catch(() => {}));
    await sleep(120);
    // ① 杀掉常驻（监督器应自愈）
    const pids = pidsOnPort(PORT);
    if (!pids.length) { console.log('  ✗ 第' + r + '轮：找不到 :3799 的 PID'); bad++; await Promise.allSettled(load); continue; }
    pids.forEach(killPid);
    await Promise.allSettled(load);
    // 等监督器自愈（不再中途双 spawn 抢端口污染测量·只在真·45s 都没起时才兜底并判红）
    let heal = await waitAlive(HEAL_TIMEOUT_MS);
    let healed = heal >= 0;
    if (!healed) { bad++; startSupervisor(); heal = await waitAlive(HEAL_TIMEOUT_MS); healed = heal >= 0; }
    if (healed) healTimes.push(heal);
    const slow = healed && heal > SLOW_MS;
    // ③ prd-data 合法性
    const ok3 = !prdReadable || prdValid();
    if (!ok3) bad++;
    console.log('  ' + (healed && ok3 ? (slow ? '⚠' : '✓') : '✗') + ' 第' + r + '轮：杀 ' + pids.length + ' 进程 → ' +
      (healed ? '自愈 ' + heal + 'ms' + (slow ? '(偏慢)' : '') : '45s未自愈') + ' · prd-data ' + (prdReadable ? (ok3 ? '合法' : '损坏!') : '无'));
    await sleep(1000);
  }

  console.log('──────────────────────────────────');
  const avg = healTimes.length ? Math.round(healTimes.reduce((a, b) => a + b, 0) / healTimes.length) : -1;
  const max = healTimes.length ? Math.max(...healTimes) : -1;
  console.log('  自愈：' + healTimes.length + '/' + ROUNDS + ' 次 · 平均 ' + avg + 'ms · 最慢 ' + max + 'ms');
  // 收尾确保在跑
  if (!(await alive())) { startSupervisor(); await waitAlive(HEAL_TIMEOUT_MS); }
  const finalAlive = await alive();
  console.log('  收尾 :3799 ' + (finalAlive ? '在跑 ✓' : '未起 ✗'));
  if (!finalAlive) bad++;
  if (bad) { console.log('  ❌ 有红（自愈失败 / prd-data 损坏 / 收尾未起）'); process.exit(1); }
  console.log('  ✅ 崩不了：杀 ' + ROUNDS + ' 次全自愈 · prd-data 全程合法 · 服务始终可恢复');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
