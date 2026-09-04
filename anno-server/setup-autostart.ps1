# setup-autostart.ps1 -- one-time: make anno-server auto-start (hidden) on Windows login.
# Path-relative (uses this script's own folder) -> works on ANY machine, ships with anno-server.
# Usage: right-click -> Run with PowerShell, OR tell the AI "config anno-server auto-start".
$vbs = Join-Path $PSScriptRoot 'start-anno-server.vbs'
if (-not (Test-Path $vbs)) { Write-Host "[X] start-anno-server.vbs not found next to this script."; exit 1 }
$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup 'anno-server.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = 'wscript.exe'
$sc.Arguments = '"' + $vbs + '"'
$sc.WindowStyle = 7
$sc.WorkingDirectory = $PSScriptRoot
$sc.Description = 'anno-server PRD sync service - auto start hidden on login'
$sc.Save()
Write-Host "[OK] Auto-start configured:"
Write-Host "     $lnk"
Write-Host "     -> wscript.exe `"$vbs`""
Write-Host "     anno-server will now start hidden every time you log in. No more 'start anno-server' errors."
