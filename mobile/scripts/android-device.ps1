param(
  [switch]$BuildOnly,
  [string]$DeviceId,
  [ValidateSet('arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86')][string]$Architecture,
  [string]$NodePath,
  [string]$JavaPath,
  [string]$SdkPath
)
$ErrorActionPreference = 'Stop'
$mobileSource = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $SdkPath) { $SdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' } }
$adb = Join-Path $SdkPath 'platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { throw 'Install Android Studio SDK/platform-tools or pass -SdkPath.' }
if (-not $NodePath) {
  $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  $NodePath = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node.exe -ErrorAction Stop).Source }
}
$version = [version]((& $NodePath --version).Trim().TrimStart('v'))
if (-not (($version.Major -eq 22 -and $version.Minor -ge 13) -or ($version.Major -eq 24 -and $version.Minor -ge 3) -or $version.Major -ge 25)) { throw 'Use Node 22.13+ or 24.3+; pass -NodePath to a supported node.exe.' }
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path $npmCommand) 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCli)) { throw 'Cannot locate npm-cli.js. Install Node with npm.' }
if (-not $JavaPath) {
  $installedJdk = 'C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot'
  $JavaPath = if (Test-Path -LiteralPath $installedJdk) { $installedJdk } else { $env:JAVA_HOME }
}
$java = Join-Path $JavaPath 'bin\java.exe'
if (-not (Test-Path -LiteralPath $java)) { throw 'Install JDK 17 and set JAVA_HOME or pass -JavaPath.' }
if (-not $BuildOnly) {
  $phones = @(& $adb devices | Where-Object { $_ -match '^([^\s]+)\s+device$' -and $_ -notmatch '^emulator-' } | ForEach-Object { ($_ -split '\s+')[0] })
  if (-not $DeviceId) {
    if ($phones.Count -ne 1) { throw 'Connect one Android phone using USB, enable USB debugging, accept its authorization prompt, or pass -DeviceId from adb devices.' }
    $DeviceId = $phones[0]
  }
  if ($DeviceId -notin $phones) { throw 'The selected Android phone is not connected and authorized.' }
  if (-not $Architecture) { $Architecture = (& $adb -s $DeviceId shell getprop ro.product.cpu.abi).Trim() }
}
if (-not $Architecture) { $Architecture = 'arm64-v8a' }
if ($Architecture -notin @('arm64-v8a','armeabi-v7a','x86_64','x86')) { throw "Unsupported Android ABI: $Architecture" }
$buildFolder = Join-Path $env:TEMP ('rsd-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
if ($buildFolder -match '[^\x00-\x7F]') { throw 'TEMP contains non-ASCII characters. Set TEMP to an existing ASCII path for this PowerShell session.' }
New-Item -ItemType Directory -Path $buildFolder | Out-Null
Write-Host "Building only mobile source in $buildFolder"
Get-ChildItem -LiteralPath $mobileSource -Force | Where-Object {
  $_.Name -notin @('node_modules','android','ios','dist','.expo','.git','tsconfig.tsbuildinfo')
} | Copy-Item -Destination $buildFolder -Recurse
$oldPath = $env:PATH; $oldJava = $env:JAVA_HOME; $oldSdk = $env:ANDROID_HOME; $oldDistribution = $env:RSD_DISTRIBUTION
try {
  # npm.cmd normally selects its adjacent system Node; this shim keeps Expo's
  # child npm processes on the supported runtime too.
  $toolsFolder = Join-Path $buildFolder '.rsd-tools'
  New-Item -ItemType Directory -Path $toolsFolder | Out-Null
  Set-Content -LiteralPath (Join-Path $toolsFolder 'npm.cmd') -Value ('@"' + $NodePath + '" "' + $npmCli + '" %*') -Encoding ascii
  $env:PATH = $toolsFolder + ';' + (Split-Path $NodePath) + ';' + (Join-Path $JavaPath 'bin') + ';' + $env:PATH
  $env:JAVA_HOME = $JavaPath; $env:ANDROID_HOME = $SdkPath; $env:RSD_DISTRIBUTION = 'direct'
  Push-Location $buildFolder
  try {
    & $NodePath $npmCli ci
    if ($LASTEXITCODE -ne 0) { throw 'Mobile dependency installation failed.' }
    & $NodePath 'node_modules\expo\bin\cli' prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android native generation failed.' }
    Push-Location (Join-Path $buildFolder 'android')
    try {
      & $java '-Dfile.encoding=UTF-8' -classpath 'gradle\wrapper\gradle-wrapper.jar' org.gradle.wrapper.GradleWrapperMain app:assembleDebug "-PreactNativeArchitectures=$Architecture" '-Pandroid.overridePathCheck=true'
      if ($LASTEXITCODE -ne 0) { throw 'Android development build failed.' }
    } finally { Pop-Location }
    $artifactFolder = Join-Path $mobileSource 'dist\android'
    New-Item -ItemType Directory -Force -Path $artifactFolder | Out-Null
    $apk = Join-Path $artifactFolder "rsd-education-sdk57-development-$Architecture.apk"
    Copy-Item -LiteralPath (Join-Path $buildFolder 'android\app\build\outputs\apk\debug\app-debug.apk') -Destination $apk
    Write-Host "Development APK: $apk"
    if (-not $BuildOnly) {
      & $adb -s $DeviceId install -r $apk
      if ($LASTEXITCODE -ne 0) { throw 'APK installation failed. Read the adb error; do not uninstall an existing app without preserving its data.' }
      & $adb -s $DeviceId shell am start -a android.intent.action.VIEW -d 'rsdeducation://'
      if ($LASTEXITCODE -ne 0) { throw 'The installed app could not be opened.' }
      Write-Host 'Start Metro in the maintained mobile folder with expo start --dev-client --clear --lan, then scan its QR using the RSD development app.'
    }
  } finally { Pop-Location }
} finally {
  $env:PATH = $oldPath; $env:JAVA_HOME = $oldJava; $env:ANDROID_HOME = $oldSdk; $env:RSD_DISTRIBUTION = $oldDistribution
  Write-Host "Temporary mobile build retained at $buildFolder. The website was not copied or changed."
}
