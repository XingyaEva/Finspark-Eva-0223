// 悬浮智能问数助手组件
// 包含：悬浮图标 + 侧边栏对话 + 全屏跳转

/**
 * 生成悬浮助手的CSS样式
 */
export const floatingAssistantStyles = `
/* ============ 悬浮助手样式 ============ */
/* 悬浮按钮 */
.floating-assistant-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    border: none;
}
.floating-assistant-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 30px rgba(99, 102, 241, 0.5);
}
.floating-assistant-btn.sidebar-open {
    transform: scale(0.9);
    opacity: 0.7;
}
.floating-assistant-btn i {
    font-size: 24px;
    color: white;
}
.floating-assistant-btn .tooltip {
    position: absolute;
    right: 70px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
}
.floating-assistant-btn:hover .tooltip {
    opacity: 1;
}
.floating-assistant-btn .tooltip::after {
    content: '';
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 6px solid transparent;
    border-left-color: rgba(0, 0, 0, 0.9);
}

/* 侧边栏遮罩 */
.sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1001;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}
.sidebar-overlay.active {
    opacity: 1;
    visibility: visible;
}

/* 侧边栏 */
.assistant-sidebar {
    position: fixed;
    top: 0;
    right: -420px;
    width: 400px;
    height: 100vh;
    background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
    border-left: 1px solid rgba(99, 102, 241, 0.3);
    z-index: 1002;
    display: flex;
    flex-direction: column;
    transition: right 0.3s ease;
    box-shadow: -5px 0 30px rgba(0, 0, 0, 0.3);
}
.assistant-sidebar.active {
    right: 0;
}

/* 侧边栏头部 */
.sidebar-header {
    padding: 20px;
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}
.sidebar-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.sidebar-title i {
    font-size: 24px;
    color: #8b5cf6;
}
.sidebar-title h3 {
    font-size: 18px;
    font-weight: 600;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.sidebar-actions {
    display: flex;
    gap: 8px;
}
.sidebar-action-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}
.sidebar-action-btn:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
    color: #8b5cf6;
}
.sidebar-action-btn.fullscreen-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
}

/* 股票上下文提示 */
.stock-context-bar {
    padding: 10px 20px;
    background: linear-gradient(90deg, rgba(212, 175, 55, 0.1) 0%, rgba(245, 209, 126, 0.05) 100%);
    border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
}
.stock-context-bar.hidden {
    display: none;
}
.stock-context-icon {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #d4af37, #f5d17e);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.stock-context-icon i {
    font-size: 12px;
    color: #0a0a0a;
}
.stock-context-info {
    flex: 1;
}
.stock-context-name {
    color: #d4af37;
    font-weight: 600;
}
.stock-context-code {
    color: #9ca3af;
    font-size: 12px;
    margin-left: 8px;
}
.stock-context-clear {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
}
.stock-context-clear:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #9ca3af;
}

/* 快捷功能区 */
.quick-actions {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(99, 102, 241, 0.1);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.quick-actions-title {
    width: 100%;
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
}
.quick-action-chip {
    padding: 8px 14px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 20px;
    color: #a5b4fc;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}
.quick-action-chip:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
    color: white;
}
.quick-action-chip i {
    font-size: 12px;
}

/* 对话区域 */
.chat-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.chat-container::-webkit-scrollbar {
    width: 6px;
}
.chat-container::-webkit-scrollbar-track {
    background: transparent;
}
.chat-container::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
}
.chat-container::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
}

/* 欢迎消息 */
.welcome-message {
    text-align: center;
    padding: 40px 20px;
}
.welcome-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.welcome-icon i {
    font-size: 36px;
    color: #8b5cf6;
}
.welcome-title {
    font-size: 20px;
    font-weight: 600;
    color: white;
    margin-bottom: 8px;
}
.welcome-subtitle {
    color: #9ca3af;
    font-size: 14px;
    line-height: 1.5;
}

/* 聊天气泡 */
.chat-message {
    display: flex;
    gap: 12px;
    animation: fadeInUp 0.3s ease;
    position: relative;
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
.chat-message.user {
    flex-direction: row-reverse;
}
.chat-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.chat-message.assistant .chat-avatar {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
.chat-message.user .chat-avatar {
    background: linear-gradient(135deg, #d4af37, #f5d17e);
}
.chat-avatar i {
    font-size: 16px;
    color: white;
}
.chat-bubble {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.6;
}
.chat-message.assistant .chat-bubble {
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.2);
    color: #e5e7eb;
    border-top-left-radius: 4px;
}
.chat-message.user .chat-bubble {
    background: linear-gradient(135deg, #d4af37, #f5d17e);
    color: #0a0a0a;
    border-top-right-radius: 4px;
}

/* 打字指示器 */
.typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
}
.typing-dot {
    width: 8px;
    height: 8px;
    background: #8b5cf6;
    border-radius: 50%;
    animation: typingBounce 1.4s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-8px); }
}

/* 输入区域 */
.input-area {
    padding: 16px 20px;
    border-top: 1px solid rgba(99, 102, 241, 0.2);
    background: rgba(0, 0, 0, 0.3);
}
.input-wrapper {
    display: flex;
    gap: 12px;
    align-items: flex-end;
}
.input-field {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    color: white;
    font-size: 14px;
    resize: none;
    min-height: 44px;
    max-height: 120px;
    transition: all 0.2s;
}
.input-field:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}
.input-field::placeholder {
    color: #6b7280;
}
.send-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
}
.send-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}
.send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}
.send-btn i {
    font-size: 18px;
}

/* 收藏问题按钮 */
.save-question-btn {
    position: absolute;
    right: -28px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
    border-radius: 4px;
}
.chat-message.assistant:hover .save-question-btn {
    opacity: 1;
}
.save-question-btn:hover {
    color: #d4af37;
    background: rgba(212, 175, 55, 0.1);
}
.save-question-btn:disabled {
    cursor: default;
}

/* 响应式 */
@media (max-width: 480px) {
    .assistant-sidebar {
        width: 100%;
        right: -100%;
    }
    .floating-assistant-btn {
        width: 52px;
        height: 52px;
        bottom: 16px;
        right: 16px;
    }
    .floating-assistant-btn i {
        font-size: 20px;
    }
}
`;

