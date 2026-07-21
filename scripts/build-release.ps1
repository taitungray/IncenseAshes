param(
  [string]$VersionName = "",
  [string]$VersionCode = ""
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AndroidDir = Join-Path $Root "android"
$BuildToolsDir = Join-Path $Root ".build-tools"
$JdkZip = Join-Path $BuildToolsDir "temurin17.zip"
$JdkDir = Join-Path $BuildToolsDir "jdk17"
$SdkZip = Join-Path $BuildToolsDir "android-commandlinetools.zip"
$SdkDir = Join-Path $BuildToolsDir "android-sdk"
$SdkManager = Join-Path $SdkDir "cmdline-tools\latest\bin\sdkmanager.bat"
$LocalProperties = Join-Path $AndroidDir "local.properties"
$LocalPropertiesBackup = $null

function Write-Step($Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-Checked($Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
  }
}

function Wait-ForFile($Path, $Label) {
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $Path) {
      return (Resolve-Path $Path).Path
    }
    Start-Sleep -Milliseconds 500
  }
  throw "$Label was not generated: $Path"
}

function Download-WithNode($Url, $OutFile) {
  $script = @"
const https = require('https');
const fs = require('fs');
const url = process.argv[1];
const out = process.argv[2];
function get(u) {
  https.get(u, { rejectUnauthorized: false }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return get(res.headers.location);
    if (res.statusCode !== 200) {
      console.error('HTTP ' + res.statusCode);
      process.exit(1);
    }
    const f = fs.createWriteStream(out);
    f.on('error', (e) => { console.error(e); process.exit(1); });
    res.pipe(f);
    f.on('finish', () => f.close(() => process.exit(0)));
  }).on('error', (e) => { console.error(e); process.exit(1); });
}
get(url);
"@
  node -e $script $Url $OutFile
}

function Get-JdkHome {
  $existing = Get-ChildItem -Path $JdkDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
    Select-Object -First 1
  if ($existing) {
    return $existing.FullName
  }

  New-Item -ItemType Directory -Force -Path $BuildToolsDir | Out-Null

  Write-Step "Download JDK 17"
  Download-WithNode `
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk" `
    $JdkZip

  Write-Step "Extract JDK 17"
  New-Item -ItemType Directory -Force -Path $JdkDir | Out-Null
  Expand-Archive -Path $JdkZip -DestinationPath $JdkDir -Force

  $installed = Get-ChildItem -Path $JdkDir -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
    Select-Object -First 1
  if (-not $installed) {
    throw "Cannot find JDK 17 java.exe"
  }
  return $installed.FullName
}

function Ensure-AndroidSdk {
  if (-not (Test-Path $SdkManager)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $SdkDir "cmdline-tools") | Out-Null

    Write-Step "Download Android command-line tools"
    Download-WithNode `
      "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" `
      $SdkZip

    Write-Step "Extract Android command-line tools"
    $ExtractDir = Join-Path $SdkDir "cmdline-tools\extract"
    Expand-Archive -Path $SdkZip -DestinationPath $ExtractDir -Force
    Move-Item -LiteralPath (Join-Path $ExtractDir "cmdline-tools") -Destination (Join-Path $SdkDir "cmdline-tools\latest")
  }

  Write-Step "Accept SDK Licenses"
  $env:ANDROID_HOME = $SdkDir
  $env:ANDROID_SDK_ROOT = $SdkDir
  1..30 | ForEach-Object { "y" } | & $SdkManager --licenses | Out-Host

  Write-Step "Install Android SDK 36 Components"
  & $SdkManager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
}

