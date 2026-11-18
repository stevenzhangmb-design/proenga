#!/usr/bin/env bash
# update-proenga.sh - 把 Proenga 更新到 GitHub 上的最新版（macOS / Linux；Windows 的 Git Bash 也能用）
#
# 用法（在 proenga 文件夹里运行）：
#   bash update-proenga.sh -Check     只检查有没有新版，列出更新了什么（也可以写 --check）
#   bash update-proenga.sh            更新到最新版
# 测试用参数：
#   -Source <本地 zip 或文件夹>       （--source）用本地的新版代替从 GitHub 下载
#   -RemoteVersionUrl <网址或本地文件> （--remote-version-url）从这里读“最新版本号”（同目录的 CHANGELOG.md 一起读）
# 环境变量（测试用）：ANNO_PORT 同步服务端口（默认 3799）；HOME 用户主目录（检查全局安装用）
#
# ZIP 下载的：先完整备份到同级的“proenga-备份-日期时间”文件夹，再按清单替换工具包文件、删掉新版不再有的工具包文件，
#             清单外你自己的文件一个都不碰；出错自动用备份还原。
# git 下载的：git pull；本地改过工具包文件就停下不更新；出错自动退回更新前的提交。
# 退出码：0 成功或已是最新；1 失败（现有文件没被改动，或已自动还原）；2 需要你先处理（例如本地有改动）。
# 需要：bash、node（Proenga 本身就要 node）、curl 或 wget、unzip（或 bsdtar / python3）。

REPO_VERSION_URL='https://raw.githubusercontent.com/stevenzhangmb-design/proenga/main/VERSION'
REPO_ZIP_URL='https://github.com/stevenzhangmb-design/proenga/archive/refs/heads/main.zip'

say() { printf '%s\n' "$*"; }
die() { say ""; say "没有更新成功：$*"; exit 1; }

is_win_bash() { case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; esac; return 1; }

fetch() { # $1 网址或本地文件  $2 保存到
  case "$1" in
    http://*|https://*)
      local u="$1"
      case "$u" in *raw.githubusercontent.com*) case "$u" in *\?*) ;; *) u="$u?t=$(date +%s)" ;; esac ;; esac
      if command -v curl >/dev/null 2>&1; then curl -fsSL --connect-timeout 20 --max-time 900 -A proenga-updater -o "$2" "$u"
      elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$u"
      else node -e "fetch(process.argv[1]).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}).then(b=>require('fs').writeFileSync(process.argv[2],Buffer.from(b))).catch(e=>{console.error(e.message);process.exit(1)})" "$u" "$2"
      fi ;;
    file://*) cp "${1#file://}" "$2" ;;
    *) cp "$1" "$2" ;;
  esac
}

unzip_to() { # $1 zip  $2 目录
  mkdir -p "$2" || return 1
  if command -v unzip >/dev/null 2>&1; then unzip -q "$1" -d "$2"
  elif command -v bsdtar >/dev/null 2>&1; then bsdtar -xf "$1" -C "$2"
  elif command -v python3 >/dev/null 2>&1; then python3 -I -m zipfile -e "$1" "$2"
  else say "电脑上没有 unzip，解不开压缩包。"; return 1
  fi
}

