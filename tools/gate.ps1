# =============================================================
#  Full gate runner (single versioned source of truth for the gate)
#
#  Usage (from anywhere):
#     powershell -ExecutionPolicy Bypass -File tools\gate.ps1
#     powershell -ExecutionPolicy Bypass -File tools\gate.ps1 -Skip lint
#     powershell -ExecutionPolicy Bypass -File tools\gate.ps1 -Root C:\path\to\repo
#       (-Root lets a copy of this runner gate ANY checkout, e.g. a merge
#        checkpoint whose tree does not contain tools/ yet)
#
#  Behaviour:
#   - Runs the ordered step list below, restricted to the steps that
#     actually exist in Frontend/package.json of the CURRENT tree, so the
#     same runner works on every merge checkpoint (older trees simply have
#     fewer steps).
#   - Logs each step to .gate-logs/<step>.txt, summary to .gate-logs/summary.txt
#   - Exit code 0 = every executed step green, 1 = at least one failure, 2 = abort.
#   - ASCII only on purpose: avoids PowerShell 5.1 encoding pitfalls for a
#     versioned file (see .gitattributes / docs/REVIEW-WAVE-3.md).
# =============================================================
param(
  [string[]]$Skip = @(),
  [string]$Root = ''
)

$ErrorActionPreference = 'Continue'

if ($Root) { $root = (Resolve-Path $Root).Path } else { $root = Split-Path -Parent $PSScriptRoot }
$fe = Join-Path $root 'Frontend'
$logs = Join-Path $root '.gate-logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$pkgPath = Join-Path $fe 'package.json'
if (-not (Test-Path $pkgPath)) {
  Write-Output "GATE-ABORT: package.json not found at $pkgPath"
  exit 2
}
$scripts = (Get-Content -Raw $pkgPath | ConvertFrom-Json).scripts.PSObject.Properties.Name

# Ordered gate steps. New waves append their guard at the end.
$steps = @(
  'lint',
  'test:cache', 'test:denied', 'test:toast',
  'test:weekly', 'test:weekly:report', 'test:weekly:groups', 'test:weekly:history',
  'test:weekly:history:body', 'test:weekly:cards:body',
  'test:weekly:surface', 'test:weekly:body',
  'test:halls:surface', 'test:halls:body', 'test:hatchery:body',
  'test:customer-fields', 'test:customer-detail',
  'test:hatchery-utils', 'test:hatchery-surface', 'test:dashboard-surface',
  'test:dashboard:bookmarks:body',
  'test:hatchery:sms-body',
  'test:chart-dashboard:body',
  'test:weekly:flock-report:body',
  'test:dashboard:sms-status:body',
  'test:chart-dashboard:all:body',
  'test:dashboard:setup-charts:body',
  'audit:size', 'audit:dead-exports', 'audit:surface', 'audit:big-methods'
)

$run = @()
foreach ($s in $steps) {
  if ($Skip -contains $s) { Write-Output "GATE-SKIP (requested)      :: $s"; continue }
  if ($scripts -notcontains $s) { Write-Output "GATE-SKIP (not in tree)    :: $s"; continue }
  $run += $s
}

Write-Output "GATE-START root=$root steps=$($run.Count) of $($steps.Count)"

Set-Location $fe
$summary = @()
$anyFail = $false

foreach ($step in $run) {
  $safe = ($step -replace '[:]', '_')
  $out = Join-Path $logs "$safe.txt"
  cmd /c "npm run $step > `"$out`" 2>&1"
  $code = $LASTEXITCODE
  $text = ''
  if (Test-Path $out) { $text = Get-Content -Raw $out }
  $pass = ([regex]::Matches($text, '(?m)^PASS - ')).Count
  $fail = ([regex]::Matches($text, '(?m)^FAIL - ')).Count
  if ($code -ne 0 -or $fail -ne 0) {
    $line = "**$step :: exit=$code pass=$pass fail=$fail**"
    $anyFail = $true
  } else {
    $line = "  $step :: exit=$code pass=$pass fail=$fail"
  }
  $summary += $line
  Write-Output $line
}

$summary | Set-Content -Encoding UTF8 (Join-Path $logs 'summary.txt')

if ($anyFail) {
  Write-Output 'GATE-FAIL'
  exit 1
}
Write-Output 'GATE-PASS'
exit 0
