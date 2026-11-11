# Starts a Cloudflare quick tunnel to the local backend and writes the tunnel's address into frontend/config.js.
#
# Usage:  tunnel.bat            (double-click, or run from a terminal)
#         powershell -File scripts\tunnel.ps1 [-Port 8000]
#
# The backend must already be running (run.bat). The tunnel runs until Ctrl+C is pressed or the window is closed.
param([int]$Port = 8000)

$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root "frontend\config.js"

# Locate cloudflared: tools\cloudflared\cloudflared.exe first, then the PATH.
$exe = Join-Path $root "tools\cloudflared\cloudflared.exe"
if (-not (Test-Path $exe)) {
    $found = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($found) {
        $exe = $found.Source
    } else {
        Write-Host "cloudflared was not found."
        Write-Host "Download cloudflared-windows-amd64.exe from https://github.com/cloudflare/cloudflared/releases"
        Write-Host "and save it as tools\cloudflared\cloudflared.exe, or add it to the PATH."
        exit 1
    }
}

try {
    Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 3 | Out-Null
} catch {
    Write-Host "Warning: no backend answers on port $Port. Start it first (run.bat)."
}

$script:updated = $false
Write-Host "Starting tunnel to http://localhost:$Port ..."

& $exe tunnel --no-autoupdate --url "http://localhost:$Port" 2>&1 | ForEach-Object {
    $line = "$_"
    if (-not $script:updated -and $line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $address = $Matches[0]
        $text = [System.IO.File]::ReadAllText($config)
        $new = [regex]::Replace($text, 'window\.AUTHENTECH_API\s*=\s*"[^"]*";', "window.AUTHENTECH_API = `"$address`";")
        [System.IO.File]::WriteAllText($config, $new, (New-Object System.Text.UTF8Encoding($false)))
        $script:updated = $true
        Write-Host ""
        Write-Host "Tunnel address: $address"
        Write-Host "frontend\config.js was updated. To publish the new address:"
        Write-Host "    git add frontend/config.js"
        Write-Host "    git commit -m `"Update backend address`""
        Write-Host "    git push"
        Write-Host "Keep this window open while the site is in use. Ctrl+C stops the tunnel."
        Write-Host ""
    }
}
