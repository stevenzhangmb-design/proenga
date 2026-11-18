<#
  update-proenga.ps1 - 把 Proenga 更新到 GitHub 上的最新版（Windows PowerShell 5.1 起可用，不需要管理员权限）

  用法（在 proenga 文件夹里运行；也可以右键本文件选【使用 PowerShell 运行】）：
    powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1 -Check   只检查有没有新版，列出更新了什么
    powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1          更新到最新版

  测试用参数：
    -Source <本地 zip 或文件夹>       用本地的新版代替从 GitHub 下载
    -RemoteVersionUrl <网址或本地文件>  从这里读“最新版本号”（同目录的 CHANGELOG.md 一起读）
  环境变量（测试用）：ANNO_PORT 同步服务端口（默认 3799）；PROENGA_TEST_HOME 代替用户主目录（检查全局安装用）

  更新时：
    ZIP 下载的：先完整备份到同级的“proenga-备份-日期时间”文件夹，再按清单替换工具包文件，删掉新版不再有的工具包文件；
               你自己的文件（archive、anno-server\anno-config.json、.claude\settings.json、.claude\ledgers.txt、.mcp.json、
               自己学的规范等清单外的文件）一个都不碰。出错自动用备份还原。
    git 下载的：git pull；本地改过工具包文件就停下不更新；出错自动退回更新前的提交。
  退出码：0 成功或已是最新；1 失败（现有文件没被改动，或已自动还原）；2 需要你先处理（例如本地有改动）。
