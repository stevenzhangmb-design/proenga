#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   逐页自检健康闸 · verify-gate-health-gate.js（2026-11-13）
   根治「rebuild-deliverable.ps1 -Quick 之后的后台逐页自检一直假红、报告还是乱码没人看得懂」：
     ① deliverable-verify-gate.js 以前每片写死端口 9760+分片×2，被残留进程/并发自检占住就 0.6 秒崩；
     ② 后台 PowerShell 5.1 按 GBK 解码 node 的 UTF-8 输出再存盘，.gate-report.txt 全是乱码。
   本闸：
     A 静态：自检闸不许出现写死端口；必须 listen(0) + --remote-debugging-port=0 + EADDRINUSE 重试 + 只清自己的残留；
     B 静态：rebuild-deliverable.ps1 的后台脚本必须先把控制台编码设成 UTF-8、报告按 UTF-8 写、不许 Out-String；
     C 运行（仅 Windows）：把 ps1 里那两行编码设置原样抽出来，真跑一次 node 输出中文 → 写文件 → 读回逐字相等；
     D 运行（可选）：传入报告路径 = 校验它是合法 UTF-8、第一行是 RUNNING/PASS/FAIL、且含中文结论。
   用法：node verify-gate-health-gate.js [<交付件>.gate-report.txt …]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
require('./_gate-env');                                   // 接临时目录沙盒
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const VG = path.join(__dirname, 'deliverable-verify-gate.js');
const PS1 = path.join(__dirname, '..', 'rebuild-deliverable.ps1');
const bad = [];
const ok = m => console.log('  ✓ ' + m);
const no = m => { bad.push(m); console.log('  ✗ ' + m); };

console.log('════════ 逐页自检健康闸 verify-gate-health-gate ════════');

