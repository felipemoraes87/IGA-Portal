param(
  [string]$DbContainer = "iga_portal_db",
  [string]$Database = "iga_portal",
  [string]$User = "postgres",
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"

if (-not $SkipPreflight) {
  & (Join-Path $PSScriptRoot "validate-legacy-schema.ps1") -DbContainer $DbContainer -Database $Database -User $User
}

& (Join-Path $PSScriptRoot "sync-orchestrator-to-portal.ps1") -DbContainer $DbContainer -Database $Database -User $User