#>
param(
  [switch]$Check,
  [string]$Source = '',
  [string]$RemoteVersionUrl = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$Root = (Resolve-Path -LiteralPath $PSScriptRoot).ProviderPath.TrimEnd('\')
$RepoVersionUrl = 'https://raw.githubusercontent.com/stevenzhangmb-design/proenga/main/VERSION'
$RepoZipUrl = 'https://github.com/stevenzhangmb-design/proenga/archive/refs/heads/main.zip'
$ManifestName = '.proenga-manifest.json'
$Port = 3799
if ($env:ANNO_PORT -match '^\d+$') { $Port = [int]$env:ANNO_PORT }
$UserHome = [Environment]::GetFolderPath('UserProfile')
if ($env:PROENGA_TEST_HOME) { $UserHome = $env:PROENGA_TEST_HOME }
# 用户自己的东西：就算清单里出现也绝不覆盖、绝不删除
$Protected = @('^archive/', '^anno-server/anno-config\.json$', '^\.claude/settings\.json$', '^\.claude/ledgers\.txt$', '^\.mcp\.json$')
# 用户会往里加内容的工具包文件：改过就保留，新版另存为 .new
$KeepIfModified = @('skills/pm-design/learned-specs/README.md')
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Sha1 = [System.Security.Cryptography.SHA1]::Create()
$script:ExitCode = 0
$script:Tmp = $null
$script:Backup = $null
if ($Source -and -not [IO.Path]::IsPathRooted($Source) -and $Source -notmatch '^https?://') { $Source = Join-Path (Get-Location).ProviderPath $Source }

function Say([string]$m) { Write-Host $m }
function VerLabel([string]$v) { if ($v) { return $v } return '没有版本号（加入一键更新之前的老版本）' }

# ---------- 版本号 ----------
function ConvertTo-VerKey([string]$v) {
  if ($v -and ($v.Trim() -match '^(\d{4})\.(\d{1,2})\.(\d{1,2})\.(\d+)$')) {
    return ('{0:D4}{1:D2}{2:D2}{3:D6}' -f [int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4])
  }
  return ''
}
function Compare-Ver([string]$a, [string]$b) {
  $x = ConvertTo-VerKey $a; $y = ConvertTo-VerKey $b
  return [Math]::Sign([string]::CompareOrdinal($x, $y))
}
function Read-VersionFile([string]$dir) {
  $f = Join-Path $dir 'VERSION'
  if ([IO.File]::Exists($f)) { return ([IO.File]::ReadAllText($f)).Trim([char[]]@([char]0xFEFF, ' ', "`r", "`n", "`t")) }
  return ''
}
function Read-TextFile([string]$f) {
  if ([IO.File]::Exists($f)) { return ([IO.File]::ReadAllText($f, $Utf8)).TrimStart([char]0xFEFF) }
  return $null
}

# ---------- 读网址或本地文件 ----------
function Get-Bytes([string]$loc) {
  if ($loc -match '^https?://') {
    $u = $loc
    if ($u -match 'raw\.githubusercontent\.com' -and $u -notmatch '\?') { $u += ('?t=' + [DateTime]::UtcNow.Ticks) }
    $wc = New-Object System.Net.WebClient
    $wc.Headers['User-Agent'] = 'proenga-updater'
    try { return , $wc.DownloadData($u) } finally { $wc.Dispose() }
  }
  if ($loc -match '^file:///?(.+)$') { $loc = [Uri]::UnescapeDataString($Matches[1]) }
  return , [IO.File]::ReadAllBytes($loc)
}

# ---------- CHANGELOG：取两个版本之间的段落（标题如“## 2026-11-18：新增一键更新”或“## 2026.11.18.2 ……”）----------
function Get-ChangelogNotes([string]$text, [string]$fromVer, [string]$toVer) {
  if (-not $text) { return '' }
  $fromKey = ConvertTo-VerKey $fromVer; $toKey = ConvertTo-VerKey $toVer
  $sections = New-Object System.Collections.ArrayList
  $cur = $null
  foreach ($line in ($text -split "`r?`n")) {
    if ($line -match '^##\s+(.+)$') {
      $h = $Matches[1]; $key = ''
      if ($h -match '(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\.(\d+))?') {
        $seq = 999999; if ($Matches[4]) { $seq = [int]$Matches[4] }   # 只写日期的标题 = 那一天的全部更新
        $key = '{0:D4}{1:D2}{2:D2}{3:D6}' -f [int]$Matches[1], [int]$Matches[2], [int]$Matches[3], $seq
      }
      $cur = @{ key = $key; lines = (New-Object System.Collections.ArrayList) }
      [void]$sections.Add($cur)
      [void]$cur.lines.Add($line)
    } elseif ($cur) {
      if ($line -match '^---\s*$' -or $line -match '^>\s*更新方法') { continue }
      [void]$cur.lines.Add($line)
    }
  }
  $picked = @()
  foreach ($s in $sections) {
    if (-not $s.key) { continue }
    if ($fromKey -and [string]::CompareOrdinal($s.key, $fromKey) -le 0) { continue }
    if ($toKey -and [string]::CompareOrdinal($s.key.Substring(0, 8), $toKey.Substring(0, 8)) -gt 0) { continue }
    $picked += , $s
  }
  if (-not $fromKey -and $picked.Count -gt 2) { $picked = $picked[0..1] }
  $out = New-Object System.Collections.ArrayList
  foreach ($s in $picked) { foreach ($l in $s.lines) { [void]$out.Add($l) } }
  while ($out.Count -and -not ([string]$out[$out.Count - 1]).Trim()) { $out.RemoveAt($out.Count - 1) }
  if ($out.Count -gt 60) { $out = @($out[0..59]) + @('……（完整内容见 CHANGELOG.md）') }
  return ($out -join "`n")
}

# ---------- 文件哈希（git blob 哈希，和清单一致）----------
function Get-BlobHash([string]$path) {
  $b = [IO.File]::ReadAllBytes($path)
  $h = [Text.Encoding]::ASCII.GetBytes('blob ' + $b.Length + [char]0)
  $all = New-Object byte[] ($h.Length + $b.Length)
  [Buffer]::BlockCopy($h, 0, $all, 0, $h.Length)
  [Buffer]::BlockCopy($b, 0, $all, $h.Length, $b.Length)
  return ([BitConverter]::ToString($Sha1.ComputeHash($all)) -replace '-', '').ToLower()
}
function Read-Manifest([string]$file) {
  if (-not [IO.File]::Exists($file)) { return $null }
  try { $j = ([IO.File]::ReadAllText($file, $Utf8)).TrimStart([char]0xFEFF) | ConvertFrom-Json } catch { return $null }
  $files = @{}; $hist = @{}
  if ($j.files) { foreach ($p in $j.files.PSObject.Properties) { $files[$p.Name] = [string]$p.Value } }
  if ($j.history) { foreach ($p in $j.history.PSObject.Properties) { $hist[$p.Name] = @($p.Value) } }
  return @{ version = [string]$j.version; files = $files; history = $hist }
}
function Test-Known([string]$rel, [string]$hash, $mans) {
  foreach ($m in $mans) {
    if (-not $m) { continue }
    if ($m.files.ContainsKey($rel) -and $m.files[$rel] -eq $hash) { return $true }
    if ($m.history.ContainsKey($rel) -and ($m.history[$rel] -contains $hash)) { return $true }
  }
  return $false
}
function Test-RelShape([string]$rel) { return -not ($rel -match '^[\\/]' -or $rel -match '^[A-Za-z]:' -or (($rel -split '[\\/]') -contains '..')) }
function Test-Protected([string]$rel) { foreach ($p in $Protected) { if ($rel -match $p) { return $true } }; return $false }
function Get-Abs([string]$base, [string]$rel) { return (Join-Path $base ($rel -replace '/', '\')) }
function Copy-One([string]$src, [string]$dst) {
  $d = [IO.Path]::GetDirectoryName($dst)
  if (-not [IO.Directory]::Exists($d)) { [void][IO.Directory]::CreateDirectory($d) }
  if ([IO.File]::Exists($dst)) { [IO.File]::SetAttributes($dst, [IO.FileAttributes]::Normal) }
  [IO.File]::Copy($src, $dst, $true)
}
function Remove-EmptyParents([string]$file, [string]$stopAt) {
  $d = [IO.Path]::GetDirectoryName($file)
  while ($d -and $d.Length -gt $stopAt.Length -and [IO.Directory]::Exists($d) -and -not [IO.Directory]::EnumerateFileSystemEntries($d).GetEnumerator().MoveNext()) {
    [IO.Directory]::Delete($d); $d = [IO.Path]::GetDirectoryName($d)
  }
}
function Norm([string]$s) { if ($null -eq $s) { return $null }; return ($s.TrimStart([char]0xFEFF) -replace "`r`n", "`n").Trim() }

# ---------- 临时目录与新版包 ----------
function New-TempDir {
  $d = Join-Path ([IO.Path]::GetTempPath()) ('proenga-update-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  [void][IO.Directory]::CreateDirectory($d)
  return $d
}
function Get-StagedPackage([string]$src) {
  if (-not $script:Tmp) { $script:Tmp = New-TempDir }
  if (-not $src) {
    $zip = Join-Path $script:Tmp 'proenga-main.zip'
    Say '正在从 GitHub 下载新版……'
    $wc = New-Object System.Net.WebClient
    $wc.Headers['User-Agent'] = 'proenga-updater'
    try { $wc.DownloadFile($RepoZipUrl, $zip) } catch { throw ('下载新版失败，可能是网络不通：' + $_.Exception.Message) } finally { $wc.Dispose() }
    $src = $zip
  }
  if ([IO.Directory]::Exists($src)) { $dir = (Resolve-Path -LiteralPath $src).ProviderPath }
  else {
    if (-not [IO.File]::Exists($src)) { throw ('找不到新版文件：' + $src) }
    $dir = Join-Path $script:Tmp 'unzipped'
    try {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [IO.Compression.ZipFile]::ExtractToDirectory($src, $dir)
    } catch { throw ('新版压缩包解压失败，可能没下载完整：' + $_.Exception.Message) }
  }
  $cand = @($dir) + @(Get-ChildItem -LiteralPath $dir -Directory -Force | ForEach-Object { $_.FullName })
  foreach ($c in $cand) {
    if ([IO.File]::Exists((Join-Path $c 'VERSION')) -and [IO.File]::Exists((Join-Path $c $ManifestName))) { return $c }
  }
  throw '新版里没有找到 VERSION 和文件清单，可能不是完整的 Proenga 包。'
}
function Test-Package([string]$dir, $man) {
  $bad = New-Object System.Collections.ArrayList
  foreach ($rel in @($man.files.Keys)) {
    if (-not (Test-RelShape $rel) -or (Test-Protected $rel)) { [void]$bad.Add($rel + '（路径不允许）'); continue }
    $f = Get-Abs $dir $rel
    if (-not [IO.File]::Exists($f)) { [void]$bad.Add($rel + '（缺失）') }
    elseif ((Get-BlobHash $f) -ne $man.files[$rel]) { [void]$bad.Add($rel + '（内容不对）') }
  }
  return , $bad
}

# ---------- 同步服务 anno-server ----------
function Get-AllProcs { try { return @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { return @(Get-WmiObject Win32_Process) } }
function Get-ServiceProcs {
  $needle = ((Join-Path $Root 'anno-server') + '\').ToLower()
  $all = Get-AllProcs
  $byId = @{}; foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
  $sel = @{}
  foreach ($p in $all) {
    $cl = [string]$p.CommandLine; if (-not $cl) { continue }
    $n = $cl.ToLower().Replace('/', '\')
    if ($n.Contains($needle) -and ($n.Contains('server.js') -or $n.Contains('start-anno-server'))) {
      $sel[[int]$p.ProcessId] = $p
      $par = $byId[[int]$p.ParentProcessId]   # 用相对路径启动的守护进程，命令行里没有完整路径，从子进程往上找
      if ($par -and ([string]$par.CommandLine).ToLower().Contains('start-anno-server')) { $sel[[int]$par.ProcessId] = $par }
    }
  }
  return @($sel.Values)
}
function Test-PortOpen {
  $c = New-Object Net.Sockets.TcpClient
  try { $iar = $c.BeginConnect('127.0.0.1', $Port, $null, $null); return ($iar.AsyncWaitHandle.WaitOne(800) -and $c.Connected) } catch { return $false } finally { $c.Close() }
}
function Test-AnnoHttp {
  try {
    $r = [Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/anno-queue"); $r.Timeout = 2000; $r.Proxy = $null
    $resp = $r.GetResponse(); $ok = ([int]$resp.StatusCode -eq 200); $resp.Close(); return $ok
  } catch { return $false }
}
function Get-PortOwner {
  try {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    return (Get-AllProcs | Where-Object { $_.ProcessId -eq $c.OwningProcess } | Select-Object -First 1)
  } catch { return $null }
}
function Stop-SyncService {
  $st = @{ wasRunning = $false; foreign = '' }
  $procs = @(Get-ServiceProcs)
  if ($procs.Count) {
    $st.wasRunning = $true
    Say '正在停止同步服务（先停守护进程，再停 node）……'
    $guardIds = @($procs | Where-Object { $_.Name -match '^(wscript|cscript)\.exe$' -or ([string]$_.CommandLine).ToLower().Contains('start-anno-server') } | ForEach-Object { [int]$_.ProcessId })
    foreach ($id in $guardIds) { try { Stop-Process -Id $id -Force -ErrorAction Stop } catch {} }
    foreach ($p in $procs) { if ($guardIds -notcontains [int]$p.ProcessId) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} } }
  }
  for ($i = 0; $i -lt 30; $i++) {
    if (@(Get-ServiceProcs).Count -eq 0 -and -not (Test-PortOpen)) { break }
    if ($i -eq 6 -and @(Get-ServiceProcs).Count -eq 0) { break }   # 本文件夹的进程都停了，端口仍占着 = 别的程序
    Start-Sleep -Milliseconds 500
  }
  if (@(Get-ServiceProcs).Count) { throw '同步服务停不下来，请关掉 AI 工具后再试。现有文件没有改动。' }
  if (Test-PortOpen) {
    $o = Get-PortOwner
    $st.foreign = '未知程序'
    if ($o) { $st.foreign = [string]$o.CommandLine; if (-not $st.foreign) { $st.foreign = [string]$o.Name } }
  } elseif ($st.wasRunning) { Say ('同步服务已停止，端口 ' + $Port + ' 已释放。') }
  return $st
}
function Start-SyncService($st) {
  if ($st.foreign) { return ('没有启动：端口 ' + $Port + ' 被另一个程序占着（' + $st.foreign + '），它不是这个文件夹里的同步服务，我没有动它。需要用这个文件夹的同步服务时，先关掉那个程序，再运行 anno-server\start-anno-server.vbs。') }
  $vbs = Join-Path $Root 'anno-server\start-anno-server.vbs'
  $js = Join-Path $Root 'anno-server\start-anno-server.js'
  if ([IO.File]::Exists($vbs)) { Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $vbs + '"') -WorkingDirectory (Split-Path $vbs) }
  elseif ([IO.File]::Exists($js)) { Start-Process -FilePath 'node' -ArgumentList ('"' + $js + '"') -WorkingDirectory (Split-Path $js) -WindowStyle Hidden }
  else { return '没有启动：找不到 anno-server\start-anno-server.vbs。' }
  for ($i = 0; $i -lt 40; $i++) { if (Test-AnnoHttp) { break }; Start-Sleep -Milliseconds 500 }
  if (-not (Test-AnnoHttp)) { return ('启动失败：20 秒内 http://localhost:' + $Port + '/anno-queue 没有响应。可以跟 AI 说“帮我启动 anno-server”。') }
  if (@(Get-ServiceProcs).Count -eq 0) { return ('端口 ' + $Port + ' 有响应，但不是这个文件夹里的同步服务。') }
  return '已重新启动，运行正常。'
}

# ---------- .claude\settings.json ----------
function Update-ClaudeSettings([string]$oldExampleText, $mans) {
  $s = Join-Path $Root '.claude\settings.json'; $ex = Join-Path $Root '.claude\settings.json.example'
  if (-not [IO.File]::Exists($s) -or -not [IO.File]::Exists($ex)) { return '' }
  $cur = Norm (Read-TextFile $s); $newEx = Read-TextFile $ex
  if ((Norm $newEx) -eq $cur) { return '' }
  $unmodified = (($null -ne $oldExampleText) -and ((Norm $oldExampleText) -eq $cur)) -or (Test-Known '.claude/settings.json.example' (Get-BlobHash $s) $mans)
  if ($unmodified) { Copy-One $ex $s; return '.claude\settings.json：你没改过，已换成新版钩子配置。' }
  if (($null -ne $oldExampleText) -and ((Norm $oldExampleText) -eq (Norm $newEx))) { return '' }
  Copy-One $ex ($s + '.new')
  return '.claude\settings.json：你改过，原文件保留没动；新版钩子配置另存为 .claude\settings.json.new，请让 AI 帮你把里面的 hooks 合并进 settings.json。'
}

# ---------- 全局安装（~/.agents/skills、~/.claude/skills）----------
function Get-BackupDir {
  if (-not $script:Backup) {
    $parent = Split-Path -Parent $Root
    $script:Backup = Join-Path $parent ('proenga-备份-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    [void][IO.Directory]::CreateDirectory($script:Backup)
  }
  return $script:Backup
}
function Update-GlobalSkills($newMan, $oldMan) {
  $msgs = New-Object System.Collections.ArrayList
  $names = @($newMan.files.Keys | Where-Object { $_ -match '^skills/[^/]+/' } | ForEach-Object { ($_ -split '/')[1] } | Sort-Object -Unique)
  $targets = @(@{ label = '~/.agents/skills'; dir = (Join-Path $UserHome '.agents\skills'); tag = 'agents-skills' },
               @{ label = '~/.claude/skills'; dir = (Join-Path $UserHome '.claude\skills'); tag = 'claude-skills' })
  foreach ($t in $targets) {
    $tdir = $t.dir
    if (-not [IO.Directory]::Exists($tdir)) { continue }
    $isP = [IO.File]::Exists((Join-Path $tdir 'pm-design\SKILL.md')) -and [IO.Directory]::Exists((Join-Path $tdir '_shared'))
    if (-not $isP) {
      foreach ($n in $names) { $f = Join-Path $tdir ($n + '\SKILL.md'); if ([IO.File]::Exists($f) -and (Test-Known ('skills/' + $n + '/SKILL.md') (Get-BlobHash $f) @($newMan, $oldMan))) { $isP = $true; break } }
    }
    if (-not $isP) { continue }
    try {
      $bdir = Join-Path (Get-BackupDir) ('全局技能\' + $t.tag)
      foreach ($n in $names) {
        $src = Join-Path $tdir $n
        if ([IO.Directory]::Exists($src)) { robocopy $src (Join-Path $bdir $n) /E /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -ge 8) { throw ('备份 ' + $src + ' 失败') } }
      }
      $w = 0; $d = 0; $kept = @()
      foreach ($rel in @($newMan.files.Keys)) {
        if ($rel -notmatch '^skills/') { continue }
        $dst = Join-Path $tdir (($rel.Substring(7)) -replace '/', '\'); $src = Get-Abs $Root $rel
        if (-not [IO.File]::Exists($src)) { continue }
        if ([IO.File]::Exists($dst)) {
          $h = Get-BlobHash $dst
          if ($h -eq $newMan.files[$rel]) { continue }
          if (($KeepIfModified -contains $rel) -and -not (Test-Known $rel $h @($newMan, $oldMan))) { Copy-One $src ($dst + '.new'); $kept += ($rel.Substring(7)); continue }
        }
        Copy-One $src $dst; $w++
      }
      $cands = @{}; if ($oldMan) { foreach ($k in $oldMan.files.Keys) { $cands[$k] = 1 } }; foreach ($k in $newMan.history.Keys) { $cands[$k] = 1 }
      foreach ($rel in @($cands.Keys)) {
        if ($rel -notmatch '^skills/' -or $newMan.files.ContainsKey($rel) -or -not (Test-RelShape $rel)) { continue }
        $dst = Join-Path $tdir (($rel.Substring(7)) -replace '/', '\')
        if ([IO.File]::Exists($dst) -and (Test-Known $rel (Get-BlobHash $dst) @($newMan, $oldMan))) { [IO.File]::Delete($dst); Remove-EmptyParents $dst $tdir; $d++ }
      }
      $m = '全局技能 ' + $t.label + '：已换成新版（更新 ' + $w + ' 个文件，删除 ' + $d + ' 个旧文件，你自己加的文件没动；原来的在备份的“全局技能”文件夹里）。'
      if ($kept.Count) { $m += ' 你改过的 ' + ($kept -join '、') + ' 保留没动，新版另存为同名 .new 文件。' }
      [void]$msgs.Add($m)
    } catch { [void]$msgs.Add('全局技能 ' + $t.label + '：更新失败（' + $_.Exception.Message + '），请让 AI 按 README 重新复制一次技能。') }
  }
  return , $msgs
}

# ---------- 备份与还原（ZIP 用户）----------
function Count-Files([string]$d) { return @(Get-ChildItem -LiteralPath $d -Recurse -Force -File -ErrorAction SilentlyContinue).Count }
function New-FullBackup {
  $b = Get-BackupDir
  Say ('正在把整个文件夹备份到：' + $b + '（文件多时要等一会儿）')
  robocopy $Root $b /E /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw ('备份失败（robocopy 退出码 ' + $LASTEXITCODE + '），没有做任何改动。') }
  $n1 = Count-Files $Root; $n2 = Count-Files $b
  if ($n2 -lt $n1) { throw ('备份不完整（' + $n2 + '/' + $n1 + ' 个文件），没有做任何改动。') }
  return $b
}
function Restore-FromJournal($journal, [string]$backup) {
  $failed = @()
  for ($i = $journal.Count - 1; $i -ge 0; $i--) {
    $e = $journal[$i]; $dst = Get-Abs $Root $e.rel; $bak = Get-Abs $backup $e.rel
    try {
      if ($e.existed) { if (-not ([IO.File]::Exists($dst) -and (Get-BlobHash $dst) -eq (Get-BlobHash $bak))) { Copy-One $bak $dst } }
      elseif ([IO.File]::Exists($dst)) { [IO.File]::Delete($dst); Remove-EmptyParents $dst $Root }
    } catch { $failed += $e.rel }
  }
  return , $failed
}

# ---------- 主流程 ----------
function Invoke-Main {
  $localVer = Read-VersionFile $Root
  Say ('Proenga 文件夹：' + $Root)
  Say ('当前版本：' + (VerLabel $localVer))

  # a. 最新版本号
  $verUrl = $RemoteVersionUrl
  if (-not $verUrl -and -not $Source) { $verUrl = $RepoVersionUrl }
  $remoteVer = ''; $changelog = ''
  if ($verUrl) {
    try { $remoteVer = ($Utf8.GetString((Get-Bytes $verUrl))).Trim([char[]]@([char]0xFEFF, ' ', "`r", "`n", "`t")) }
    catch { if (-not $Source) { throw ('读不到最新版本号，可能是网络不通（' + $_.Exception.Message + '）。现有文件没有改动。') } }
    if ($remoteVer -and -not (ConvertTo-VerKey $remoteVer)) { throw ('读到的最新版本号格式不对：' + $remoteVer) }
    if ($verUrl -match 'VERSION$') { try { $changelog = $Utf8.GetString((Get-Bytes ($verUrl -replace 'VERSION$', 'CHANGELOG.md'))) } catch {} }
  }

  if ($Check) {
    if (-not $remoteVer) { $stage = Get-StagedPackage $Source; $remoteVer = Read-VersionFile $stage; $changelog = Read-TextFile (Join-Path $stage 'CHANGELOG.md') }
    Say ('最新版本：' + $remoteVer)
    if ((Compare-Ver $remoteVer $localVer) -le 0) { Say '已经是最新版，不用更新。'; return }
    Say '有新版可以更新。'
    $notes = Get-ChangelogNotes $changelog $localVer $remoteVer
    if ($notes) { Say ''; Say '更新内容（摘自 CHANGELOG.md）：'; Say $notes } else { Say 'CHANGELOG.md 里没有找到这段时间的更新说明。' }
    Say ''
    Say '要更新，跟 AI 说“帮我更新 Proenga”，或运行：powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1'
    return
  }

  if ($remoteVer -and (Compare-Ver $remoteVer $localVer) -le 0) { Say '已经是最新版，不用更新。'; return }

  $isGit = [IO.Directory]::Exists((Join-Path $Root '.git'))
  $oldMan = Read-Manifest (Join-Path $Root $ManifestName)
  $oldExample = Read-TextFile (Join-Path $Root '.claude\settings.json.example')
  $changes = ''; $userChanged = @(); $keptNew = @(); $backup = ''; $svc = $null

  if ($isGit) {
    # ---------- c. git 用户 ----------
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw '这个文件夹是用 git 下载的，但电脑上找不到 git 命令。请先安装 Git，或让 AI 帮你更新。现有文件没有改动。' }
    $st = Invoke-Git @('status', '--porcelain', '--untracked-files=no')
    if ($st.code -ne 0) { throw ('git 读不了这个文件夹的状态：' + $st.out) }
    if ($st.out) {
      Say ''
      Say '先停下了，没有更新：你改过下面这些工具包文件，直接更新会和新版冲突。'
      foreach ($l in ($st.out -split "`n")) { Say ('  ' + $l.Trim()) }
      Say '需要先处理本地改动：不要的话跟 AI 说“帮我撤销这些本地改动后再更新 Proenga”；要保留的话跟 AI 说“帮我保存这些本地改动，再更新 Proenga”。'
      $script:ExitCode = 2; return
    }
    $oldHead = (Invoke-Git @('rev-parse', 'HEAD')).out
    $svc = Stop-SyncService
    Say '正在用 git pull 取新版……'
    $pull = Invoke-Git @('pull', '--ff-only')
    if ($pull.code -ne 0) {
      $cur = (Invoke-Git @('rev-parse', 'HEAD')).out
      if ($cur -and $oldHead -and $cur -ne $oldHead) { [void](Invoke-Git @('reset', '--keep', $oldHead)) }
      $why = '原因：' + $pull.out
      if ($pull.out -match 'would be overwritten|untracked working tree files') { $why = '原因：新版里有文件和你自己加的文件同名（见下面 git 的提示），需要先把你的文件改名或挪走。' + "`n" + $pull.out }
      elseif ($pull.out -match 'Not possible to fast-forward|diverge|non-fast-forward') { $why = '原因：这个文件夹里有你自己的 git 提交，和新版分叉了，需要先处理本地改动。' }
      elseif ($pull.out -match 'Could not resolve host|unable to access|Failed to connect|timed out') { $why = '原因：连不上 GitHub，请检查网络后再试。' }
      [void](Start-SyncService $svc)
      throw ('git pull 没成功，文件夹已保持更新前的样子。' + $why)
    }
    $newHead = (Invoke-Git @('rev-parse', 'HEAD')).out
    try {
      $changes = (Invoke-Git @('diff', '--shortstat', $oldHead, $newHead)).out
      $newMan = Read-Manifest (Join-Path $Root $ManifestName)
      if (-not $newMan) { throw '新版里没有文件清单' }
      $settingsMsg = Update-ClaudeSettings $oldExample @($newMan, $oldMan)
    } catch {
      [void](Invoke-Git @('reset', '--keep', $oldHead))
      [void](Start-SyncService $svc)
      throw ('更新后检查没通过，已退回更新前的版本。原因：' + $_.Exception.Message)
    }
    $changelog = Read-TextFile (Join-Path $Root 'CHANGELOG.md')
  } else {
    # ---------- d. ZIP 用户 ----------
    $stage = Get-StagedPackage $Source
    $newMan = Read-Manifest (Join-Path $stage $ManifestName)
    if (-not $newMan) { throw '新版的文件清单读不出来，包可能不完整。现有文件没有改动。' }
    $newVerPkg = Read-VersionFile $stage
    if ($newMan.version -ne $newVerPkg) { throw '新版的版本号和文件清单对不上，包可能不完整。现有文件没有改动。' }
    if ((Compare-Ver $newVerPkg $localVer) -le 0) { Say ('下载到的版本（' + $newVerPkg + '）不比现在的新，不用更新。'); return }
    Say '正在核对新版文件是否完整……'
    $bad = Test-Package $stage $newMan
    if ($bad.Count) { throw ('新版有 ' + $bad.Count + ' 个文件缺失或损坏（例如 ' + (@($bad)[0..([Math]::Min(2, $bad.Count - 1))] -join '、') + '），可能没下载完整。现有文件没有改动。') }
    $changelog = Read-TextFile (Join-Path $stage 'CHANGELOG.md')

    # 算出要换、要删的文件
    $copy = New-Object System.Collections.ArrayList; $del = New-Object System.Collections.ArrayList
    $added = 0
    foreach ($rel in @($newMan.files.Keys | Sort-Object)) {
      if (Test-Protected $rel) { continue }
      $dst = Get-Abs $Root $rel
      if ([IO.File]::Exists($dst)) {
        $h = Get-BlobHash $dst
        if ($h -eq $newMan.files[$rel]) { continue }
        if (-not (Test-Known $rel $h @($oldMan, $newMan))) {
          if ($KeepIfModified -contains $rel) { $keptNew += $rel; continue }
          $userChanged += $rel
        }
      } else { $added++ }
      [void]$copy.Add($rel)
    }
    $cands = @{}; if ($oldMan) { foreach ($k in $oldMan.files.Keys) { $cands[$k] = 1 } }; foreach ($k in $newMan.history.Keys) { $cands[$k] = 1 }
    foreach ($rel in @($cands.Keys | Sort-Object)) {
      if ($newMan.files.ContainsKey($rel) -or $rel -eq $ManifestName -or (Test-Protected $rel) -or -not (Test-RelShape $rel)) { continue }
      $dst = Get-Abs $Root $rel
      if (-not [IO.File]::Exists($dst)) { continue }
      $inOld = ($null -ne $oldMan) -and $oldMan.files.ContainsKey($rel)
      $h = Get-BlobHash $dst
      $knownH = Test-Known $rel $h @($oldMan, $newMan)
      if ($inOld -or $knownH) { [void]$del.Add($rel); if (-not $knownH) { $userChanged += ($rel + '（新版已删除）') } }
    }

    $svc = Stop-SyncService
    try { $backup = New-FullBackup } catch { [void](Start-SyncService $svc); throw }

    Say ('正在更新文件（替换 ' + $copy.Count + ' 个，删除 ' + $del.Count + ' 个）……')
    $journal = New-Object System.Collections.ArrayList
    try {
      foreach ($rel in $copy) {
        $dst = Get-Abs $Root $rel
        [void]$journal.Add(@{ rel = $rel; existed = [IO.File]::Exists($dst) })
        Copy-One (Get-Abs $stage $rel) $dst
      }
      foreach ($rel in $keptNew) {
        $dst = Get-Abs $Root ($rel + '.new')
        [void]$journal.Add(@{ rel = ($rel + '.new'); existed = [IO.File]::Exists($dst) })
        Copy-One (Get-Abs $stage $rel) $dst
      }
      foreach ($rel in $del) {
        $dst = Get-Abs $Root $rel
        [void]$journal.Add(@{ rel = $rel; existed = $true })
        [IO.File]::SetAttributes($dst, [IO.FileAttributes]::Normal)
        [IO.File]::Delete($dst)
        Remove-EmptyParents $dst $Root
      }
      $mdst = Get-Abs $Root $ManifestName
      [void]$journal.Add(@{ rel = $ManifestName; existed = [IO.File]::Exists($mdst) })
      Copy-One (Get-Abs $stage $ManifestName) $mdst
      if ((Read-VersionFile $Root) -ne $newVerPkg) { throw '写完后版本号不对' }
      $settingsMsg = Update-ClaudeSettings $oldExample @($newMan, $oldMan)
    } catch {
      $err = $_.Exception.Message
      Say ('更新时出错：' + $err)
      Say '正在用备份还原……'
      $failed = Restore-FromJournal $journal $backup
      $s = Start-SyncService $svc
      if ($failed.Count) { throw ('更新失败，已还原，但有 ' + $failed.Count + ' 个文件没还原成功（例如 ' + $failed[0] + '）。完整备份在：' + $backup + '，可以把备份文件夹里的内容复制回来。原因：' + $err) }
      throw ('更新失败，已用备份还原成更新前的样子（同步服务：' + $s + '）。原因：' + $err + '。备份在：' + $backup)
    }
    $changes = '替换 ' + ($copy.Count - $added) + ' 个文件，新增 ' + $added + ' 个，删除 ' + $del.Count + ' 个'
  }

  # f. 全局安装
  $globalMsgs = Update-GlobalSkills $newMan $oldMan
  # g. 重启同步服务 + 自检
  $svcMsg = Start-SyncService $svc
  $newVer = Read-VersionFile $Root
  $verOk = ($newVer -eq $newMan.version)
  # h. 结果
  Say ''
  Say '================ 更新完成 ================'
  Say ('版本：' + (VerLabel $localVer) + ' → ' + $newVer + '（自检：版本号' + $(if ($verOk) { '正确' } else { '不对，请重新运行一次' }) + '）')
  $notes = Get-ChangelogNotes $changelog $localVer $newVer
  if ($notes) { Say '更新了什么（摘自 CHANGELOG.md）：'; Say $notes } else { Say '更新了什么：CHANGELOG.md 里没有这段时间的说明。' }
  if ($changes) { Say ('文件变化：' + $changes + '。') }
  $mine = @('archive', 'anno-server\anno-config.json', '.claude\settings.json', '.claude\ledgers.txt', '.mcp.json') | Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) }
  Say ('你自己的文件没动：' + $(if ($mine) { ($mine -join '、') + '，以及清单外你自己加的其它文件。' } else { '清单外你自己加的文件都保留着。' }))
  if ($userChanged.Count) { Say ('这些工具包文件你改过，已换成新版，你原来的版本在备份里：' + ($userChanged -join '、')) }
  if ($keptNew.Count) { Say ('这些文件你改过，保留没动，新版另存为同名 .new 文件：' + ($keptNew -join '、')) }
  if ($settingsMsg) { Say $settingsMsg }
  foreach ($m in $globalMsgs) { Say $m }
  if ($backup) { Say ('备份在：' + $backup + '（确认新版用着没问题后可以删掉）') }
  elseif ($script:Backup) { Say ('备份在：' + $script:Backup) }
  Say ('同步服务：' + $svcMsg)
  Say '下一步：把正在用的 AI 工具关掉重开（OpenClaw 新开一个会话），新规则才会生效。以前做好的原型不用动，AI 打开时会提示要不要换新版标注层。'
  if (-not $verOk) { $script:ExitCode = 1 }
}

function Invoke-Git([string[]]$GitArgs) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try {
    $out = & git -C $Root -c core.quotepath=off @GitArgs 2>&1 | ForEach-Object { [string]$_ }
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $old }
  return @{ code = $code; out = (($out | Where-Object { $_ -ne $null }) -join "`n").Trim() }
}
function Test-FromExplorer {
  try { $me = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"; $par = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $me.ParentProcessId); return ($par.Name -eq 'explorer.exe') } catch { return $false }
}

try {
  Invoke-Main
} catch {
  Say ''
  Say ('没有更新成功：' + $_.Exception.Message)
  $script:ExitCode = 1
} finally {
  if ($script:Tmp -and [IO.Directory]::Exists($script:Tmp)) { try { Remove-Item -LiteralPath $script:Tmp -Recurse -Force } catch {} }
}
if (Test-FromExplorer) { try { Read-Host '按回车键关闭窗口' | Out-Null } catch {} }
exit $script:ExitCode
