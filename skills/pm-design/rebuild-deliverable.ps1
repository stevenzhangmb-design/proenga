# rebuild-deliverable.ps1
#
# 交付件重建（根治「改了源/骨架，却只验 _bld.html 预览、没重建用户实际打开的离线文件」事故·2026-09-16）
#
# 机制铁律：project-data 里的 "_deliverable" = 用户实际打开的离线 .html 文件路径。
# 改完 project-data / 骨架后【交付】时，必须跑本脚本：
#   全量装配(含体检闸) → make-offline(内联 EP/Vue) → 覆盖到 _deliverable 路径。
# 然后必须在【那个文件本身】里验收（禁把 _bld.html 预览当交付件）。
#
# 用法：
#   .\rebuild-deliverable.ps1 -ProjectData "<你的目录>\OMS复刻-project-data.json"
#   （-Out 可覆盖输出路径；缺省读 project-data 的 _deliverable 字段）

param(
  [Parameter(Mandatory=$true)][string]$ProjectData,
  [string]$Out = "",
  # 迭代期提速：只逐页自检这几页（逗号分隔的 page id），例如 -Pages "issuing,order-main"。
  # 不传 = 全量（默认永远安全）。交付给用户前必须不带 -Pages 再跑一次全量。
  [string]$Pages = "",
  # 快速模式（2026-09-18 提速剥离）：快速装配 0.2s + 离线化 0.2s 直接更新交付件（用户马上能刷新看到）；
  # 布局/保真体检（~10s）和全量逐页自检（~28s）剥离到【后台】跑，结果写到 <交付件>.gate-report.txt。
  # 报告第一行 = RUNNING / PASS / FAIL。说"做完了"之前必须看到 PASS。
  [switch]$Quick
)
$ErrorActionPreference = 'Stop'
# §2026-11-13 计时如实：秒表从脚本第一行开始，报的是用户真正等待的时间（原来从装配才开始计，漏了读 project-data 的 6~20 秒）
$swAll = [Diagnostics.Stopwatch]::StartNew()
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $ProjectData)) { Write-Error "project-data 不存在: $ProjectData"; exit 1 }

# 读 _deliverable 路径
# §2026-11-13 提速：禁用 ConvertFrom-Json 整份解析（53MB 要 6~20 秒）。改用 qa\pd-top-field.js 单遍字节扫描，
#   只认顶层键（嵌套同名键/字符串里的同名文字都不会误认），约 0.3 秒；输出为纯 ASCII 的 JSON 字符串，不受控制台编码影响。
if ([string]::IsNullOrEmpty($Out)) {
  $rawField = node (Join-Path $here "qa\pd-top-field.js") $ProjectData "_deliverable"
  if ($LASTEXITCODE -eq 1) { Write-Error "读取 project-data 失败: $ProjectData"; exit 1 }
  $Out = ("" + $rawField).Trim() | ConvertFrom-Json
  if ([string]::IsNullOrEmpty($Out)) {
    Write-Error "project-data 未声明 _deliverable（用户实际打开的离线文件路径）。请先在 project-data 顶部加 `"_deliverable`": `"<绝对路径.html>`""
    exit 1
  }
}
Write-Output "交付件目标 = $Out"

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("_deliv_bld_" + (Get-Random) + ".html")

if ($Quick) {
  node (Join-Path $here "qa\assemble-prototype.js") $ProjectData $tmp --fast | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Error "快速装配失败 — 交付件未动"; exit 1 }
  # §2026-11-13 提速：新增项对比只读 project-data + 基线、与交付件无关，装配成功后立刻在旁边并行跑（省 ~1.5 秒），
  #   输出照旧放在最后打印。用 UTF-8 收输出，不受控制台编码影响。离线化失败则掐掉它，和原来"失败就不跑"一致。
  $auditPsi = New-Object Diagnostics.ProcessStartInfo
  $auditPsi.FileName = 'node'
  $auditPsi.Arguments = '"' + (Join-Path $here "qa\added-structure-audit.js") + '" "' + $ProjectData + '"'
  $auditPsi.UseShellExecute = $false; $auditPsi.CreateNoWindow = $true
  $auditPsi.RedirectStandardOutput = $true; $auditPsi.RedirectStandardError = $true
  $auditPsi.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
  $auditPsi.StandardErrorEncoding = New-Object Text.UTF8Encoding($false)
  $audit = [Diagnostics.Process]::Start($auditPsi)
  $auditOut = $audit.StandardOutput.ReadToEndAsync(); $auditErr = $audit.StandardError.ReadToEndAsync()
  try {
    & (Join-Path $here "make-offline.ps1") -InputHtml $tmp -OutputHtml $Out | Out-Null
  } catch {
    try { $audit.Kill() } catch {}
    throw
  }
  Remove-Item $tmp -ErrorAction SilentlyContinue
  Write-Output ("✅ 交付件已更新（快速模式 {0:N1} 秒，从脚本启动算起）：{1}" -f $swAll.Elapsed.TotalSeconds, $Out)
  # 只验改动涉及的页（可选，~3 秒/页），同步跑，红了立刻知道
  if (-not [string]::IsNullOrEmpty($Pages)) {
    node (Join-Path $here "qa\deliverable-verify-gate.js") $Out $ProjectData --pages $Pages | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { try { $audit.Kill() } catch {}; Write-Error "改动页自检未过"; exit 1 }
  }
  # 全量体检 + 全量逐页自检剥离到后台
  $report = "$Out.gate-report.txt"
  Set-Content -Path $report -Value "RUNNING $(Get-Date -Format 'HH:mm:ss')" -Encoding UTF8
  $bg = Join-Path ([System.IO.Path]::GetTempPath()) ("_deliv_bg_" + (Get-Random) + ".ps1")
  $asm = Join-Path $here "qa\assemble-prototype.js"; $vg = Join-Path $here "qa\deliverable-verify-gate.js"
  $tmp2 = Join-Path ([System.IO.Path]::GetTempPath()) ("_deliv_chk_" + (Get-Random) + ".html")
  # 报告第一行带后台进程号：读报告时若是 RUNNING 但该进程已不在 = 后台检查被中断（例如父进程被杀），必须重跑，不能当"还在跑"。
  # §2026-11-13 报告乱码根治：PowerShell 5.1 默认按 GBK 解码 node 的 UTF-8 输出、再按 UTF-8 存盘 = 乱码。
  #   后台脚本第一件事把控制台输出编码设成 UTF-8（node 输出按 UTF-8 解码），报告用 UTF-8 写；
  #   第一行 = 状态 + 时间 + 一句中文结论。verify-gate-health-gate.js 卡死这两条，禁改回。
  $body = @"
