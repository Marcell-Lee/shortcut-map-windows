$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$devices = @(Get-PnpDevice -Class Keyboard -PresentOnly | ForEach-Object {
  $instanceId = $_.InstanceId
  $reported = (Get-PnpDeviceProperty -InstanceId $instanceId -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue).Data
  $name = @($reported, $_.FriendlyName) | Where-Object { $_ -is [string] -and $_.Trim() } | Select-Object -First 1
  $name = [string]$name
  if ($instanceId -match '(?i)VID_([0-9A-F]{4})&PID_([0-9A-F]{4})') {
    $key = ('VID_{0}&PID_{1}' -f $Matches[1].ToUpperInvariant(), $Matches[2].ToUpperInvariant())
  } else {
    $key = ($instanceId -split '\\')[0..1] -join '\'
  }
  [pscustomobject]@{ key = $key; name = $name }
})

$groups = @($devices | Group-Object key | ForEach-Object {
  $names = @($_.Group | ForEach-Object name | Where-Object { $_ -and $_ -notmatch '^(?i:HID Keyboard Device|Keyboard|USB Input Device)$' } | Select-Object -Unique)
  [pscustomobject]@{ id = $_.Name; name = $(if ($names.Count) { $names[0] } else { 'Windows 通用键盘设备' }) }
})

$matches = @($groups | Where-Object { $_.name -match '(?i)(?:MAD|MADE|MATE)\s*68|68\s*(?:key|键)' -or $_.name -match '(?i)(?:104|108)\s*(?:key|键)|full\s*size|全尺寸' })
$suggestion = $null
if ($matches.Count -eq 1) {
  $detected = $matches[0]
  $layoutId = if ($detected.name -match '(?i)(?:MAD|MADE|MATE)\s*68|68\s*(?:key|键)') { 'compact68' } else { 'full' }
  $suggestion = [pscustomobject]@{ layoutId = $layoutId; model = $detected.name }
}

@{ devices = $groups; suggestion = $suggestion } | ConvertTo-Json -Depth 4 -Compress
