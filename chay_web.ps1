$ErrorActionPreference = "Stop"

$siteDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$url = "http://127.0.0.1:$port/index.html"

function Test-LocalServer {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Find-ServerCommand {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    return @{ Command = "python"; Args = "-m http.server $port --bind 127.0.0.1" }
  }

  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    return @{ Command = "py"; Args = "-m http.server $port --bind 127.0.0.1" }
  }

  $node = Get-Command npx -ErrorAction SilentlyContinue
  if ($node) {
    return @{ Command = "npx"; Args = "-y serve -l $port ." }
  }

  throw "Khong tim thay Python hoac Node.js. Hay cai dat Python hoac Node."
}

if (-not (Test-LocalServer)) {
  $cmdInfo = Find-ServerCommand
  Write-Host "Dang khoi dong server local tai $url..." -ForegroundColor Cyan

  Start-Process `
    -FilePath $cmdInfo.Command `
    -ArgumentList $cmdInfo.Args `
    -WorkingDirectory $siteDir `
    -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-LocalServer) {
      $ready = $true
      break
    }
  }
} else {
  Write-Host "Server local dang chay san tai $url" -ForegroundColor Green
}

Write-Host "Dang mo website tren trinh duyet..." -ForegroundColor Green
Start-Process $url