find_pkg_root() { # 找到含 VERSION 和清单的目录
  local d="$1" c
  if [ -f "$d/VERSION" ] && [ -f "$d/.proenga-manifest.json" ]; then printf '%s' "$d"; return 0; fi
  for c in "$d"/* "$d"/.[!.]*; do
    if [ -d "$c" ] && [ -f "$c/VERSION" ] && [ -f "$c/.proenga-manifest.json" ]; then printf '%s' "$c"; return 0; fi
  done
  return 1
}

read_version() { [ -f "$1/VERSION" ] && tr -d ' \r\n\t' <"$1/VERSION"; }

# ---------- 同步服务 anno-server ----------
port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") >/dev/null 2>&1; }
http_ok() {
  if command -v curl >/dev/null 2>&1; then [ "$(curl -s -o /dev/null -m 2 -w '%{http_code}' --noproxy '*' "http://127.0.0.1:$PORT/anno-queue" 2>/dev/null)" = 200 ]
  else port_open; fi
}
win_ps() { # 在 Git Bash 里用 Windows 的 PowerShell 管进程；$1 = stop | count | start
  PROENGA_ROOT_WIN="$(cygpath -w "$ROOT")" PROENGA_MODE="$1" powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '
$n = ($env:PROENGA_ROOT_WIN.TrimEnd("\") + "\anno-server\").ToLower()
if ($env:PROENGA_MODE -eq "start") { Start-Process -FilePath wscript.exe -ArgumentList ([char]34 + $n.TrimEnd("\") + "\start-anno-server.vbs" + [char]34) -WorkingDirectory $n.TrimEnd("\"); exit 0 }
$all = @(Get-CimInstance Win32_Process); $by = @{}; foreach ($p in $all) { $by[[int]$p.ProcessId] = $p }
$sel = @{}
foreach ($p in $all) { $c = [string]$p.CommandLine; if (-not $c) { continue }; $l = $c.ToLower().Replace("/", "\")
  if ($l.Contains($n) -and ($l.Contains("server.js") -or $l.Contains("start-anno-server"))) { $sel[[int]$p.ProcessId] = $p
    $q = $by[[int]$p.ParentProcessId]; if ($q -and ([string]$q.CommandLine).ToLower().Contains("start-anno-server")) { $sel[[int]$q.ProcessId] = $q } } }
if ($env:PROENGA_MODE -eq "count") { [Console]::Out.Write($sel.Count); exit 0 }
$g = @($sel.Values | Where-Object { $_.Name -match "^(wscript|cscript)\.exe$" -or ([string]$_.CommandLine).ToLower().Contains("start-anno-server") } | ForEach-Object { [int]$_.ProcessId })
foreach ($id in $g) { try { Stop-Process -Id $id -Force -ErrorAction Stop } catch {} }
foreach ($p in $sel.Values) { if ($g -notcontains [int]$p.ProcessId) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} } }
[Console]::Out.Write($sel.Count)' 2>/dev/null | tr -d '\r'
}
svc_pids() { # 本文件夹的同步服务进程：先列守护进程，再列 server.js
  local needle="$ROOT/anno-server/" line pid ppid args pargs guards='' rest=''
  while IFS= read -r line; do
    pid=$(printf '%s' "$line" | awk '{print $1}'); ppid=$(printf '%s' "$line" | awk '{print $2}')
    args=$(printf '%s' "$line" | cut -d' ' -f3-)
    case "$args" in *"$needle"*) ;; *) continue ;; esac
    case "$args" in *start-anno-server*) guards="$guards $pid"; continue ;; *server.js*) rest="$rest $pid" ;; *) continue ;; esac
    pargs=$(ps -o args= -p "$ppid" 2>/dev/null)
    case "$pargs" in *start-anno-server*) guards="$guards $ppid" ;; esac
  done <<EOF
$(ps ax -ww -o pid= -o ppid= -o args= 2>/dev/null | sed -E 's/^ *([0-9]+) +([0-9]+) +/\1 \2 /')
EOF
  printf '%s\n' "$guards $rest" | tr ' ' '\n' | awk 'NF && !seen[$0]++'
}
svc_count() { if is_win_bash; then win_ps count; else svc_pids | awk 'END{print NR}'; fi; }
stop_service() {
  SVC_WAS=0; SVC_FOREIGN=''
  local n i
  if is_win_bash; then n=$(win_ps stop); else
    n=0
    for pid in $(svc_pids); do kill "$pid" 2>/dev/null; n=$((n+1)); done
  fi
  [ "${n:-0}" -gt 0 ] && { SVC_WAS=1; say "正在停止同步服务（先停守护进程，再停 node）……"; }
  i=0
  while [ $i -lt 30 ]; do
    [ "$(svc_count)" = 0 ] && ! port_open && break
    [ $i -eq 6 ] && [ "$(svc_count)" = 0 ] && break
    if [ $i -eq 10 ] && ! is_win_bash; then for pid in $(svc_pids); do kill -9 "$pid" 2>/dev/null; done; fi
    sleep 0.5; i=$((i+1))
  done
  [ "$(svc_count)" = 0 ] || die "同步服务停不下来，请关掉 AI 工具后再试。现有文件没有改动。"
  if port_open; then
    SVC_FOREIGN='未知程序'
    if command -v lsof >/dev/null 2>&1; then
      local op; op=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
      [ -n "$op" ] && SVC_FOREIGN=$(ps -o args= -p "$op" 2>/dev/null)
    fi
  elif [ "$SVC_WAS" = 1 ]; then say "同步服务已停止，端口 $PORT 已释放。"; fi
}
start_service() {
  if [ -n "${SVC_FOREIGN:-}" ]; then
    SVC_MSG="没有启动：端口 $PORT 被另一个程序占着（$SVC_FOREIGN），它不是这个文件夹里的同步服务，我没有动它。"; return
  fi
  if is_win_bash && [ -f "$ROOT/anno-server/start-anno-server.vbs" ]; then win_ps start >/dev/null
  elif [ -f "$ROOT/anno-server/start-anno-server.js" ]; then (cd "$ROOT/anno-server" && nohup node "$ROOT/anno-server/start-anno-server.js" >/dev/null 2>&1 &)
  else SVC_MSG='没有启动：找不到 anno-server/start-anno-server.js。'; return; fi
  local i=0
  while [ $i -lt 40 ]; do http_ok && break; sleep 0.5; i=$((i+1)); done
  if ! http_ok; then SVC_MSG="启动失败：20 秒内 http://localhost:$PORT/anno-queue 没有响应。可以跟 AI 说“帮我启动 anno-server”。"; return; fi
  if [ "$(svc_count)" = 0 ]; then SVC_MSG="端口 $PORT 有响应，但不是这个文件夹里的同步服务。"; return; fi
  SVC_MSG='已重新启动，运行正常。'
}

backup_dir() {
  if [ -z "${BACKUP:-}" ]; then
    BACKUP="$(dirname "$ROOT")/proenga-备份-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP" || die "建不了备份文件夹：$BACKUP。现有文件没有改动。"
  fi
}

write_helper() {
cat >"$1" <<'JS'
'use strict';
// update-proenga.sh 的帮手：核对新版、按清单替换/删除文件（带还原）、settings.json、全局技能、CHANGELOG
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAN = '.proenga-manifest.json';
const PROTECT = [/^archive\//, /^anno-server\/anno-config\.json$/, /^\.claude\/settings\.json$/, /^\.claude\/ledgers\.txt$/, /^\.mcp\.json$/];
const KEEP_IF_MODIFIED = ['skills/pm-design/learned-specs/README.md'];
const say = (s) => process.stdout.write(s + '\n');
const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = (f) => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const blob = (f) => { const b = fs.readFileSync(f); return crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex'); };
const readMan = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); return { version: String(j.version || ''), files: j.files || {}, history: j.history || {} }; } catch { return null; } };
const shapeOk = (r) => typeof r === 'string' && !!r && !/^[\\/]/.test(r) && !/^[A-Za-z]:/.test(r) && !r.split(/[\\/]/).includes('..');
const isProt = (r) => PROTECT.some((re) => re.test(r));
const known = (rel, h, mans) => mans.some((m) => m && (m.files[rel] === h || (Array.isArray(m.history[rel]) && m.history[rel].includes(h))));
const abs = (base, rel) => path.join(base, ...rel.split('/'));
function copyOne(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); if (isFile(dst)) { try { fs.chmodSync(dst, 0o644); } catch { /* 无所谓 */ } } fs.copyFileSync(src, dst); }
function pruneUp(file, stop) { let d = path.dirname(file); while (d.length > stop.length && isDir(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); d = path.dirname(d); } }
const verKey = (v) => { const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})\.(\d+)$/.exec(String(v || '').trim()); return m ? m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0') + m[4].padStart(6, '0') : ''; };
const norm = (s) => s == null ? null : s.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
const readText = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); } catch { return null; } };
const [cmd, ...a] = process.argv.slice(2);

