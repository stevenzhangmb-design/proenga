# quick.ps1 —— 画原型/改原型的【默认】命令（方案 B·2026-09-28 用户拍板）
#
# 为什么要有这个脚本：提速的规矩早就写在 SKILL.md 里了，但规矩管不住"顺手多跑一道"。
# 把快路做成【一条命令】，快路才会变成最省事的那条路。
#
#   迭代期（默认，0.2 秒）  ：.\quick.ps1 -ProjectData <源.json>
#   想看某几页对不对（~10s）：.\quick.ps1 -ProjectData <源.json> -Check "页id,页id"
#   收尾交给用户（~40 秒）  ：.\rebuild-deliverable.ps1 -ProjectData <源.json>     ← 这一步不能省
#
# 迭代期【不】做的事（做了就是慢的根源）：
#   ✗ 浏览器逐项验收   ✗ 离线化   ✗ 截图   ✗ 重建交付件   ✗ 整套 deliver-gate
# 逐项对截图 1:1 只有用户明确要求时才做。

param(
  [Parameter(Mandatory=$true)][string]$ProjectData,
  [string]$Out = "",
  # 只逐页渲染自检这几页（逗号分隔 page id）；不传 = 只装配、不开浏览器
  [string]$Check = ""
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $ProjectData)) { Write-Error "project-data 不存在: $ProjectData"; exit 1 }

if ($Out -eq "") { $Out = Join-Path (Split-Path -Parent $ProjectData) '_bld.html' }

$sw = [Diagnostics.Stopwatch]::StartNew()
node (Join-Path $here 'qa\assemble-prototype.js') $ProjectData $Out --fast
if ($LASTEXITCODE -ne 0) { Write-Error "装配失败"; exit 2 }
$sw.Stop()
Write-Host ("  预览已更新 → {0}  （{1} ms）" -f $Out, $sw.ElapsedMilliseconds)

if ($Check -ne "") {
  Write-Host "  逐页渲染自检：$Check"
  node (Join-Path $here 'qa\deliverable-verify-gate.js') $Out $ProjectData --pages $Check
  if ($LASTEXITCODE -ne 0) { Write-Error "逐页自检没过"; exit 3 }
}

Write-Host ""
Write-Host "  下一步：继续改就再跑一次本命令；要交给用户时跑"
Write-Host "    .\rebuild-deliverable.ps1 -ProjectData `"$ProjectData`""
Write-Host "  （那一步会离线化 + 重建用户实际打开的那个文件 + 全量逐页自检，约 40 秒，不能省）"
