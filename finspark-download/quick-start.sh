#!/bin/bash
# Finspark 快速部署脚本
# 使用方法: bash quick-start.sh

set -e

echo "🚀 Finspark 投资分析系统 - 快速部署"
echo "======================================"
echo ""

# 1. 解压代码
echo "📦 Step 1: 解压代码包..."
if [ -f "finspark-source-20260116-134937.tar.gz" ]; then
    tar -xzf finspark-source-20260116-134937.tar.gz
    echo "✅ 代码解压完成"
else
    echo "❌ 错误: 找不到代码包文件"
    exit 1
fi

# 2. 进入项目目录
cd finspark || exit 1

# 3. 安装依赖
echo ""
echo "📚 Step 2: 安装依赖..."
echo "   这可能需要 2-3 分钟..."
npm install
echo "✅ 依赖安装完成"

# 4. 配置环境变量
echo ""
echo "🔑 Step 3: 配置环境变量..."
if [ ! -f ".dev.vars" ]; then
    echo "创建 .dev.vars 文件..."
    cat > .dev.vars << 'EOF'
# VectorEngine API Key（必需）
VECTORENGINE_API_KEY=your_vectorengine_api_key_here

# Tushare Token（必需，5000+积分）
TUSHARE_TOKEN=your_tushare_token_here

# JWT Secret（必需，随机字符串）
JWT_SECRET=your_random_jwt_secret_here_change_this_in_production
EOF
    echo "⚠️  请编辑 .dev.vars 文件，填入真实的 API Keys"
    echo ""
    read -p "按回车继续（确保已配置 .dev.vars）..." dummy
else
    echo "✅ .dev.vars 文件已存在"
fi

# 5. 初始化数据库
echo ""
echo "🗄️  Step 4: 初始化数据库..."
npm run db:migrate:local
npm run db:seed
echo "✅ 数据库初始化完成"

# 6. 构建项目
echo ""
echo "🔨 Step 5: 构建项目..."
npm run build
echo "✅ 项目构建完成"

# 7. 启动服务
echo ""
echo "🚀 Step 6: 启动服务..."
echo "   使用 PM2 管理进程..."

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ 服务启动完成！"
echo ""
echo "======================================"
echo "📊 访问地址:"
echo "   - 主页: http://localhost:3000"
echo "   - 测试: http://localhost:3000/test-chart.html"
echo "   - 助手: http://localhost:3000/assistant"
echo ""
echo "🔧 常用命令:"
echo "   - 查看日志: pm2 logs finspark"
echo "   - 查看状态: pm2 status"
echo "   - 重启服务: pm2 restart finspark"
echo "   - 停止服务: pm2 stop finspark"
echo ""
echo "📖 详细文档: 查看 FINSPARK_README.md"
echo "======================================"