function notes(text, from, to) {
  if (!text) return '';
  const fk = verKey(from), tk = verKey(to); const secs = []; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      const m = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\.(\d+))?/.exec(h[1]);
      cur = { key: m ? m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0') + (m[4] ? m[4].padStart(6, '0') : '999999') : '', lines: [line] };
      secs.push(cur);
    } else if (cur && !/^---\s*$/.test(line) && !/^>\s*更新方法/.test(line)) cur.lines.push(line);
  }
  let picked = secs.filter((s) => s.key && (!fk || s.key > fk) && (!tk || s.key.slice(0, 8) <= tk.slice(0, 8)));
  if (!fk) picked = picked.slice(0, 2);
  let out = [].concat(...picked.map((s) => s.lines));
  while (out.length && !out[out.length - 1].trim()) out.pop();
  if (out.length > 60) out = out.slice(0, 60).concat('……（完整内容见 CHANGELOG.md）');
  return out.join('\n');
}

function settings(root, oldExFile, mans) {
  const s = path.join(root, '.claude', 'settings.json'), ex = path.join(root, '.claude', 'settings.json.example');
  if (!isFile(s) || !isFile(ex)) return '';
  const cur = norm(readText(s)), newEx = readText(ex), oldEx = oldExFile ? readText(oldExFile) : null;
  if (norm(newEx) === cur) return '';
  if ((oldEx != null && norm(oldEx) === cur) || known('.claude/settings.json.example', blob(s), mans)) { copyOne(ex, s); return '.claude/settings.json：你没改过，已换成新版钩子配置。'; }
  if (oldEx != null && norm(oldEx) === norm(newEx)) return '';
  copyOne(ex, s + '.new');
  return '.claude/settings.json：你改过，原文件保留没动；新版钩子配置另存为 .claude/settings.json.new，请让 AI 帮你把里面的 hooks 合并进 settings.json。';
}

