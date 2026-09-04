Write-Host "Starting PRD Sync Server..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
node server.js
