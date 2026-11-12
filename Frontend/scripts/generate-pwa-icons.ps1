# ============================================================
#  scripts/generate-pwa-icons.ps1  (wave 13.24)
# ------------------------------------------------------------
#  Builds the PWA icons from the company logo.
#  Why a script and not a build step? The project has no image
#  library (no sharp / canvas / ImageMagick), so the PNG files are
#  generated ONCE and committed under src/assets/images/pwa/.
#
#  Requires: Windows PowerShell 5.1 + System.Drawing (built-in)
#  Usage (from Frontend/):
#     powershell -ExecutionPolicy Bypass -File scripts\generate-pwa-icons.ps1
#
#  Output:
#     icon-192.png            192x192  purpose "any"
#     icon-512.png            512x512  purpose "any"
#     icon-maskable-512.png   512x512  purpose "maskable" (extra padding)
#     apple-touch-icon-180.png 180x180 (iOS home screen)
#
#  NOTE: ASCII-only on purpose (PowerShell 5.1 encoding safety,
#        same rule as tools/gate.ps1).
# ============================================================
param(
  [string]$Source = '',
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$frontend = Split-Path -Parent $PSScriptRoot
if (-not $Source) { $Source = Join-Path $frontend 'src\assets\images\skb-logo.png' }
if (-not $OutDir) { $OutDir = Join-Path $frontend 'src\assets\images\pwa' }

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Logo not found: $Source"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Theme color of the portal (same as manifest theme_color)
$BACKGROUND = [System.Drawing.Color]::FromArgb(255, 44, 122, 110)
# The logo is dark text on transparent, so it needs a light plate on top
# of the brand color - otherwise the mark is barely readable at 48-192 px.
$PLATE = [System.Drawing.Color]::FromArgb(255, 248, 250, 252)

$script:logo = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)
Write-Output "Source logo: $($script:logo.Width)x$($script:logo.Height)"

function New-PwaIcon {
  param(
    [int]$Size,
    [double]$PlateRatio,
    [double]$LogoRatio,
    [string]$FileName
  )

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgBrush = New-Object System.Drawing.SolidBrush($BACKGROUND)
  $graphics.FillRectangle($bgBrush, 0, 0, $Size, $Size)
  $bgBrush.Dispose()

  # Light circular plate behind the logo
  $plateSize = [int][Math]::Round($Size * $PlateRatio)
  $plateX = [int][Math]::Round(($Size - $plateSize) / 2)
  $plateBrush = New-Object System.Drawing.SolidBrush($PLATE)
  $graphics.FillEllipse($plateBrush, $plateX, $plateX, $plateSize, $plateSize)
  $plateBrush.Dispose()

  $targetW = [int][Math]::Round($Size * $LogoRatio)
  $targetH = [int][Math]::Round($targetW * $script:logo.Height / $script:logo.Width)
  $x = [int][Math]::Round(($Size - $targetW) / 2)
  $y = [int][Math]::Round(($Size - $targetH) / 2)

  $dest = New-Object System.Drawing.Rectangle($x, $y, $targetW, $targetH)
  $graphics.DrawImage($script:logo, $dest)

  $graphics.Dispose()

  $path = Join-Path $OutDir $FileName
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = (Get-Item -LiteralPath $path).Length
  $bmp.Dispose()

  Write-Output ("  {0,-24} {1}x{1}  {2} bytes" -f $FileName, $Size, $bytes)
}

# "any": plate 82%, logo 60% of the canvas
New-PwaIcon -Size 192 -PlateRatio 0.82 -LogoRatio 0.60 -FileName 'icon-192.png'
New-PwaIcon -Size 512 -PlateRatio 0.82 -LogoRatio 0.60 -FileName 'icon-512.png'
# Maskable safe zone is the inner 80% circle => smaller plate and logo
New-PwaIcon -Size 512 -PlateRatio 0.72 -LogoRatio 0.50 -FileName 'icon-maskable-512.png'
New-PwaIcon -Size 180 -PlateRatio 0.82 -LogoRatio 0.60 -FileName 'apple-touch-icon-180.png'

$script:logo.Dispose()
Write-Output "Done. Icons written to: $OutDir"
