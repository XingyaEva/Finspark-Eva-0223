// 智能问数助手页面HTML - 支持K线图表和AI走势解读
export const assistantPageHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能问数助手 - Finspark 财报分析系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
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
        
        .chat-bubble-user {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        
        .chat-bubble-assistant {
            background: rgba(51, 65, 85, 0.8);
            border: 1px solid rgba(148, 163, 184, 0.2);
        }
        
        .typing-indicator span {
            animation: typing 1.4s infinite ease-in-out;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        
        .sql-code {
            background: rgba(0, 0, 0, 0.3);
            font-family: 'Monaco', 'Menlo', monospace;
        }
        
        .data-table { font-size: 0.8rem; }
        .data-table th { background: rgba(59, 130, 246, 0.2); }
        .data-table tr:hover { background: rgba(59, 130, 246, 0.1); }
        
        .suggestion-chip { transition: all 0.2s; }
        .suggestion-chip:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .glow-border { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.5); border-radius: 3px; }
        
        .markdown-content h3 { font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #60a5fa; }
        .markdown-content p { margin-bottom: 0.75rem; }
        .markdown-content ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-content li { margin-bottom: 0.25rem; }
        .markdown-content strong { color: #fbbf24; }
        
        /* K线图表容器 */
        .kline-chart-container {
            width: 100%;
            height: 400px;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 12px;
            margin: 16px 0;
        }
        
        /* 股票标签 */
        .stock-tag {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-radius: 20px;
            font-size: 12px;
            color: #93c5fd;
        }
        
        /* 涨跌指示 */
        .change-up { color: #ef4444; }
        .change-down { color: #22c55e; }
        
        /* 图表布局 70/30 */
        .chart-layout {
            display: flex;
            gap: 16px;
        }
        .chart-area { flex: 7; }
        .insight-area { flex: 3; min-width: 280px; }
        
        @media (max-width: 1024px) {
            .chart-layout { flex-direction: column; }
            .insight-area { min-width: 100%; }
        }
    </style>
</head>
<body class="text-gray-100">
    <!-- 顶部导航 -->
    <nav class="fixed top-0 left-0 right-0 z-50 glass-card border-b border-gray-700/50">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <i class="fas fa-robot text-white text-lg"></i>
                </div>
                <div>
                    <h1 class="text-lg font-bold text-white">智能问数助手</h1>
                    <p class="text-xs text-gray-400">Text-to-SQL + K线分析 + AI解读</p>
                </div>
            </a>
            <div class="flex items-center gap-4">
                <a href="/" class="text-gray-400 hover:text-white transition">
                    <i class="fas fa-home mr-1"></i> 首页
                </a>
                <a href="/analysis" class="text-gray-400 hover:text-white transition">
                    <i class="fas fa-chart-line mr-1"></i> 财报分析
                </a>
            </div>
        </div>
    </nav>
    
    <!-- 主内容区 -->
    <div class="pt-20 pb-32 min-h-screen">
        <div class="max-w-6xl mx-auto px-4">
            
            <!-- 功能介绍卡片 -->
            <div class="glass-card rounded-2xl p-6 mb-6">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-database text-white text-xl"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white mb-2">智能股票问答 & K线分析</h2>
                        <p class="text-gray-400 text-sm">
                            支持自然语言查询股票数据，自动识别股票并获取K线行情，生成动态对比图表，AI专业解读走势。
                        </p>
                    </div>
                </div>
                
                <!-- 能力展示 -->
                <div class="grid grid-cols-4 gap-4 mt-6">
                    <div class="bg-gray-800/50 rounded-xl p-4 text-center">
                        <div class="text-2xl font-bold text-blue-400" id="stockCount">--</div>
                        <div class="text-xs text-gray-500">股票数据</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-xl p-4 text-center">
                        <div class="text-2xl font-bold text-green-400" id="industryCount">20+</div>
                        <div class="text-xs text-gray-500">行业分类</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-xl p-4 text-center">
                        <div class="text-2xl font-bold text-purple-400">
                            <i class="fas fa-chart-candlestick"></i>
                        </div>
                        <div class="text-xs text-gray-500">K线图表</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-xl p-4 text-center">
                        <div class="text-2xl font-bold text-yellow-400">
                            <i class="fas fa-brain"></i>
                        </div>
                        <div class="text-xs text-gray-500">AI解读</div>
                    </div>
                </div>
            </div>
            
            <!-- 建议问题 -->
            <div class="mb-6">
                <div class="text-sm text-gray-500 mb-3">
                    <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 试试这些问题:
                </div>
                <div class="flex flex-wrap gap-2" id="suggestions">
                    <button class="suggestion-chip px-4 py-2 bg-gray-800/60 hover:bg-blue-600/30 border border-gray-700 hover:border-blue-500 rounded-full text-sm text-gray-300 hover:text-white" onclick="askQuestion('茅台和五粮液的走势对比')">
                        <i class="fas fa-chart-line mr-1 text-blue-400"></i>茅台和五粮液的走势对比
                    </button>
                    <button class="suggestion-chip px-4 py-2 bg-gray-800/60 hover:bg-blue-600/30 border border-gray-700 hover:border-blue-500 rounded-full text-sm text-gray-300 hover:text-white" onclick="askQuestion('比亚迪最近的股价走势如何')">
                        <i class="fas fa-chart-line mr-1 text-green-400"></i>比亚迪最近的股价走势如何
                    </button>
                    <button class="suggestion-chip px-4 py-2 bg-gray-800/60 hover:bg-blue-600/30 border border-gray-700 hover:border-blue-500 rounded-full text-sm text-gray-300 hover:text-white" onclick="askQuestion('宁德时代和中芯国际走势对比')">
                        <i class="fas fa-chart-line mr-1 text-purple-400"></i>宁德时代和中芯国际对比
                    </button>
                    <button class="suggestion-chip px-4 py-2 bg-gray-800/60 hover:bg-green-600/30 border border-gray-700 hover:border-green-500 rounded-full text-sm text-gray-300 hover:text-white" onclick="askQuestion('数据库里有多少只股票')">
                        <i class="fas fa-database mr-1 text-green-400"></i>数据库里有多少只股票
                    </button>
                    <button class="suggestion-chip px-4 py-2 bg-gray-800/60 hover:bg-green-600/30 border border-gray-700 hover:border-green-500 rounded-full text-sm text-gray-300 hover:text-white" onclick="askQuestion('列出所有白酒行业的股票')">
                        <i class="fas fa-list mr-1 text-yellow-400"></i>列出所有白酒行业股票
                    </button>
                </div>
            </div>
            
            <!-- 对话区域 -->
            <div class="glass-card rounded-2xl overflow-hidden glow-border">
                <!-- 对话历史 -->
                <div id="chatHistory" class="min-h-[500px] max-h-[700px] overflow-y-auto p-6 space-y-4">
                    <!-- 欢迎消息 -->
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-robot text-white text-sm"></i>
                        </div>
                        <div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                            <p class="text-gray-200">👋 你好！我是智能问数助手。</p>
                            <p class="text-gray-300 mt-2">我可以帮你：</p>
                            <ul class="text-gray-400 text-sm mt-1 ml-4 list-disc">
                                <li><strong class="text-blue-400">股票走势分析</strong> - 输入股票名称，自动生成K线图和AI解读</li>
                                <li><strong class="text-green-400">多股票对比</strong> - 对比多只股票的走势表现</li>
                                <li><strong class="text-purple-400">数据库查询</strong> - 用自然语言查询股票信息</li>
                            </ul>
                            <p class="text-gray-500 text-sm mt-3">例如: "茅台和五粮液最近的走势对比" 或 "白酒行业有哪些股票"</p>
                        </div>
                    </div>
                </div>
                
                <!-- 输入区域 -->
                <div class="border-t border-gray-700/50 p-4 bg-gray-900/50">
                    <div class="flex items-center gap-3">
                        <div class="flex-1 relative">
                            <input 
                                type="text" 
                                id="questionInput" 
                                placeholder="输入股票名称查看走势，或用自然语言提问..."
                                class="w-full bg-gray-800/80 border border-gray-600 focus:border-blue-500 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                                onkeypress="if(event.key === 'Enter') sendQuestion()"
                            >
                            <button 
                                onclick="sendQuestion()"
                                class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center transition"
                            >
                                <i class="fas fa-paper-plane text-white text-sm"></i>
                            </button>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span><i class="fas fa-chart-line mr-1 text-blue-400"></i> 支持K线走势 | <i class="fas fa-shield-alt mr-1"></i> 安全查询</span>
                        <span id="queryStatus"></span>
                    </div>
                </div>
            </div>
            
        </div>
    </div>
    
    <script>
        let conversationHistory = [];
        let isProcessing = false;
        let chartInstances = {};
        
        // 颜色配置
        const STOCK_COLORS = [
            '#3b82f6', // blue
            '#ef4444', // red
            '#22c55e', // green
            '#f59e0b', // amber
            '#8b5cf6', // purple
        ];
        
        // 加载数据库统计
        async function loadStats() {
            try {
                const healthResp = await fetch('/api/health');
                const health = await healthResp.json();
                document.getElementById('stockCount').textContent = health.stockCount || '--';
            } catch (e) {
                console.error('Failed to load stats:', e);
            }
        }
        
        // 发送问题
        async function sendQuestion() {
            const input = document.getElementById('questionInput');
            const question = input.value.trim();
            if (!question || isProcessing) return;
            askQuestion(question);
            input.value = '';
        }
        
        // 判断是否是K线查询
        function isKlineQuery(question) {
            const klineKeywords = ['走势', 'K线', '行情', '涨跌', '对比', '比较', '价格', '股价', '趋势', '表现', '怎么样', '如何'];
            return klineKeywords.some(kw => question.includes(kw));
        }
        
        // 主查询函数
        async function askQuestion(question) {
            if (isProcessing) return;
            isProcessing = true;
            
            const statusEl = document.getElementById('queryStatus');
            addUserMessage(question);
            const loadingId = addLoadingMessage();
            
            try {
                // 判断查询类型
                if (isKlineQuery(question)) {
                    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在识别股票并获取K线数据...';
                    await handleKlineQuery(question, loadingId, statusEl);
                } else {
                    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在分析问题并生成SQL...';
                    await handleSqlQuery(question, loadingId, statusEl);
                }
            } catch (error) {
                removeLoadingMessage(loadingId);
                addAssistantMessage('❌ 发生错误: ' + error.message);
                statusEl.textContent = '';
            }
            
            isProcessing = false;
            scrollToBottom();
        }
        
        // 处理K线查询
        async function handleKlineQuery(question, loadingId, statusEl) {
            try {
                // 使用smart-query API
                const response = await fetch('/api/assistant/smart-query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question, conversationHistory })
                });
                
                const result = await response.json();
                removeLoadingMessage(loadingId);
                
                if (!result.success) {
                    addAssistantMessage('❌ 查询失败: ' + (result.error || '未知错误'));
                    statusEl.textContent = '';
                    return;
                }
                
                // 如果是K线数据
                if (result.type === 'kline' && result.stocks && result.stocks.length > 0) {
                    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在生成图表...';
                    
                    // 构建响应
                    let html = '<div class="mb-4">';
                    html += '<div class="flex flex-wrap gap-2 mb-3">';
                    result.stocks.forEach((stock, idx) => {
                        html += '<span class="stock-tag"><i class="fas fa-chart-line mr-1" style="color:' + STOCK_COLORS[idx % 5] + '"></i>' + stock.name + ' (' + stock.ts_code + ')</span>';
                    });
                    html += '</div>';
                    
                    // 图表容器ID
                    const chartId = 'chart-' + Date.now();
                    
                    // 70/30 布局
                    html += '<div class="chart-layout">';
                    html += '<div class="chart-area"><div id="' + chartId + '" class="kline-chart-container"></div></div>';
                    html += '<div class="insight-area glass-card rounded-xl p-4">';
                    html += '<h4 class="text-sm font-semibold text-blue-400 mb-3"><i class="fas fa-brain mr-1"></i> AI 走势解读</h4>';
                    html += '<div id="' + chartId + '-insight" class="text-sm text-gray-300">';
                    if (result.analysis) {
                        html += formatMarkdown(result.analysis);
                    } else {
                        html += '<div class="flex items-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> 正在生成解读...</div>';
                    }
                    html += '</div></div></div>';
                    html += '</div>';
                    
                    addAssistantMessage(html);
                    
                    // 渲染图表
                    setTimeout(() => {
                        renderKlineChart(chartId, result.stocks, result.klineData);
                    }, 100);
                    
                    statusEl.innerHTML = '<i class="fas fa-check text-green-400 mr-1"></i> K线图表已生成';
                    
                } else if (result.type === 'query' || result.type === 'chat') {
                    // 普通查询结果
                    handleQueryResult(result, statusEl);
                } else {
                    addAssistantMessage('未能识别到相关股票，请尝试输入具体的股票名称，如"茅台"、"比亚迪"等。');
                    statusEl.textContent = '';
                }
                
            } catch (error) {
                console.error('K线查询错误:', error);
                throw error;
            }
        }
        
        // 处理SQL查询
        async function handleSqlQuery(question, loadingId, statusEl) {
            const queryResp = await fetch('/api/assistant/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, conversationHistory })
            });
            
            const queryResult = await queryResp.json();
            removeLoadingMessage(loadingId);
            
            if (!queryResult.success) {
                addAssistantMessage('❌ 查询失败: ' + queryResult.error);
                statusEl.textContent = '';
                return;
            }
            
            handleQueryResult(queryResult, statusEl);
        }
        
        // 处理查询结果
        async function handleQueryResult(queryResult, statusEl) {
            if (queryResult.type === 'chat') {
                addAssistantMessage(queryResult.message);
                statusEl.textContent = '';
                return;
            }
            
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在生成数据解读...';
            
            let responseHtml = '<div class="mb-3">' +
                '<div class="text-xs text-gray-400 mb-1"><i class="fas fa-code mr-1"></i> 执行的SQL:</div>' +
                '<pre class="sql-code rounded-lg px-3 py-2 text-xs text-green-400 overflow-x-auto">' + escapeHtml(queryResult.sql) + '</pre>' +
                '</div>' +
                '<div class="text-sm text-gray-400 mb-3">' +
                '<i class="fas fa-info-circle mr-1"></i> ' + (queryResult.explanation || '查询完成') +
                '<span class="ml-2 text-blue-400">(' + queryResult.rowCount + ' 条结果)</span>' +
                '</div>';
            
            if (queryResult.data && queryResult.data.length > 0) {
                responseHtml += renderDataTable(queryResult.data);
            }
            
            const msgId = addAssistantMessage(responseHtml);
            
            // 生成AI解读
            try {
                const interpretResp = await fetch('/api/assistant/interpret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: queryResult.question || '',
                        sql: queryResult.sql,
                        data: queryResult.data,
                        explanation: queryResult.explanation
                    })
                });
                
                const interpretResult = await interpretResp.json();
                
                if (interpretResult.success && interpretResult.interpretation) {
                    appendToMessage(msgId, 
                        '<div class="mt-4 pt-4 border-t border-gray-600">' +
                        '<div class="text-xs text-yellow-400 mb-2"><i class="fas fa-lightbulb mr-1"></i> AI 数据解读:</div>' +
                        '<div class="markdown-content text-sm text-gray-300">' + formatMarkdown(interpretResult.interpretation) + '</div>' +
                        '</div>'
                    );
                }
            } catch (e) {
                console.error('解读生成失败:', e);
            }
            
            statusEl.innerHTML = '<i class="fas fa-check text-green-400 mr-1"></i> 查询完成';
            
            conversationHistory.push(
                { role: 'user', content: queryResult.question || '' },
                { role: 'assistant', content: 'SQL: ' + queryResult.sql + '\\n结果数量: ' + queryResult.rowCount }
            );
        }
        
        // 渲染K线图表 (使用收盘价折线图对比)
        function renderKlineChart(chartId, stocks, klineData) {
            const chartDom = document.getElementById(chartId);
            if (!chartDom) return;
            
            // 销毁旧实例
            if (chartInstances[chartId]) {
                chartInstances[chartId].dispose();
            }
            
            const chart = echarts.init(chartDom, 'dark');
            chartInstances[chartId] = chart;
            
            // 准备数据
            const allDates = new Set();
            const seriesData = [];
            
            klineData.forEach((stock, idx) => {
                if (!stock.success || !stock.data || stock.data.length === 0) return;
                
                // 收集所有日期
                stock.data.forEach(d => allDates.add(d.trade_date));
                
                // 创建日期到价格的映射
                const priceMap = {};
                stock.data.forEach(d => {
                    priceMap[d.trade_date] = d.close;
                });
                
                seriesData.push({
                    name: stock.name || stock.ts_code,
                    priceMap,
                    color: STOCK_COLORS[idx % 5]
                });
            });
            
            // 排序日期
            const dates = Array.from(allDates).sort();
            
            // 计算涨跌幅（以第一天为基准）
            const series = seriesData.map((s, idx) => {
                const basePrice = s.priceMap[dates[0]];
                const data = dates.map(date => {
                    const price = s.priceMap[date];
                    if (!price || !basePrice) return null;
                    return ((price - basePrice) / basePrice * 100).toFixed(2);
                });
                
                return {
                    name: s.name,
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 2 },
                    itemStyle: { color: s.color },
                    data: data
                };
            });
            
            const option = {
                backgroundColor: 'transparent',
                title: {
                    text: '股票走势对比 (涨跌幅%)',
                    left: 'center',
                    textStyle: { color: '#e5e7eb', fontSize: 14 }
                },
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    textStyle: { color: '#e5e7eb' },
                    formatter: function(params) {
                        let html = '<div style="font-weight:600;margin-bottom:8px">' + params[0].axisValue + '</div>';
                        params.forEach(p => {
                            const val = p.value;
                            const color = val >= 0 ? '#ef4444' : '#22c55e';
                            const sign = val >= 0 ? '+' : '';
                            html += '<div style="display:flex;align-items:center;margin:4px 0">';
                            html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:8px"></span>';
                            html += '<span style="flex:1">' + p.seriesName + '</span>';
                            html += '<span style="color:' + color + ';font-weight:600">' + sign + val + '%</span>';
                            html += '</div>';
                        });
                        return html;
                    }
                },
                legend: {
                    top: 30,
                    textStyle: { color: '#9ca3af' },
                    data: seriesData.map(s => s.name)
                },
                grid: {
                    left: '3%',
                    right: '3%',
                    bottom: '15%',
                    top: '15%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: dates.map(d => d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8)),
                    axisLine: { lineStyle: { color: '#4b5563' } },
                    axisLabel: { 
                        color: '#9ca3af',
                        rotate: 45,
                        formatter: function(value) {
                            return value.substring(5);
                        }
                    }
                },
                yAxis: {
                    type: 'value',
                    name: '涨跌幅(%)',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLine: { lineStyle: { color: '#4b5563' } },
                    axisLabel: { 
                        color: '#9ca3af',
                        formatter: '{value}%'
                    },
                    splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
                },
                dataZoom: [
                    {
                        type: 'inside',
                        start: 70,
                        end: 100
                    },
                    {
                        type: 'slider',
                        start: 70,
                        end: 100,
                        height: 20,
                        bottom: 10,
                        borderColor: '#4b5563',
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        fillerColor: 'rgba(59, 130, 246, 0.2)',
                        handleStyle: { color: '#3b82f6' },
                        textStyle: { color: '#9ca3af' }
                    }
                ],
                series: series
            };
            
            chart.setOption(option);
            
            // 响应式
            window.addEventListener('resize', () => {
                chart.resize();
            });
        }
        
        function addUserMessage(content) {
            const chatHistoryEl = document.getElementById('chatHistory');
            const div = document.createElement('div');
            div.className = 'flex items-start gap-3 justify-end';
            div.innerHTML = '<div class="chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">' +
                '<p class="text-white">' + escapeHtml(content) + '</p></div>' +
                '<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">' +
                '<i class="fas fa-user text-white text-sm"></i></div>';
            chatHistoryEl.appendChild(div);
            scrollToBottom();
        }
        
        function addAssistantMessage(content) {
            const chatHistoryEl = document.getElementById('chatHistory');
            const div = document.createElement('div');
            const msgId = 'msg-' + Date.now();
            div.className = 'flex items-start gap-3';
            div.id = msgId;
            div.innerHTML = '<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">' +
                '<i class="fas fa-robot text-white text-sm"></i></div>' +
                '<div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] msg-content">' + content + '</div>';
            chatHistoryEl.appendChild(div);
            scrollToBottom();
            return msgId;
        }
        
        function appendToMessage(msgId, content) {
            const msg = document.getElementById(msgId);
            if (msg) {
                const contentEl = msg.querySelector('.msg-content');
                if (contentEl) contentEl.innerHTML += content;
            }
            scrollToBottom();
        }
        
        function addLoadingMessage() {
            const chatHistoryEl = document.getElementById('chatHistory');
            const div = document.createElement('div');
            const loadingId = 'loading-' + Date.now();
            div.className = 'flex items-start gap-3';
            div.id = loadingId;
            div.innerHTML = '<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">' +
                '<i class="fas fa-robot text-white text-sm"></i></div>' +
                '<div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3">' +
                '<div class="typing-indicator flex gap-1">' +
                '<span class="w-2 h-2 bg-gray-400 rounded-full"></span>' +
                '<span class="w-2 h-2 bg-gray-400 rounded-full"></span>' +
                '<span class="w-2 h-2 bg-gray-400 rounded-full"></span></div></div>';
            chatHistoryEl.appendChild(div);
            scrollToBottom();
            return loadingId;
        }
        
        function removeLoadingMessage(loadingId) {
            const el = document.getElementById(loadingId);
            if (el) el.remove();
        }
        
        function renderDataTable(data) {
            if (!data || data.length === 0) return '';
            const keys = Object.keys(data[0]);
            const displayData = data.slice(0, 20);
            
            let html = '<div class="overflow-x-auto"><table class="data-table w-full text-left"><thead><tr>';
            keys.forEach(k => { html += '<th class="px-3 py-2 text-gray-300 font-medium">' + escapeHtml(k) + '</th>'; });
            html += '</tr></thead><tbody>';
            
            displayData.forEach(row => {
                html += '<tr class="border-t border-gray-700/50">';
                keys.forEach(k => {
                    const val = row[k];
                    html += '<td class="px-3 py-2 text-gray-400">' + (val !== null ? escapeHtml(String(val)) : '-') + '</td>';
                });
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            if (data.length > 20) html += '<div class="text-xs text-gray-500 mt-2">显示前20条，共' + data.length + '条结果</div>';
            return html;
        }
        
        function formatMarkdown(text) {
            if (!text) return '';
            return text
                .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
                .replace(/### (.+)/g, '<h3 class="text-blue-400 font-semibold mt-3 mb-1">$1</h3>')
                .replace(/## (.+)/g, '<h3 class="text-blue-400 font-semibold mt-3 mb-1">$1</h3>')
                .replace(/^- (.+)/gm, '<li class="ml-4">$1</li>')
                .replace(/^\\d+\\. (.+)/gm, '<li class="ml-4">$1</li>')
                .replace(/\\n\\n/g, '</p><p class="my-2">')
                .replace(/\\n/g, '<br>');
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function scrollToBottom() {
            const chatHistoryEl = document.getElementById('chatHistory');
            setTimeout(() => { chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight; }, 100);
        }
        
        loadStats();
        document.getElementById('questionInput').focus();
    </script>
</body>
</html>
`;
