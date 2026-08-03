$ErrorActionPreference = 'Stop'

$connections = Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue
$processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)

foreach ($processId in $processIds) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 400

if (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue) {
  Write-Output 'Unable to stop the job tracker service.'
  exit 1
}

Write-Output 'Job tracker service stopped.'
