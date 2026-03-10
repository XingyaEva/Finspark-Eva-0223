// 会员中心页面
import { responsiveStyles } from '../styles/responsive';

export const membershipPageHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>会员中心 - Finspark 财报分析系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Noto Sans SC', sans-serif; }
        body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; }
        
        .glass-card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .tier-free { background: linear-gradient(135deg, #374151 0%, #1f2937 100%); }
        .tier-pro { background: linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%); }
        .tier-elite { background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); }
        
        .plan-card {
            transition: all 0.3s ease;
        }
        .plan-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .plan-card.recommended {
            border: 2px solid #7c3aed;
        }
        
        .feature-check { color: #22c55e; }
        .feature-cross { color: #6b7280; }
        
        .faq-item {
            transition: all 0.3s ease;
        }
        .faq-item.active .faq-answer {
            max-height: 200px;
            opacity: 1;
        }
        .faq-item .faq-answer {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .faq-item.active .faq-icon {
            transform: rotate(180deg);
        }
        
        .coming-soon-badge {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .usage-bar {
            height: 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            overflow: hidden;
        }
        .usage-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        \${responsiveStyles}
    </style>
</head>
<body class="text-gray-100">
    <!-- 桌面端导航栏 -->
    <nav class="glass-card border-b border-gray-700/50 sticky top-0 z-50 hide-on-mobile">
        <div class="container-adaptive">
            <div class="flex justify-between h-16 items-center">
                <a href="/" class="flex items-center space-x-2">
                    <i class="fas fa-chart-line text-2xl text-blue-400"></i>
                    <span class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Finspark</span>
                </a>
                <div class="flex items-center space-x-4">
                    <a href="/" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-home mr-1"></i> 首页
                    </a>
                    <a href="/my-reports" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-history mr-1"></i> 我的分析
                    </a>
                </div>
            </div>
        </div>
    </nav>
    
    <!-- 移动端导航栏 -->
    <nav class="mobile-nav show-on-mobile glass-card border-b border-gray-700/50">
        <div class="px-4 py-3 flex items-center justify-between">
            <a href="/" class="flex items-center space-x-2">
                <i class="fas fa-chart-line text-xl text-blue-400"></i>
                <span class="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Finspark</span>
            </a>
            <div class="flex items-center space-x-3">
                <a href="/" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-home text-lg"></i>
                </a>
                <a href="/my-reports" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-history text-lg"></i>
                </a>
            </div>
        </div>
    </nav>
    
    <main class="container-adaptive pt-adaptive-header pb-8">
        <!-- 页面标题 -->
        <div class="text-center mb-8 md:mb-12">
            <h1 class="text-2xl md:text-4xl font-bold mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                会员中心
            </h1>
            <p class="text-gray-400 text-base md:text-lg">解锁更多专业分析功能，助力投资决策</p>
        </div>
        
        <!-- 当前会员状态 -->
        <section id="currentStatus" class="mb-8 md:mb-12">
            <div class="glass-card rounded-2xl p-4 md:p-6">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-semibold">
                        <i class="fas fa-user-circle mr-2 text-blue-400"></i>我的会员状态
                    </h2>
                    <span id="tierBadge" class="px-4 py-2 rounded-full text-sm font-bold tier-free">
                        加载中...
                    </span>
                </div>
                
                <div id="statusContent" class="grid md:grid-cols-3 gap-6">
                    <!-- 动态加载 -->
                    <div class="animate-pulse">
                        <div class="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                        <div class="h-8 bg-gray-700 rounded w-3/4"></div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- 方案对比 -->
        <section id="plansSection" class="mb-8 md:mb-12">
            <div class="text-center mb-6 md:mb-8">
                <h2 class="text-xl md:text-2xl font-bold mb-2">选择适合你的方案</h2>
                <p class="text-gray-400 text-sm md:text-base">所有方案均支持月付和年付，年付更优惠</p>
                
                <!-- 即将推出提示 -->
                <div class="inline-flex items-center mt-4 px-4 py-2 coming-soon-badge rounded-full text-sm font-bold text-black">
                    <i class="fas fa-rocket mr-2"></i>
                    会员订阅功能即将推出
                </div>
            </div>
            
            <!-- 计费周期切换 -->
            <div class="flex justify-center mb-6 md:mb-8">
                <div class="glass-card rounded-full p-1 inline-flex">
                    <button id="monthlyBtn" onclick="switchBilling('monthly')" class="px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all bg-blue-600 text-white">
                        月付
                    </button>
                    <button id="yearlyBtn" onclick="switchBilling('yearly')" class="px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all text-gray-400 hover:text-white">
                        年付 <span class="text-green-400 text-xs">省40%</span>
                    </button>
                </div>
            </div>
            
            <!-- 方案卡片 -->
            <div id="plansGrid" class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <!-- 动态加载 -->
                <div class="glass-card rounded-2xl p-6 animate-pulse">
                    <div class="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
                    <div class="h-10 bg-gray-700 rounded w-3/4 mb-6"></div>
                    <div class="space-y-3">
                        <div class="h-4 bg-gray-700 rounded"></div>
                        <div class="h-4 bg-gray-700 rounded"></div>
                        <div class="h-4 bg-gray-700 rounded"></div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- 功能对比表 -->
        <section id="comparisonSection" class="mb-8 md:mb-12">
            <div class="glass-card rounded-2xl p-4 md:p-6 overflow-x-auto">
                <h2 class="text-lg md:text-xl font-semibold mb-4 md:mb-6">
                    <i class="fas fa-th-list mr-2 text-purple-400"></i>功能对比
                </h2>
                
                <table id="comparisonTable" class="w-full min-w-[600px]">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-4 px-4 text-gray-400 font-medium">功能</th>
                            <th class="text-center py-4 px-4 text-gray-300 font-medium">免费版</th>
                            <th class="text-center py-4 px-4 text-purple-400 font-medium">Pro</th>
                            <th class="text-center py-4 px-4 text-yellow-400 font-medium">Elite</th>
                        </tr>
                    </thead>
                    <tbody id="comparisonBody">
                        <!-- 动态加载 -->
                    </tbody>
                </table>
            </div>
        </section>
        
        <!-- 订单历史 -->
        <section id="ordersSection" class="mb-8 md:mb-12">
            <div class="glass-card rounded-2xl p-4 md:p-6">
                <h2 class="text-lg md:text-xl font-semibold mb-4 md:mb-6">
                    <i class="fas fa-receipt mr-2 text-green-400"></i>订单历史
                </h2>
                
                <div id="ordersContent">
                    <div class="text-center py-12 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-4"></i>
                        <p>暂无订单记录</p>
                        <p class="text-sm mt-2">会员订阅功能即将推出，敬请期待</p>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- FAQ -->
        <section id="faqSection" class="mb-8 md:mb-12">
            <div class="glass-card rounded-2xl p-4 md:p-6">
                <h2 class="text-lg md:text-xl font-semibold mb-4 md:mb-6">
                    <i class="fas fa-question-circle mr-2 text-blue-400"></i>常见问题
                </h2>
                
                <div id="faqList" class="space-y-4">
                    <!-- 动态加载 -->
                </div>
            </div>
        </section>
    </main>
    
    <!-- 页脚 -->
    <footer class="glass-card border-t border-gray-700/50 py-6 md:py-8 mt-8 md:mt-12">
        <div class="container-adaptive text-center text-gray-500 text-sm">
            <p>© 2026 Finspark 财报分析系统. All rights reserved.</p>
            <p class="mt-2">专业的AI驱动财务分析平台</p>
        </div>
    </footer>
    
    <script>
        // 全局状态
        let currentBilling = 'monthly';
        let plansData = [];
        let comparisonData = null;
        let membershipStatus = null;
        
        // 初始化
        document.addEventListener('DOMContentLoaded', async () => {
            await Promise.all([
                loadMembershipStatus(),
                loadPlans(),
                loadComparison(),
                loadFaq()
            ]);
        });
        
        // 加载会员状态
        async function loadMembershipStatus() {
            try {
                const token = localStorage.getItem('accessToken');
                const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                
                const response = await fetch('/api/membership/current', { headers });
                const data = await response.json();
                
                if (data.success) {
                    membershipStatus = data.status;
                    renderMembershipStatus(data);
                }
            } catch (error) {
                console.error('Load membership status error:', error);
            }
        }
        
        // 渲染会员状态
        function renderMembershipStatus(data) {
            const { status, isLoggedIn } = data;
            
            // 更新徽章
            const tierBadge = document.getElementById('tierBadge');
            const tierClasses = {
                guest: 'tier-free',
                free: 'tier-free',
                pro: 'tier-pro',
                elite: 'tier-elite'
            };
            tierBadge.className = 'px-4 py-2 rounded-full text-sm font-bold ' + (tierClasses[status.tier] || 'tier-free');
            tierBadge.textContent = status.tierName;
            
            // 渲染状态内容
            const statusContent = document.getElementById('statusContent');
            
            if (!isLoggedIn) {
                statusContent.innerHTML = \`
                    <div class="md:col-span-3 text-center py-8">
                        <i class="fas fa-user-lock text-4xl text-gray-600 mb-4"></i>
                        <p class="text-gray-400 mb-4">登录后查看您的会员状态</p>
                        <a href="/" class="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
                            <i class="fas fa-sign-in-alt mr-2"></i>去登录
                        </a>
                    </div>
                \`;
                return;
            }
            
            // 分析次数
            const analysisUsed = status.usageToday?.analysis || 0;
            const analysisLimit = status.limits?.analysis;
            const analysisPercent = analysisLimit ? Math.min((analysisUsed / analysisLimit) * 100, 100) : 0;
            
            statusContent.innerHTML = \`
                <div class="space-y-3">
                    <div class="text-gray-400 text-sm">今日分析次数</div>
                    <div class="text-2xl font-bold">
                        \${analysisUsed}<span class="text-gray-500">/\${analysisLimit || '∞'}</span>
                    </div>
                    <div class="usage-bar">
                        <div class="usage-bar-fill bg-blue-500" style="width: \${analysisPercent}%"></div>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <div class="text-gray-400 text-sm">会员有效期</div>
                    <div class="text-2xl font-bold">
                        \${status.expiresAt ? formatDate(status.expiresAt) : (status.tier === 'free' || status.tier === 'guest' ? '永久免费' : '-')}
                    </div>
                    \${status.daysRemaining !== null ? \`<div class="text-sm text-gray-400">剩余 \${status.daysRemaining} 天</div>\` : ''}
                </div>
                
                <div class="space-y-3">
                    <div class="text-gray-400 text-sm">收藏使用</div>
                    <div class="text-2xl font-bold">
                        -<span class="text-gray-500">/\${status.limits?.favorites || 0}</span>
                    </div>
                    <div class="text-sm text-gray-400">
                        \${status.tier === 'guest' ? '登录解锁收藏功能' : '收藏您关注的股票'}
                    </div>
                </div>
            \`;
        }
        
        // 加载方案
        async function loadPlans() {
            try {
                const response = await fetch('/api/membership/plans');
                const data = await response.json();
                
                if (data.success) {
                    plansData = data.plans;
                    renderPlans();
                }
            } catch (error) {
                console.error('Load plans error:', error);
            }
        }
        
        // 渲染方案卡片
        function renderPlans() {
            const grid = document.getElementById('plansGrid');
            const isYearly = currentBilling === 'yearly';
            
            // 按等级分组
            const proPlans = plansData.filter(p => p.tier === 'pro');
            const elitePlans = plansData.filter(p => p.tier === 'elite');
            
            const proMonthly = proPlans.find(p => p.duration_months === 1);
            const proYearly = proPlans.find(p => p.duration_months === 12);
            const eliteMonthly = elitePlans.find(p => p.duration_months === 1);
            const eliteYearly = elitePlans.find(p => p.duration_months === 12);
            
            const proPlan = isYearly ? proYearly : proMonthly;
            const elitePlan = isYearly ? eliteYearly : eliteMonthly;
            
            grid.innerHTML = \`
                <!-- 免费版 -->
                <div class="plan-card glass-card rounded-2xl p-6">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2">免费版</h3>
                        <p class="text-gray-400 text-sm">基础财报分析功能</p>
                    </div>
                    
                    <div class="mb-6">
                        <span class="text-4xl font-bold">¥0</span>
                        <span class="text-gray-400">/永久</span>
                    </div>
                    
                    <ul class="space-y-3 mb-8">
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>每日10次分析
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>完整分析报告
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>100个收藏位
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>历史记录查看
                        </li>
                        <li class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-times feature-cross mr-3"></i>AI漫画解读
                        </li>
                        <li class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-times feature-cross mr-3"></i>行业对比分析
                        </li>
                    </ul>
                    
                    <button class="w-full py-3 rounded-xl bg-gray-700 text-gray-300 font-medium cursor-default">
                        当前方案
                    </button>
                </div>
                
                <!-- Pro -->
                <div class="plan-card glass-card rounded-2xl p-6 recommended relative">
                    \${proPlan?.is_recommended ? '<div class="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-purple-600 rounded-full text-xs font-bold">最受欢迎</div>' : ''}
                    
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2 text-purple-400">Pro 会员</h3>
                        <p class="text-gray-400 text-sm">专业分析工具套件</p>
                    </div>
                    
                    <div class="mb-6">
                        <span class="text-4xl font-bold">¥\${proPlan ? (proPlan.current_price_cents / 100).toFixed(0) : '--'}</span>
                        <span class="text-gray-400">/\${isYearly ? '年' : '月'}</span>
                        \${proPlan && proPlan.original_price_cents > proPlan.current_price_cents ? \`
                            <span class="ml-2 text-sm text-gray-500 line-through">¥\${(proPlan.original_price_cents / 100).toFixed(0)}</span>
                        \` : ''}
                    </div>
                    
                    <ul class="space-y-3 mb-8">
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>每日50次分析
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>AI漫画解读
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>专业风险评估
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>行业对比分析
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>PDF无水印导出
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>500个收藏位
                        </li>
                    </ul>
                    
                    <button onclick="handleUpgrade('pro')" class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">
                        即将推出
                    </button>
                </div>
                
                <!-- Elite -->
                <div class="plan-card glass-card rounded-2xl p-6">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2 text-yellow-400">Elite 会员</h3>
                        <p class="text-gray-400 text-sm">企业级全功能套件</p>
                    </div>
                    
                    <div class="mb-6">
                        <span class="text-4xl font-bold">¥\${elitePlan ? (elitePlan.current_price_cents / 100).toFixed(0) : '--'}</span>
                        <span class="text-gray-400">/\${isYearly ? '年' : '月'}</span>
                        \${elitePlan && elitePlan.original_price_cents > elitePlan.current_price_cents ? \`
                            <span class="ml-2 text-sm text-gray-500 line-through">¥\${(elitePlan.original_price_cents / 100).toFixed(0)}</span>
                        \` : ''}
                    </div>
                    
                    <ul class="space-y-3 mb-8">
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>无限分析次数
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>全部Pro功能
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>批量分析
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>API访问权限
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>1000个收藏位
                        </li>
                        <li class="flex items-center text-sm">
                            <i class="fas fa-check feature-check mr-3"></i>优先客服支持
                        </li>
                    </ul>
                    
                    <button onclick="handleUpgrade('elite')" class="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-black font-medium transition-colors">
                        即将推出
                    </button>
                </div>
            \`;
        }
        
        // 加载对比数据
        async function loadComparison() {
            try {
                const response = await fetch('/api/membership/comparison');
                const data = await response.json();
                
                if (data.success) {
                    comparisonData = data;
                    renderComparison();
                }
            } catch (error) {
                console.error('Load comparison error:', error);
            }
        }
        
        // 渲染对比表格
        function renderComparison() {
            if (!comparisonData) return;
            
            const tbody = document.getElementById('comparisonBody');
            const features = comparisonData.tiers[0]?.features || [];
            
            tbody.innerHTML = features.map(feature => \`
                <tr class="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                    <td class="py-4 px-4 text-gray-300">\${feature.name}</td>
                    <td class="py-4 px-4 text-center">\${renderFeatureValue(feature.free)}</td>
                    <td class="py-4 px-4 text-center">\${renderFeatureValue(feature.pro)}</td>
                    <td class="py-4 px-4 text-center">\${renderFeatureValue(feature.elite)}</td>
                </tr>
            \`).join('');
        }
        
        // 渲染功能值
        function renderFeatureValue(value) {
            if (value === true) {
                return '<i class="fas fa-check text-green-500"></i>';
            } else if (value === false) {
                return '<i class="fas fa-times text-gray-600"></i>';
            } else {
                return '<span class="text-gray-300">' + value + '</span>';
            }
        }
        
        // 加载FAQ
        async function loadFaq() {
            try {
                const response = await fetch('/api/membership/faq');
                const data = await response.json();
                
                if (data.success) {
                    renderFaq(data.faqs);
                }
            } catch (error) {
                console.error('Load FAQ error:', error);
            }
        }
        
        // 渲染FAQ
        function renderFaq(faqs) {
            const faqList = document.getElementById('faqList');
            
            faqList.innerHTML = faqs.map((faq, index) => \`
                <div class="faq-item glass-card rounded-xl overflow-hidden" onclick="toggleFaq(this)">
                    <div class="flex items-center justify-between p-4 cursor-pointer">
                        <span class="font-medium">\${faq.question}</span>
                        <i class="fas fa-chevron-down faq-icon transition-transform text-gray-400"></i>
                    </div>
                    <div class="faq-answer px-4 pb-4 text-gray-400">
                        \${faq.answer}
                    </div>
                </div>
            \`).join('');
        }
        
        // 切换计费周期
        function switchBilling(billing) {
            currentBilling = billing;
            
            const monthlyBtn = document.getElementById('monthlyBtn');
            const yearlyBtn = document.getElementById('yearlyBtn');
            
            if (billing === 'monthly') {
                monthlyBtn.className = 'px-6 py-2 rounded-full text-sm font-medium transition-all bg-blue-600 text-white';
                yearlyBtn.className = 'px-6 py-2 rounded-full text-sm font-medium transition-all text-gray-400 hover:text-white';
            } else {
                monthlyBtn.className = 'px-6 py-2 rounded-full text-sm font-medium transition-all text-gray-400 hover:text-white';
                yearlyBtn.className = 'px-6 py-2 rounded-full text-sm font-medium transition-all bg-blue-600 text-white';
            }
            
            renderPlans();
        }
        
        // 切换FAQ
        function toggleFaq(element) {
            element.classList.toggle('active');
        }
        
        // 处理升级
        async function handleUpgrade(tier) {
            const token = localStorage.getItem('accessToken');
            
            if (!token) {
                alert('请先登录后再升级会员');
                window.location.href = '/';
                return;
            }
            
            // 显示即将推出提示
            alert('会员订阅功能正在开发中，敬请期待！\\n\\n您可以先体验免费版的所有功能。');
        }
        
        // 格式化日期
        function formatDate(dateStr) {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    </script>
</body>
</html>
`;
