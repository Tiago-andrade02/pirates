$ErrorActionPreference = "SilentlyContinue"
$dir = "C:\Users\tiago andrade\Documents\Default Project"
$logDir = Join-Path $dir ".logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
  $log = Join-Path $logDir "dev-$stamp.log"
  Push-Location $dir
  & "C:\Program Files\nodejs\npm.cmd" run dev *>> $log
  Pop-Location
  Start-Sleep -Seconds 5
}
