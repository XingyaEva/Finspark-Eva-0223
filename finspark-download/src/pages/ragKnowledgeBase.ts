/**
 * RAG 知识库管理页面
 * 提供文档上传、管理和RAG问答界面
 */
export const ragKnowledgeBaseHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG 知识库 - Finspark 财报分析系统</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Noto Sans SC', sans-serif; }
        body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; }
        .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(148, 163, 184, 0.1); }
        .gold-text { color: #d4af37; }
        .btn-gold { background: linear-gradient(135deg, #d4af37 0%, #f5d75e 100%); color: #1a1a2e; font-weight: 600; }
        .btn-gold:hover { background: linear-gradient(135deg, #f5d75e 0%, #d4af37 100%); }
        .chat-bubble-user { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .chat-bubble-assistant { background: rgba(51, 65, 85, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); }
        .source-card { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); }
        .source-card:hover { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.5); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.5); border-radius: 3px; }
        .tab-active { border-bottom: 2px solid #d4af37; color: #d4af37; }
        .upload-zone { border: 2px dashed rgba(148, 163, 184, 0.3); transition: all 0.3s; }
        .upload-zone:hover, .upload-zone.dragover { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        .doc-card { transition: all 0.2s; }
        .doc-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .typing-indicator span { animation: typing 1.4s infinite ease-in-out; }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } }
    </style>
</head>
<body class="text-gray-100">
    <!-- 顶部导航 -->
    <nav class="fixed top-0 left-0 right-0 z-50 glass-card border-b border-gray-700/50">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <i class="fas fa-brain text-white text-lg"></i>
                </div>
                <div>
                    <h1 class="text-lg font-bold text-white">RAG 知识库</h1>
                    <p class="text-xs text-gray-400">基于向量检索的智能财报问答</p>
                </div>
            </a>
            <div class="flex items-center gap-4">
                <a href="/" class="text-gray-400 hover:text-white transition"><i class="fas fa-home mr-1"></i> 首页</a>
                <a href="/assistant" class="text-gray-400 hover:text-white transition"><i class="fas fa-robot mr-1"></i> 问数助手</a>
            </div>
        </div>
    </nav>

    <div class="pt-20 pb-12 min-h-screen">
        <div class="max-w-7xl mx-auto px-4">
            <!-- Tab导航 -->
            <div class="flex gap-6 border-b border-gray-700/50 mb-6">
                <button id="tabQA" onclick="switchTab('qa')" class="pb-3 px-1 text-sm font-semibold tab-active transition">
                    <i class="fas fa-comments mr-2"></i>知识库问答
                </button>
                <button id="tabDocs" onclick="switchTab('docs')" class="pb-3 px-1 text-sm font-semibold text-gray-400 hover:text-white transition">
                    <i class="fas fa-folder-open mr-2"></i>文档管理
                </button>
                <button id="tabUpload" onclick="switchTab('upload')" class="pb-3 px-1 text-sm font-semibold text-gray-400 hover:text-white transition">
                    <i class="fas fa-cloud-upload-alt mr-2"></i>上传文档
                </button>
            </div>

            <!-- ========= 问答Tab ========= -->
            <div id="panelQA" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- 左侧：问答区域 -->
                <div class="lg:col-span-2">
                    <div class="glass-card rounded-2xl overflow-hidden" style="box-shadow: 0 0 20px rgba(59,130,246,0.3);">
                        <!-- 对话历史 -->
                        <div id="chatHistory" class="min-h-[500px] max-h-[600px] overflow-y-auto p-6 space-y-4">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-brain text-white text-sm"></i>
                                </div>
                                <div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                                    <p class="text-gray-200 font-semibold">你好！我是 RAG 知识库助手 </p>
                                    <p class="text-gray-300 mt-2 text-sm">我可以基于已上传的财报文档来回答你的问题。先上传文档到知识库，然后就可以开始提问了。</p>
                                    <div class="mt-3 grid grid-cols-2 gap-2">
                                        <button onclick="askPreset('这家公司的营业收入是多少？')" class="text-left text-xs px-3 py-2 bg-gray-700/50 hover:bg-blue-600/30 border border-gray-600 hover:border-blue-500 rounded-lg text-gray-300 hover:text-white transition">
                                            营业收入是多少？
                                        </button>
                                        <button onclick="askPreset('公司的主要风险有哪些？')" class="text-left text-xs px-3 py-2 bg-gray-700/50 hover:bg-blue-600/30 border border-gray-600 hover:border-blue-500 rounded-lg text-gray-300 hover:text-white transition">
                                            主要风险有哪些？
                                        </button>
                                        <button onclick="askPreset('毛利率和净利率的变化趋势？')" class="text-left text-xs px-3 py-2 bg-gray-700/50 hover:bg-blue-600/30 border border-gray-600 hover:border-blue-500 rounded-lg text-gray-300 hover:text-white transition">
                                            毛利率净利率趋势？
                                        </button>
                                        <button onclick="askPreset('分析公司的竞争优势')" class="text-left text-xs px-3 py-2 bg-gray-700/50 hover:bg-blue-600/30 border border-gray-600 hover:border-blue-500 rounded-lg text-gray-300 hover:text-white transition">
                                            公司竞争优势分析
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- 输入区域 -->
                        <div class="border-t border-gray-700/50 p-4 bg-gray-900/50">
                            <div class="flex items-center gap-3">
                                <div class="flex-1 relative">
                                    <input type="text" id="questionInput" placeholder="基于知识库提问..." class="w-full bg-gray-800/80 border border-gray-600 focus:border-blue-500 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" onkeypress="if(event.key==='Enter')sendRAGQuery()">
                                    <button onclick="sendRAGQuery()" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center transition">
                                        <i class="fas fa-paper-plane text-white text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="mt-2 text-xs text-gray-500 flex items-center justify-between">
                                <span><i class="fas fa-brain mr-1 text-purple-400"></i> RAG增强检索 | <i class="fas fa-shield-alt mr-1"></i> 基于知识库回答</span>
                                <span id="queryStatus"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右侧：知识库概览 -->
                <div class="space-y-4">
                    <!-- 统计卡片 -->
                    <div class="glass-card rounded-xl p-4">
                        <h3 class="text-sm font-semibold gold-text mb-3"><i class="fas fa-chart-pie mr-2"></i>知识库统计</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-gray-800/50 rounded-lg p-3 text-center">
                                <div id="statDocs" class="text-2xl font-bold text-blue-400">0</div>
                                <div class="text-xs text-gray-500">文档数</div>
                            </div>
                            <div class="bg-gray-800/50 rounded-lg p-3 text-center">
                                <div id="statChunks" class="text-2xl font-bold text-green-400">0</div>
                                <div class="text-xs text-gray-500">文本块</div>
                            </div>
                        </div>
                    </div>

                    <!-- 引用来源 -->
                    <div class="glass-card rounded-xl p-4">
                        <h3 class="text-sm font-semibold gold-text mb-3"><i class="fas fa-quote-left mr-2"></i>引用来源</h3>
                        <div id="sourcesPanel" class="space-y-2 max-h-[400px] overflow-y-auto">
                            <div class="text-sm text-gray-500 text-center py-4">提问后将显示引用的文档来源</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========= 文档管理Tab ========= -->
            <div id="panelDocs" class="hidden">
                <div class="glass-card rounded-xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-bold text-white"><i class="fas fa-folder-open mr-2 gold-text"></i>已上传文档</h2>
                        <button onclick="switchTab('upload')" class="btn-gold px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-2"></i>上传新文档</button>
                    </div>
                    <div id="documentsList" class="space-y-3">
                        <div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</div>
                    </div>
                </div>
            </div>

            <!-- ========= 上传Tab ========= -->
            <div id="panelUpload" class="hidden">
                <div class="glass-card rounded-xl p-6 max-w-3xl mx-auto">
                    <h2 class="text-lg font-bold text-white mb-6"><i class="fas fa-cloud-upload-alt mr-2 gold-text"></i>上传财报文档</h2>
                    
                    <!-- 文档信息 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">文档标题 *</label>
                            <input type="text" id="uploadTitle" placeholder="如：贵州茅台2024年报" class="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">关联股票代码</label>
                            <input type="text" id="uploadStockCode" placeholder="如：600519.SH" class="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">文档分类</label>
                            <select id="uploadCategory" class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="annual_report">年度报告</option>
                                <option value="quarterly_report">季度报告</option>
                                <option value="research">研究报告</option>
                                <option value="announcement">公告</option>
                                <option value="general" selected>通用文档</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">关联公司名称</label>
                            <input type="text" id="uploadStockName" placeholder="如：贵州茅台" class="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                        </div>
                    </div>

                    <!-- 高级设置（折叠） -->
                    <details class="mb-6">
                        <summary class="cursor-pointer text-sm text-gray-400 hover:text-white"><i class="fas fa-cog mr-1"></i> 高级设置（分块参数）</summary>
                        <div class="mt-3 grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-lg">
                            <div>
                                <label class="block text-xs text-gray-500 mb-1">分块大小（字符）</label>
                                <input type="number" id="uploadChunkSize" value="500" min="100" max="2000" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-500 mb-1">重叠大小（字符）</label>
                                <input type="number" id="uploadChunkOverlap" value="100" min="0" max="500" class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm">
                            </div>
                        </div>
                    </details>

                    <!-- 文本输入区域 -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-1">文档内容 *</label>
                        <textarea id="uploadContent" rows="12" placeholder="粘贴财报文本内容...&#10;&#10;支持纯文本、Markdown格式。&#10;可以直接从PDF中复制文本内容粘贴到这里。" class="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-4 py-3 text-white text-sm focus:outline-none resize-y"></textarea>
                        <div class="flex justify-between mt-1 text-xs text-gray-500">
                            <span id="contentLength">0 字符</span>
                            <span>最大 500,000 字符</span>
                        </div>
                    </div>

                    <!-- 上传按钮 -->
                    <div class="flex items-center gap-4">
                        <button id="uploadBtn" onclick="uploadDocument()" class="btn-gold px-6 py-3 rounded-lg flex items-center">
                            <i class="fas fa-cloud-upload-alt mr-2"></i>导入知识库
                        </button>
                        <div id="uploadProgress" class="hidden text-sm text-gray-400">
                            <i class="fas fa-spinner fa-spin mr-2"></i><span id="uploadProgressText">处理中...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let conversationHistory = [];
        let currentSessionId = null;
        let isProcessing = false;

        // Tab切换
        function switchTab(tab) {
            document.querySelectorAll('[id^="panel"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="tab"]').forEach(el => { el.classList.remove('tab-active'); el.classList.add('text-gray-400'); });
            
            const panelMap = { qa: 'panelQA', docs: 'panelDocs', upload: 'panelUpload' };
            const tabMap = { qa: 'tabQA', docs: 'tabDocs', upload: 'tabUpload' };
            
            document.getElementById(panelMap[tab]).classList.remove('hidden');
            const tabEl = document.getElementById(tabMap[tab]);
            tabEl.classList.add('tab-active');
            tabEl.classList.remove('text-gray-400');

            if (tab === 'docs') loadDocuments();
        }

        // 加载统计
        async function loadStats() {
            try {
                const resp = await fetch('/api/rag/stats');
                const data = await resp.json();
                if (data.success) {
                    document.getElementById('statDocs').textContent = data.completedDocuments || 0;
                    document.getElementById('statChunks').textContent = data.totalChunks || 0;
                }
            } catch (e) { console.error('Failed to load stats:', e); }
        }

        // 加载文档列表
        async function loadDocuments() {
            const container = document.getElementById('documentsList');
            try {
                const resp = await fetch('/api/rag/documents');
                const data = await resp.json();
                if (data.success && data.documents.length > 0) {
                    container.innerHTML = data.documents.map(doc => {
                        const statusColors = { completed: 'bg-green-500', processing: 'bg-yellow-500', failed: 'bg-red-500', pending: 'bg-gray-500' };
                        const statusLabels = { completed: '已完成', processing: '处理中', failed: '失败', pending: '待处理' };
                        const categoryLabels = { annual_report: '年报', quarterly_report: '季报', research: '研报', announcement: '公告', general: '通用' };
                        return '<div class="doc-card glass-card rounded-lg p-4 flex items-center justify-between">' +
                            '<div class="flex items-center gap-3">' +
                            '<div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><i class="fas fa-file-alt text-blue-400"></i></div>' +
                            '<div>' +
                            '<div class="font-semibold text-white text-sm">' + escapeHtml(doc.title) + '</div>' +
                            '<div class="text-xs text-gray-500">' + (doc.stock_code || '') + (doc.stock_name ? ' ' + doc.stock_name : '') + ' | ' + (categoryLabels[doc.category] || doc.category) + ' | ' + doc.chunk_count + ' 个分块</div>' +
                            '</div></div>' +
                            '<div class="flex items-center gap-3">' +
                            '<span class="px-2 py-1 rounded text-xs text-white ' + (statusColors[doc.status] || 'bg-gray-500') + '">' + (statusLabels[doc.status] || doc.status) + '</span>' +
                            '<button onclick="deleteDoc(' + doc.id + ')" class="text-red-400 hover:text-red-300 text-sm"><i class="fas fa-trash"></i></button>' +
                            '</div></div>';
                    }).join('');
                } else {
                    container.innerHTML = '<div class="text-center py-12 text-gray-500"><i class="fas fa-folder-open text-4xl mb-3"></i><div>知识库暂无文档</div><div class="text-xs mt-1">点击"上传文档"开始构建知识库</div></div>';
                }
            } catch (e) { container.innerHTML = '<div class="text-center py-8 text-red-400">加载失败</div>'; }
        }

        // 上传文档
        async function uploadDocument() {
            const title = document.getElementById('uploadTitle').value.trim();
            const content = document.getElementById('uploadContent').value.trim();
            const stockCode = document.getElementById('uploadStockCode').value.trim();
            const stockName = document.getElementById('uploadStockName').value.trim();
            const category = document.getElementById('uploadCategory').value;
            const chunkSize = parseInt(document.getElementById('uploadChunkSize').value) || 500;
            const chunkOverlap = parseInt(document.getElementById('uploadChunkOverlap').value) || 100;

            if (!title) { alert('请输入文档标题'); return; }
            if (!content) { alert('请输入文档内容'); return; }

            const btn = document.getElementById('uploadBtn');
            const progress = document.getElementById('uploadProgress');
            btn.disabled = true; btn.style.opacity = '0.5';
            progress.classList.remove('hidden');
            document.getElementById('uploadProgressText').textContent = '正在分块并生成向量...';

            try {
                const resp = await fetch('/api/rag/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, fileName: title + '.txt', stockCode: stockCode || undefined, stockName: stockName || undefined, category, chunkSize, chunkOverlap })
                });
                const data = await resp.json();
                if (data.success) {
                    document.getElementById('uploadProgressText').textContent = '上传成功! ' + data.chunkCount + ' 个分块已入库';
                    document.getElementById('uploadTitle').value = '';
                    document.getElementById('uploadContent').value = '';
                    document.getElementById('contentLength').textContent = '0 字符';
                    loadStats();
                    setTimeout(() => { progress.classList.add('hidden'); btn.disabled = false; btn.style.opacity = '1'; }, 2000);
                } else {
                    alert('上传失败: ' + data.error);
                    progress.classList.add('hidden'); btn.disabled = false; btn.style.opacity = '1';
                }
            } catch (e) {
                alert('上传失败: ' + e.message);
                progress.classList.add('hidden'); btn.disabled = false; btn.style.opacity = '1';
            }
        }

        // 删除文档
        async function deleteDoc(id) {
            if (!confirm('确定删除该文档？将同时删除所有分块和向量数据。')) return;
            try {
                const resp = await fetch('/api/rag/documents/' + id, { method: 'DELETE' });
                const data = await resp.json();
                if (data.success) { loadDocuments(); loadStats(); }
                else alert('删除失败: ' + data.error);
            } catch (e) { alert('删除失败'); }
        }

        // RAG问答
        function askPreset(q) { document.getElementById('questionInput').value = q; sendRAGQuery(); }

        async function sendRAGQuery() {
            const input = document.getElementById('questionInput');
            const question = input.value.trim();
            if (!question || isProcessing) return;
            isProcessing = true;
            input.value = '';

            addUserMessage(question);
            const loadingId = addLoadingMessage();
            const statusEl = document.getElementById('queryStatus');
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在检索知识库...';

            try {
                const resp = await fetch('/api/rag/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question, sessionId: currentSessionId, conversationHistory, topK: 5 })
                });
                const data = await resp.json();
                removeLoadingMessage(loadingId);

                if (data.success) {
                    currentSessionId = data.sessionId;
                    addAssistantMessage(formatMarkdown(data.answer));
                    conversationHistory.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer });

                    // 显示来源
                    const sourcesPanel = document.getElementById('sourcesPanel');
                    if (data.sources && data.sources.length > 0) {
                        sourcesPanel.innerHTML = data.sources.map((s, i) => 
                            '<div class="source-card rounded-lg p-3 cursor-pointer" title="相关度: ' + (s.relevanceScore * 100).toFixed(0) + '%">' +
                            '<div class="flex items-center gap-2 mb-1">' +
                            '<span class="text-xs px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300">来源' + (i+1) + '</span>' +
                            '<span class="text-xs text-gray-400 truncate">' + escapeHtml(s.documentTitle) + '</span>' +
                            '</div>' +
                            '<p class="text-xs text-gray-400 line-clamp-3">' + escapeHtml(s.chunkContent) + '</p>' +
                            '<div class="mt-1 text-xs text-gray-500">相关度: ' + (s.relevanceScore * 100).toFixed(0) + '%</div>' +
                            '</div>'
                        ).join('');
                    } else {
                        sourcesPanel.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">未检索到相关文档</div>';
                    }
                    statusEl.innerHTML = '<i class="fas fa-check text-green-400 mr-1"></i> 检索到 ' + (data.sourceCount || 0) + ' 个相关片段';
                } else {
                    addAssistantMessage('抱歉，查询失败：' + (data.error || '未知错误'));
                    statusEl.textContent = '';
                }
            } catch (e) {
                removeLoadingMessage(loadingId);
                addAssistantMessage('查询出错：' + e.message);
                statusEl.textContent = '';
            }
            isProcessing = false;
        }

        // 消息渲染
        function addUserMessage(content) {
            const el = document.getElementById('chatHistory');
            const div = document.createElement('div');
            div.className = 'flex items-start gap-3 justify-end';
            div.innerHTML = '<div class="chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]"><p class="text-white text-sm">' + escapeHtml(content) + '</p></div><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0"><i class="fas fa-user text-white text-sm"></i></div>';
            el.appendChild(div); scrollToBottom();
        }

        function addAssistantMessage(html) {
            const el = document.getElementById('chatHistory');
            const div = document.createElement('div');
            div.className = 'flex items-start gap-3';
            div.innerHTML = '<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0"><i class="fas fa-brain text-white text-sm"></i></div><div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm text-gray-200">' + html + '</div>';
            el.appendChild(div); scrollToBottom();
        }

        function addLoadingMessage() {
            const el = document.getElementById('chatHistory');
            const div = document.createElement('div');
            const id = 'loading-' + Date.now();
            div.id = id; div.className = 'flex items-start gap-3';
            div.innerHTML = '<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0"><i class="fas fa-brain text-white text-sm"></i></div><div class="chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3"><div class="typing-indicator flex gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full"></span><span class="w-2 h-2 bg-gray-400 rounded-full"></span><span class="w-2 h-2 bg-gray-400 rounded-full"></span></div></div>';
            el.appendChild(div); scrollToBottom(); return id;
        }

        function removeLoadingMessage(id) { const el = document.getElementById(id); if (el) el.remove(); }

        function formatMarkdown(text) {
            if (!text) return '';
            return text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong class="text-yellow-300">$1</strong>')
                .replace(/### (.+)/g, '<h4 class="text-blue-400 font-semibold mt-2 mb-1">$1</h4>')
                .replace(/## (.+)/g, '<h3 class="text-blue-400 font-semibold mt-3 mb-1">$1</h3>')
                .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
                .replace(/^\\d+\\. (.+)/gm, '<li class="ml-4">$1</li>')
                .replace(/\\n\\n/g, '</p><p class="my-2">')
                .replace(/\\n/g, '<br>');
        }

        function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
        function scrollToBottom() { const el = document.getElementById('chatHistory'); setTimeout(() => { el.scrollTop = el.scrollHeight; }, 100); }

        // 字符计数
        document.getElementById('uploadContent')?.addEventListener('input', function() {
            document.getElementById('contentLength').textContent = this.value.length + ' 字符';
        });

        // 初始化
        loadStats();
    </script>
</body>
</html>
`;
