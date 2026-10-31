param([string[]]$Tests=@('verify-native-10.mjs'),[string]$Executable='src-tauri/target/release/yeran.exe')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$exe=(Resolve-Path -LiteralPath $Executable).Path
if(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }) { throw 'The selected test executable is already running. Close that test instance first.' }
$run=Join-Path $projectRoot ('.oil-ui/native-'+[DateTimeOffset]::Now.ToUnixTimeMilliseconds())
New-Item -Path $run -ItemType Directory -Force | Out-Null
$port=9236
foreach($test in $Tests){
 $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$port"
 $env:WEBVIEW2_USER_DATA_FOLDER=Join-Path $run ($test.Replace('.mjs',''))
 $env:YERAN_CDP_URL="http://127.0.0.1:$port"
 $env:YERAN_NATIVE_URL='http://tauri.localhost'
 $env:YERAN_TEST_EXECUTABLE=$exe
 $p=Start-Process -FilePath $exe -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
 Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER
 try{& node (Join-Path $PSScriptRoot $test) 2>&1 | Tee-Object -FilePath (Join-Path $run ($test+'.log'));if($LASTEXITCODE -ne 0){throw "$test failed with $LASTEXITCODE"}}
 finally{$owned=Get-Process -Id $p.Id -ErrorAction SilentlyContinue;if($owned -and $owned.Path -eq $exe){Stop-Process -Id $p.Id}}
 $port++
}
Write-Output "Logs: $run"
