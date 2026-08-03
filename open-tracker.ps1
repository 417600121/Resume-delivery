param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$url = 'http://127.0.0.1:8766/'

function Test-TrackerServer {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-TrackerServer)) {
  & (Join-Path $env:WINDIR 'System32\wscript.exe') (Join-Path $PSScriptRoot 'run-server.vbs')

  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if (Test-TrackerServer) { break }
  }
}

if (-not $NoBrowser) {
  & (Join-Path $env:WINDIR 'System32\rundll32.exe') 'url.dll,FileProtocolHandler' $url
}
