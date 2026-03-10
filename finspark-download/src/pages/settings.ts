// 用户设置页面
// 包含偏好设置、账户管理、通知设置等
import { responsiveStyles } from '../styles/responsive';

export const settingsPageHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>设置 - Finspark 投资分析</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans SC', sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); min-height: 100vh; }
        .gold-text { color: #d4af37; }
        .gold-gradient { background: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.2); }
        .btn-gold { background: linear-gradient(135deg, #d4af37 0%, #f5d17e 100%); color: #0a0a0a; font-weight: 600; }
        .btn-outline { border: 1px solid rgba(212, 175, 55, 0.5); color: #d4af37; }
        .btn-outline:hover { background: rgba(212, 175, 55, 0.1); }
        .setting-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s; }
        .setting-card:hover { border-color: rgba(212, 175, 55, 0.3); }
        .toggle-switch { position: relative; width: 48px; height: 26px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #374151; border-radius: 13px; transition: 0.3s; }
        .toggle-slider:before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .toggle-switch input:checked + .toggle-slider { background: #d4af37; }
        .toggle-switch input:checked + .toggle-slider:before { transform: translateX(22px); }
        .select-custom { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; }
        .select-custom:focus { border-color: #d4af37; outline: none; box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2); }
        .nav-tab { padding: 12px 24px; color: #9ca3af; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s; }
        .nav-tab:hover { color: #d4af37; }
        .nav-tab.active { color: #d4af37; border-bottom-color: #d4af37; }
        .toast { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        \${responsiveStyles}
    </style>
</head>
<body class="text-white">
    <!-- 桌面端导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-black/30 border-b border-gray-800 hide-on-mobile">
        <div class="container-adaptive flex justify-between items-center">
            <a href="/" class="text-2xl font-bold gold-gradient">Finspark</a>
            <div class="flex items-center space-x-4">
                <a href="/membership" class="text-gray-400 hover:text-white transition">会员中心</a>
                <a href="/" class="btn-gold px-4 py-2 rounded-lg text-sm">
                    <i class="fas fa-chart-line mr-2"></i>开始分析
                </a>
            </div>
        </div>
    </nav>
    
    <!-- 移动端导航栏 -->
    <nav class="mobile-nav show-on-mobile backdrop-blur-md bg-black/30 border-b border-gray-800">
        <div class="px-4 py-3 flex items-center justify-between">
            <a href="/" class="text-xl font-bold gold-gradient">Finspark</a>
            <div class="flex items-center space-x-2">
                <a href="/membership" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-crown text-lg"></i>
                </a>
                <a href="/" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-home text-lg"></i>
                </a>
            </div>
        </div>
    </nav>
    
    <main class="pt-adaptive-header pb-8 md:pb-16">
        <div class="container-adaptive" style="max-width: 768px;">
            <!-- 页面标题 -->
            <div class="mb-6 md:mb-8">
                <h1 class="text-2xl md:text-3xl font-bold gold-gradient mb-2">设置</h1>
                <p class="text-gray-400 text-sm md:text-base">管理您的偏好设置和账户信息</p>
            </div>
            
            <!-- 选项卡导航 -->
            <div class="flex border-b border-gray-800 mb-4 md:mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div class="nav-tab active whitespace-nowrap text-sm md:text-base" onclick="switchTab('analysis')">
                    <i class="fas fa-chart-pie mr-1 md:mr-2"></i><span class="hidden sm:inline">分析</span>偏好
                </div>
                <div class="nav-tab whitespace-nowrap text-sm md:text-base" onclick="switchTab('appearance')">
                    <i class="fas fa-palette mr-1 md:mr-2"></i><span class="hidden sm:inline">外观</span>主题
                </div>
                <div class="nav-tab whitespace-nowrap text-sm md:text-base" onclick="switchTab('notifications')">
                    <i class="fas fa-bell mr-1 md:mr-2"></i>通知<span class="hidden sm:inline">设置</span>
                </div>
                <div class="nav-tab whitespace-nowrap text-sm md:text-base" onclick="switchTab('account')">
                    <i class="fas fa-user-cog mr-1 md:mr-2"></i>账户<span class="hidden sm:inline">管理</span>
                </div>
            </div>
            
            <!-- 加载状态 -->
            <div id="loadingState" class="text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl gold-text mb-4"></i>
                <p class="text-gray-400">加载设置中...</p>
            </div>
            
            <!-- 未登录提示 -->
            <div id="loginPrompt" class="hidden text-center py-12">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
                    <i class="fas fa-lock text-3xl text-gray-500"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">请先登录</h3>
                <p class="text-gray-400 mb-6">登录后可以保存您的个性化设置</p>
                <button onclick="showLoginModal()" class="btn-gold px-6 py-3 rounded-lg">
                    <i class="fas fa-sign-in-alt mr-2"></i>登录 / 注册
                </button>
            </div>
            
            <!-- 设置内容 -->
            <div id="settingsContent" class="hidden space-y-6">
                <!-- 分析偏好 -->
                <div id="tab-analysis" class="space-y-4">
                    <!-- Agent 配置入口 -->
                    <a href="/settings/agents" class="setting-card rounded-xl p-5 block hover:border-yellow-500/50 cursor-pointer">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-600 to-orange-600 flex items-center justify-center">
                                    <i class="fas fa-robot text-white text-lg"></i>
                                </div>
                                <div>
                                    <h3 class="font-semibold gold-text">Agent 配置中心</h3>
                                    <p class="text-sm text-gray-400 mt-1">自定义 AI Agent 的模型偏好、分析深度和高级参数</p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-500"></i>
                        </div>
                    </a>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">默认报告类型</h3>
                                <p class="text-sm text-gray-400 mt-1">选择默认分析的财报类型</p>
                            </div>
                            <select id="defaultReportType" class="select-custom" onchange="updatePreference('defaultReportType', this.value)">
                                <option value="annual">年度报告</option>
                                <option value="quarterly">季度报告</option>
                                <option value="all">全部报告</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">分析深度</h3>
                                <p class="text-sm text-gray-400 mt-1">选择分析的详细程度</p>
                            </div>
                            <select id="analysisDepth" class="select-custom" onchange="updatePreference('analysisDepth', this.value)">
                                <option value="quick">快速分析</option>
                                <option value="standard">标准分析</option>
                                <option value="deep">深度分析</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">包含漫画解读</h3>
                                <p class="text-sm text-gray-400 mt-1">默认生成AI漫画解读版</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="includeComic" onchange="updatePreference('includeComic', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">包含业绩预测</h3>
                                <p class="text-sm text-gray-400 mt-1">默认包含未来业绩预测分析</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="includeForecast" onchange="updatePreference('includeForecast', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">包含行业对比</h3>
                                <p class="text-sm text-gray-400 mt-1">默认包含同行业公司对比</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="includeIndustryCompare" onchange="updatePreference('includeIndustryCompare', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">默认导出格式</h3>
                                <p class="text-sm text-gray-400 mt-1">选择报告导出的默认格式</p>
                            </div>
                            <select id="exportFormat" class="select-custom" onchange="updatePreference('exportFormat', this.value)">
                                <option value="pdf">PDF 文档</option>
                                <option value="html">HTML 网页</option>
                                <option value="json">JSON 数据</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 外观主题 -->
                <div id="tab-appearance" class="hidden space-y-4">
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">界面主题</h3>
                                <p class="text-sm text-gray-400 mt-1">选择您喜欢的界面主题</p>
                            </div>
                            <select id="theme" class="select-custom" onchange="updatePreference('theme', this.value)">
                                <option value="dark">深色模式</option>
                                <option value="light">浅色模式</option>
                                <option value="auto">跟随系统</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">图表配色</h3>
                                <p class="text-sm text-gray-400 mt-1">选择图表的主题配色</p>
                            </div>
                            <select id="chartColorScheme" class="select-custom" onchange="updatePreference('chartColorScheme', this.value)">
                                <option value="gold">金色系</option>
                                <option value="blue">蓝色系</option>
                                <option value="green">绿色系</option>
                                <option value="purple">紫色系</option>
                            </select>
                        </div>
                        <div class="flex gap-2 mt-3">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 cursor-pointer" onclick="selectColorScheme('gold')"></div>
                            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 cursor-pointer" onclick="selectColorScheme('blue')"></div>
                            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-green-600 to-green-400 cursor-pointer" onclick="selectColorScheme('green')"></div>
                            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 cursor-pointer" onclick="selectColorScheme('purple')"></div>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">语言</h3>
                                <p class="text-sm text-gray-400 mt-1">选择界面显示语言</p>
                            </div>
                            <select id="language" class="select-custom" onchange="updatePreference('language', this.value)">
                                <option value="zh-CN">简体中文</option>
                                <option value="zh-TW">繁体中文</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 通知设置 -->
                <div id="tab-notifications" class="hidden space-y-4">
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">邮件通知</h3>
                                <p class="text-sm text-gray-400 mt-1">接收重要更新的邮件通知</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="emailNotifications" onchange="updatePreference('emailNotifications', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">报告完成通知</h3>
                                <p class="text-sm text-gray-400 mt-1">分析报告生成完成时通知我</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="reportCompleteNotify" onchange="updatePreference('reportCompleteNotify', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">每周摘要</h3>
                                <p class="text-sm text-gray-400 mt-1">每周发送投资分析摘要邮件</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="weeklyDigest" onchange="updatePreference('weeklyDigest', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold">营销邮件</h3>
                                <p class="text-sm text-gray-400 mt-1">接收产品更新和促销信息</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="marketingEmails" onchange="updatePreference('marketingEmails', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 账户管理 -->
                <div id="tab-account" class="hidden space-y-4">
                    <div class="setting-card rounded-xl p-5">
                        <h3 class="font-semibold mb-4">常用股票</h3>
                        <div id="favoriteStocksList" class="flex flex-wrap gap-2 mb-4">
                            <!-- 动态生成 -->
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="newFavoriteStock" placeholder="输入股票代码" 
                                class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
                            <button onclick="addFavoriteStock()" class="btn-outline px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-plus mr-1"></i>添加
                            </button>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">搜索历史</h3>
                                <p class="text-sm text-gray-400 mt-1">清除您的搜索历史记录</p>
                            </div>
                            <button onclick="clearSearchHistory()" class="btn-outline px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-trash mr-1"></i>清除历史
                            </button>
                        </div>
                    </div>
                    
                    <div class="setting-card rounded-xl p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="font-semibold">重置设置</h3>
                                <p class="text-sm text-gray-400 mt-1">将所有设置恢复为默认值</p>
                            </div>
                            <button onclick="resetAllPreferences()" class="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition">
                                <i class="fas fa-undo mr-1"></i>重置
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 保存状态指示器 -->
                <div id="saveIndicator" class="fixed bottom-8 right-8 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg opacity-0 transition-opacity duration-300">
                    <i class="fas fa-check mr-2"></i>已保存
                </div>
            </div>
        </div>
    </main>
    
    <script>
        let currentPreferences = {};
        let isLoggedIn = false;
        
        // 初始化
        async function init() {
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                showLoginRequired();
                return;
            }
            
            try {
                const response = await fetch('/api/preferences', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.status === 401) {
                    showLoginRequired();
                    return;
                }
                
                const data = await response.json();
                
                if (data.success) {
                    isLoggedIn = true;
                    currentPreferences = data.preferences;
                    applyPreferencesToUI();
                    showSettings();
                } else {
                    showLoginRequired();
                }
            } catch (error) {
                console.error('Load preferences error:', error);
                showLoginRequired();
            }
        }
        
        function showLoginRequired() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('loginPrompt').classList.remove('hidden');
            document.getElementById('settingsContent').classList.add('hidden');
        }
        
        function showSettings() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('loginPrompt').classList.add('hidden');
            document.getElementById('settingsContent').classList.remove('hidden');
        }
        
        function showLoginModal() {
            window.location.href = '/?login=true';
        }
        
        // 应用偏好到UI
        function applyPreferencesToUI() {
            // 下拉选择
            ['defaultReportType', 'analysisDepth', 'theme', 'chartColorScheme', 'language', 'exportFormat'].forEach(key => {
                const el = document.getElementById(key);
                if (el && currentPreferences[key]) {
                    el.value = currentPreferences[key];
                }
            });
            
            // 开关
            ['includeComic', 'includeForecast', 'includeIndustryCompare', 
             'emailNotifications', 'reportCompleteNotify', 'weeklyDigest', 'marketingEmails'].forEach(key => {
                const el = document.getElementById(key);
                if (el) {
                    el.checked = currentPreferences[key] === true;
                }
            });
            
            // 常用股票
            renderFavoriteStocks();
        }
        
        // 渲染常用股票
        function renderFavoriteStocks() {
            const list = document.getElementById('favoriteStocksList');
            const stocks = currentPreferences.favoriteStocks || [];
            
            if (stocks.length === 0) {
                list.innerHTML = '<span class="text-gray-500 text-sm">暂无常用股票</span>';
                return;
            }
            
            list.innerHTML = stocks.map(code => \`
                <span class="px-3 py-1 bg-gray-800 rounded-full text-sm flex items-center gap-2">
                    \${code}
                    <button onclick="removeFavoriteStock('\${code}')" class="text-gray-500 hover:text-red-400">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            \`).join('');
        }
        
        // 更新偏好设置
        async function updatePreference(key, value) {
            if (!isLoggedIn) return;
            
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/preferences', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ [key]: value })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentPreferences = data.preferences;
                    showSaveIndicator();
                } else {
                    alert('保存失败: ' + data.error);
                }
            } catch (error) {
                console.error('Update preference error:', error);
                alert('保存失败，请稍后重试');
            }
        }
        
        // 显示保存指示器
        function showSaveIndicator() {
            const indicator = document.getElementById('saveIndicator');
            indicator.style.opacity = '1';
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }
        
        // 切换选项卡
        function switchTab(tabName) {
            // 更新导航
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.closest('.nav-tab').classList.add('active');
            
            // 更新内容
            ['analysis', 'appearance', 'notifications', 'account'].forEach(name => {
                const tab = document.getElementById('tab-' + name);
                if (tab) {
                    tab.classList.toggle('hidden', name !== tabName);
                }
            });
        }
        
        // 选择配色方案
        function selectColorScheme(scheme) {
            document.getElementById('chartColorScheme').value = scheme;
            updatePreference('chartColorScheme', scheme);
        }
        
        // 添加常用股票
        async function addFavoriteStock() {
            const input = document.getElementById('newFavoriteStock');
            const stockCode = input.value.trim().toUpperCase();
            
            if (!stockCode) return;
            
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/preferences/favorite-stocks', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stockCode })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentPreferences.favoriteStocks = data.favoriteStocks;
                    renderFavoriteStocks();
                    input.value = '';
                    showSaveIndicator();
                } else {
                    alert('添加失败: ' + data.error);
                }
            } catch (error) {
                console.error('Add favorite stock error:', error);
                alert('添加失败，请稍后重试');
            }
        }
        
        // 移除常用股票
        async function removeFavoriteStock(stockCode) {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/preferences/favorite-stocks/' + stockCode, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentPreferences.favoriteStocks = data.favoriteStocks;
                    renderFavoriteStocks();
                    showSaveIndicator();
                }
            } catch (error) {
                console.error('Remove favorite stock error:', error);
            }
        }
        
        // 清除搜索历史
        async function clearSearchHistory() {
            if (!confirm('确定要清除所有搜索历史吗？')) return;
            
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/preferences/recent-searches', {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentPreferences.recentSearches = [];
                    showSaveIndicator();
                    alert('搜索历史已清除');
                }
            } catch (error) {
                console.error('Clear search history error:', error);
            }
        }
        
        // 重置所有设置
        async function resetAllPreferences() {
            if (!confirm('确定要将所有设置重置为默认值吗？此操作不可撤销。')) return;
            
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/preferences/reset', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentPreferences = data.preferences;
                    applyPreferencesToUI();
                    showSaveIndicator();
                    alert('设置已重置为默认值');
                }
            } catch (error) {
                console.error('Reset preferences error:', error);
                alert('重置失败，请稍后重试');
            }
        }
        
        // 页面加载时初始化
        init();
    </script>
</body>
</html>
`;

export default settingsPageHtml;