/* ── A 端口 ── */
const code = fs.readFileSync(VG, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   // 去注释再查
const hard = [
  [/listen\(\s*[1-9]\d{2,}/, 'listen(写死端口号)'],
  [/remote-debugging-port=\s*[1-9]\d{2,}/, '--remote-debugging-port=写死端口号'],
  [/remote-debugging-port='\s*\+/, '--remote-debugging-port= 拼接算出来的固定端口'],
  [/\b(port|dport)\s*=\s*[1-9]\d{3,}/, 'port = 写死数字'],
  [/\b[1-9]\d{3,4}\s*\+\s*\(?\s*SHARD/, '端口号 + 分片号'],
];
const hits = hard.filter(([re]) => re.test(code)).map(([, d]) => d);
if (hits.length) no('deliverable-verify-gate.js 又写死了端口：' + hits.join('、'));
else ok('自检闸没有写死端口');
for (const [re, d] of [
  [/\.listen\(0\b/, '本地服务 listen(0) 让系统分配端口'],
  [/--remote-debugging-port=0/, 'Chrome 调试端口用 0 + 读 DevToolsActivePort'],
  [/DevToolsActivePort/, '读 Chrome 实际调试端口'],
  [/EADDRINUSE/, '端口被占重试一次'],
  [/reapStale\(\)/, '启动时清本工具自己的超时残留'],
  [/--dv-verify-gate-owned/, 'Chrome 带本工具标记（清残留只认它，不碰别的工具）'],
  [/\.onclose\s*=/, '浏览器中途断开立刻失败（不卡死）'],
  [/withRelaunch/, '浏览器被杀后重开浏览器重验当前页'],
  [/if \(!allPages\.length\) \{ red\+\+/, '分片拿到空页面清单 = 红（不许一页没验算通过）'],
]) { if (re.test(code)) ok(d); else no('自检闸缺：' + d); }
const dg = fs.readFileSync(path.join(__dirname, 'deliver-gate.js'), 'utf8');
if (/notmatch '--dv-verify-gate-owned'/.test(dg)) ok('deliver-gate 清僵尸 Chrome 时放行自检闸的 Chrome');
else no('deliver-gate 清僵尸 Chrome 会误杀正在跑的逐页自检（要放行 --dv-verify-gate-owned）');

/* ── B 报告编码（ps1 后台脚本）── */
const ps1 = fs.readFileSync(PS1, 'utf8');
const hs = /\$body\s*=\s*@"([\s\S]*?)\n"@/.exec(ps1);
let encLines = [];
if (!hs) no('rebuild-deliverable.ps1 里找不到后台脚本 $body = @" … "@');
else {
  const body = hs[1];
  encLines = body.split(/\r?\n/).filter(l => /^\[Console\]::OutputEncoding\s*=|^`\$OutputEncoding\s*=/.test(l.trim()));
  if (/\[Console\]::OutputEncoding\s*=\s*New-Object Text\.UTF8Encoding/.test(body)) ok('后台脚本先把控制台编码设成 UTF-8');
  else no('后台脚本没把 [Console]::OutputEncoding 设成 UTF-8（PowerShell 5.1 会按 GBK 解码 node 输出 = 乱码）');
  if (/Out-String/.test(body)) no('后台脚本又用了 Out-String 收 node 输出（易乱码）');
  else ok('后台脚本不用 Out-String');
  if (/WriteAllText\([^\n]*\$enc\)/.test(body) && /UTF8Encoding/.test(body)) ok('报告用 UTF-8 写');
  else no('报告没有用 UTF-8 写（要用 [IO.File]::WriteAllText(…, UTF8Encoding)）');
  if (/通过：/.test(body) && /未通过：/.test(body)) ok('报告第一行带中文结论');
  else no('报告第一行缺中文结论（通过：… / 未通过：…）');
}

/* ── C 运行：真跑一次编码链路 ── */
if (process.platform === 'win32' && encLines.length >= 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vgh-'));
  const out = path.join(dir, 'r.txt');
  const want = '交付件自检 通过：逐页渲染 ✓\n分片 stderr：端口正常';
  const js = path.join(dir, 'p.js');
  fs.writeFileSync(js, 'console.log(' + JSON.stringify(want.split('\n')[0]) + ');console.error(' + JSON.stringify(want.split('\n')[1]) + ')');
  const lines = encLines.map(l => l.trim().replace(/`\$/g, '$'));
  /* 收输出的那段管道也从 ps1 原样抽（node '$vg' 那一行 2>&1 | … ) -join），保证测的就是真在用的写法 */
  const vgLine = (hs[1].split(/\r?\n/).find(l => /node '\$vg'/.test(l)) || '');
  const pm = /2>&1 \| ([\s\S]*?)\) -join/.exec(vgLine);
  const pipe = pm ? pm[1].replace(/`\$/g, '$') : 'ForEach-Object { "$_" }';
  if (!pm) no('ps1 里 node \'$vg\' 那一行找不到 2>&1 | … 的收输出写法');
  const script = lines.join('\n') + "\n$e = New-Object Text.UTF8Encoding($false)\n"
    + "$x = ((node '" + js + "' 2>&1 | " + pipe + ") -join \"`n\")\n"
    + "[IO.File]::WriteAllText('" + out + "', $x, $e)\n";
  const sp = path.join(dir, 't.ps1');
  fs.writeFileSync(sp, '\ufeff' + script);
  spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', sp], { timeout: 30000, windowsHide: true });
  let got = '';
  try { got = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(out)).trim(); } catch (e) { got = '(读不出来：' + e.message + ')'; }
  const norm = x => x.split(/\r?\n/).map(l => l.trim()).filter(Boolean).sort().join('\n');   // stdout/stderr 先后不定
  if (norm(got) === norm(want)) ok('真跑：PowerShell 收 node 中文输出写成 UTF-8，逐字一致');
  else no('真跑：PowerShell 收 node 中文输出后变了样：' + JSON.stringify(got).slice(0, 80));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

/* ── D 可选：校验已有报告 ── */
for (const rp of process.argv.slice(2)) {
  if (!fs.existsSync(rp)) { no('报告不存在：' + rp); continue; }
  let t;
  try { t = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(rp)).replace(/^\ufeff/, ''); }
  catch (_) { no('报告不是合法 UTF-8：' + rp); continue; }
  const first = t.split(/\r?\n/)[0];
  if (!/^(RUNNING|PASS|FAIL) \d\d:\d\d:\d\d/.test(first)) { no('报告第一行格式不对：' + first.slice(0, 60)); continue; }
  if (/^(PASS|FAIL)/.test(first) && !/交付件自检/.test(t)) { no('报告里找不到“交付件自检”字样，疑似乱码：' + rp); continue; }
  if (!/[\u4e00-\u9fa5]/.test(first)) { no('报告第一行没有中文结论：' + first.slice(0, 60)); continue; }
  ok('报告可读（UTF-8·有中文结论）：' + first.slice(0, 60));
}

console.log('──────────────────────────────────');
if (bad.length) { console.log('❌ 逐页自检健康闸未过（' + bad.length + ' 项）'); process.exit(1); }
console.log('✅ 逐页自检健康闸通过：端口不写死·报告不乱码');
