$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $projectRoot 'release'
$app = Join-Path $releaseDir 'Alt快捷键占用地图.html'
$guide = Join-Path $releaseDir '使用说明.txt'
$archive = Join-Path $releaseDir '快捷键地图-便携版.zip'

if (-not (Test-Path -LiteralPath $app)) {
  throw '分发页面缺失，请先执行 npm run build:release。'
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/使用说明.txt') -Destination $guide -Force
$html = Get-Content -LiteralPath $app -Raw -Encoding UTF8
$profilePath = Join-Path $projectRoot 'local/profile.json'
$privateMarkers = @()
if (Test-Path -LiteralPath $profilePath) {
  $profile = Get-Content -LiteralPath $profilePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $privateMarkers = @($profile.privateMarkers)
}
foreach ($marker in $privateMarkers) {
  if ($html.Contains($marker)) { throw "分发版含本机信息：$marker" }
}
if ($html -match '(?i)[A-Z]:\\Users\\[^\\\s"'']+') { throw '分发版含用户目录。' }
Compress-Archive -LiteralPath $app, $guide -DestinationPath $archive -CompressionLevel Optimal -Force
Add-Type -AssemblyName System.IO.Compression
$entries = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  $names = @($entries.Entries | ForEach-Object FullName)
  if ($names.Count -ne 2 -or $names -notcontains 'Alt快捷键占用地图.html' -or $names -notcontains '使用说明.txt') {
    throw '压缩包包含意外文件。'
  }
} finally { $entries.Dispose() }
Write-Output "已生成便携版：$archive"
