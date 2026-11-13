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
  [string]$Title = "PRD",
  # Set ONLY after every edit the user made in the Word has been copied into the md (user rule 2026-11-06: an edited Word wins over the md)
  [switch]$WordSynced
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $InputMd)) { Write-Error "Input md not found: $InputMd"; exit 1 }

$dir = Split-Path -Parent $InputMd
if ([string]::IsNullOrEmpty($OutDocx)) { $OutDocx = [IO.Path]::ChangeExtension($InputMd, '.docx') }

# Open-in-editor guard (user iron rule 2026-11-09): never overwrite a docx the user has open.
# WPS reads the file into memory and keeps no lock (no ~$ owner file, the file can still be opened exclusively),
# so a file-lock test misses it. Look for the file name in the open WPS / Word windows instead (UI Automation, Windows only).
$openIn = @()
try {
  Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
  $leaf = Split-Path -Leaf $OutDocx
  $ids = @(Get-Process -Name wps, wpsoffice, winword -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  if ($ids.Count -gt 0) {
    $root = [Windows.Automation.AutomationElement]::RootElement
    foreach ($w in $root.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)) {
      if ($ids -notcontains $w.Current.ProcessId) { continue }
      # Match the exact file name (with extension) in the window title; a copy like "<name>查看版.docx" must not count (false positive 2026-11-09).
      $t = $w.Current.Name
      if ($t -eq $leaf -or $t.StartsWith("$leaf ") -or $t.Contains(" $leaf ") -or $t.Contains("[$leaf]")) { $openIn += $t; continue }
      foreach ($e in $w.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.Condition]::TrueCondition)) {
        # Only an open document tab counts; WPS home page "recent files" ListItems carry the same name (false positive 2026-11-09).
        if ($e.Current.Name -eq $leaf -and $e.Current.ControlType -ne [Windows.Automation.ControlType]::ListItem) { $openIn += $w.Current.Name; break }
      }
    }
  }
} catch { }
if ($openIn.Count -gt 0) {
  Write-Output "STOPPED -> '$OutDocx' is open in WPS/Word and was NOT overwritten. Ask the user to close it first, then re-run."
  exit 4
}

# Word-first guard (user rule 2026-11-06): if the user edited the docx after it was generated, the docx is the latest version.
# Never overwrite it from the md; stop and print the text differences so the edits are copied into the md first.
$guard = Join-Path $PSScriptRoot '..\prd\qa\docx-guard.js'
if ((Test-Path $guard) -and (-not $WordSynced)) {
  node "$guard" check "$OutDocx" "$InputMd"
  if ($LASTEXITCODE -eq 3) { Write-Output "STOPPED -> '$OutDocx' was edited by the user and was NOT overwritten. Copy the Word edits into the md, then re-run with -WordSynced."; exit 3 }
}
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

# mermaid library: prefer a local copy (unpkg is often unreachable -> every flowchart fails); fall back to the CDN
$mermaidSrc = 'https://unpkg.com/mermaid@10/dist/mermaid.min.js'
foreach ($p in @(
  (Join-Path $PSScriptRoot 'vendor\mermaid.min.js'),
  (Join-Path $PSScriptRoot '..\prd\vendor\mermaid.min.js'),
  (Join-Path $PSScriptRoot '..\..\..\anno-server\vendor\mermaid.min.js')
)) { if (Test-Path $p) { $mermaidSrc = 'file:///' + ((Resolve-Path $p).Path -replace '\\','/'); break } }

