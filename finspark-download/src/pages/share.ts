// 分享预览页面
// 用于展示分享的报告摘要，带有 Open Graph 元数据

export function generateSharePageHtml(data: {
  shareCode: string;
  reportId: number;
  companyName: string;
  companyCode: string;
  score?: number;
  recommendation?: string;
  reportDate?: string;
  summary?: string;
  baseUrl: string;
}): string {
  const { shareCode, reportId, companyName, companyCode, score, recommendation, reportDate, summary, baseUrl } = data;
  
  const title = `${companyName} 财报分析报告 - Finspark`;
  const description = summary || `查看 ${companyName}(${companyCode}) 的AI智能财报分析报告，包含盈利能力、风险评估、估值分析等深度解读。`;
  const ogImage = `${baseUrl}/api/og-image/${shareCode}`;
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="${description}">
    <meta name="keywords" content="${companyName},${companyCode},财报分析,投资分析,AI分析,股票分析">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${baseUrl}/share/${shareCode}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Finspark">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${baseUrl}/share/${shareCode}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${ogImage}">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { 
            font-family: 'Noto Sans SC', sans-serif; 
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); 
            min-height: 100vh; 
        }
        .gold-text { color: #d4af37; }
        .gold-gradient { 
            background: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%); 
            -webkit-background-clip: text; 
            -webkit-text-fill-color: transparent; 
            background-clip: text; 
        }
        .card { 
            background: rgba(255, 255, 255, 0.03); 
            border: 1px solid rgba(212, 175, 55, 0.2); 
            backdrop-filter: blur(10px);
        }
        .btn-gold { 
            background: linear-gradient(135deg, #d4af37 0%, #f5d17e 100%); 
            color: #0a0a0a; 
            font-weight: 600; 
        }
        .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: conic-gradient(#d4af37 calc(var(--score) * 3.6deg), rgba(255,255,255,0.1) 0);
            position: relative;
        }
        .score-inner {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: #1a1a2e;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body class="text-white">
    <!-- 导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-black/30 border-b border-gray-800">
        <div class="max-w-5xl mx-auto flex justify-between items-center">
            <a href="/" class="text-2xl font-bold gold-gradient">Finspark</a>
            <a href="/" class="btn-gold px-4 py-2 rounded-lg text-sm">
                <i class="fas fa-chart-line mr-2"></i>开始分析
            </a>
        </div>
    </nav>
    
    <main class="pt-24 pb-16 px-4">
        <div class="max-w-3xl mx-auto">
            <!-- 分享卡片 -->
            <div class="card rounded-2xl overflow-hidden">
                <!-- 头部 -->
                <div class="p-8 text-center border-b border-gray-800">
                    <div class="text-sm text-gray-400 mb-2">
                        <i class="fas fa-share-alt mr-2"></i>分享的分析报告
                    </div>
                    <h1 class="text-3xl font-bold mb-2">${companyName}</h1>
                    <div class="text-gray-400">${companyCode}</div>
                </div>
                
                <!-- 核心指标 -->
                <div class="p-8">
                    <div class="flex flex-col md:flex-row items-center justify-center gap-8">
                        ${score ? `
                        <div class="score-circle" style="--score: ${score}">
                            <div class="score-inner">
                                <span class="text-3xl font-bold gold-text">${score}</span>
                                <span class="text-xs text-gray-400">综合评分</span>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="text-center md:text-left">
                            ${recommendation ? `
                            <div class="mb-4">
                                <div class="text-sm text-gray-400 mb-1">投资建议</div>
                                <div class="text-2xl font-semibold ${
                                    recommendation.includes('买入') || recommendation.includes('增持') ? 'text-green-400' :
                                    recommendation.includes('卖出') || recommendation.includes('减持') ? 'text-red-400' :
                                    'text-yellow-400'
                                }">${recommendation}</div>
                            </div>
                            ` : ''}
                            ${reportDate ? `
                            <div>
                                <div class="text-sm text-gray-400 mb-1">报告日期</div>
                                <div class="text-white">${reportDate}</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${summary ? `
                    <div class="mt-8 p-4 bg-gray-800/50 rounded-lg">
                        <div class="text-sm text-gray-400 mb-2"><i class="fas fa-lightbulb mr-2"></i>报告摘要</div>
                        <p class="text-gray-300 leading-relaxed">${summary}</p>
                    </div>
                    ` : ''}
                </div>
                
                <!-- 操作按钮 -->
                <div class="p-6 border-t border-gray-800 flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/analyze?code=${companyCode}&name=${encodeURIComponent(companyName)}" 
                       class="btn-gold px-8 py-3 rounded-lg text-center">
                        <i class="fas fa-chart-bar mr-2"></i>查看完整报告
                    </a>
                    <button onclick="copyShareLink()" class="px-8 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition">
                        <i class="fas fa-copy mr-2"></i>复制链接
                    </button>
                </div>
            </div>
            
            <!-- 平台介绍 -->
            <div class="mt-8 text-center text-gray-500 text-sm">
                <p>由 <a href="/" class="gold-text hover:underline">Finspark</a> AI 多智能体系统生成</p>
                <p class="mt-2">专业的智能投资分析平台，助您做出明智的投资决策</p>
            </div>
        </div>
    </main>
    
    <!-- Toast 提示 -->
    <div id="toast" class="fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-green-500 text-white rounded-lg shadow-lg opacity-0 transition-opacity duration-300 pointer-events-none">
        链接已复制到剪贴板
    </div>
    
    <script>
        function copyShareLink() {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                const toast = document.getElementById('toast');
                toast.style.opacity = '1';
                setTimeout(() => {
                    toast.style.opacity = '0';
                }, 2000);
            });
        }
    </script>
</body>
</html>
`;
}

export default generateSharePageHtml;
