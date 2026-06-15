param(
  [switch]$Unsigned,
  [switch]$NoInstall,
  [switch]$OpenFolder
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host ""
Write-Host "=== Millennium Desk - Release ===" -ForegroundColor Cyan
Write-Host ""

Write-Host ">> [1/4] Dependencias npm"
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $Unsigned) {
  Write-Host ""
  Write-Host ">> [2/4] EVS (Widevine / DRM)"
  py -3 -m pip install --upgrade castlabs-evs --quiet
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  py -3 -m castlabs_evs.account refresh 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Login EVS necessario (abre o navegador)..." -ForegroundColor Yellow
    py -3 -m castlabs_evs.account reauth
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    Write-Host "EVS OK (token renovado)"
  }
} else {
  Write-Host ""
  Write-Host ">> [2/4] EVS ignorado (build sem DRM)"
}

Write-Host ""
Write-Host ">> [3/4] Build do instalador"

$installerArgs = @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\build-installer.ps1"), "-SkipInstall")
if ($Unsigned) { $installerArgs += "-Unsigned" }

powershell @installerArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$distDir = Join-Path $root "dist"
$setupPath = Join-Path $distDir "Millennium-Desk-Setup.exe"
$fileUrl = "file:///" + ($setupPath -replace "\\", "/" -replace " ", "%20")

Write-Host ""
Write-Host ">> [4/4] Pronto" -ForegroundColor Green
Write-Host ""
Write-Host "Instalador:"
Write-Host $setupPath
Write-Host ""
Write-Host "Link:"
Write-Host $fileUrl

$running = Get-Process -Name "millennium-desk" -ErrorAction SilentlyContinue
if ($running) {
  Write-Host ""
  Write-Host "Feche o Millennium Desk antes de instalar." -ForegroundColor Yellow
}

if ($OpenFolder) {
  Start-Process explorer.exe $distDir
} elseif (-not $NoInstall) {
  Write-Host ""
  Write-Host "Abrindo instalador..."
  Start-Process $setupPath
}
