param([switch]$Installer)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$localCargo = Join-Path $PSScriptRoot '.tools\cargo'
if (Test-Path -LiteralPath (Join-Path $localCargo 'bin\cargo.exe')) {
    $env:CARGO_HOME = $localCargo
    $env:RUSTUP_HOME = Join-Path $PSScriptRoot '.tools\rustup'
    $env:PATH = (Join-Path $localCargo 'bin') + ';' + $env:PATH
}
if ($Installer) { & npm.cmd run tauri -- build --bundles nsis } else { & npm.cmd run tauri -- build --no-bundle }
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Check Rust, WebView2 and Visual Studio C++ Build Tools.' }
Write-Host "Desktop executable: $PSScriptRoot\src-tauri\target\release\yeran.exe" -ForegroundColor Green
