param(
  [string]$DbContainer = "iga_portal_db",
  [string]$Database = "iga_portal",
  [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"

$sqlPath = Join-Path $PSScriptRoot "validate-legacy-schema.sql"
if (-not (Test-Path $sqlPath)) {
  throw "SQL file not found: $sqlPath"
}

Write-Host "Validating required legacy tables/columns..."
Get-Content -Path $sqlPath -Raw -Encoding UTF8 |
  docker exec -i $DbContainer psql -U $User -d $Database -v ON_ERROR_STOP=1 -P pager=off
Write-Host "Legacy schema preflight passed."
