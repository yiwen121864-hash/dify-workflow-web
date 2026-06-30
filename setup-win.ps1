# 学术关键词翻译扩增助手 - Windows Server 一键部署脚本
# 使用方法:
#   1. git clone https://github.com/yiwen121864-hash/dify-workflow-web.git
#   2. cd dify-workflow-web
#   3. 编辑 .env 文件，填入 DIFY_API_KEY
#   4. PowerShell 中运行: .\setup-win.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  学术关键词翻译扩增助手 - Windows 部署脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$APP_DIR = $PSScriptRoot

# 1. 检查 .env 配置
Write-Host "[1/4] 检查环境配置..." -ForegroundColor Yellow

if (-not (Test-Path "$APP_DIR\.env")) {
    Write-Host "  未找到 .env 文件，正在从 .env.example 创建..." -ForegroundColor Yellow
    Copy-Item "$APP_DIR\.env.example" "$APP_DIR\.env"
    Write-Host "  !! 请先编辑 .env 文件，填入 DIFY_API_KEY 后重新运行！" -ForegroundColor Red
    Write-Host "     notepad $APP_DIR\.env" -ForegroundColor White
    exit 1
}

$envContent = Get-Content "$APP_DIR\.env" -Raw
if ($envContent -match 'DIFY_API_KEY=你的Dify_API密钥' -or $envContent -notmatch 'DIFY_API_KEY=app-') {
    Write-Host "  !! DIFY_API_KEY 未正确配置！请编辑 .env 后重新运行。" -ForegroundColor Red
    Write-Host "     notepad $APP_DIR\.env" -ForegroundColor White
    exit 1
}
Write-Host "  [OK] 配置检查通过" -ForegroundColor Green

# 2. 检查 Node.js
Write-Host "[2/4] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "  [OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  !! Node.js 未安装！请先下载安装 https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 3. 安装依赖
Write-Host "[3/4] 安装项目依赖..." -ForegroundColor Yellow
Set-Location $APP_DIR
npm install --production
Write-Host "  [OK] 依赖安装完成" -ForegroundColor Green

# 4. 配置 Windows 防火墙
Write-Host "[4/4] 配置 Windows 防火墙..." -ForegroundColor Yellow
$PORT = 3000
try {
    $existingRule = netsh advfirewall firewall show rule name="学术关键词助手-3000" 2>$null
    if ($LASTEXITCODE -ne 0) {
        netsh advfirewall firewall add rule name="学术关键词助手-3000" dir=in action=allow protocol=TCP localport=$PORT | Out-Null
        Write-Host "  [OK] 防火墙规则已添加" -ForegroundColor Green
    } else {
        Write-Host "  [OK] 防火墙规则已存在" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARN] 防火墙配置失败，请手动放行端口 $PORT" -ForegroundColor Yellow
}

# 加载 .env 环境变量
Get-Content "$APP_DIR\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$' -and $_ -notmatch '^\s*#') {
        $varName = $Matches[1].Trim()
        $varValue = $Matches[2].Trim()
        [Environment]::SetEnvironmentVariable($varName, $varValue, "Process")
    }
}

# 创建启动脚本
$startScript = @"
@echo off
cd /d "$APP_DIR"
echo 正在启动学术关键词翻译扩增助手...
node server.js
pause
"@
Set-Content -Path "$APP_DIR\start.bat" -Value $startScript -Encoding Default

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "           部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  启动方式一（前台运行）：" -ForegroundColor White
Write-Host "    双击 "$APP_DIR\start.bat"" -ForegroundColor Yellow
Write-Host ""
Write-Host "  启动方式二（PowerShell 运行）：" -ForegroundColor White
Write-Host "    Set-Location '$APP_DIR'" -ForegroundColor Yellow
Write-Host "    node server.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "  启动后访问：http://47.110.71.143:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  !! 重要：请确保阿里云安全组已放行 TCP 3000 端口！！" -ForegroundColor Red
Write-Host ""
