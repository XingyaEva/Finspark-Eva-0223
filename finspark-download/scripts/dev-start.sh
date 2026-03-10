#!/bin/bash
# Finspark 本地开发环境一键启动脚本

set -e

echo "🚀 Finspark 本地开发环境启动中..."

# 1. 构建项目
echo "📦 Step 1/3: 构建项目..."
npm run build

# 2. 初始化本地数据库（如果需要）
echo "🗄️  Step 2/3: 初始化本地D1数据库..."
if [ ! -d ".wrangler/state/v3/d1" ]; then
    echo "   首次运行，创建数据库表结构..."
    npx wrangler d1 execute genspark-financial-db --local --file=migrations/0001_stock_tables.sql
    npx wrangler d1 execute genspark-financial-db --local --file=migrations/0002_user_features.sql
    npx wrangler d1 execute genspark-financial-db --local --file=migrations/0004_comic_ip_character.sql
    echo "   导入股票数据..."
    npx wrangler d1 execute genspark-financial-db --local --file=seed.sql
    echo "   ✅ 数据库初始化完成"
else
    echo "   数据库已存在，跳过初始化"
fi

# 3. 启动开发服务器
echo "🌐 Step 3/3: 启动开发服务器..."
echo ""
echo "=========================================="
echo "  服务地址: http://localhost:8788"
echo "=========================================="
echo ""
npx wrangler pages dev ./dist --port 8788 --compatibility-date 2024-12-01 --compatibility-flag nodejs_compat --ip 0.0.0.0
