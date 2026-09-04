# check-annotation-coverage.ps1
# Verifies every function point in window.__PRD_DATA__ has an exact
# data-annotation binding in the prototype HTML.
# Usage:
#   & .\check-annotation-coverage.ps1 -InputHtml "path\to\prototype.html"

param(
    [Parameter(Mandatory = $true)]
    [string]$InputHtml
)

if (-not (Test-Path -LiteralPath $InputHtml)) {
    Write-Host "ERROR: input HTML not found: $InputHtml" -ForegroundColor Red
    exit 2
}

# Read full file as a single string
$html = Get-Content -LiteralPath $InputHtml -Raw -Encoding UTF8

# Locate window.__PRD_DATA__ block
$prdIdx = $html.IndexOf("window.__PRD_DATA__")
if ($prdIdx -lt 0) {
    Write-Host "ERROR: window.__PRD_DATA__ not found in HTML." -ForegroundColor Red
    exit 2
}

# Find the function_points object within the PRD data
$fpIdx = $html.IndexOf("function_points", $prdIdx)
if ($fpIdx -lt 0) {
    Write-Host "ERROR: function_points object not found in window.__PRD_DATA__." -ForegroundColor Red
    exit 2
}

# Scope the search to the region starting at function_points
$fpRegion = $html.Substring($fpIdx)

# Extract function point keys: a quoted string immediately followed by ':' and '{'
# Real function point keys follow the "menu-view.action" shape, e.g.
#   "充值管理-WMS.充值": {   /   "account-balance-OMS.query": {
# They always contain a '.' separating the menu-view part from the action,
# which distinguishes them from nested sub-objects like
# field_specs / use_cases / message_notifications / operation_log.
$keyPattern = '"([^"\r\n]*\.[^"\r\n]*)"\s*:\s*\{'
$matches = [System.Text.RegularExpressions.Regex]::Matches($fpRegion, $keyPattern)

# Collect unique keys, preserving order
$keys = New-Object System.Collections.Generic.List[string]
$seen = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $matches) {
    $k = $m.Groups[1].Value
    if ($seen.Add($k)) {
        $keys.Add($k) | Out-Null
    }
}

$total = $keys.Count

if ($total -eq 0) {
    Write-Host "WARN: no function point keys extracted from function_points." -ForegroundColor Yellow
    exit 2
}

# Check each key for an exact data-annotation binding (single or double quoted)
$missing = New-Object System.Collections.Generic.List[string]
$bound = 0
foreach ($k in $keys) {
    $needleSingle = "data-annotation='" + $k + "'"
    $needleDouble = 'data-annotation="' + $k + '"'
    if ($html.Contains($needleSingle) -or $html.Contains($needleDouble)) {
        $bound++
    } else {
        $missing.Add($k) | Out-Null
    }
}

$coverage = [math]::Round(($bound / $total) * 100, 2)

Write-Host ""
Write-Host "=== Annotation Coverage Check ===" -ForegroundColor Cyan
Write-Host "Prototype : $InputHtml"
Write-Host "Total function points : $total"
Write-Host "Bound (data-annotation): $bound"
Write-Host "Missing               : $($missing.Count)"
Write-Host "Coverage              : $coverage%"
Write-Host ""

if ($missing.Count -eq 0) {
    Write-Host "PASS: 100% coverage" -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAIL: coverage gaps detected" -ForegroundColor Red
    Write-Host "--- Missing data-annotation bindings ---" -ForegroundColor Red
    foreach ($k in $missing) {
        Write-Host "  - $k"
    }
    exit 1
}
