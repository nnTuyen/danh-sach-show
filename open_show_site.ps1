$ErrorActionPreference = "Stop"

$siteDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$url = "http://127.0.0.1:$port/index.html"

function Test-LocalSite {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-PythonCommand {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) { return "python" }

  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return "py" }

  throw "Python was not found. Install Python or run manually: python -m http.server 8000"
}

if (-not (Test-LocalSite)) {
  $pythonCommand = Get-PythonCommand
  $arguments = "-m http.server $port --bind 127.0.0.1"

  Start-Process `
    -FilePath $pythonCommand `
    -ArgumentList $arguments `
    -WorkingDirectory $siteDir `
    -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-LocalSite) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "Local server was started but the page did not respond at $url"
  }
}

Start-Process $url