/**
 * 生成悬浮助手的HTML结构
 */
export const floatingAssistantHtml = `
<!-- 悬浮助手按钮 -->
<button id="floatingAssistantBtn" class="floating-assistant-btn" onclick="toggleAssistantSidebar()">
    <i class="fas fa-robot"></i>
    <span class="tooltip">智能问数 (Ctrl+M)</span>
</button>

<!-- 侧边栏遮罩 -->
<div id="sidebarOverlay" class="sidebar-overlay" onclick="toggleAssistantSidebar()"></div>

<!-- 智能助手侧边栏 -->
<div id="assistantSidebar" class="assistant-sidebar">
    <!-- 头部 -->
    <div class="sidebar-header">
        <div class="sidebar-title">
            <i class="fas fa-robot"></i>
            <h3>智能问数助手</h3>
        </div>
        <div class="sidebar-actions">
            <button class="sidebar-action-btn fullscreen-btn" onclick="openFullscreenAssistant()" title="全屏模式">
                <i class="fas fa-expand"></i>
            </button>
            <button class="sidebar-action-btn" onclick="toggleAssistantSidebar()" title="关闭">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </div>
    
    <!-- 股票上下文提示 -->
    <div id="stockContextBar" class="stock-context-bar hidden">
        <div class="stock-context-icon">
            <i class="fas fa-chart-line"></i>
        </div>
        <div class="stock-context-info">
            <span id="stockContextName" class="stock-context-name">-</span>
            <span id="stockContextCode" class="stock-context-code">-</span>
        </div>
        <button class="stock-context-clear" onclick="clearStockContext()" title="清除上下文">
            <i class="fas fa-times"></i>
        </button>
    </div>
    
    <!-- 快捷功能 -->
    <div id="quickActionsContainer" class="quick-actions">
        <div class="quick-actions-title">快捷提问</div>
        <button class="quick-action-chip" onclick="sendQuickQuestion('帮我分析最近的财报数据')">
            <i class="fas fa-chart-line"></i>财报分析
        </button>
        <button class="quick-action-chip" onclick="sendQuickQuestion('查看当前股票的K线走势')">
            <i class="fas fa-chart-area"></i>K线走势
        </button>
        <button class="quick-action-chip" onclick="sendQuickQuestion('对比同行业公司表现')">
            <i class="fas fa-balance-scale"></i>行业对比
        </button>
        <button class="quick-action-chip" onclick="sendQuickQuestion('分析公司的盈利能力')">
            <i class="fas fa-coins"></i>盈利分析
        </button>
    </div>
    
    <!-- 对话区域 -->
    <div id="chatContainer" class="chat-container">
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-lightbulb"></i>
            </div>
            <div class="welcome-title">你好！我是智能问数助手</div>
            <div class="welcome-subtitle">
                我可以帮你分析股票数据、解读财报、<br>
                查看K线走势，随时问我问题吧！
            </div>
        </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
        <div class="input-wrapper">
            <textarea 
                id="assistantInput" 
                class="input-field" 
                placeholder="输入你的问题..."
                rows="1"
                onkeydown="handleInputKeydown(event)"
            ></textarea>
            <button id="sendBtn" class="send-btn" onclick="sendMessage()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>
</div>
`;

