#!/bin/bash
# GitHub Hot Daily - 本地开发启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 GitHub Hot Daily - 本地开发环境"
echo "======================================"

# 检查 Python 版本
if ! command -v python3 &>/dev/null; then
  echo "❌ 未找到 python3，请先安装 Python 3.8+"
  exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION"

# 检查并安装依赖
if [ ! -f ".venv/bin/activate" ]; then
  echo "📦 创建虚拟环境..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "📦 安装 Python 依赖..."
pip install -q -r requirements.txt

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  未找到 .env 文件，正在从 .env.example 复制..."
  cp .env.example .env
  echo "📝 请编辑 .env 文件，填入你的 GitHub Token 和 OpenAI API Key"
  echo ""
fi

# 同步数据到前端目录
echo "📂 同步数据到前端目录..."
mkdir -p frontend/data/daily
cp data/index.json frontend/data/index.json 2>/dev/null || true
cp data/classics.json frontend/data/classics.json 2>/dev/null || true
cp data/daily/*.json frontend/data/daily/ 2>/dev/null || true

echo ""
echo "🌐 启动本地开发服务器..."
echo "   访问地址: http://localhost:8080"
echo "   按 Ctrl+C 停止服务器"
echo ""

# 启动 HTTP 服务器
cd frontend
python3 -m http.server 8080
