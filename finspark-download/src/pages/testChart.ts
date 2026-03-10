// ECharts 测试页面
export const testChartPageHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ECharts & API 测试</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #1a1a1a;
            color: white;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 { color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #2196F3; margin-top: 30px; }
        #test-chart {
            width: 100%;
            height: 400px;
            background: #2a2a2a;
            border: 1px solid #444;
            margin: 20px 0;
        }
        .info {
            margin: 20px 0;
            padding: 15px;
            background: #2a2a2a;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
        }
        .error {
            border-left-color: #f44336;
        }
        .status-item {
            margin: 10px 0;
            padding: 10px;
            background: #1a1a1a;
            border-radius: 4px;
        }
        .success { color: #4CAF50; }
        .fail { color: #f44336; }
        .warning { color: #ff9800; }
        #logs {
            margin-top: 20px;
            padding: 15px;
            background: #000;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            border-radius: 4px;
            max-height: 400px;
            overflow-y: auto;
        }
        .log-entry {
            margin: 5px 0;
            padding: 5px;
            border-bottom: 1px solid #333;
        }
        button {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: #1976D2;
        }
    </style>
</head>
<body>
    <h1>🔧 Finspark 系统诊断工具</h1>
    
    <div id="summary" class="info">
        <h3>🎯 测试摘要</h3>
        <div class="status-item">
            <strong>ECharts CDN:</strong> <span id="echarts-status">检测中...</span>
        </div>
        <div class="status-item">
            <strong>图表渲染:</strong> <span id="chart-status">等待ECharts加载...</span>
        </div>
        <div class="status-item">
            <strong>API连接:</strong> <span id="api-status">检测中...</span>
        </div>
        <div class="status-item">
            <strong>数据完整性:</strong> <span id="data-status">等待API响应...</span>
        </div>
    </div>
    
    <h2>📊 ECharts 测试图表</h2>
    <div id="test-chart"></div>
    
    <h2>🔍 手动测试</h2>
    <div>
        <button onclick="testAPI()">测试 API</button>
        <button onclick="testChart()">重绘图表</button>
        <button onclick="clearLogs()">清空日志</button>
        <button onclick="location.href='/'">返回首页</button>
    </div>
    
    <h2>📝 测试日志</h2>
    <div id="logs"></div>
    
    <script>
        const logs = document.getElementById('logs');
        
        function log(msg, type = 'info') {
            const time = new Date().toLocaleTimeString();
            const colors = {
                info: '#4CAF50',
                error: '#f44336',
                warning: '#ff9800',
                success: '#00BCD4'
            };
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.style.color = colors[type] || colors.info;
            entry.innerHTML = \`[\${time}] \${msg}\`;
            logs.appendChild(entry);
            logs.scrollTop = logs.scrollHeight;
            console.log(\`[Test] \${msg}\`);
        }
        
        function updateStatus(id, text, isSuccess) {
            const el = document.getElementById(id);
            el.innerHTML = isSuccess 
                ? \`<span class="success">✅ \${text}</span>\`
                : \`<span class="fail">❌ \${text}</span>\`;
        }
        
        function clearLogs() {
            logs.innerHTML = '';
            log('日志已清空', 'info');
        }
        
        // 1. 检查 ECharts
        log('Step 1: 检查 ECharts CDN', 'info');
        if (typeof echarts !== 'undefined') {
            log(\`✅ ECharts 加载成功，版本: \${echarts.version}\`, 'success');
            updateStatus('echarts-status', \`版本 \${echarts.version}\`, true);
        } else {
            log('❌ ECharts 加载失败', 'error');
            updateStatus('echarts-status', '加载失败', false);
        }
        
        // 2. 测试图表渲染
        function testChart() {
            if (typeof echarts === 'undefined') {
                log('❌ 无法绘制图表：ECharts未加载', 'error');
                updateStatus('chart-status', '无法渲染', false);
                return;
            }
            
            log('Step 2: 绘制测试图表', 'info');
            try {
                const chartDom = document.getElementById('test-chart');
                const myChart = echarts.init(chartDom, 'dark');
                
                const option = {
                    title: {
                        text: 'Finspark 测试图表',
                        textStyle: { color: '#fff' }
                    },
                    tooltip: {
                        trigger: 'axis',
                        backgroundColor: 'rgba(50,50,50,0.9)'
                    },
                    legend: {
                        data: ['营收', '净利润'],
                        textStyle: { color: '#fff' }
                    },
                    grid: {
                        left: '3%',
                        right: '4%',
                        bottom: '3%',
                        containLabel: true
                    },
                    xAxis: {
                        type: 'category',
                        data: ['Q1', 'Q2', 'Q3', 'Q4'],
                        axisLabel: { color: '#fff' }
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: { color: '#fff' }
                    },
                    series: [
                        {
                            name: '营收',
                            type: 'bar',
                            data: [120, 200, 150, 180],
                            itemStyle: { color: '#4CAF50' }
                        },
                        {
                            name: '净利润',
                            type: 'line',
                            data: [50, 80, 60, 75],
                            itemStyle: { color: '#2196F3' }
                        }
                    ]
                };
                
                myChart.setOption(option);
                log('✅ 图表渲染成功', 'success');
                updateStatus('chart-status', '渲染成功', true);
            } catch (err) {
                log(\`❌ 图表渲染失败: \${err.message}\`, 'error');
                updateStatus('chart-status', \`渲染失败: \${err.message}\`, false);
            }
        }
        
        // 3. 测试 API
        function testAPI() {
            log('Step 3: 测试财务数据 API', 'info');
            updateStatus('api-status', '请求中...', false);
            
            fetch('/api/chart/financial/600519.SH')
                .then(response => {
                    log(\`API 响应状态: \${response.status}\`, response.ok ? 'success' : 'error');
                    if (!response.ok) {
                        throw new Error(\`HTTP \${response.status}\`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        const incomeCount = data.data.income?.length || 0;
                        const finaCount = data.data.finaIndicator?.length || 0;
                        log(\`✅ API 调用成功\`, 'success');
                        log(\`   - 收入数据: \${incomeCount} 条\`, 'info');
                        log(\`   - 财务指标: \${finaCount} 条\`, 'info');
                        updateStatus('api-status', '连接正常', true);
                        updateStatus('data-status', \`收入:\${incomeCount}条, 指标:\${finaCount}条\`, true);
                    } else {
                        log(\`❌ API 返回错误: \${data.error}\`, 'error');
                        updateStatus('api-status', \`错误: \${data.error}\`, false);
                        updateStatus('data-status', '数据获取失败', false);
                    }
                })
                .catch(err => {
                    log(\`❌ API 调用失败: \${err.message}\`, 'error');
                    updateStatus('api-status', \`失败: \${err.message}\`, false);
                    updateStatus('data-status', '无法获取', false);
                });
        }
        
        // 自动运行测试
        log('=== 开始自动测试 ===', 'info');
        setTimeout(() => {
            testChart();
            testAPI();
        }, 100);
        
        log('💡 提示：如果所有测试都通过，说明基础环境正常', 'success');
        log('💡 如果分析页面仍有问题，请打开浏览器开发者工具（F12）查看 Console', 'warning');
    </script>
</body>
</html>`;
