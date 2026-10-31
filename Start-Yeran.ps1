$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$binary = Join-Path $PSScriptRoot 'release\Yeran-1.0.exe'
if (-not (Test-Path -LiteralPath $binary)) { $binary = Join-Path $PSScriptRoot 'src-tauri\target\release\yeran.exe' }
if (-not (Test-Path -LiteralPath $binary)) { throw 'Build the desktop app with Build-Desktop.ps1 first.' }
Start-Process -FilePath $binary -WindowStyle Hidden
