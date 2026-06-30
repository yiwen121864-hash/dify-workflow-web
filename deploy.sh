#!/bin/bash
#
# 学术关键词翻译扩增助手 - 阿里云 ECS 一键部署脚本
# 使用方法:
#   1. 将此项目上传到 ECS 服务器（如 /root/academic-keyword-assistant）
#   2. 配置 .env 文件中的 DIFY_API_KEY
#   3. 运行: bash deploy.sh
#
set -e

# ─── 配置变量 ────────────────────────────────────────────
APP_NAME="academic-keyword-assistant"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_VERSION="20"  # 推荐 Node.js 20 LTS

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   学术关键词翻译扩增助手 - ECS 部署脚本       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "📁 项目目录: $APP_DIR"

# ─── 1. 检查 .env 配置 ───────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 1/6  检查环境配置"
echo "=========================================="

if [ ! -f "$APP_DIR/.env" ]; then
  echo "⚠️  未找到 .env 文件，正在从 .env.example 创建..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "❌ 请编辑 .env 文件，填入你的 DIFY_API_KEY 后重新运行此脚本！"
  echo "   nano $APP_DIR/.env"
  exit 1
fi

source "$APP_DIR/.env" 2>/dev/null || true
if [ -z "$DIFY_API_KEY" ] || [ "$DIFY_API_KEY" = "你的Dify_API密钥" ]; then
  echo "❌ DIFY_API_KEY 未配置！请编辑 .env 文件后重新运行。"
  echo "   nano $APP_DIR/.env"
  exit 1
fi
echo "✅ 环境配置检查通过"

# ─── 2. 安装 Node.js ────────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 2/6  检查 Node.js 环境"
echo "=========================================="

if command -v node &>/dev/null; then
  NODE_CURRENT=$(node -v)
  echo "✅ Node.js 已安装: $NODE_CURRENT"
else
  echo "📦 正在安装 Node.js $NODE_VERSION ..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "✅ Node.js 安装完成: $(node -v)"
fi

# ─── 3. 安装依赖 ────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 3/6  安装项目依赖"
echo "=========================================="

cd "$APP_DIR"
npm install --production
echo "✅ 依赖安装完成"

# ─── 4. 安装 PM2 ────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 4/6  安装 PM2 进程守护"
echo "=========================================="

if command -v pm2 &>/dev/null; then
  echo "✅ PM2 已安装: $(pm2 -v)"
else
  echo "📦 正在安装 PM2..."
  npm install -g pm2
  echo "✅ PM2 安装完成"
fi

# ─── 5. 配置防火墙 ──────────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 5/6  配置防火墙规则"
echo "=========================================="

PORT="${PORT:-3000}"

echo "📌 服务将运行在端口: $PORT"

# 检查阿里云安全组（需在控制台手动配置，这里给出提示）
echo ""
echo "  ⚠️  重要提示：请确保阿里云安全组已放行端口 $PORT"
echo "     1. 打开阿里云 ECS 控制台"
echo "     2. 进入实例 → 安全组 → 配置规则"
echo "     3. 添加入方向规则：TCP $PORT，授权对象 0.0.0.0/0"
echo ""

# 尝试开放防火墙（如果有 firewalld）
if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld 2>/dev/null; then
  echo "🔧 正在配置 firewalld..."
  sudo firewall-cmd --permanent --add-port=$PORT/tcp 2>/dev/null || true
  sudo firewall-cmd --reload 2>/dev/null || true
  echo "✅ firewalld 配置完成"
fi

# 尝试开放 ufw
if command -v ufw &>/dev/null; then
  echo "🔧 正在配置 ufw..."
  sudo ufw allow $PORT/tcp 2>/dev/null || true
  echo "✅ ufw 配置完成"
fi

# 尝试 iptables
if command -v iptables &>/dev/null; then
  echo "🔧 正在配置 iptables..."
  # 检查规则是否已存在
  if ! sudo iptables -C INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT -p tcp --dport $PORT -j ACCEPT
  fi
  echo "✅ iptables 配置完成"
fi

# ─── 6. 启动服务 ────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Step 6/6  启动应用服务"
echo "=========================================="

# 先停止旧进程（如果存在）
pm2 delete "$APP_NAME" 2>/dev/null || true

# 创建日志目录
mkdir -p "$APP_DIR/logs"

# 使用 dotenv 方式启动（需要安装 dotenv）
# 或者 export 环境变量后启动
export DIFY_API_KEY="$DIFY_API_KEY"
export DIFY_BASE_URL="${DIFY_BASE_URL:-https://api.dify.ai/v1}"
export PORT="$PORT"

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          🎉 部署完成！                        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  📍 公网访问: http://172.22.97.161:$PORT"
echo "  📍 本地访问: http://localhost:$PORT"
echo ""
echo "  常用命令:"
echo "    pm2 ls              - 查看应用状态"
echo "    pm2 logs $APP_NAME   - 查看实时日志"
echo "    pm2 restart $APP_NAME - 重启应用"
echo "    pm2 stop $APP_NAME    - 停止应用"
echo ""
