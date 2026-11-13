# make-offline.ps1
#
# Convert any online prototype HTML (using unpkg.com CDN) into a fully offline single-file HTML.
# All 4 CDN resources (Vue, Element Plus JS/CSS, Icons) are downloaded and inlined.
# Output is ~1.6 MB single file that opens on any machine, no network needed.
#
# Usage:
#   .\make-offline.ps1 -InputHtml "C:\path\to\prototype.html"
#   .\make-offline.ps1 -InputHtml "C:\path\to\prototype.html" -OutputHtml "C:\path\to\prototype-offline.html"
#
# Default output adds "-offline" suffix to input filename.

param(
  [Parameter(Mandatory=$true)][string]$InputHtml,
  [string]$OutputHtml = ""
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InputHtml)) {
  Write-Error "Input file not found: $InputHtml"
  exit 1
}

if ([string]::IsNullOrEmpty($OutputHtml)) {
  $dir = Split-Path -Parent $InputHtml
  $name = [System.IO.Path]::GetFileNameWithoutExtension($InputHtml)
  $OutputHtml = Join-Path $dir "$name-offline.html"
}

# Step 1: Download 4 CDN resources to a temp dir (absolute path to avoid $env:TEMP edge cases)
$tmp = Join-Path (Split-Path -Parent $OutputHtml) ("_vendor_tmp_" + (Get-Random))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# Fixed versions. Sync with prototype-template.md when bumping.
$resources = @(
  @{ key='vue';       url='https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js';                    file='vue.js'    }
  @{ key='ep_css';    url='https://unpkg.com/element-plus@2.6.3/dist/index.css';                    file='ep.css'    }
  @{ key='ep_js';     url='https://unpkg.com/element-plus@2.6.3/dist/index.full.min.js';            file='ep.js'     }
  @{ key='icons';     url='https://unpkg.com/@element-plus/icons-vue@2.3.1/dist/index.iife.min.js'; file='icons.js'  }
  @{ key='ep_locale'; url='https://unpkg.com/element-plus@2.6.3/dist/locale/zh-cn.min.js';          file='eploc.js'  }
)

# These files never change for a fixed version, yet re-downloading them on every rebuild cost ~190s
# on a slow link (measured 2026-09-16) - that was 95% of the whole rebuild, regardless of what changed.
# So they are SHIPPED in vendor/ (in the repo, ~1.75 MB) and read from there: a fresh install is fast
# on the very first run and works with no network at all. Keyed by URL via a "<file>.url" marker -
# bumping a version changes the URL, the marker mismatches, and the file is re-downloaded into vendor/.
$vendorCache = Join-Path $PSScriptRoot "vendor"
New-Item -ItemType Directory -Force -Path $vendorCache | Out-Null

Write-Output "=== Collecting 5 CDN resources (local cache first) ==="
$contents = @{}
$hit = 0
foreach ($r in $resources) {
  $localPath = Join-Path $tmp $r.file
  $cached    = Join-Path $vendorCache $r.file
  $marker    = "$cached.url"
  $cachedUrl = ''
  if (Test-Path $marker) { $cachedUrl = (Get-Content -Raw -Encoding UTF8 $marker).Trim() }
  $usable = (Test-Path $cached) -and ((Get-Item $cached).Length -gt 1000) -and ($cachedUrl -eq $r.url)
  try {
    if ($usable) {
      $bytes = [System.IO.File]::ReadAllBytes($cached)
      $contents[$r.key] = [System.Text.Encoding]::UTF8.GetString($bytes)
      $size_kb = [math]::Round($bytes.Length / 1KB, 1)
      Write-Output ("  CACHE " + $r.key + ": " + $size_kb + " KB")
      $hit++
    } else {
      Invoke-WebRequest -Uri $r.url -UseBasicParsing -OutFile $localPath -TimeoutSec 60
      $bytes = [System.IO.File]::ReadAllBytes($localPath)
      $contents[$r.key] = [System.Text.Encoding]::UTF8.GetString($bytes)
      $size_kb = [math]::Round($bytes.Length / 1KB, 1)
      Write-Output ("  DOWNLOAD " + $r.key + ": " + $size_kb + " KB")
      # Save into the shared cache so the next rebuild (and the QA gates) skip the network
      Copy-Item $localPath $cached -Force
      Set-Content -Path $marker -Value $r.url -Encoding UTF8 -NoNewline
    }
  } catch {
    Write-Error ("Download failed: " + $r.url + " - " + $_.Exception.Message)
    Get-ChildItem $tmp -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    exit 1
  }
}

