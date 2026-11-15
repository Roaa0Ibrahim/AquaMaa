# One-time setup on a laptop without the Android SDK, so build_and_run.bat can build and install the Pepper app.
# Needs Android Studio installed (for its Java runtime) and internet. No setup wizard needed.
#   Installs into %LOCALAPPDATA%\Android\Sdk: command-line tools, platform-tools (adb), Android 34, build-tools 34.
# Run:  powershell -ExecutionPolicy Bypass -File pepper\PepperWaterQuality\setup_android_sdk.ps1

$ErrorActionPreference = "Stop"
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path $jbr)) { throw "Android Studio's Java runtime not found at $jbr. Install Android Studio first." }
$env:JAVA_HOME = $jbr

$tools = Join-Path $sdk "cmdline-tools\latest"
if (-not (Test-Path (Join-Path $tools "bin\sdkmanager.bat"))) {
    $zip = Join-Path $env:TEMP "android-cmdline-tools.zip"
    Write-Host "Downloading the Android command-line tools..."
    Invoke-WebRequest "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zip
    $unpack = Join-Path $env:TEMP "android-cmdline-tools"
    if (Test-Path $unpack) { Remove-Item -Recurse -Force $unpack }
    Expand-Archive $zip $unpack
    New-Item -ItemType Directory -Force (Split-Path $tools) | Out-Null
    Move-Item (Join-Path $unpack "cmdline-tools") $tools
}
$sdkmanager = Join-Path $tools "bin\sdkmanager.bat"
Write-Host "Accepting the SDK licences..."
# Piping "y" into sdkmanager doesn't reach it from PowerShell (14 Nov), so the accepted-licence file is written
# directly, as build servers do
$licences = Join-Path $sdk "licenses"
New-Item -ItemType Directory -Force $licences | Out-Null
Set-Content -Encoding ascii (Join-Path $licences "android-sdk-license") `
    "`n24333f8a63b6825ea9c5514f83c2829b004d1fee`nd56f5187479451eabf01fb78af6dfcb131a6481e`n8933bad161af4178b1185d1a37fbf41ea5269c55"
Write-Host "Installing platform-tools (adb), Android 34 and build-tools 34 (a few minutes)..."
& $sdkmanager --sdk_root=$sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"
Write-Host "Done. adb: $(Join-Path $sdk 'platform-tools\adb.exe')"
