#!/bin/bash
# ============================================================
# Finspark 开发模式自动构建启动脚本
# 
# 功能:
#   1. 初始构建 + 启动 wrangler pages dev
#   2. 后台监控 src/ 文件变更，自动触发增量重构建
#   3. Wrangler 自动拾取 dist/ 变更进行热重载
#
# 用法:
#   ./scripts/dev-watch.sh              # 默认端口 3001
#   ./scripts/dev-watch.sh --port 8080  # 自定义端口
#   
# 停止: Ctrl+C (自动清理所有后台进程)
# ============================================================

set -e

PORT="${1:-3001}"
if [ "$1" = "--port" ]; then
    PORT="${2:-3001}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}[dev] Shutting down...${NC}"
    # Kill all child processes
    kill $(jobs -p) 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}[dev] Stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. 初始构建
echo -e "${BLUE}[dev] Building project...${NC}"
npm run build
echo -e "${GREEN}[dev] Build complete.${NC}"
echo ""

# 2. 启动 wrangler pages dev (后台)
echo -e "${BLUE}[dev] Starting wrangler pages dev on port ${PORT}...${NC}"
npx wrangler pages dev dist \
    --d1=genspark-financial-db \
    --ip 0.0.0.0 \
    --port "$PORT" &
WRANGLER_PID=$!

# 等待 wrangler 启动
sleep 5
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dev server: http://localhost:${PORT}${NC}"
echo -e "${GREEN}  File watcher active on src/${NC}"
echo -e "${GREEN}  Auto-rebuild on file change${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 3. 文件监控 + 自动重构建
LAST_BUILD=$(date +%s)
DEBOUNCE_SECONDS=2

while true; do
    # 使用 find 检测 src/ 下比上次构建新的文件
    CHANGED=$(find src/ -newer dist/_worker.js -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -5)
    
    if [ -n "$CHANGED" ]; then
        NOW=$(date +%s)
        ELAPSED=$((NOW - LAST_BUILD))
        
        if [ "$ELAPSED" -ge "$DEBOUNCE_SECONDS" ]; then
            echo ""
            echo -e "${YELLOW}[dev] Source changed:${NC}"
            echo "$CHANGED" | while read f; do echo "  $f"; done
            echo -e "${BLUE}[dev] Rebuilding...${NC}"
            
            if npm run build 2>&1 | tail -3; then
                LAST_BUILD=$(date +%s)
                echo -e "${GREEN}[dev] Rebuild complete. Wrangler will auto-reload.${NC}"
            else
                echo -e "${RED}[dev] Build failed! Fix errors and save again.${NC}"
                LAST_BUILD=$(date +%s)
            fi
        fi
    fi
    
    # 每秒检测一次
    sleep 1
    
    # 检查 wrangler 是否还在运行
    if ! kill -0 $WRANGLER_PID 2>/dev/null; then
        echo -e "${RED}[dev] Wrangler process died, restarting...${NC}"
        npx wrangler pages dev dist \
            --d1=genspark-financial-db \
            --ip 0.0.0.0 \
            --port "$PORT" &
        WRANGLER_PID=$!
        sleep 3
    fi
done