# Step 2: Read online HTML
Write-Output ""
Write-Output "=== Reading online HTML ==="
$html = [System.IO.File]::ReadAllText($InputHtml, [System.Text.UTF8Encoding]::new($true))
$origSize_kb = [math]::Round([System.Text.Encoding]::UTF8.GetBytes($html).Length / 1KB, 1)
Write-Output ("  Original size: " + $origSize_kb + " KB")

# Step 3: Use .Replace (literal) to avoid regex $-char issues
# Each marker lists several 'old' tag variants (装配器 skeleton 固定版本；手搓版可能用不带版本号的 unpkg URL / 自闭合 /> / 多 locale 包——全认)
$markers = @(
  @{ key='vue';       olds=@('<script src="https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js"></script>',
                             '<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>')                        }
  @{ key='ep_css';    olds=@('<link rel="stylesheet" href="https://unpkg.com/element-plus@2.6.3/dist/index.css">',
                             '<link rel="stylesheet" href="https://unpkg.com/element-plus@2.6.3/dist/index.css" />',
                             '<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">',
                             '<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />')                 }
  @{ key='ep_js';     olds=@('<script src="https://unpkg.com/element-plus@2.6.3/dist/index.full.min.js"></script>',
                             '<script src="https://unpkg.com/element-plus/dist/index.full.min.js"></script>')                  }
  @{ key='icons';     olds=@('<script src="https://unpkg.com/@element-plus/icons-vue@2.3.1/dist/index.iife.min.js"></script>',
                             '<script src="https://unpkg.com/@element-plus/icons-vue"></script>')                              }
  @{ key='ep_locale'; olds=@('<script src="https://unpkg.com/element-plus@2.6.3/dist/locale/zh-cn.min.js"></script>',
                             '<script src="https://unpkg.com/element-plus/dist/locale/zh-cn.min.js"></script>')                }
)

Write-Output ""
Write-Output "=== Inlining 4 resources ==="
$replaceCount = 0
foreach ($m in $markers) {
  $key = $m.key
  $matchedTag = $null
  foreach ($cand in $m.olds) { if ($html.Contains($cand)) { $matchedTag = $cand; break } }
  if ($matchedTag) {
    if ($key -eq 'ep_css') {
      $newTag = "<style>`n/* " + $key + " inlined */`n" + $contents[$key] + "`n</style>"
    } else {
      $newTag = "<script>`n/* " + $key + " inlined */`n" + $contents[$key] + "`n</script>"
    }
    $html = $html.Replace($matchedTag, $newTag)
    Write-Output ("  OK replaced: " + $key)
    $replaceCount++
  } else {
    Write-Warning ("  ! Tag not found for: " + $key + " (prototype may not use this dependency)")
  }
}

# Step 4: Write offline HTML (UTF-8 with BOM keeps Chinese chars intact)
[System.IO.File]::WriteAllText($OutputHtml, $html, [System.Text.UTF8Encoding]::new($true))

$finalSize_mb = [math]::Round((Get-Item $OutputHtml).Length / 1MB, 2)
$finalSize_kb = [math]::Round((Get-Item $OutputHtml).Length / 1KB, 1)

Write-Output ""
Write-Output "=== Done ==="
Write-Output ("  Output: " + $OutputHtml)
Write-Output ("  Size: " + $finalSize_kb + " KB (" + $finalSize_mb + " MB)")
Write-Output ("  Replacements: " + $replaceCount + " / 4")
Write-Output ""
Write-Output "Now this file can be sent to anyone (CN/intl, online/offline). Double-click to open."

# Step 5: Cleanup tmp
Get-ChildItem $tmp -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
