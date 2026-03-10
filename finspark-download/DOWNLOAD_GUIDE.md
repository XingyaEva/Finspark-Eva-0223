# Finspark 完整代码包下载清单

**生成时间**: 2026-01-16 13:51  
**包大小**: 53MB  
**最新提交**: 7bafa28  

---

## 📦 包含文件

### 1. finspark-source-20260116-134937.tar.gz (30MB)
**完整源代码包**（不含 node_modules 和 .git）

**包含**:
- ✅ 所有源代码（src/）
- ✅ 数据库迁移文件（migrations/）
- ✅ 静态资源（public/）
- ✅ 配置文件（package.json, wrangler.jsonc等）
- ✅ 文档（docs/, README.md等）

**不含**（需重新生成）:
- ❌ node_modules（需运行 npm install）
- ❌ dist（需运行 npm run build）
- ❌ .git（可选，使用 git init 重新初始化）

**使用方法**:
```bash
# 解压
tar -xzf finspark-source-20260116-134937.tar.gz

# 进入目录
cd finspark

# 安装依赖
npm install

# 配置环境
cp .dev.vars.example .dev.vars
nano .dev.vars  # 填入真实的 API Keys

# 初始化数据库
npm run db:migrate:local
npm run db:seed

# 构建并启动
npm run build
pm2 start ecosystem.config.cjs
```

---

### 2. finspark-git-backup.bundle (23MB)
**Git 完整历史备份**

包含完整的 Git 历史、所有分支和提交记录。

**使用方法**:
```bash
# 从 bundle 克隆仓库
git clone finspark-git-backup.bundle finspark-from-bundle

# 进入目录
cd finspark-from-bundle

# 查看分支
git branch -a

# 切换到开发分支
git checkout genspark_ai_developer

# 关联新的远程仓库
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 推送
git push -u origin --all
git push -u origin --tags
```

**适用场景**:
- 需要保留完整的 Git 历史
- 需要查看历史提交和分支
- 需要恢复到某个历史版本

---

### 3. FINSPARK_README.md (12KB)
**完整使用说明**

**包含**:
- 📚 快速开始指南
- 🔧 开发命令大全
- 🌐 Cloudflare 部署教程
- 📝 最新修复记录
- ⚠️ 重要提示和故障排查
- 🎯 Git 初始化指南

---

### 4. quick-start.sh (可执行脚本)
**一键部署脚本**

**功能**:
1. ✅ 自动解压代码
2. ✅ 安装 npm 依赖
3. ✅ 创建 .dev.vars 模板
4. ✅ 初始化数据库
5. ✅ 构建项目
6. ✅ 启动 PM2 服务

**使用方法**:
```bash
# 1. 下载完整包
wget YOUR_DOWNLOAD_URL/finspark-complete-package.tar.gz

# 2. 解压
tar -xzf finspark-complete-package.tar.gz
cd finspark-download

# 3. 运行脚本（需要先配置 .dev.vars）
bash quick-start.sh
```

**前提条件**:
- Node.js 18+
- npm 或 pnpm
- PM2（脚本会自动安装）

---

## 🚀 推荐使用方式

### 方式A：仅需源码（推荐）
适合：熟悉Git和npm的开发者

```bash
# 1. 解压源码包
tar -xzf finspark-source-20260116-134937.tar.gz
cd finspark

# 2. 安装依赖
npm install

# 3. 配置环境
# 创建 .dev.vars 并填入 API Keys

# 4. 初始化并启动
npm run db:migrate:local
npm run db:seed
npm run build
pm2 start ecosystem.config.cjs
```

### 方式B：保留Git历史
适合：需要查看历史提交或多人协作

```bash
# 1. 从bundle克隆
git clone finspark-git-backup.bundle finspark
cd finspark

# 2. 安装依赖（同方式A）
npm install

# 3. 后续步骤同方式A
```

### 方式C：一键部署
适合：快速体验，自动化部署

