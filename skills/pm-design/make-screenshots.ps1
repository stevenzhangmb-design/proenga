# make-screenshots.ps1
#
# Auto-capture prototype state screenshots via headless Chrome/Edge, for filling PRD 原型图.
# Replaces the manual "IMG-xx" placeholder workflow with real, auto-generated screenshots.
#
# Prerequisite: the prototype HTML must support URL params to deep-link each state, e.g.
#   ?sys=OMS|WMS & page=<page-key> & open=form|detail|audit|biz & anno=1
# (see prototype-template.md "URL 参数直达状态" convention). Use the OFFLINE html so no network is needed.
#
# Usage:
#   .\make-screenshots.ps1 -InputHtml "C:\path\proto-offline.html" -StatesJson "C:\path\states.json"
#   .\make-screenshots.ps1 -InputHtml "..." -StatesJson "..." -OutDir "C:\path\screenshots" -Width 1680 -Height 1180
#
# states.json format (UTF-8): an array of { "file": "img-01", "query": "sys=WMS&page=recharge-list" }
#
# Key gotcha (learned 2026-06-07): headless screenshot SILENTLY fails without --user-data-dir.
#   Always pass --user-data-dir to a writable temp profile, or no PNG is produced.

param(
  [Parameter(Mandatory=$true)][string]$InputHtml,
  [Parameter(Mandatory=$true)][string]$StatesJson,
  [string]$OutDir = "",
  [int]$Width = 1680,
  [int]$Height = 1180,
  [int]$WaitMs = 9000
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InputHtml))  { Write-Error "Input HTML not found: $InputHtml"; exit 1 }
if (-not (Test-Path $StatesJson)) { Write-Error "States JSON not found: $StatesJson"; exit 1 }

# Locate a Chromium-based browser
$browser = $null
foreach ($p in @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)) { if (Test-Path $p) { $browser = $p; break } }
if (-not $browser) { Write-Error "No Chrome/Edge found"; exit 1 }

if ([string]::IsNullOrEmpty($OutDir)) { $OutDir = Join-Path (Split-Path -Parent $InputHtml) 'screenshots' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Copy to an ASCII temp path (file:// URI with non-ASCII chars can fail to load)
$tmp = Join-Path (Split-Path -Parent $InputHtml) ('_shotsrc_' + (Get-Random) + '.html')
Copy-Item $InputHtml $tmp -Force
$uri = 'file:///' + (($tmp -replace '\\','/'))
$ud  = Join-Path (Split-Path -Parent $InputHtml) '_chrome_shot_prof'

$states = Get-Content $StatesJson -Raw -Encoding UTF8 | ConvertFrom-Json
$ok = 0
foreach ($s in $states) {
  $out = Join-Path $OutDir ($s.file + '.png')
  if (Test-Path $out) { Remove-Item $out -Force }
  & $browser --headless=new --disable-gpu --no-sandbox --no-first-run "--user-data-dir=$ud" --hide-scrollbars "--window-size=$Width,$Height" "--force-device-scale-factor=2" "--virtual-time-budget=$WaitMs" "--screenshot=$out" "$uri`?$($s.query)" | Out-Null
  Start-Sleep -Milliseconds 400
  if (Test-Path $out) { $ok++; Write-Output ("  OK   {0}  {1} KB  ({2})" -f $s.file, [math]::Round((Get-Item $out).Length/1KB,1), $s.query) }
  else { Write-Output ("  FAIL {0}  ({1})" -f $s.file, $s.query) }
}
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Output ""
Write-Output "Done: $ok / $($states.Count) screenshots -> $OutDir"
Write-Output "Tip: have the AI Read each PNG to verify rendering before embedding into PRD."
