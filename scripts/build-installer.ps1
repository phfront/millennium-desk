param(
  [switch]$Signed,
  [switch]$Unsigned,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($Signed -and $Unsigned) {
  throw "Use apenas -Signed ou -Unsigned, nao os dois."
}

$useSigned = if ($Unsigned) { $false } else { $true }

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $package.version

if (-not $SkipInstall) {
  Write-Host ">> npm install"
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$makeScript = if ($useSigned) { "make:signed" } else { "make" }
if ($useSigned) {
  Write-Host ">> Build assinado (Widevine/DRM) — necessario para Spotify e Netflix"
} else {
  Write-Host ">> AVISO: build SEM assinatura — Spotify pode pular musicas e Netflix nao reproduz"
}
Write-Host ">> npm run $makeScript"
npm run $makeScript
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$makeDir = Join-Path $root "out\make\squirrel.windows\x64"
if (-not (Test-Path $makeDir)) {
  throw "Pasta de build nao encontrada: $makeDir"
}

$setup = Get-ChildItem $makeDir -Filter "*Setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) {
  throw "Setup.exe nao encontrado em $makeDir"
}

$distDir = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

$stableName = "Millennium-Desk-Setup.exe"
$versionedName = "Millennium-Desk-$version-Setup.exe"
$stablePath = Join-Path $distDir $stableName
$versionedPath = Join-Path $distDir $versionedName

Copy-Item $setup.FullName $versionedPath -Force
Copy-Item $setup.FullName $stablePath -Force

$fileUrl = "file:///" + ($stablePath -replace "\\", "/" -replace " ", "%20")

Write-Host ""
Write-Host "BUILD_OK"
Write-Host "VERSION=$version"
Write-Host "SIGNED=$useSigned"
Write-Host "INSTALLER_PATH=$stablePath"
Write-Host "INSTALLER_VERSIONED=$versionedPath"
Write-Host "INSTALLER_URL=$fileUrl"
Write-Host "SOURCE_SETUP=$($setup.FullName)"
