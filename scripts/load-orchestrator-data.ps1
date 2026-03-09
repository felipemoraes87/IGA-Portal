param(
  [string]$DataDir = ".\\data",
  [string]$DbContainer = "iga_portal_db",
  [string]$Database = "iga_portal",
  [string]$User = "postgres",
  [switch]$SkipPortalSync
)

$ErrorActionPreference = "Stop"

$tables = @(
  "assignment",
  "business_roles",
  "organizational",
  "organizational_business_roles",
  "snapshot_br_users_match",
  "snapshot_user_entitlements_detailed",
  "softwares",
  "system_business_roles",
  "system_roles",
  "users"
)

Write-Host "Truncating orchestrator tables..."
$truncate = "TRUNCATE TABLE " + (($tables | ForEach-Object { '"' + $_ + '"' }) -join ", ") + " RESTART IDENTITY;"
docker exec -i $DbContainer psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $truncate | Out-Null

$importDir = "/tmp/orchestrator-import"
docker exec -i $DbContainer sh -lc "rm -rf $importDir && mkdir -p $importDir" | Out-Null

foreach ($table in $tables) {
  $file = Join-Path $DataDir ($table + ".csv")
  if (-not (Test-Path $file)) {
    throw "File not found: $file"
  }

  Write-Host "Loading $table from $file ..."
  $header = Get-Content -Path $file -TotalCount 1 -Encoding UTF8
  $columns = $header -split "," | ForEach-Object { $_.Trim().Trim('"') }
  $colList = ($columns | ForEach-Object { '"' + $_ + '"' }) -join ", "
  $containerFile = "$importDir/$table.csv"
  docker cp $file "${DbContainer}:$containerFile" | Out-Null
  $copyCmd = 'COPY "' + $table + '"(' + $colList + ") FROM '" + $containerFile + "' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
  docker exec -i $DbContainer psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $copyCmd | Out-Null
}

Write-Host "Load completed."
docker exec -i $DbContainer sh -lc "rm -rf $importDir" | Out-Null

if (-not $SkipPortalSync) {
  & (Join-Path $PSScriptRoot "sync-orchestrator-to-portal.ps1") -DbContainer $DbContainer -Database $Database -User $User
}
