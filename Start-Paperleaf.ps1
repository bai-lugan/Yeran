$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$binary = Join-Path $PSScriptRoot 'release\Yeran-0.5.exe'
if (-not (Test-Path -LiteralPath $binary)) { $binary = Join-Path $PSScriptRoot 'src-tauri\target\release\yeran.exe' }
if (Test-Path -LiteralPath $binary) {
    Start-Process -FilePath $binary -WindowStyle Hidden
} else {
    Write-Host 'Starting browser development version: http://127.0.0.1:1420' -ForegroundColor Cyan
    Start-Process 'http://127.0.0.1:1420'
    & npm.cmd run dev
}