```bash
# 解压完整包
tar -xzf finspark-complete-package.tar.gz
cd finspark-download

# 编辑 API Keys（重要！）
nano .dev.vars.example

# 运行部署脚本
bash quick-start.sh
```

---

## 🔑 必需的 API Keys

### 1. VectorEngine API Key
- 获取地址: https://vectorengine.ai
- 用途: AI分析引擎（GPT-5.1）
- 必需: ✅ 是
- 成本: 按使用量计费

### 2. Tushare Token
- 获取地址: https://tushare.pro
- 用途: 股票财务数据
- 必需: ✅ 是（5000+积分）
- 成本: ¥500/年（5000积分）

### 3. JWT Secret
- 生成方法: 随机字符串（32位以上）
- 用途: 用户认证加密
- 必需: ✅ 是
- 示例: `openssl rand -base64 32`

---

## 📊 系统要求

### 最低配置
- **操作系统**: Linux / macOS / Windows (WSL2)
- **Node.js**: 18.0.0+
- **npm**: 9.0.0+
- **内存**: 2GB+
- **硬盘**: 1GB+（不含数据库）

### 推荐配置
- **操作系统**: Ubuntu 22.04+ / macOS 13+
- **Node.js**: 20.0.0+
- **pnpm**: 8.0.0+（比npm更快）
- **内存**: 4GB+
- **硬盘**: 5GB+

---

## 🔄 从旧版本迁移

如果您已有旧版本的Finspark代码：

```bash
# 1. 备份旧数据库
cp ./local.db ./local.db.backup

# 2. 解压新代码到新目录
tar -xzf finspark-source-20260116-134937.tar.gz -C /path/to/new

# 3. 复制配置和数据
cp .dev.vars /path/to/new/finspark/
cp local.db /path/to/new/finspark/

# 4. 运行迁移
cd /path/to/new/finspark
npm install
npm run db:migrate:local

# 5. 重启服务
pm2 restart finspark
```

---

## 📝 更新日志（最新5条）

| Commit | 日期 | 说明 |
|--------|------|------|
| 7bafa28 | 2026-01-16 | 添加test-chart测试页面路由 |
| 85b7abb | 2026-01-16 | 修复incomeChart不存在导致的图表加载失败 |
| 6d81bd4 | 2026-01-16 | 添加详细的前端调试日志和ECharts测试页面 |
| 5745ca1 | 2026-01-16 | 添加Tushare 10000积分权限分析报告 |
| 8fc987e | 2026-01-16 | 增强后端JSON解析逻辑，修复Agent输出截断问题 |

完整历史: 使用 `git log` 查看

---

## ⚠️ 重要注意事项

1. **不要提交 .dev.vars 到 Git**
   - 已在 .gitignore 中
   - 包含敏感的 API Keys

2. **生产环境使用 Cloudflare Secrets**
   ```bash
   npx wrangler pages secret put VECTORENGINE_API_KEY
   ```

3. **定期备份数据库**
   ```bash
   cp local.db local.db.$(date +%Y%m%d)
   ```

4. **检查 Tushare Token 有效期**
   - Token 会过期
   - 定期更新 .dev.vars

---

## 📞 获取帮助

### 文档
- 项目 README: `FINSPARK_README.md`
- 快速参考: `QUICK_REFERENCE.txt`（代码包内）
- API 文档: `API_KEYS_CONFIGURED.md`（代码包内）

### 在线资源
- Hono 框架: https://hono.dev
- Cloudflare Workers: https://developers.cloudflare.com/workers
- Tushare 文档: https://tushare.pro/document/1

---

## ✅ 下载检查清单

在开始之前，确认您已准备：

- [ ] 下载 `finspark-complete-package.tar.gz` (53MB)
- [ ] Node.js 18+ 已安装
- [ ] VectorEngine API Key 已获取
- [ ] Tushare Token 已获取（5000+积分）
- [ ] 至少 2GB 可用内存
- [ ] 至少 1GB 可用硬盘空间

---

**开始使用**: 解压 `finspark-complete-package.tar.gz` 并查看 `FINSPARK_README.md`

**祝开发顺利！** 🚀
