# Windows starter for the reel skill setup. It checks Node, then runs setup.mjs.
# Usage: powershell -ExecutionPolicy Bypass -File setup.ps1 [--check] [--skip-catalog]

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node is not installed. Install it with: winget install OpenJS.NodeJS.LTS"
  Write-Host "Then open a new PowerShell window and run setup again."
  exit 1
}

$major = [int](& node -p "process.versions.node.split('.')[0]")
if ($major -lt 22) {
  Write-Host "Node $(& node --version) is too old. Need 22 or later. Install with: winget install OpenJS.NodeJS.LTS"
  exit 1
}

& node (Join-Path $PSScriptRoot 'setup.mjs') @args
exit $LASTEXITCODE
