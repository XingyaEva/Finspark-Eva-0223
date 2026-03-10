// 智能问数助手 - 悬浮图标 + 侧边栏组件
// 参考 Monica 浏览器插件风格设计

export const assistantWidgetHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能问数助手 - 悬浮组件演示</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Noto Sans SC', sans-serif; box-sizing: border-box; }
        body { 
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        /* ========== 悬浮图标样式 ========== */
        .floating-icon {
            position: fixed;
            right: 24px;
            bottom: 100px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            z-index: 9999;
        }
        
        .floating-icon:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(99, 102, 241, 0.5);
        }
        
        .floating-icon:active {
            transform: scale(0.95);
        }
        
        .floating-icon svg {
            width: 28px;
            height: 28px;
            fill: white;
        }
        
        /* 悬浮图标快捷键提示 */
        .floating-shortcut {
            position: absolute;
            top: -8px;
            right: -8px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .floating-icon:hover .floating-shortcut {
            opacity: 1;
        }
        
        /* ========== 侧边栏样式 ========== */
        .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .sidebar-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        
        .sidebar {
            position: fixed;
            top: 0;
            right: -420px;
            width: 400px;
            height: 100vh;
            background: white;
            box-shadow: -4px 0 30px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            transition: right 0.3s ease;
            display: flex;
            flex-direction: column;
        }
        
        .sidebar.active {
            right: 0;
        }
        
        /* 侧边栏头部 */
        .sidebar-header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .sidebar-header h3 {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .sidebar-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .sidebar-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .sidebar-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        /* 侧边栏内容区 */
        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
        }
        
        /* 欢迎区域 */
        .welcome-section {
            text-align: center;
            padding: 24px 16px;
            flex-shrink: 0;
        }
        
        .welcome-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 16px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .welcome-icon i {
            font-size: 28px;
            color: white;
        }
        
        .welcome-title {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .welcome-subtitle {
            font-size: 14px;
            color: #64748b;
        }
        
        /* 快捷功能区 */
        .quick-actions {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin: 16px 0;
            flex-shrink: 0;
        }
        
        .quick-action-btn {
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
        }
        
        .quick-action-btn:hover {
            background: #f1f5f9;
            border-color: #6366f1;
            transform: translateY(-2px);
        }
        
        .quick-action-btn i {
            font-size: 20px;
            color: #6366f1;
            margin-bottom: 6px;
            display: block;
        }
        
        .quick-action-btn span {
            font-size: 12px;
            color: #475569;
        }
        
        /* 对话消息区 */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .message {
            display: flex;
            gap: 8px;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
            flex-direction: row-reverse;
        }
        
        .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .message.assistant .message-avatar {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
        }
        
        .message.user .message-avatar {
            background: #e2e8f0;
            color: #475569;
        }
        
        .message-content {
            max-width: 280px;
            padding: 10px 14px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .message.assistant .message-content {
            background: #f1f5f9;
            color: #1e293b;
            border-bottom-left-radius: 4px;
        }
        
        .message.user .message-content {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }
        
        /* 输入区域 */
        .sidebar-input-area {
            padding: 12px 16px;
            border-top: 1px solid #e2e8f0;
            background: white;
            flex-shrink: 0;
        }
        
        .input-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f1f5f9;
            border-radius: 24px;
            padding: 8px 12px;
            border: 2px solid transparent;
            transition: all 0.2s;
        }
        
        .input-wrapper:focus-within {
            border-color: #6366f1;
            background: white;
        }
        
        .input-wrapper input {
            flex: 1;
            border: none;
            background: transparent;
            outline: none;
            font-size: 14px;
            color: #1e293b;
        }
        
        .input-wrapper input::placeholder {
            color: #94a3b8;
        }
        
        .send-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .send-btn:hover {
            transform: scale(1.05);
        }
        
        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* 打字指示器 */
        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 8px 14px;
        }
        
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: #94a3b8;
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) { animation-delay: 0s; }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-8px); }
        }
        
        /* ========== 演示页面内容 ========== */
        .demo-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .demo-header {
            margin-bottom: 40px;
        }
        
        .demo-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .demo-header p {
            color: #64748b;
        }
        
        .demo-table {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        
        .demo-table table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .demo-table th {
            background: #f8fafc;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .demo-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
            color: #1e293b;
        }
        
        .demo-table tr:last-child td {
            border-bottom: none;
        }
        
        .demo-table tr:hover td {
            background: #f8fafc;
        }
        
        .tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .tag-green { background: #dcfce7; color: #16a34a; }
        .tag-blue { background: #dbeafe; color: #2563eb; }
        .tag-purple { background: #f3e8ff; color: #9333ea; }
        .tag-yellow { background: #fef9c3; color: #ca8a04; }
        
        /* 隐藏悬浮图标当侧边栏打开时 */
        .floating-icon.hidden {
            opacity: 0;
            pointer-events: none;
            transform: scale(0.5);
        }
        
        /* 数据表格/图表结果样式 */
        .result-table {
            width: 100%;
            margin: 8px 0;
            font-size: 12px;
            border-collapse: collapse;
        }
        
        .result-table th {
            background: #f1f5f9;
            padding: 8px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .result-table td {
            padding: 8px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }
        
        .mini-chart {
            width: 100%;
            height: 200px;
            background: #f8fafc;
            border-radius: 8px;
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <!-- 演示页面内容 - 模拟一个需求跟踪表 -->
    <div class="demo-content">
        <div class="demo-header">
            <h1>📊 需求跟踪表智能表格</h1>
            <p>点击右下角的悬浮图标，或按 Ctrl+M 唤起智能问数助手</p>
        </div>
        
        <div class="demo-table">
            <table>
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>需求简述</th>
                        <th>核对</th>
                        <th>提出部门</th>
                        <th>需求类型</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>22</td>
                        <td>希望把业务环节的计算全部系统化，可以在线上集中核对所有单据和附件</td>
                        <td>✓</td>
                        <td>财务部</td>
                        <td><span class="tag tag-purple">流程设计需求</span></td>
                        <td><span class="tag tag-blue">进行中</span></td>
                    </tr>
                    <tr>
                        <td>23</td>
                        <td>萍钢进口矿有多少个合同过兰州、三亚，萍钢能不能看到具体合同情况</td>
                        <td>✓</td>
                        <td>财务部</td>
                        <td><span class="tag tag-green">管理需求</span></td>
                        <td><span class="tag tag-yellow">待确认</span></td>
                    </tr>
                    <tr>
                        <td>24</td>
                        <td>原料长协合同的补充协议/调价单需要审批流需确认</td>
                        <td>✓</td>
                        <td>财务部</td>
                        <td><span class="tag tag-green">管理需求</span></td>
                        <td><span class="tag tag-blue">进行中</span></td>
                    </tr>
                    <tr>
                        <td>25</td>
                        <td>业务痛点：因为贸易主体多，信息传递，付款/开票时间比较紧</td>
                        <td>✓</td>
                        <td>财务部</td>
                        <td><span class="tag tag-green">管理需求</span></td>
                        <td><span class="tag tag-blue">进行中</span></td>
                    </tr>
                    <tr>
                        <td>26</td>
                        <td>分主体的审批流程权限的灵活性，为不同角色的人给不同主体的权限</td>
                        <td>✓</td>
                        <td>财务部</td>
                        <td><span class="tag tag-green">管理需求</span></td>
                        <td><span class="tag tag-yellow">待确认</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- 悬浮图标 -->
    <div class="floating-icon" id="floatingIcon" onclick="toggleSidebar()">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <span class="floating-shortcut">Ctrl+M</span>
    </div>
    
    <!-- 侧边栏遮罩 -->
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    
    <!-- 侧边栏 -->
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h3>
                <i class="fas fa-robot"></i>
                智能问数助手
            </h3>
            <div class="sidebar-actions">
                <button class="sidebar-btn" onclick="openFullscreen()" title="全屏模式">
                    <i class="fas fa-expand"></i>
                </button>
                <button class="sidebar-btn" onclick="closeSidebar()" title="关闭">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        
        <div class="sidebar-content">
            <!-- 欢迎区域 -->
            <div class="welcome-section" id="welcomeSection">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="welcome-title">今天有什么我能为你做的</div>
                <div class="welcome-subtitle">用自然语言查询数据，获取智能分析</div>
            </div>
            
            <!-- 快捷功能 -->
            <div class="quick-actions" id="quickActions">
                <button class="quick-action-btn" onclick="askQuestion('写一篇总结')">
                    <i class="fas fa-file-alt"></i>
                    <span>写作助手</span>
                </button>
                <button class="quick-action-btn" onclick="askQuestion('帮我分析这个表格的数据')">
                    <i class="fas fa-search"></i>
                    <span>AI 搜索</span>
                </button>
                <button class="quick-action-btn" onclick="askQuestion('创建一个学习计划')">
                    <i class="fas fa-calendar-alt"></i>
                    <span>学习计划</span>
                </button>
                <button class="quick-action-btn" onclick="askQuestion('查询财务部的需求统计')">
                    <i class="fas fa-chart-bar"></i>
                    <span>数据分析</span>
                </button>
            </div>
            
            <!-- 对话消息区 -->
            <div class="chat-messages" id="chatMessages">
                <!-- 消息会动态添加到这里 -->
            </div>
        </div>
        
        <!-- 输入区域 -->
        <div class="sidebar-input-area">
            <div class="input-wrapper">
                <input type="text" 
                       id="messageInput" 
                       placeholder="输入问题，按 Enter 发送..."
                       onkeypress="handleKeyPress(event)">
                <button class="send-btn" onclick="sendMessage()" id="sendBtn">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>
    
    <script>
        // 状态管理
        let isSidebarOpen = false;
        let hasStartedChat = false;
        
        // 切换侧边栏
        function toggleSidebar() {
            if (isSidebarOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        }
        
        // 打开侧边栏
        function openSidebar() {
            document.getElementById('sidebar').classList.add('active');
            document.getElementById('sidebarOverlay').classList.add('active');
            document.getElementById('floatingIcon').classList.add('hidden');
            document.getElementById('messageInput').focus();
            isSidebarOpen = true;
        }
        
        // 关闭侧边栏
        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
            document.getElementById('floatingIcon').classList.remove('hidden');
            isSidebarOpen = false;
        }
        
        // 打开全屏模式
        function openFullscreen() {
            window.location.href = '/assistant';
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', function(e) {
            // Ctrl+M 或 Command+M 切换侧边栏
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                toggleSidebar();
            }
            // Escape 关闭侧边栏
            if (e.key === 'Escape' && isSidebarOpen) {
                closeSidebar();
            }
        });
        
        // 处理回车键
        function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }
        
        // 发送消息
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            // 隐藏欢迎区域和快捷功能
            if (!hasStartedChat) {
                document.getElementById('welcomeSection').style.display = 'none';
                document.getElementById('quickActions').style.display = 'none';
                hasStartedChat = true;
            }
            
            // 添加用户消息
            addMessage(message, 'user');
            input.value = '';
            
            // 显示打字指示器
            showTypingIndicator();
            
            // 模拟AI响应
            setTimeout(() => {
                hideTypingIndicator();
                
                // 根据问题类型生成不同的响应
                let response = generateResponse(message);
                addMessage(response, 'assistant');
            }, 1000 + Math.random() * 1000);
        }
        
        // 快捷问题
        function askQuestion(question) {
            document.getElementById('messageInput').value = question;
            sendMessage();
        }
        
        // 添加消息到聊天区
        function addMessage(content, type) {
            const messagesContainer = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            
            const avatarIcon = type === 'assistant' ? 'fas fa-robot' : 'fas fa-user';
            
            messageDiv.innerHTML = \`
                <div class="message-avatar">
                    <i class="\${avatarIcon}" style="font-size: 14px;"></i>
                </div>
                <div class="message-content">\${content}</div>
            \`;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 显示打字指示器
        function showTypingIndicator() {
            const messagesContainer = document.getElementById('chatMessages');
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message assistant';
            typingDiv.id = 'typingIndicator';
            typingDiv.innerHTML = \`
                <div class="message-avatar">
                    <i class="fas fa-robot" style="font-size: 14px;"></i>
                </div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            \`;
            messagesContainer.appendChild(typingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 隐藏打字指示器
        function hideTypingIndicator() {
            const typingDiv = document.getElementById('typingIndicator');
            if (typingDiv) {
                typingDiv.remove();
            }
        }
        
        // 生成响应（演示用）
        function generateResponse(question) {
            const q = question.toLowerCase();
            
            if (q.includes('统计') || q.includes('数据') || q.includes('分析')) {
                return \`根据表格数据分析：
                
<table class="result-table">
<tr><th>部门</th><th>需求数</th><th>进行中</th></tr>
<tr><td>财务部</td><td>5</td><td>3</td></tr>
</table>

📊 **关键发现**：
• 财务部提出的需求最多，共5条
• 60%的需求正在进行中
• 流程设计需求占比20%\`;
            }
            
            if (q.includes('写') || q.includes('总结')) {
                return \`好的，我来帮您撰写总结：

**需求跟踪周报总结**

本周共收到5条新需求，主要来自财务部。其中：
• 流程设计需求 1 条
• 管理需求 4 条

重点关注：业务环节系统化改造需求已进入实施阶段。\`;
            }
            
            if (q.includes('学习') || q.includes('计划')) {
                return \`📚 **学习计划建议**

根据您的需求，我为您制定以下计划：

**第一周**：了解需求分析基础
**第二周**：学习流程设计方法
**第三周**：实践案例分析
**第四周**：项目实战演练

需要我详细展开某个阶段吗？\`;
            }
            
            return \`我理解您的问题是关于："\${question}"

让我为您分析相关数据。您可以尝试问我：
• "统计各部门的需求数量"
• "分析需求类型分布"
• "查看进行中的需求"\`;
        }
    </script>
</body>
</html>
`;

// 可嵌入的悬浮组件脚本（供其他页面使用）
export const assistantWidgetScript = `
<script>
(function() {
    // 创建悬浮图标
    const floatingIcon = document.createElement('div');
    floatingIcon.id = 'finspark-assistant-icon';
    floatingIcon.innerHTML = \`
        <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
    \`;
    floatingIcon.style.cssText = \`
        position: fixed;
        right: 24px;
        bottom: 100px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9999;
    \`;
    
    floatingIcon.addEventListener('mouseenter', () => {
        floatingIcon.style.transform = 'scale(1.1)';
    });
    
    floatingIcon.addEventListener('mouseleave', () => {
        floatingIcon.style.transform = 'scale(1)';
    });
    
    floatingIcon.addEventListener('click', () => {
        window.open('/assistant-widget', '_blank');
    });
    
    document.body.appendChild(floatingIcon);
})();
</script>
`;
