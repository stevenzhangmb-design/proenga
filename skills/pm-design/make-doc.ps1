# make-doc.ps1
#
# Turn a PRD .md into an image-embedded Word (.docx) for online-doc delivery (腾讯文档/飞书/...).
# Solves two problems pandoc alone can't:
#   1) relative-path screenshots (![](screenshots/img-xx.png)) break when a bare .md is uploaded online
#      -> docx embeds the images, so they travel with the file.
#   2) ```mermaid``` flowcharts render as raw code in docx (pandoc doesn't render mermaid)
#      -> this script renders each mermaid block to a trimmed PNG via headless Chrome + mermaid.js,
#         swaps it into a temp copy of the md, then runs pandoc.
#
# The original .md is left UNCHANGED (keeps live mermaid for VS Code/Typora/GitHub);
# only the docx gets rendered flowchart images.
#
# Usage:
#   .\make-doc.ps1 -InputMd "C:\path\PRD-xxx.md"                 # -> PRD-xxx.docx beside it
#   .\make-doc.ps1 -InputMd "..." -OutDocx "C:\path\out.docx"
#
# Requirements: pandoc on PATH; Chrome/Edge installed; network access to unpkg (mermaid CDN).
# Gotcha: headless --screenshot SILENTLY fails without --user-data-dir (always passed below).

param(
  [Parameter(Mandatory=$true)][string]$InputMd,
  [string]$OutDocx = "",
  [string]$Title = "PRD"
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $InputMd)) { Write-Error "Input md not found: $InputMd"; exit 1 }

$dir = Split-Path -Parent $InputMd
if ([string]::IsNullOrEmpty($OutDocx)) { $OutDocx = [IO.Path]::ChangeExtension($InputMd, '.docx') }
$shotDir = Join-Path $dir 'screenshots'
New-Item -ItemType Directory -Force -Path $shotDir | Out-Null

# Locate browser
$browser = $null
foreach ($p in @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)) { if (Test-Path $p) { $browser = $p; break } }
if (-not $browser) { Write-Error "No Chrome/Edge found"; exit 1 }
$ud = Join-Path $dir '_chrome_shot_prof'

$md = [IO.File]::ReadAllText($InputMd)

# --- phase 1: render each ```mermaid block to a trimmed PNG (in document order) ---
$rx = New-Object System.Text.RegularExpressions.Regex '(?s)```mermaid\s*(.*?)```'
$idx = 0
foreach ($mm in $rx.Matches($md)) {
  $idx++
  $code = $mm.Groups[1].Value.Trim()
  $html = @"
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<style>body{margin:0;padding:16px;background:#fff;display:inline-block}.mermaid{font-family:"Microsoft YaHei",sans-serif}</style>
<script src="https://unpkg.com/mermaid@10/dist/mermaid.min.js"></script></head>
<body><pre class="mermaid">
$code
</pre><script>mermaid.initialize({startOnLoad:true,securityLevel:'loose',flowchart:{useMaxWidth:false}});</script></body></html>
"@
  $htmlFile = Join-Path $dir ("_mmd_$idx.html")
  [IO.File]::WriteAllText($htmlFile, $html, (New-Object System.Text.UTF8Encoding($false)))
  $uri = 'file:///' + (($htmlFile -replace '\\','/'))
  # pass 1: dump-dom to read rendered svg natural size.
  # NOTE: capturing native --dump-dom into a variable returns empty in PS 5.1; write to a file then read.
  $domFile = Join-Path $dir ("_dom_$idx.txt")
  & $browser --headless=new --disable-gpu --no-sandbox --no-first-run "--user-data-dir=$ud" --virtual-time-budget=9000 --dump-dom "$uri" | Out-File -FilePath $domFile -Encoding utf8
  Start-Sleep -Milliseconds 300
  $dom = [IO.File]::ReadAllText($domFile)
  Remove-Item $domFile -Force -ErrorAction SilentlyContinue
  $sm = [regex]::Match($dom, '<svg[^>]*width="([0-9.]+)"[^>]*height="([0-9.]+)"')
  $w = if ($sm.Success) { [math]::Ceiling([double]$sm.Groups[1].Value) + 34 } else { 1600 }
  $h = if ($sm.Success) { [math]::Ceiling([double]$sm.Groups[2].Value) + 34 } else { 700 }
  # pass 2: screenshot at fitted size (trims whitespace)
  $png = Join-Path $shotDir ("flow-$idx.png")
  & $browser --headless=new --disable-gpu --no-sandbox --no-first-run "--user-data-dir=$ud" --hide-scrollbars "--window-size=$w,$h" --virtual-time-budget=9000 "--screenshot=$png" "$uri" | Out-Null
  Start-Sleep -Milliseconds 400
  Remove-Item $htmlFile -Force -ErrorAction SilentlyContinue
  if (Test-Path $png) { Write-Output ("  flow-$idx rendered  {0}x{1}  {2} KB" -f $w,$h,[math]::Round((Get-Item $png).Length/1KB,1)) }
  else { Write-Output "  flow-$idx FAILED to render" }
}

# --- phase 2: swap every mermaid block for its image (counter -> flow-1, flow-2, ... in order) ---
$script:fi = 0
$ev = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $script:fi++; "![业务流程图 $($script:fi)](screenshots/flow-$($script:fi).png)" }
$md = $rx.Replace($md, $ev)

# --- pandoc -> docx (resource-path lets relative images embed) ---
$tmpMd = Join-Path $dir ('_docxsrc_' + (Get-Random) + '.md')
[IO.File]::WriteAllText($tmpMd, $md, (New-Object System.Text.UTF8Encoding($false)))
pandoc "$tmpMd" -o "$OutDocx" --resource-path="$dir" --metadata title="$Title"
Start-Sleep -Seconds 1
Remove-Item $tmpMd -Force -ErrorAction SilentlyContinue

if (Test-Path $OutDocx) { Write-Output ("Done -> {0}  ({1} MB)" -f $OutDocx, [math]::Round((Get-Item $OutDocx).Length/1MB,2)) }
else { Write-Output "pandoc failed to produce docx" }
Write-Output "Note: original .md kept unchanged (live mermaid preserved); only the docx uses rendered flow images."
