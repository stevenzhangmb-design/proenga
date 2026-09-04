# Regression invariant checker for PM prototype annotation layer (static, no browser).
# Pure ASCII + \u escapes -> encoding-proof. Asserts structural root-fixes (regression-test-cases.md).
# Usage: powershell -ExecutionPolicy Bypass -File regression-check.ps1 -InputHtml "<prototype>.html"
param([Parameter(Mandatory=$true)][string]$InputHtml)

if (-not (Test-Path $InputHtml)) { Write-Host "ERROR: file not found: $InputHtml"; exit 2 }
$html = Get-Content -Raw -Encoding UTF8 $InputHtml
$script:fail = 0
function Pass($id,$msg){ Write-Host ("PASS  {0}  {1}" -f $id,$msg) }
function Fail($id,$msg){ Write-Host ("FAIL  {0}  {1}" -f $id,$msg); $script:fail++ }

Write-Host "=== Regression Invariant Check (static) ==="
Write-Host ("Prototype : {0}" -f $InputHtml)
Write-Host ""

# RT-06: no fuzzy function-point matching (structural root-fix). prdMatch must NOT call _matchPrdFp.
if ($html -match '_matchPrdFp\(zn\)') {
  Fail "RT-06" "fuzzy matching STILL active: prdMatch calls _matchPrdFp(zn)"
} elseif ($html -match 'boundFp\s*&&\s*PRD\.function_points\s*&&\s*PRD\.function_points\[boundFp\]') {
  Pass "RT-06" "exact-binding-only: prdMatch uses boundFp, no name-based fuzzy match"
} else {
  Fail "RT-06" "could not confirm exact-binding-only prdMatch"
}

# RT-05: frame capture collects real zoneHTML + precise fpKey from data-annotation.
if (($html -match 'zoneHTML\s*=\s*\[\.\.\._zoneCards\]') -and ($html -match 'const fpKey = \(_zoneCards\.size === 1')) {
  Pass "RT-05" "frame capture: real zoneHTML + precise fpKey"
} else {
  Fail "RT-05" "frame capture (zoneHTML / fpKey) not found"
}

# RT-01: home account card bound to the DISPLAY fp (account-balance-OMS.home-top), not the list-query fp.
# \u escapes: 璐︽埛浣欓-OMS.棣栭〉鍙充晶椤堕儴  ->  account-balance-OMS.home-right-top
$homeFp = '账户余额-OMS\.首页右侧顶部'
if ($html -match ("data-annotation=['" + '"' + "]" + $homeFp + "['" + '"' + "]")) {
  Pass "RT-01" "home account card bound to display fp (not list-query)"
} else {
  Fail "RT-01" "home account card display-fp binding missing"
}

# COV: every function_points key has a data-annotation binding (precise-binding precondition).
$fpKeys = [System.Collections.Generic.HashSet[string]]::new()
foreach ($m in [regex]::Matches($html, '"([^"\\]+-(?:OMS|WMS)\.[^"\\]+)"\s*:\s*\{')) { [void]$fpKeys.Add($m.Groups[1].Value) }
$missing = @()
foreach ($k in $fpKeys) {
  if (($html -notmatch [regex]::Escape("data-annotation='$k'")) -and ($html -notmatch [regex]::Escape('data-annotation="' + $k + '"'))) { $missing += $k }
}
if (($fpKeys.Count -gt 0) -and ($missing.Count -eq 0)) {
  Pass "COV" ("data-annotation coverage 100% ({0}/{0})" -f $fpKeys.Count)
} else {
  Fail "COV" ("coverage gap {0}/{1} -> {2}" -f $missing.Count, $fpKeys.Count, ($missing -join ', '))
}

Write-Host ""
Write-Host "NOTE: RT-02/03 (region naming / dashboard grouping) and RT-04 (OMS/WMS wording) are runtime/content"
Write-Host "      checks -> covered by AI second-pass self-check (rule A) + Playwright (when set up)."
Write-Host ""
if ($script:fail -eq 0) { Write-Host "RESULT: ALL PASS"; exit 0 } else { Write-Host ("RESULT: {0} FAILED" -f $script:fail); exit 1 }
