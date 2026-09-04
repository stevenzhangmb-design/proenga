# Setup script: Install Node.js (portable) + configure Playwright MCP for Claude Code
# No admin/UAC required. Run once after cloning this repo.
#
# Strategy: uses --executable-path to point @playwright/mcp at a Chrome binary you already
# have installed (Chrome / Edge / Puppeteer-downloaded Chrome). This avoids the browser
# download step that often fails silently on Windows paths with non-ASCII characters.

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Claude Code Playwright MCP Setup ===" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Node.js (portable zip, no UAC needed) ---
$nodeVer  = "24.16.0"
$nodeDest = "$env:LOCALAPPDATA\Programs\nodejs"
$nodeExe  = "$nodeDest\node.exe"

$nodeAlreadyOk = $false
if (Test-Path $nodeExe) {
    $ver = & $nodeExe --version 2>$null
    if ($ver -like "v$nodeVer*") { $nodeAlreadyOk = $true }
}
# Also check if node is already on PATH (installed by another method)
if (-not $nodeAlreadyOk) {
    $inPath = Get-Command node -ErrorAction SilentlyContinue
    if ($inPath) { $nodeAlreadyOk = $true; $nodeExe = $inPath.Source }
}

if ($nodeAlreadyOk) {
    Write-Host "[OK] Node.js already installed: $(& node --version 2>$null)" -ForegroundColor Green
} else {
    Write-Host "[1/3] Downloading Node.js $nodeVer (portable zip)..." -ForegroundColor Yellow
    $zip = "$env:TEMP\node-$nodeVer-win-x64.zip"
    $url = "https://nodejs.org/dist/v$nodeVer/node-v$nodeVer-win-x64.zip"
    try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    } catch {
        Write-Host "[ERROR] Download failed. Check your network connection." -ForegroundColor Red
        exit 1
    }

    Write-Host "[1/3] Extracting to $nodeDest ..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force $nodeDest | Out-Null
    $tmp = "$env:TEMP\node-extract"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    Copy-Item "$tmp\node-v$nodeVer-win-x64\*" $nodeDest -Recurse -Force
    Remove-Item $tmp -Recurse -Force
    Remove-Item $zip -Force

    # Add to user PATH
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$nodeDest*") {
        [Environment]::SetEnvironmentVariable("PATH", "$nodeDest;$userPath", "User")
    }
    $env:PATH = "$nodeDest;$env:PATH"

    Write-Host "[OK] Node.js installed: $($(&"$nodeDest\node.exe" --version))" -ForegroundColor Green
}

# Ensure nodeDest is in current session PATH
if ($env:PATH -notlike "*$nodeDest*") { $env:PATH = "$nodeDest;$env:PATH" }

# --- Step 2: Locate an existing Chrome / Edge binary ---
Write-Host "[2/3] Locating Chrome/Edge binary for --executable-path ..." -ForegroundColor Yellow

$chromeBinary = $null
$chromeCandidates = @(
    # System Chrome
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    # System Edge
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    # Puppeteer-downloaded Chrome (mermaid-cli etc.)
    "$env:USERPROFILE\AppData\Local\ms-playwright\chromium-*\chrome-win\chrome.exe",
    "$env:USERPROFILE\.cache\puppeteer\chrome\win64-*\chrome-win64\chrome.exe"
)

foreach ($candidate in $chromeCandidates) {
    # Support glob patterns
    $found = Get-Item $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $chromeBinary = $found.FullName; break }
}

if ($chromeBinary) {
    Write-Host "[OK] Found browser: $chromeBinary" -ForegroundColor Green
} else {
    Write-Host "[WARN] No Chrome/Edge found. @playwright/mcp will try to download its own browser." -ForegroundColor Yellow
    Write-Host "       If that fails, install Chrome and re-run this script." -ForegroundColor Yellow
}

# --- Step 3: Write Claude Code .mcp.json in the project root ---
Write-Host "[3/3] Writing .mcp.json in current directory ..." -ForegroundColor Yellow

$npxCmd = if (Test-Path "$nodeDest\npx.cmd") { "$nodeDest\npx.cmd" } else { "npx" }

if ($chromeBinary) {
    $mcpArgs = '["@playwright/mcp@latest", "--browser", "chromium", "--executable-path", "' + ($chromeBinary -replace '\\','\\') + '"]'
} else {
    $mcpArgs = '["@playwright/mcp@latest", "--browser", "chromium"]'
}

$mcpJson = @"
{
  "mcpServers": {
    "playwright": {
      "command": "$($npxCmd -replace '\\','\\')",
      "args": $mcpArgs,
      "env": {
        "PATH": "$($nodeDest -replace '\\','\\');C:\\Windows\\system32;C:\\Windows"
      }
    }
  }
}
"@

$mcpFile = Join-Path (Get-Location) '.mcp.json'
if (Test-Path $mcpFile) {
    $existing = Get-Content $mcpFile -Raw
    if ($existing -like "*playwright*") {
        Write-Host "[OK] .mcp.json already contains playwright entry — skipping overwrite." -ForegroundColor Green
    } else {
        Write-Host "[WARN] .mcp.json exists but has no playwright entry. Add manually:" -ForegroundColor Yellow
        Write-Host $mcpJson -ForegroundColor Gray
    }
} else {
    Set-Content -Path $mcpFile -Value $mcpJson -Encoding utf8
    Write-Host "[OK] .mcp.json written to $(Get-Location)" -ForegroundColor Green
}

# Also ensure enableAllProjectMcpServers is set in ~/.claude/settings.json
$settingsFile = "$env:USERPROFILE\.claude\settings.json"
if (Test-Path $settingsFile) {
    $settingsRaw = Get-Content $settingsFile -Raw
    if ($settingsRaw -notlike "*enableAllProjectMcpServers*") {
        Write-Host "[INFO] Adding enableAllProjectMcpServers to ~/.claude/settings.json ..." -ForegroundColor Yellow
        $settingsRaw = $settingsRaw.TrimEnd().TrimEnd('}') + ',' + "`n  `"enableAllProjectMcpServers`": true`n}"
        Set-Content -Path $settingsFile -Value $settingsRaw -Encoding utf8
        Write-Host "[OK] settings.json updated." -ForegroundColor Green
    }
}

# --- Done ---
Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Restart Claude Code (VSCode extension or CLI)." -ForegroundColor White
Write-Host "  2. Playwright MCP tools will appear automatically (mcp__playwright__*)." -ForegroundColor White
Write-Host "  3. Tell Claude: 'Open https://... and log in with account xxx / password xxx'" -ForegroundColor White
Write-Host ""
Write-Host "Tip: Claude can only save screenshots inside the project directory." -ForegroundColor Gray
Write-Host "     Ask Claude to save to e.g. d:\AI\ai-rules\screenshots\capture.png" -ForegroundColor Gray
Write-Host ""
