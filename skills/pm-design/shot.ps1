# shot.ps1 —— 检查原型的【唯一】方式：装配 + 截图，自己看图（2026-09-28 用户明令）
#
# 为什么要有这个脚本：AI 一说「检查一下」就去写 DOM 探针 / 指纹 diff / 审计工具，
# 把 0.2 秒的活干成一天。用户要看的是【生成的原型样式】，不是代码层级的检查。
# 所以检查只留这一条路：跑一次，出图，眼睛对。
#
#   .\shot.ps1 -ProjectData <源.json> -Pages "页id,页id"          # 默认端（卖家/主视图）
#   .\shot.ps1 -ProjectData <源.json> -Pages "cpa-home" -View cpa  # 指定视图
#
# 出图位置：<源.json 同目录>\_shots\<页id>.png  —— AI 直接 Read 这些 png 看
# 不做的事：不写探针、不抽 DOM、不做指纹 diff、不重建交付件。

param(
  [Parameter(Mandatory=$true)][string]$ProjectData,
  [Parameter(Mandatory=$true)][string]$Pages,
  [string]$View = "",
  [int]$Width = 1440,
  [int]$Height = 1000,
  [int]$Port = 9423
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $ProjectData)) { Write-Error "project-data 不存在: $ProjectData"; exit 1 }

$dir = Split-Path -Parent $ProjectData
$bld = Join-Path $dir '_bld.html'
$out = Join-Path $dir '_shots'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Force $out | Out-Null }

node (Join-Path $here 'qa\assemble-prototype.js') $ProjectData $bld --fast
if ($LASTEXITCODE -ne 0) { Write-Error "装配失败"; exit 2 }

# 注意：PowerShell 调原生命令时会把空字符串参数【丢掉】，后面的参数就全错位了（宽高端口都挪了一位）。
# 所以 -View 没给时传一个占位符 "-"，由 node 侧当成空处理。
$v = if ($View -eq "") { "-" } else { $View }
node (Join-Path $here 'qa\_shot-pages.js') $bld $Pages $out $v $Width $Height $Port
if ($LASTEXITCODE -ne 0) { Write-Error "截图失败"; exit 3 }

Write-Host ""
Write-Host "  图在 $out —— 直接看图跟参考截图对，不一样就改 project-data 再跑一次本命令。"