/**
 * 生成悬浮助手的JavaScript逻辑
 */
export const floatingAssistantScript = `
<script>
// ============ 智能问数助手逻辑 ============
let assistantSidebarOpen = false;
let assistantMessages = [];
let isAssistantTyping = false;
let currentStockContext = null; // 当前股票上下文

// 预置问题模板 - 基于报告上下文
const contextualQuestions = {
    // 通用问题（无上下文时）
    general: [
        { icon: 'fa-chart-line', text: '财报分析', query: '帮我分析最近的财报数据' },
        { icon: 'fa-chart-area', text: 'K线走势', query: '查看当前股票的K线走势' },
        { icon: 'fa-balance-scale', text: '行业对比', query: '对比同行业公司表现' },
        { icon: 'fa-coins', text: '盈利分析', query: '分析公司的盈利能力' }
    ],
    // 有股票上下文时的问题
    withStock: [
        { icon: 'fa-chart-pie', text: '盈利能力', query: '分析{stock}的盈利能力和利润率趋势' },
        { icon: 'fa-shield-alt', text: '风险评估', query: '{stock}的财务风险有哪些？' },
        { icon: 'fa-balance-scale', text: '同业对比', query: '{stock}在同行业中表现如何？' },
        { icon: 'fa-chart-line', text: 'K线分析', query: '分析{stock}近期K线走势' },
        { icon: 'fa-money-bill-wave', text: '现金流', query: '{stock}的现金流状况如何？' },
        { icon: 'fa-bullseye', text: '估值分析', query: '{stock}当前估值是否合理？' }
    ],
    // 有完整报告时的深度问题
    withReport: [
        { icon: 'fa-star', text: '核心优势', query: '根据财报分析，{stock}的核心竞争优势是什么？' },
        { icon: 'fa-exclamation-triangle', text: '潜在风险', query: '财报中有哪些需要关注的风险信号？' },
        { icon: 'fa-lightbulb', text: '投资建议', query: '基于当前分析，{stock}是否值得投资？' },
        { icon: 'fa-arrow-up', text: '成长性', query: '{stock}未来的成长空间如何？' },
        { icon: 'fa-comments-dollar', text: '业务模式', query: '解读{stock}的盈利模式和护城河' },
        { icon: 'fa-chart-bar', text: '指标详解', query: '详细解释财报中的关键财务指标' }
    ]
};

// 切换侧边栏
function toggleAssistantSidebar() {
    const sidebar = document.getElementById('assistantSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('floatingAssistantBtn');
    
    assistantSidebarOpen = !assistantSidebarOpen;
    
    if (assistantSidebarOpen) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        btn.classList.add('sidebar-open');
        document.getElementById('assistantInput').focus();
        // 更新上下文显示
        updateStockContextUI();
        updateQuickActions();
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        btn.classList.remove('sidebar-open');
    }
}

// 设置股票上下文（由报告页面调用）
function setAssistantStockContext(stockCode, stockName, hasReport) {
    currentStockContext = { code: stockCode, name: stockName, hasReport: hasReport || false };
    window.currentStockCode = stockCode;
    window.currentStockName = stockName;
    window.hasAnalysisReport = hasReport || false;
    updateStockContextUI();
    updateQuickActions();
}

// 清除股票上下文
function clearStockContext() {
    currentStockContext = null;
    window.currentStockCode = null;
    window.currentStockName = null;
    window.hasAnalysisReport = false;
    updateStockContextUI();
    updateQuickActions();
}

// 更新股票上下文UI
function updateStockContextUI() {
    const contextBar = document.getElementById('stockContextBar');
    const nameEl = document.getElementById('stockContextName');
    const codeEl = document.getElementById('stockContextCode');
    
    if (!contextBar) return;
    
    // 从全局变量获取上下文
    const stockCode = window.currentStockCode;
    const stockName = window.currentStockName || stockCode;
    
    if (stockCode) {
        currentStockContext = { 
            code: stockCode, 
            name: stockName, 
            hasReport: window.hasAnalysisReport || false 
        };
        contextBar.classList.remove('hidden');
        nameEl.textContent = stockName;
        codeEl.textContent = stockCode;
    } else {
        contextBar.classList.add('hidden');
    }
}

// 更新快捷问题
function updateQuickActions() {
    const container = document.getElementById('quickActionsContainer');
    if (!container) return;
    
    let questions = contextualQuestions.general;
    let title = '快捷提问';
    
    if (currentStockContext) {
        if (currentStockContext.hasReport) {
            questions = contextualQuestions.withReport;
            title = '基于分析报告提问';
        } else {
            questions = contextualQuestions.withStock;
            title = '关于 ' + currentStockContext.name + ' 提问';
        }
    }
    
    // 生成HTML
    const buttonsHtml = questions.map(q => {
        const query = q.query.replace(/{stock}/g, currentStockContext ? currentStockContext.name : '');
        const escapedQuery = query.replace(/'/g, "\\'");
        return '<button class="quick-action-chip" onclick="sendQuickQuestion(\\'' + escapedQuery + '\\')">' +
            '<i class="fas ' + q.icon + '"></i>' + q.text +
            '</button>';
    }).join('');
    
    container.innerHTML = '<div class="quick-actions-title">' + title + '</div>' + buttonsHtml;
}

// 打开全屏助手
function openFullscreenAssistant() {
    window.location.href = '/assistant';
}

// 发送快捷问题
function sendQuickQuestion(question) {
    document.getElementById('assistantInput').value = question;
    sendMessage();
}

// 处理输入框键盘事件
function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('assistantInput');
    const message = input.value.trim();
    
    if (!message || isAssistantTyping) return;
    
    // 清空输入框
    input.value = '';
    input.style.height = 'auto';
    
    // 添加用户消息
    addChatMessage('user', message);
    
    // 显示打字指示器
    showTypingIndicator();
    
    try {
        // 获取当前股票上下文
        const stockCode = window.currentStockCode || null;
        const stockName = window.currentStockName || null;
        const reportId = window.currentReportId || null;
        
        // 构建请求体，包含完整上下文
        const requestBody = { 
            message, 
            stockCode,
            stockName,
            reportId, // 传递报告ID以获取更精确的上下文
            history: assistantMessages.slice(-10) // 最近10条消息作为上下文
        };
        
        // 调用API
        const response = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        // 隐藏打字指示器
        hideTypingIndicator();
        
        if (data.success) {
            addChatMessage('assistant', data.reply);
            
            // 如果有图表数据，显示图表提示
            if (data.chartData) {
                addChatMessage('assistant', '📊 已为您生成图表，点击"全屏模式"查看完整图表');
            }
            
            // 如果有跟进问题建议
            if (data.followUpQuestions && data.followUpQuestions.length > 0) {
                showFollowUpSuggestions(data.followUpQuestions);
            }
        } else {
            addChatMessage('assistant', '抱歉，处理您的问题时出现了错误。请稍后重试。');
        }
    } catch (error) {
        hideTypingIndicator();
        addChatMessage('assistant', '网络连接出现问题，请检查网络后重试。');
        console.error('Assistant error:', error);
    }
}

// 显示跟进问题建议
function showFollowUpSuggestions(questions) {
    const container = document.getElementById('chatContainer');
    
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'follow-up-suggestions';
    suggestionsDiv.style.cssText = 'padding:12px;background:rgba(99,102,241,0.05);border-radius:12px;margin-top:8px;';
    
    let buttonsHtml = questions.slice(0, 3).map(q => {
        const escapedQ = q.replace(/'/g, "\\'");
        return '<button class="quick-action-chip" style="font-size:12px;padding:6px 10px;" onclick="sendQuickQuestion(\\'' + escapedQ + '\\')">' + q + '</button>';
    }).join('');
    
    suggestionsDiv.innerHTML = '<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">您可能还想问：</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + buttonsHtml + '</div>';
    
    container.appendChild(suggestionsDiv);
    container.scrollTop = container.scrollHeight;
}

// 添加聊天消息
function addChatMessage(role, content, userQuestion = null) {
    const container = document.getElementById('chatContainer');
    
    // 移除欢迎消息
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    // 保存消息历史
    assistantMessages.push({ role, content });
    
    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message ' + role;
    
    const avatarIcon = role === 'assistant' ? 'fa-robot' : 'fa-user';
    const msgId = Date.now();
    
    // 为用户消息保存问题文本（用于收藏）
    if (role === 'user') {
        window._lastUserQuestion = content;
    }
    
    // 助手消息添加收藏按钮
    const saveBtn = role === 'assistant' ? 
        '<button class="save-question-btn" onclick="saveQuestionToFavorites(' + msgId + ', this)" title="收藏这个问答"><i class="fas fa-bookmark"></i></button>' : '';
    
    messageDiv.innerHTML = \`
        <div class="chat-avatar">
            <i class="fas \${avatarIcon}"></i>
        </div>
        <div class="chat-bubble">\${formatMessageContent(content)}</div>
        \${saveBtn}
    \`;
    
    // 存储问答对用于收藏
    if (role === 'assistant' && window._lastUserQuestion) {
        messageDiv.dataset.question = window._lastUserQuestion;
        messageDiv.dataset.answer = content;
    }
    
    container.appendChild(messageDiv);
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
}

// 收藏问答
async function saveQuestionToFavorites(msgId, btn) {
    const messageDiv = btn.closest('.chat-message');
    const question = messageDiv.dataset.question;
    const answer = messageDiv.dataset.answer;
    
    if (!question) {
        alert('无法获取问题内容');
        return;
    }
    
    // 检查登录状态
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('请先登录后再收藏问题');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const response = await fetch('/api/assistant/saved-questions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question,
                answer,
                stockCode: window.currentStockCode,
                stockName: window.currentStockName,
                reportId: window.currentReportId,
                category: 'general'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            btn.innerHTML = '<i class="fas fa-bookmark" style="color:#d4af37;"></i>';
            btn.title = '已收藏';
            btn.disabled = true;
        } else {
            btn.innerHTML = '<i class="fas fa-bookmark"></i>';
            btn.disabled = false;
            alert(data.error || '收藏失败');
        }
    } catch (error) {
        console.error('Save question error:', error);
        btn.innerHTML = '<i class="fas fa-bookmark"></i>';
        btn.disabled = false;
        alert('网络错误，请稍后重试');
    }
}

// 格式化消息内容
function formatMessageContent(content) {
    // 简单的Markdown支持
    return content
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        .replace(/\`(.+?)\`/g, '<code style="background:rgba(99,102,241,0.2);padding:2px 6px;border-radius:4px;">$1</code>')
        .replace(/\\n/g, '<br>');
}

// 显示打字指示器
function showTypingIndicator() {
    isAssistantTyping = true;
    const container = document.getElementById('chatContainer');
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'chat-message assistant';
    typingDiv.innerHTML = \`
        <div class="chat-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="chat-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    \`;
    
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

// 隐藏打字指示器
function hideTypingIndicator() {
    isAssistantTyping = false;
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl+M 或 Cmd+M 切换侧边栏
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        toggleAssistantSidebar();
    }
    // Esc 关闭侧边栏
    if (e.key === 'Escape' && assistantSidebarOpen) {
        toggleAssistantSidebar();
    }
});

// 自动调整输入框高度
document.getElementById('assistantInput')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
</script>
`;

/**
 * 获取完整的悬浮助手组件（包含样式、HTML和脚本）
 */
export function getFloatingAssistantComponent(): string {
    return `
<style>
${floatingAssistantStyles}
</style>
${floatingAssistantHtml}
${floatingAssistantScript}
`;
}

export default getFloatingAssistantComponent;