# --- phase 1: render each ```mermaid block to a trimmed PNG (in document order) ---
$rx = New-Object System.Text.RegularExpressions.Regex '(?s)```mermaid\s*(.*?)```'
# Fast path (2026-11-13): render-mermaid.js caches PNGs by content hash (unchanged charts are never re-rendered)
# and renders the changed ones in ONE headless Chrome, instead of 2 Chrome launches per chart (~8.6 s each).
# Same template / trim (+34) / fallback size as the legacy loop below, which only runs if node or the helper is missing.
$useLegacy = $true
$renderer = Join-Path $PSScriptRoot 'render-mermaid.js'
$mmCodes = @($rx.Matches($md) | ForEach-Object { $_.Groups[1].Value.Trim() })
if ($mmCodes.Count -eq 0) { $useLegacy = $false }
elseif ((Test-Path $renderer) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $useLegacy = $false
  $jobFile = Join-Path $dir ('_mmdjob_' + (Get-Random) + '.json')
  $job = ConvertTo-Json -InputObject ([ordered]@{ mermaidSrc = $mermaidSrc; outDir = $shotDir; charts = $mmCodes }) -Depth 4 -Compress
  [IO.File]::WriteAllText($jobFile, $job, (New-Object System.Text.UTF8Encoding($false)))
  $sw = [Diagnostics.Stopwatch]::StartNew()
  node "$renderer" "$jobFile"
  Write-Output ("  flowchart step {0:N1} s" -f $sw.Elapsed.TotalSeconds)
  Remove-Item $jobFile -Force -ErrorAction SilentlyContinue
}
$idx = 0
if (-not $useLegacy) { $mmList = @() } else { $mmList = $rx.Matches($md) }
foreach ($mm in $mmList) {
  $idx++
  $code = $mm.Groups[1].Value.Trim()
  $html = @"
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<style>body{margin:0;padding:16px;background:#fff;display:inline-block}.mermaid{font-family:"Microsoft YaHei",sans-serif}</style>
<script src="$mermaidSrc"></script></head>
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

# --- table guard: pandoc only treats a pipe table as a table when a blank line precedes it.
#     A table right under "**4.4.8.4.1.3 字段规范**  " (hard break, no blank line) is swallowed
#     into that paragraph and shows in Word as a run of "|" text (user caught it 2026-10-28).
$md = [regex]::Replace($md, '(?m)^(?!\s*\|)(.*\S.*)\r?\n(?=\|)', "`$1`n`n")

# --- pandoc -> docx (resource-path lets relative images embed) ---
$tmpMd = Join-Path $dir ('_docxsrc_' + (Get-Random) + '.md')
[IO.File]::WriteAllText($tmpMd, $md, (New-Object System.Text.UTF8Encoding($false)))
# Gotcha: an existing docx open in Word/WPS makes pandoc fail with "permission denied".
# Existence alone is NOT proof of success (the stale file is still there), so compare mtime
# before/after AND check the exit code - otherwise a failed run reports "Done" and the user
# ships a docx that silently lacks the latest edits.
$before = if (Test-Path $OutDocx) { (Get-Item $OutDocx).LastWriteTimeUtc } else { [datetime]::MinValue }
# Default Word layout (user rule 2026-11-05): Microsoft YaHei, body 10.5pt. Single source: skills\prd\prd-reference.docx
$refArgs = @()
$refDoc = Join-Path $PSScriptRoot '..\prd\prd-reference.docx'
if (Test-Path $refDoc) { $refArgs = @("--reference-doc=$((Resolve-Path $refDoc).Path)") }
# No italic anywhere (user rule 2026-11-05): markdown emphasis is output upright
$noItalic = Join-Path $PSScriptRoot '..\prd\prd-no-italic.lua'
if (Test-Path $noItalic) { $refArgs += "--lua-filter=$((Resolve-Path $noItalic).Path)"; $refArgs += $(if ((pandoc --help | Out-String) -match 'syntax-highlighting') { '--syntax-highlighting=none' } else { '--no-highlight' }) }   # code colouring adds italic token styles
# md already opens with its own "# H1" (PRD 规范的文档标题) -> don't add a second title on top
if ($md -match '^\s*# \S') { pandoc "$tmpMd" -o "$OutDocx" --resource-path="$dir" @refArgs }
else { pandoc "$tmpMd" -o "$OutDocx" --resource-path="$dir" --metadata title="$Title" @refArgs }
$code = $LASTEXITCODE
Start-Sleep -Seconds 1
Remove-Item $tmpMd -Force -ErrorAction SilentlyContinue
$after = if (Test-Path $OutDocx) { (Get-Item $OutDocx).LastWriteTimeUtc } else { [datetime]::MinValue }

if ($code -eq 0 -and $after -gt $before) {
  Write-Output ("Done -> {0}  ({1} MB)" -f $OutDocx, [math]::Round((Get-Item $OutDocx).Length/1MB,2))
  if (Test-Path $guard) { node "$guard" stamp "$OutDocx" "$InputMd" }   # fingerprint of the generated docx; a later mismatch = the user edited the Word
  Write-Output "Note: original .md kept unchanged (live mermaid preserved); only the docx uses rendered flow images."
  # PRD format gate right after conversion (F11 opens the docx and counts real tables) - not left to memory
  $lint = Join-Path $PSScriptRoot '..\prd\qa\prd-structure-lint.js'
  # Standard template = fixed chapters 1-4 only; a doc with chapter 5+ is a custom structure (2026-11-06 fix: it used to get the full template gate)
  if ((Test-Path $lint) -and ($md -match '(?m)^## 4 ') -and ($md -notmatch '(?m)^## ([5-9]|\d\d) ')) { node "$lint" "$InputMd"; if ($LASTEXITCODE -ne 0) { Write-Output "PRD format check FAILED - fix the md and convert again before delivering."; exit 2 } }
  # Not written to the standard template (or free text the user asked for): the writing rules still apply (user rule 2026-11-06)
  elseif (Test-Path $lint) { node "$lint" "$InputMd" --writing-only; if ($LASTEXITCODE -ne 0) { Write-Output "PRD writing check FAILED - fix the md and convert again before delivering."; exit 2 } }
} else {
  Write-Output ("FAILED -> pandoc exit {0}; '{1}' was NOT updated." -f $code, $OutDocx)
  Write-Output "Most likely the docx is open in Word/WPS (file lock). Close it and re-run."
  exit 1
}
