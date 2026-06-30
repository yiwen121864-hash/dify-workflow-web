# Dify Workflow Web - Windows Setup Script
$APP_DIR = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Academic Keyword Assistant - Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check .env
Write-Host "[1/4] Checking .env config..." -ForegroundColor Yellow

if (-not (Test-Path "$APP_DIR\.env")) {
    Copy-Item "$APP_DIR\.env.example" "$APP_DIR\.env"
    Write-Host "  !! Please edit .env and set DIFY_API_KEY first!" -ForegroundColor Red
    Write-Host "     notepad $APP_DIR\.env" -ForegroundColor White
    exit 1
}

$envContent = Get-Content "$APP_DIR\.env" -Raw
if ($envContent -notmatch 'DIFY_API_KEY=app-') {
    Write-Host "  !! DIFY_API_KEY not configured!" -ForegroundColor Red
    Write-Host "     notepad $APP_DIR\.env" -ForegroundColor White
    exit 1
}
Write-Host "  [OK] Config check passed" -ForegroundColor Green

# 2. Check Node.js
Write-Host "[2/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $v = node -v 2>&1
    Write-Host "  [OK] Node.js $v" -ForegroundColor Green
} catch {
    Write-Host "  !! Node.js not found! Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 3. Install dependencies
Write-Host "[3/4] Installing dependencies..." -ForegroundColor Yellow
Set-Location $APP_DIR
npm install --production
Write-Host "  [OK] Dependencies installed" -ForegroundColor Green

# 4. Firewall
Write-Host "[4/4] Configuring firewall..." -ForegroundColor Yellow
$PORT = 3000
try {
    netsh advfirewall firewall add rule name="DifyKeywordApp-3000" dir=in action=allow protocol=TCP localport=$PORT 2>$null | Out-Null
    Write-Host "  [OK] Firewall rule added" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Firewall config skipped" -ForegroundColor Yellow
}

# Load env vars
Get-Content "$APP_DIR\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$' -and $_ -notmatch '^\s*#') {
        $vn = $Matches[1].Trim()
        $vv = $Matches[2].Trim()
        [Environment]::SetEnvironmentVariable($vn, $vv, "Process")
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "           Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Start the server:" -ForegroundColor White
Write-Host "    cd $APP_DIR" -ForegroundColor Yellow
Write-Host "    node server.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then visit: http://47.110.71.143:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  !! Ensure Alibaba Cloud Security Group allows TCP 3000 !!" -ForegroundColor Red
Write-Host ""