[Console]::OutputEncoding = New-Object Text.UTF8Encoding(`$false)
`$OutputEncoding = [Console]::OutputEncoding
`$enc = New-Object Text.UTF8Encoding(`$false)
[IO.File]::WriteAllText('$report', ('RUNNING ' + (Get-Date -Format 'HH:mm:ss') + ' pid=' + `$PID + ' 后台检查进行中'), `$enc)
`$log = @()
`$log += ((node '$asm' '$ProjectData' '$tmp2' 2>&1 | ForEach-Object { if (`$_ -is [System.Management.Automation.ErrorRecord]) { "" + `$_.TargetObject } else { "" + `$_ } }) -join "`n"); `$a = `$LASTEXITCODE
Remove-Item '$tmp2' -ErrorAction SilentlyContinue
`$log += ((node '$vg' '$Out' '$ProjectData' 2>&1 | ForEach-Object { if (`$_ -is [System.Management.Automation.ErrorRecord]) { "" + `$_.TargetObject } else { "" + `$_ } }) -join "`n"); `$v = `$LASTEXITCODE
`$why = @()
if (`$a -ne 0) { `$why += ('全量装配体检未过（退出码 ' + `$a + '）') }
if (`$v -ne 0) { `$why += ('逐页自检未过（退出码 ' + `$v + '）') }
`$st = if (`$why.Count -eq 0) { 'PASS' } else { 'FAIL' }
`$msg = if (`$why.Count -eq 0) { '通过：全量体检和逐页自检全绿' } else { '未通过：' + (`$why -join '；') + '，详见下方日志' }
[IO.File]::WriteAllText('$report', ((`$st + ' ' + (Get-Date -Format 'HH:mm:ss') + ' ' + `$msg), (`$log -join "`n")) -join "`n", `$enc)
Remove-Item `$MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue
"@
  [IO.File]::WriteAllText($bg, $body, (New-Object Text.UTF8Encoding($true)))
  Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$bg -WindowStyle Hidden
  Write-Output "⏳ 全量体检+逐页自检已在后台运行（约 40 秒），结果：$report"
  # 新增项对比（用户铁律「没让做的一个都不许加」）：列出比上次认可版本多出来的结构，必须报给用户
  # （上面已并行启动，这里等它结束并按原样打印输出）
  $audit.WaitForExit()
  $ao = $auditOut.Result; $ae = $auditErr.Result
  if ($ao) { $ao.TrimEnd("`r", "`n") -split "`r?`n" | ForEach-Object { Write-Output $_ } }
  if ($ae) { [Console]::Error.Write($ae) }
  Write-Output ("⏱ 前台总耗时 {0:N1} 秒（从脚本启动到返回；后台体检不计）" -f $swAll.Elapsed.TotalSeconds)
  exit 0
}

# 1) 全量装配（含布局/保真体检闸·不加 --fast）
Write-Output "=== ① 全量装配（含体检闸）==="
node (Join-Path $here "qa\assemble-prototype.js") $ProjectData $tmp
if ($LASTEXITCODE -ne 0) { Write-Error "装配失败/体检未过 — 已拦停，不生成交付件"; exit 1 }

# 2) 离线化到交付件路径
Write-Output "=== ② 离线化 → 交付件 ==="
& (Join-Path $here "make-offline.ps1") -InputHtml $tmp -OutputHtml $Out
Remove-Item $tmp -ErrorAction SilentlyContinue

Write-Output ""
Write-Output "✅ 交付件已重建：$Out"

# 3) 自动跑交付件自检闸（逐页渲染 + 新旧检查）——重建=重建+自检，一步到位
if ([string]::IsNullOrEmpty($Pages)) {
  Write-Output "=== ③ 交付件自检（逐页渲染·全量·在交付件本身里验）==="
  node (Join-Path $here "qa\deliverable-verify-gate.js") $Out $ProjectData
} else {
  Write-Output "=== ③ 交付件自检（增量·只验 $Pages）==="
  node (Join-Path $here "qa\deliverable-verify-gate.js") $Out $ProjectData --pages $Pages
}
if ($LASTEXITCODE -ne 0) {
  Write-Error "交付件自检未过 —— 禁说'做完了'，按上面红项修到全绿"
  exit 1
}
Write-Output "✅ 交付件已重建且逐页自检全绿：$Out"
node (Join-Path $here "qa\added-structure-audit.js") $ProjectData
Write-Output ("⏱ 总耗时 {0:N1} 秒（从脚本启动算起）" -f $swAll.Elapsed.TotalSeconds)