function Set-LocalSdkDir {
  $escapedSdk = $SdkDir.Replace("\", "\\").Replace(":", "\:")
  if (Test-Path $LocalProperties) {
    $script:LocalPropertiesBackup = Get-Content $LocalProperties -Raw
  }
  Set-Content -Path $LocalProperties -Value "sdk.dir=$escapedSdk" -Encoding ASCII
}

function Restore-LocalSdkDir {
  if ($null -ne $script:LocalPropertiesBackup) {
    Set-Content -Path $LocalProperties -Value $script:LocalPropertiesBackup -NoNewline
  }
}

try {
  Set-Location $Root

  # Update build.gradle with the specified VersionName and VersionCode
  $GradleFile = Join-Path $AndroidDir "app\build.gradle"
  if (Test-Path $GradleFile) {
    $GradleContent = Get-Content $GradleFile -Raw
    
    $currentCode = 0
    if ($GradleContent -match 'versionCode\s+(\d+)') {
      $currentCode = [int]$Matches[1]
    }
    $currentName = ""
    if ($GradleContent -match 'versionName\s+"([^"]+)"') {
      $currentName = $Matches[1]
    }

    $finalName = if ($VersionName -ne "") { $VersionName } else { $currentName }
    $finalCode = if ($VersionCode -ne "" -and $VersionCode -ne "0") { [int]$VersionCode } else { $currentCode }

    Write-Step "Updating App Version in build.gradle to Name: $finalName, Code: $finalCode"
    $GradleContent = $GradleContent -replace 'versionCode\s+\d+', "versionCode $finalCode"
    $GradleContent = $GradleContent -replace 'versionName\s+"[^"]+"', "versionName `"$finalName`""
    [System.IO.File]::WriteAllText($GradleFile, $GradleContent, (New-Object System.Text.UTF8Encoding($false)))
    
    # Update local parameter for filenames
    $VersionName = $finalName
  }

  $JdkHome = Get-JdkHome
  $env:JAVA_HOME = $JdkHome
  $env:PATH = (Join-Path $JdkHome "bin") + ";" + $env:PATH

  Ensure-AndroidSdk

  Write-Step "Build Web assets"
  Invoke-Checked "node" @("build.js")

  Write-Step "Sync Capacitor Android"
  Invoke-Checked "npx.cmd" @("cap", "sync", "android")

  $KeystorePath = Join-Path $Root "release.keystore"
  if (-not (Test-Path $KeystorePath)) {
    Write-Step "Generating Release Keystore"
    & keytool -genkeypair -v -keystore $KeystorePath -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass "password" -keypass "password" -dname "CN=IncenseAshes, OU=Game, O=IncenseAshes, L=Unknown, ST=Unknown, C=TW"
  }
  
  $AndroidAppKeystore = Join-Path $AndroidDir "app\incense-release.keystore"
  Copy-Item -LiteralPath $KeystorePath -Destination $AndroidAppKeystore -Force

  Write-Step "Switch Android SDK Path"
  Set-LocalSdkDir

  Set-Location $AndroidDir

  Write-Step "Clean Gradle Cache and Build Intermediates"
  Invoke-Checked ".\gradlew.bat" @("clean")

  Write-Step "Build Signed Google Play AAB"
  Invoke-Checked ".\gradlew.bat" @("bundleRelease")

  Write-Step "Build Signed Mobile Test APK"
  Invoke-Checked ".\gradlew.bat" @("assembleRelease")

  Set-Location $Root

  $BuildsDir = Join-Path $Root "builds"
  New-Item -ItemType Directory -Force -Path $BuildsDir | Out-Null

  $AabSource = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
  $ApkSource = Join-Path $Root "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path $ApkSource)) {
    $ApkSource = Join-Path $Root "android\app\build\outputs\apk\release\app-release-unsigned.apk"
  }
  $AabDest = Join-Path $BuildsDir "incense-ashes-$VersionName-release.aab"
  $ApkDest = Join-Path $BuildsDir "incense-ashes-$VersionName-release.apk"

  Wait-ForFile $AabSource "Release AAB" | Out-Null
  Wait-ForFile $ApkSource "Release APK" | Out-Null

  Copy-Item -LiteralPath $AabSource -Destination $AabDest -Force
  Copy-Item -LiteralPath $ApkSource -Destination $ApkDest -Force

  Write-Step "Verify Signatures"
  $ApkSigner = Join-Path $SdkDir "build-tools\36.0.0\apksigner.bat"
  & $ApkSigner verify --verbose --print-certs $ApkDest

  Write-Step "Done"
  Get-ChildItem $AabDest, $ApkDest | Select-Object FullName, Length, LastWriteTime
  Get-FileHash $AabDest -Algorithm SHA256
  Get-FileHash $ApkDest -Algorithm SHA256
}
finally {
  Set-Location $Root
  Restore-LocalSdkDir
}