if (cmd === 'cmp') { const x = verKey(a[0]), y = verKey(a[1]); say(x > y ? '1' : x < y ? '-1' : '0'); }
else if (cmd === 'valid') { process.exit(verKey(a[0]) ? 0 : 1); }
else if (cmd === 'notes') { say(notes(readText(a[0]), a[1], a[2])); }
else if (cmd === 'verify') {
  const stage = a[0]; const man = readMan(path.join(stage, MAN));
  if (!man) { say('新版的文件清单读不出来'); process.exit(3); }
  const ver = (readText(path.join(stage, 'VERSION')) || '').trim();
  if (man.version !== ver) { say('新版的版本号和文件清单对不上'); process.exit(3); }
  const bad = [];
  for (const rel of Object.keys(man.files)) {
    if (!shapeOk(rel) || isProt(rel)) { bad.push(rel + '（路径不允许）'); continue; }
    const f = abs(stage, rel);
    if (!isFile(f)) bad.push(rel + '（缺失）'); else if (blob(f) !== man.files[rel]) bad.push(rel + '（内容不对）');
  }
  if (bad.length) { say('新版有 ' + bad.length + ' 个文件缺失或损坏（例如 ' + bad.slice(0, 3).join('、') + '）'); process.exit(3); }
}
else if (cmd === 'apply') {
  // apply <root> <stage> <backup> <oldManifest> <oldSettingsExample>
  const [root, stage, backup, oldManFile, oldExFile] = a;
  const newMan = readMan(path.join(stage, MAN)), oldMan = readMan(oldManFile);
  const copy = [], del = [], keptNew = [], userChanged = []; let added = 0;
  for (const rel of Object.keys(newMan.files).sort()) {
    if (isProt(rel)) continue;
    const dst = abs(root, rel);
    if (isFile(dst)) {
      const h = blob(dst);
      if (h === newMan.files[rel]) continue;
      if (!known(rel, h, [oldMan, newMan])) { if (KEEP_IF_MODIFIED.includes(rel)) { keptNew.push(rel); continue; } userChanged.push(rel); }
    } else added++;
    copy.push(rel);
  }
  const cands = new Set([...Object.keys((oldMan && oldMan.files) || {}), ...Object.keys(newMan.history)]);
  for (const rel of [...cands].sort()) {
    if (rel in newMan.files || rel === MAN || isProt(rel) || !shapeOk(rel)) continue;
    const dst = abs(root, rel); if (!isFile(dst)) continue;
    const inOld = !!(oldMan && rel in oldMan.files), k = known(rel, blob(dst), [oldMan, newMan]);
    if (inOld || k) { del.push(rel); if (!k) userChanged.push(rel + '（新版已删除）'); }
  }
  say('正在更新文件（替换 ' + copy.length + ' 个，删除 ' + del.length + ' 个）……');
  const journal = [];
  try {
    for (const rel of copy) { const dst = abs(root, rel); journal.push({ rel, existed: isFile(dst) }); copyOne(abs(stage, rel), dst); }
    for (const rel of keptNew) { const dst = abs(root, rel + '.new'); journal.push({ rel: rel + '.new', existed: isFile(dst) }); copyOne(abs(stage, rel), dst); }
    for (const rel of del) { const dst = abs(root, rel); journal.push({ rel, existed: true }); fs.unlinkSync(dst); pruneUp(dst, root); }
    const md = abs(root, MAN); journal.push({ rel: MAN, existed: isFile(md) }); copyOne(abs(stage, MAN), md);
    if ((readText(path.join(root, 'VERSION')) || '').trim() !== newMan.version) throw new Error('写完后版本号不对');
    const sm = settings(root, oldExFile, [newMan, oldMan]);
    const lines = ['文件变化：替换 ' + (copy.length - added) + ' 个文件，新增 ' + added + ' 个，删除 ' + del.length + ' 个。'];
    if (userChanged.length) lines.push('这些工具包文件你改过，已换成新版，你原来的版本在备份里：' + userChanged.join('、'));
    if (keptNew.length) lines.push('这些文件你改过，保留没动，新版另存为同名 .new 文件：' + keptNew.join('、'));
    if (sm) lines.push(sm);
    fs.writeFileSync(path.join(path.dirname(oldManFile), 'apply-result.txt'), lines.join('\n') + '\n');
  } catch (e) {
    say('更新时出错：' + e.message); say('正在用备份还原……');
    const failed = [];
    for (const j of journal.reverse()) {
      const dst = abs(root, j.rel);
      try { if (j.existed) { if (!(isFile(dst) && blob(dst) === blob(abs(backup, j.rel)))) copyOne(abs(backup, j.rel), dst); } else if (isFile(dst)) { fs.unlinkSync(dst); pruneUp(dst, root); } } catch { failed.push(j.rel); }
    }
    if (failed.length) { say('有 ' + failed.length + ' 个文件没还原成功（例如 ' + failed[0] + '）。完整备份在：' + backup + '。原因：' + e.message); process.exit(6); }
    say('已用备份还原成更新前的样子。原因：' + e.message); process.exit(5);
  }
}
else if (cmd === 'settings') { const r = settings(a[0], a[1], [readMan(path.join(a[0], MAN)), readMan(a[2])]); if (r) say(r); }
else if (cmd === 'global') {
  // global <home> <root> <oldManifest> <backupRoot 文件或空>
  const [home, root, oldManFile, backupRoot] = a;
  const newMan = readMan(path.join(root, MAN)), oldMan = readMan(oldManFile);
  if (!newMan) process.exit(0);
  const names = [...new Set(Object.keys(newMan.files).map((k) => (/^skills\/([^/]+)\//.exec(k) || [])[1]).filter(Boolean))].sort();
  for (const t of [{ label: '~/.agents/skills', dir: path.join(home, '.agents', 'skills'), tag: 'agents-skills' }, { label: '~/.claude/skills', dir: path.join(home, '.claude', 'skills'), tag: 'claude-skills' }]) {
    const T = t.dir; if (!isDir(T)) continue;
    let isP = isFile(path.join(T, 'pm-design', 'SKILL.md')) && isDir(path.join(T, '_shared'));
    if (!isP) isP = names.some((n) => { const f = path.join(T, n, 'SKILL.md'); return isFile(f) && known('skills/' + n + '/SKILL.md', blob(f), [newMan, oldMan]); });
    if (!isP) continue;
    try {
      const bdir = path.join(backupRoot, '全局技能', t.tag);
      for (const n of names) if (isDir(path.join(T, n))) fs.cpSync(path.join(T, n), path.join(bdir, n), { recursive: true });
      let w = 0, d = 0; const kept = [];
      for (const rel of Object.keys(newMan.files)) {
        if (!rel.startsWith('skills/')) continue;
        const sub = rel.slice(7), dst = abs(T, sub), src = abs(root, rel);
        if (!isFile(src)) continue;
        if (isFile(dst)) { const h = blob(dst); if (h === newMan.files[rel]) continue; if (KEEP_IF_MODIFIED.includes(rel) && !known(rel, h, [newMan, oldMan])) { copyOne(src, dst + '.new'); kept.push(sub); continue; } }
        copyOne(src, dst); w++;
      }
      const cands = new Set([...Object.keys((oldMan && oldMan.files) || {}), ...Object.keys(newMan.history)]);
      for (const rel of cands) {
        if (!rel.startsWith('skills/') || rel in newMan.files || !shapeOk(rel)) continue;
        const dst = abs(T, rel.slice(7));
        if (isFile(dst) && known(rel, blob(dst), [newMan, oldMan])) { fs.unlinkSync(dst); pruneUp(dst, T); d++; }
      }
      let m = '全局技能 ' + t.label + '：已换成新版（更新 ' + w + ' 个文件，删除 ' + d + ' 个旧文件，你自己加的文件没动；原来的在备份的“全局技能”文件夹里）。';
      if (kept.length) m += ' 你改过的 ' + kept.join('、') + ' 保留没动，新版另存为同名 .new 文件。';
      say(m);
    } catch (e) { say('全局技能 ' + t.label + '：更新失败（' + e.message + '），请让 AI 按 README 重新复制一次技能。'); }
  }
}
else if (cmd === 'has-global') {
  const [home] = a;
  for (const T of [path.join(home, '.agents', 'skills'), path.join(home, '.claude', 'skills')]) if (isFile(path.join(T, 'pm-design', 'SKILL.md'))) { say('yes'); process.exit(0); }
}
JS
}

main() {
  set -u
  local CHECK=0 SOURCE='' VERURL='' lc
  while [ $# -gt 0 ]; do
    lc=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
    case "$lc" in
      -check|--check) CHECK=1 ;;
      -source|--source) SOURCE="${2:-}"; shift ;;
      -remoteversionurl|--remoteversionurl|--remote-version-url) VERURL="${2:-}"; shift ;;
      -h|-help|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; return 0 ;;
      *) say "不认识的参数：$1（可用：-Check、-Source、-RemoteVersionUrl）"; return 1 ;;
    esac
    shift
  done
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  PORT="${ANNO_PORT:-3799}"
  BACKUP=''
  command -v node >/dev/null 2>&1 || die "找不到 Node.js（Proenga 需要它）。请先安装 Node.js 再更新。现有文件没有改动。"
  TMPD="$(mktemp -d "${TMPDIR:-/tmp}/proenga-update.XXXXXX")" || die "建不了临时文件夹。"
  trap 'rm -rf "$TMPD"' EXIT
  H="$TMPD/helper.js"; write_helper "$H"
  case "$SOURCE" in ''|/*|http://*|https://*|file://*) ;; [A-Za-z]:*) ;; *) SOURCE="$(pwd -P)/$SOURCE" ;; esac

  local localVer remoteVer='' changelog="$TMPD/CHANGELOG.md" verurl="$VERURL"
  localVer="$(read_version "$ROOT")"
  say "Proenga 文件夹：$ROOT"
  say "当前版本：${localVer:-没有版本号（加入一键更新之前的老版本）}"

  # a. 最新版本号
  [ -z "$verurl" ] && [ -z "$SOURCE" ] && verurl="$REPO_VERSION_URL"
  if [ -n "$verurl" ]; then
    if fetch "$verurl" "$TMPD/VERSION.remote" 2>/dev/null; then
      remoteVer="$(tr -d ' \r\n\t' <"$TMPD/VERSION.remote")"
      node "$H" valid "$remoteVer" || die "读到的最新版本号格式不对：$remoteVer"
      case "$verurl" in *VERSION) fetch "${verurl%VERSION}CHANGELOG.md" "$changelog" 2>/dev/null || rm -f "$changelog" ;; esac
    elif [ -z "$SOURCE" ]; then die "读不到最新版本号，可能是网络不通。现有文件没有改动。"
    fi
  fi

  stage_pkg() { # 准备新版目录 → STAGE
    local src="$SOURCE"
    if [ -z "$src" ]; then
      say "正在从 GitHub 下载新版……"
      fetch "$REPO_ZIP_URL" "$TMPD/main.zip" || die "下载新版失败，可能是网络不通。现有文件没有改动。"
      src="$TMPD/main.zip"
    fi
    if [ -d "$src" ]; then STAGE="$(cd "$src" && pwd -P)"
    else
      [ -f "$src" ] || die "找不到新版文件：$src。现有文件没有改动。"
      unzip_to "$src" "$TMPD/unz" >/dev/null 2>&1 || die "新版压缩包解压失败，可能没下载完整。现有文件没有改动。"
      STAGE="$(find_pkg_root "$TMPD/unz")" || die "新版里没有找到 VERSION 和文件清单，可能不是完整的 Proenga 包。现有文件没有改动。"
    fi
    STAGE="$(find_pkg_root "$STAGE")" || die "新版里没有找到 VERSION 和文件清单，可能不是完整的 Proenga 包。现有文件没有改动。"
  }

  if [ "$CHECK" = 1 ]; then
    if [ -z "$remoteVer" ]; then stage_pkg; remoteVer="$(read_version "$STAGE")"; cp "$STAGE/CHANGELOG.md" "$changelog" 2>/dev/null; fi
    say "最新版本：$remoteVer"
    if [ "$(node "$H" cmp "$remoteVer" "$localVer")" != 1 ]; then say "已经是最新版，不用更新。"; return 0; fi
    say "有新版可以更新。"
    local n; n="$(node "$H" notes "$changelog" "$localVer" "$remoteVer")"
    if [ -n "$n" ]; then say ""; say "更新内容（摘自 CHANGELOG.md）："; say "$n"; else say "CHANGELOG.md 里没有找到这段时间的更新说明。"; fi
    say ""; say "要更新，跟 AI 说“帮我更新 Proenga”，或运行：bash update-proenga.sh"
    return 0
  fi

  if [ -n "$remoteVer" ] && [ "$(node "$H" cmp "$remoteVer" "$localVer")" != 1 ]; then say "已经是最新版，不用更新。"; return 0; fi

  local oldMan="$TMPD/old-manifest.json" oldEx="$TMPD/old-settings.json.example" changes='' applyOut=''
  cp "$ROOT/.proenga-manifest.json" "$oldMan" 2>/dev/null || : >"$oldMan"
  cp "$ROOT/.claude/settings.json.example" "$oldEx" 2>/dev/null || oldEx=''
  SVC_FOREIGN=''; SVC_WAS=0

  if [ -d "$ROOT/.git" ]; then
    # ---------- c. git 用户 ----------
    command -v git >/dev/null 2>&1 || die "这个文件夹是用 git 下载的，但电脑上找不到 git 命令。现有文件没有改动。"
    local st oldHead newHead out
    st="$(git -C "$ROOT" -c core.quotepath=off status --porcelain --untracked-files=no 2>&1)" || die "git 读不了这个文件夹的状态：$st"
    if [ -n "$st" ]; then
      say ""; say "先停下了，没有更新：你改过下面这些工具包文件，直接更新会和新版冲突。"
      printf '%s\n' "$st" | sed 's/^/  /'
      say "需要先处理本地改动：不要的话跟 AI 说“帮我撤销这些本地改动后再更新 Proenga”；要保留的话跟 AI 说“帮我保存这些本地改动，再更新 Proenga”。"
      return 2
    fi
    oldHead="$(git -C "$ROOT" rev-parse HEAD)"
    stop_service
    say "正在用 git pull 取新版……"
    if ! out="$(git -C "$ROOT" -c core.quotepath=off pull --ff-only 2>&1)"; then
      newHead="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null)"
      [ -n "$newHead" ] && [ "$newHead" != "$oldHead" ] && git -C "$ROOT" reset --keep "$oldHead" >/dev/null 2>&1
      start_service
      case "$out" in
        *"would be overwritten"*|*"untracked working tree files"*) die "git pull 没成功，文件夹已保持更新前的样子。原因：新版里有文件和你自己加的文件同名，需要先把你的文件改名或挪走。$out" ;;
        *"Not possible to fast-forward"*|*diverge*) die "git pull 没成功，文件夹已保持更新前的样子。原因：这个文件夹里有你自己的 git 提交，和新版分叉了，需要先处理本地改动。" ;;
        *) die "git pull 没成功，文件夹已保持更新前的样子。原因：$out" ;;
      esac
    fi
    newHead="$(git -C "$ROOT" rev-parse HEAD)"
    if [ ! -f "$ROOT/.proenga-manifest.json" ]; then
      git -C "$ROOT" reset --keep "$oldHead" >/dev/null 2>&1; start_service
      die "更新后检查没通过（新版里没有文件清单），已退回更新前的版本。"
    fi
    changes="文件变化：$(git -C "$ROOT" diff --shortstat "$oldHead" "$newHead" | sed 's/^ *//')。"
    applyOut="$(node "$H" settings "$ROOT" "$oldEx" "$oldMan")"
    cp "$ROOT/CHANGELOG.md" "$changelog" 2>/dev/null
  else
    # ---------- d. ZIP 用户 ----------
    stage_pkg
    local newVerPkg; newVerPkg="$(read_version "$STAGE")"
    if [ "$(node "$H" cmp "$newVerPkg" "$localVer")" != 1 ]; then say "下载到的版本（$newVerPkg）不比现在的新，不用更新。"; return 0; fi
    say "正在核对新版文件是否完整……"
    out="$(node "$H" verify "$STAGE")" || die "$out，可能没下载完整。现有文件没有改动。"
    cp "$STAGE/CHANGELOG.md" "$changelog" 2>/dev/null
    stop_service
    backup_dir
    say "正在把整个文件夹备份到：$BACKUP（文件多时要等一会儿）"
    if ! cp -Rp "$ROOT/." "$BACKUP/"; then start_service; die "备份失败，没有做任何改动。"; fi
    local n1 n2; n1=$(find "$ROOT" -type f | wc -l); n2=$(find "$BACKUP" -type f | wc -l)
    if [ "$n2" -lt "$n1" ]; then start_service; die "备份不完整（$n2/$n1 个文件），没有做任何改动。"; fi
    local rc=0
    node "$H" apply "$ROOT" "$STAGE" "$BACKUP" "$oldMan" "${oldEx:-}" || rc=$?
    if [ "$rc" != 0 ]; then start_service; die "更新失败（同步服务：$SVC_MSG）。备份在：$BACKUP"; fi
    applyOut="$(cat "$TMPD/apply-result.txt" 2>/dev/null)"
  fi

  # f. 全局安装
  local globalOut=''
  if [ "$(node "$H" has-global "$HOME")" = yes ]; then backup_dir; globalOut="$(node "$H" global "$HOME" "$ROOT" "$oldMan" "$BACKUP")"; fi
  # g. 重启同步服务 + 自检
  start_service
  local newVer verOk='正确' rcode=0
  newVer="$(read_version "$ROOT")"
  [ "$newVer" = "$(node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version))}catch{}" "$ROOT/.proenga-manifest.json")" ] || { verOk='不对，请重新运行一次'; rcode=1; }
  # h. 结果
  say ""
  say "================ 更新完成 ================"
  say "版本：${localVer:-没有版本号（加入一键更新之前的老版本）} → $newVer（自检：版本号$verOk）"
  local n; n="$(node "$H" notes "$changelog" "$localVer" "$newVer")"
  if [ -n "$n" ]; then say "更新了什么（摘自 CHANGELOG.md）："; say "$n"; else say "更新了什么：CHANGELOG.md 里没有这段时间的说明。"; fi
  [ -n "$changes" ] && say "$changes"
  local mine='' f
  for f in archive anno-server/anno-config.json .claude/settings.json .claude/ledgers.txt .mcp.json; do [ -e "$ROOT/$f" ] && mine="$mine${mine:+、}$f"; done
  if [ -n "$mine" ]; then say "你自己的文件没动：$mine，以及清单外你自己加的其它文件。"; else say "你自己的文件没动：清单外你自己加的文件都保留着。"; fi
  [ -n "$applyOut" ] && say "$applyOut"
  [ -n "$globalOut" ] && say "$globalOut"
  [ -n "$BACKUP" ] && say "备份在：$BACKUP（确认新版用着没问题后可以删掉）"
  say "同步服务：$SVC_MSG"
  say "下一步：把正在用的 AI 工具关掉重开（OpenClaw 新开一个会话），新规则才会生效。以前做好的原型不用动，AI 打开时会提示要不要换新版标注层。"
  return $rcode
}

# 整个流程放在 main 里一次读完再执行：更新过程中本文件被新版替换也不会读乱
main "$@"; exit $?
