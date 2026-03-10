/**
 * Agent 配置中心页面
 * 
 * 功能：
 * - Agent 列表（按 L0/L1/L2/L3 分组）
 * - 模型偏好选择
 * - L1 参数配置（混合式：预设模板 + 高级表单）
 * - L2 高级 Prompt 编辑
 * - Preset 管理抽屉
 * - 权限锁定态显示
 */
import { responsiveStyles } from '../styles/responsive';

export const agentSettingsPageHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent 配置中心 - Finspark 投资分析</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans SC', sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); min-height: 100vh; }
        .gold-text { color: #d4af37; }
        .gold-gradient { background: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.2); }
        .btn-gold { background: linear-gradient(135deg, #d4af37 0%, #f5d17e 100%); color: #0a0a0a; font-weight: 600; }
        .btn-gold:hover { box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4); }
        .btn-outline { border: 1px solid rgba(212, 175, 55, 0.5); color: #d4af37; }
        .btn-outline:hover { background: rgba(212, 175, 55, 0.1); }
        
        /* Agent 列表样式 */
        .agent-item { 
            background: rgba(255, 255, 255, 0.02); 
            border: 1px solid rgba(255, 255, 255, 0.05); 
            transition: all 0.3s;
            cursor: pointer;
        }
        .agent-item:hover { border-color: rgba(212, 175, 55, 0.3); background: rgba(255, 255, 255, 0.04); }
        .agent-item.active { border-color: #d4af37; background: rgba(212, 175, 55, 0.1); }
        .agent-item.locked { opacity: 0.6; }
        
        /* 级别标签 */
        .level-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
        .level-L0 { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }
        .level-L1 { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .level-L2 { background: rgba(168, 85, 247, 0.2); color: #a78bfa; }
        .level-L3 { background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(212, 175, 55, 0.3)); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        
        /* L3 Elite 徽章 */
        .elite-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 600;
            background: linear-gradient(135deg, #d4af37 0%, #f5d17e 100%);
            color: #0a0a0a;
            border-radius: 12px;
            animation: elite-shimmer 3s infinite;
        }
        @keyframes elite-shimmer {
            0%, 100% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.3); }
            50% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.6); }
        }
        
        /* L3 Agent 特殊卡片样式 */
        .agent-item.l3-agent {
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.05), rgba(255, 255, 255, 0.02));
            border: 1px solid rgba(212, 175, 55, 0.15);
        }
        .agent-item.l3-agent:hover { 
            border-color: rgba(212, 175, 55, 0.4); 
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(255, 255, 255, 0.04));
        }
        .agent-item.l3-agent.active { 
            border-color: #d4af37; 
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.1)); 
        }
        
        /* L3 配置区域增强 */
        .l3-config-header {
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(245, 158, 11, 0.05));
            border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .l3-feature-highlight {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(212, 175, 55, 0.1);
            border-radius: 8px;
            font-size: 12px;
        }
        
        /* 模型偏好卡片 */
        .model-card {
            background: rgba(255, 255, 255, 0.03);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .model-card:hover { border-color: rgba(212, 175, 55, 0.3); }
        .model-card.selected { border-color: #d4af37; background: rgba(212, 175, 55, 0.1); }
        .model-card.recommended::before {
            content: '推荐';
            position: absolute;
            top: -8px;
            right: 12px;
            background: linear-gradient(135deg, #d4af37 0%, #f5d17e 100%);
            color: #0a0a0a;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        /* 深度模板卡片 */
        .depth-card {
            background: rgba(255, 255, 255, 0.03);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
        }
        .depth-card:hover { border-color: rgba(212, 175, 55, 0.3); transform: translateY(-2px); }
        .depth-card.selected { border-color: #d4af37; background: rgba(212, 175, 55, 0.1); }
        
        /* 人格选择卡片 */
        .personality-card {
            background: rgba(255, 255, 255, 0.03);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .personality-card:hover { border-color: rgba(212, 175, 55, 0.3); transform: translateY(-2px); }
        .personality-card.selected { border-color: #d4af37; background: rgba(212, 175, 55, 0.1); }
        
        .personality-tag {
            display: inline-block;
            padding: 2px 8px;
            font-size: 10px;
            background: rgba(212, 175, 55, 0.1);
            border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: 4px;
            color: rgba(212, 175, 55, 0.8);
        }
        .personality-card.selected .personality-tag {
            background: rgba(212, 175, 55, 0.2);
            border-color: rgba(212, 175, 55, 0.4);
            color: #d4af37;
        }
        
        /* 权限锁定遮罩 */
        .permission-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(2px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: inherit;
            z-index: 10;
        }
        
        /* 抽屉样式 */
        .drawer-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 100;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }
        .drawer-overlay.open { opacity: 1; visibility: visible; }
        
        .drawer {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 420px;
            max-width: 90vw;
            background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
            border-left: 1px solid rgba(212, 175, 55, 0.2);
            transform: translateX(100%);
            transition: transform 0.3s ease-out;
            z-index: 101;
            overflow-y: auto;
        }
        .drawer-overlay.open .drawer { transform: translateX(0); }
        
        /* 表单样式 */
        .form-input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 10px 14px;
            border-radius: 8px;
            width: 100%;
            transition: all 0.3s;
        }
        .form-input:focus {
            border-color: #d4af37;
            outline: none;
            box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
        }
        
        .form-select {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 10px 14px;
            border-radius: 8px;
            width: 100%;
            cursor: pointer;
        }
        .form-select:focus {
            border-color: #d4af37;
            outline: none;
        }
        
        /* 开关样式 */
        .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { 
            position: absolute; cursor: pointer; inset: 0; 
            background: #374151; border-radius: 12px; transition: 0.3s; 
        }
        .toggle-slider:before { 
            content: ''; position: absolute; height: 18px; width: 18px; 
            left: 3px; bottom: 3px; background: white; 
            border-radius: 50%; transition: 0.3s; 
        }
        .toggle-switch input:checked + .toggle-slider { background: #d4af37; }
        .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }
        .toggle-switch input:disabled + .toggle-slider { opacity: 0.5; cursor: not-allowed; }
        
        /* 多选标签 */
        .tag-option {
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.03);
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
        }
        .tag-option:hover { border-color: rgba(212, 175, 55, 0.3); }
        .tag-option.selected { 
            background: rgba(212, 175, 55, 0.2); 
            border-color: #d4af37; 
            color: #d4af37;
        }
        
        /* Preset 卡片 */
        .preset-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            transition: all 0.3s;
        }
        .preset-card:hover { border-color: rgba(212, 175, 55, 0.3); }
        .preset-card.default { border-color: rgba(212, 175, 55, 0.5); }
        
        /* Toast */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 200;
            animation: slideIn 0.3s ease;
        }
        .toast.success { background: rgba(34, 197, 94, 0.9); }
        .toast.error { background: rgba(239, 68, 68, 0.9); }
        .toast.info { background: rgba(59, 130, 246, 0.9); }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        /* 高级配置展开 */
        .advanced-toggle {
            cursor: pointer;
            user-select: none;
        }
        .advanced-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .advanced-content.expanded {
            max-height: 1000px;
        }
        
        /* 增强版 Prompt 编辑器 */
        .prompt-editor-container {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .prompt-toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-wrap: wrap;
        }
        
        .prompt-toolbar-label {
            font-size: 12px;
            color: #9ca3af;
            margin-right: 4px;
        }
        
        .template-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            font-size: 11px;
            background: rgba(212, 175, 55, 0.1);
            border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: 6px;
            color: rgba(212, 175, 55, 0.9);
            cursor: pointer;
            transition: all 0.2s;
        }
        .template-btn:hover {
            background: rgba(212, 175, 55, 0.2);
            border-color: rgba(212, 175, 55, 0.4);
        }
        .template-btn i { font-size: 10px; }
        
        .prompt-textarea {
            width: 100%;
            min-height: 150px;
            max-height: 300px;
            padding: 12px;
            background: transparent;
            border: none;
            outline: none;
            resize: vertical;
            font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #e5e7eb;
        }
        .prompt-textarea::placeholder { color: #6b7280; }
        .prompt-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
        .prompt-textarea:focus { box-shadow: none; }
        
        .prompt-status-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.02);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 11px;
        }
        
        .char-count { color: #9ca3af; }
        .char-count.warning { color: #fbbf24; }
        .char-count.error { color: #ef4444; }
        
        .prompt-actions { display: flex; gap: 8px; }
        
        .prompt-action-btn {
            padding: 4px 8px;
            font-size: 11px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            color: #9ca3af;
            cursor: pointer;
            transition: all 0.2s;
        }
        .prompt-action-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #e5e7eb;
        }
        .prompt-action-btn.preview-active {
            background: rgba(212, 175, 55, 0.1);
            border-color: rgba(212, 175, 55, 0.3);
            color: #d4af37;
        }
        
        .prompt-preview {
            display: none;
            padding: 12px;
            background: rgba(212, 175, 55, 0.05);
            border-top: 1px solid rgba(212, 175, 55, 0.2);
            max-height: 200px;
            overflow-y: auto;
        }
        .prompt-preview.active { display: block; }
        .prompt-preview-label {
            font-size: 10px;
            color: #d4af37;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .prompt-preview-content {
            font-size: 12px;
            color: #d1d5db;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .prompt-preview-empty {
            color: #6b7280;
            font-style: italic;
        }
        \${responsiveStyles}
    </style>
</head>
<body class="text-white">
    <!-- 桌面端导航栏 -->
    <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-black/30 border-b border-gray-800 hide-on-mobile">
        <div class="container-adaptive flex justify-between items-center">
            <a href="/" class="text-2xl font-bold gold-gradient">Finspark</a>
            <div class="flex items-center space-x-4">
                <a href="/settings" class="text-gray-400 hover:text-white transition">
                    <i class="fas fa-arrow-left mr-2"></i>返回设置
                </a>
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
                <a href="/settings" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-arrow-left text-lg"></i>
                </a>
                <a href="/" class="p-2 text-gray-400 hover:text-white touch-target">
                    <i class="fas fa-home text-lg"></i>
                </a>
            </div>
        </div>
    </nav>
    
    <main class="pt-adaptive-header pb-8 md:pb-16">
        <div class="container-adaptive">
            <!-- 页面标题 -->
            <div class="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl md:text-3xl font-bold gold-gradient mb-1 md:mb-2">Agent 配置中心</h1>
                    <p class="text-gray-400 text-sm md:text-base">自定义分析 Agent 的模型偏好和参数配置</p>
                </div>
                <button onclick="openPresetDrawer()" class="btn-outline px-4 py-2 rounded-lg text-sm md:text-base w-full sm:w-auto">
                    <i class="fas fa-bookmark mr-2"></i>管理 Preset
                </button>
            </div>
            
            <!-- 加载状态 -->
            <div id="loadingState" class="text-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl gold-text mb-4"></i>
                <p class="text-gray-400">加载配置中...</p>
            </div>
            
            <!-- 未登录提示 -->
            <div id="loginPrompt" class="hidden text-center py-20">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
                    <i class="fas fa-lock text-3xl text-gray-500"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">请先登录</h3>
                <p class="text-gray-400 mb-6">登录后可以自定义 Agent 配置</p>
                <button onclick="window.location.href='/?login=true'" class="btn-gold px-6 py-3 rounded-lg">
                    <i class="fas fa-sign-in-alt mr-2"></i>登录 / 注册
                </button>
            </div>
            
            <!-- 主内容区 -->
            <div id="mainContent" class="hidden">
                <div class="grid grid-cols-12 gap-6">
                    <!-- 左侧：Agent 列表 -->
                    <div class="col-span-12 lg:col-span-4 xl:col-span-3">
                        <div class="card rounded-xl p-4 sticky top-24">
                            <h3 class="font-semibold mb-4 flex items-center">
                                <i class="fas fa-robot mr-2 gold-text"></i>分析 Agent
                            </h3>
                            
                            <!-- Agent 分组列表 -->
                            <div id="agentList" class="space-y-4">
                                <!-- 动态生成 -->
                            </div>
                        </div>
                    </div>
                    
                    <!-- 右侧：配置面板 -->
                    <div class="col-span-12 lg:col-span-8 xl:col-span-9">
                        <!-- 未选择 Agent 提示 -->
                        <div id="noAgentSelected" class="card rounded-xl p-12 text-center">
                            <i class="fas fa-hand-pointer text-5xl text-gray-600 mb-4"></i>
                            <h3 class="text-xl font-semibold text-gray-400 mb-2">选择一个 Agent</h3>
                            <p class="text-gray-500">从左侧列表选择要配置的 Agent</p>
                        </div>
                        
                        <!-- Agent 配置面板 -->
                        <div id="agentConfigPanel" class="hidden space-y-6">
                            <!-- Agent 基本信息 -->
                            <div class="card rounded-xl p-6">
                                <div class="flex items-start justify-between mb-4">
                                    <div>
                                        <div class="flex items-center gap-3 mb-2">
                                            <h2 id="agentName" class="text-2xl font-bold"></h2>
                                            <span id="agentLevel" class="level-tag"></span>
                                        </div>
                                        <p id="agentDescription" class="text-gray-400"></p>
                                    </div>
                                    <div id="agentPermission" class="text-right">
                                        <!-- 权限状态显示 -->
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 模型偏好选择 -->
                            <div id="modelPreferenceSection" class="card rounded-xl p-6 relative">
                                <h3 class="font-semibold mb-4 flex items-center">
                                    <i class="fas fa-brain mr-2 gold-text"></i>模型偏好
                                </h3>
                                <p class="text-gray-400 text-sm mb-4">选择分析时使用的 AI 模型风格</p>
                                
                                <div id="modelOptions" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <!-- 动态生成模型选项 -->
                                </div>
                                
                                <!-- 权限锁定遮罩 -->
                                <div id="modelPermissionOverlay" class="permission-overlay hidden">
                                    <i class="fas fa-lock text-3xl text-gray-500 mb-3"></i>
                                    <p class="text-gray-400 mb-4 text-center px-4">升级到 Pro 会员<br>解锁模型偏好设置</p>
                                    <button onclick="window.location.href='/membership'" class="btn-gold px-4 py-2 rounded-lg text-sm">
                                        升级解锁
                                    </button>
                                </div>
                            </div>
                            
                            <!-- L1 参数配置 -->
                            <div id="l1ConfigSection" class="card rounded-xl p-6 relative">
                                <h3 class="font-semibold mb-4 flex items-center">
                                    <i class="fas fa-sliders-h mr-2 gold-text"></i>分析参数配置
                                </h3>
                                
                                <!-- 快速选择模板 -->
                                <div class="mb-6">
                                    <p class="text-gray-400 text-sm mb-3">快速选择分析深度</p>
                                    <div id="depthTemplates" class="grid grid-cols-3 gap-4">
                                        <!-- 动态生成深度模板 -->
                                    </div>
                                </div>
                                
                                <!-- 高级配置展开 -->
                                <div class="advanced-toggle flex items-center gap-2 text-gray-400 hover:text-white transition mb-4" onclick="toggleAdvancedConfig()">
                                    <i id="advancedIcon" class="fas fa-chevron-right transition-transform"></i>
                                    <span>高级配置</span>
                                </div>
                                
                                <div id="advancedConfig" class="advanced-content">
                                    <div id="configFields" class="space-y-4 pt-4 border-t border-gray-800">
                                        <!-- 动态生成配置字段 -->
                                    </div>
                                </div>
                                
                                <!-- 权限锁定遮罩 -->
                                <div id="configPermissionOverlay" class="permission-overlay hidden">
                                    <i class="fas fa-lock text-3xl text-gray-500 mb-3"></i>
                                    <p class="text-gray-400 mb-4 text-center px-4">升级到 Pro 会员<br>解锁参数配置</p>
                                    <button onclick="window.location.href='/membership'" class="btn-gold px-4 py-2 rounded-lg text-sm">
                                        升级解锁
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 分析人格选择（仅 FINAL_CONCLUSION） -->
                            <div id="personalitySection" class="card rounded-xl p-6 relative hidden">
                                <h3 class="font-semibold mb-2 flex items-center">
                                    <i class="fas fa-user-tie mr-2 gold-text"></i>分析人格
                                    <span class="ml-2 text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">L3 专属</span>
                                </h3>
                                <p class="text-gray-400 text-sm mb-4">选择分析人格，影响投资结论的表达风格和侧重点</p>
                                
                                <div id="personalityCards" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <!-- 冷静审慎型 -->
                                    <div class="personality-card" data-personality="prudent" onclick="selectPersonality('prudent')">
                                        <div class="flex items-center gap-3 mb-3">
                                            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(59, 130, 246, 0.2);">
                                                <i class="fas fa-shield-halved" style="color: #3b82f6;"></i>
                                            </div>
                                            <div>
                                                <div class="font-medium">冷静审慎型</div>
                                                <div class="text-xs text-gray-500">Prudent</div>
                                            </div>
                                        </div>
                                        <p class="text-xs text-gray-400 mb-2">强调风险提示，保守评估，适合风险厌恶型投资者</p>
                                        <div class="text-xs text-gray-500"><i class="fas fa-user mr-1"></i>适合：风险厌恶型投资者</div>
                                    </div>
                                    
                                    <!-- 决策导向型 -->
                                    <div class="personality-card selected" data-personality="decisive" onclick="selectPersonality('decisive')">
                                        <div class="flex items-center gap-3 mb-3">
                                            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(245, 158, 11, 0.2);">
                                                <i class="fas fa-bullseye" style="color: #f59e0b;"></i>
                                            </div>
                                            <div>
                                                <div class="font-medium">决策导向型</div>
                                                <div class="text-xs text-gray-500">Decisive</div>
                                            </div>
                                        </div>
                                        <p class="text-xs text-gray-400 mb-2">直接给出明确建议，适合追求效率的投资者</p>
                                        <div class="text-xs text-gray-500"><i class="fas fa-user mr-1"></i>适合：追求效率的投资者</div>
                                    </div>
                                    
                                    <!-- 风险提示强化型 -->
                                    <div class="personality-card" data-personality="risk_aware" onclick="selectPersonality('risk_aware')">
                                        <div class="flex items-center gap-3 mb-3">
                                            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(239, 68, 68, 0.2);">
                                                <i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i>
                                            </div>
                                            <div>
                                                <div class="font-medium">风险提示强化型</div>
                                                <div class="text-xs text-gray-500">Risk-Aware</div>
                                            </div>
                                        </div>
                                        <p class="text-xs text-gray-400 mb-2">每个结论都附带风险提示，适合机构合规需求</p>
                                        <div class="text-xs text-gray-500"><i class="fas fa-building mr-1"></i>适合：机构合规需求</div>
                                    </div>
                                </div>
                                
                                <!-- 权限锁定遮罩 -->
                                <div id="personalityPermissionOverlay" class="permission-overlay hidden">
                                    <i class="fas fa-crown text-3xl text-yellow-500 mb-3"></i>
                                    <p class="text-gray-400 mb-4 text-center px-4">升级到 Elite 会员<br>解锁分析人格选择</p>
                                    <button onclick="window.location.href='/membership'" class="btn-gold px-4 py-2 rounded-lg text-sm">
                                        升级解锁
                                    </button>
                                </div>
                            </div>
                            
                            <!-- L2 高级 Prompt 编辑 -->
                            <div id="promptSection" class="card rounded-xl p-6 relative hidden">
                                <h3 class="font-semibold mb-4 flex items-center">
                                    <i class="fas fa-edit mr-2 gold-text"></i>高级 Prompt 编辑
                                    <span class="ml-2 text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">Elite</span>
                                </h3>
                                <p class="text-gray-400 text-sm mb-4">自定义此 Agent 的分析提示词，影响输出风格和关注点</p>
                                
                                <!-- 增强版 Prompt 编辑器 -->
                                <div class="prompt-editor-container" id="promptEditorContainer">
                                    <!-- 工具栏 -->
                                    <div class="prompt-toolbar">
                                        <span class="prompt-toolbar-label">快速模板:</span>
                                        <button type="button" class="template-btn" onclick="insertPromptTemplate('focus_risk')" title="风险关注">
                                            <i class="fas fa-shield-alt"></i>
                                            <span>风险关注</span>
                                        </button>
                                        <button type="button" class="template-btn" onclick="insertPromptTemplate('table_output')" title="表格输出">
                                            <i class="fas fa-table"></i>
                                            <span>表格输出</span>
                                        </button>
                                        <button type="button" class="template-btn" onclick="insertPromptTemplate('concise')" title="精简模式">
                                            <i class="fas fa-compress-alt"></i>
                                            <span>精简模式</span>
                                        </button>
                                        <button type="button" class="template-btn" onclick="insertPromptTemplate('detailed')" title="详细分析">
                                            <i class="fas fa-expand-alt"></i>
                                            <span>详细分析</span>
                                        </button>
                                        <button type="button" class="template-btn" onclick="insertPromptTemplate('conservative')" title="保守评估">
                                            <i class="fas fa-balance-scale"></i>
                                            <span>保守评估</span>
                                        </button>
                                    </div>
                                    
                                    <!-- 编辑区域 -->
                                    <div class="prompt-editor-area">
                                        <textarea 
                                            id="promptEditor" 
                                            class="prompt-textarea" 
                                            placeholder="输入您的自定义分析要求...&#10;&#10;例如：&#10;- 请特别关注公司的现金流变化&#10;- 输出时使用表格对比关键指标&#10;- 结论请保持谨慎"
                                            maxlength="500"
                                        ></textarea>
                                    </div>
                                    
                                    <!-- 预览面板 -->
                                    <div class="prompt-preview" id="promptEditorPreview">
                                        <div class="prompt-preview-label">预览</div>
                                        <div class="prompt-preview-content" id="promptEditorPreviewContent">
                                            <span class="prompt-preview-empty">暂无内容</span>
                                        </div>
                                    </div>
                                    
                                    <!-- 底部状态栏 -->
                                    <div class="prompt-status-bar">
                                        <span class="char-count" id="promptEditorCharCount">0 / 500</span>
                                        <div class="prompt-actions">
                                            <button type="button" class="prompt-action-btn" onclick="togglePromptPreview()" id="promptEditorPreviewBtn">
                                                <i class="fas fa-eye"></i> 预览
                                            </button>
                                            <button type="button" class="prompt-action-btn" onclick="resetPrompt()">
                                                <i class="fas fa-undo"></i> 恢复默认
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 权限锁定遮罩 -->
                                <div id="promptPermissionOverlay" class="permission-overlay hidden">
                                    <i class="fas fa-crown text-3xl text-yellow-500 mb-3"></i>
                                    <p class="text-gray-400 mb-4 text-center px-4">升级到 Elite 会员<br>解锁高级 Prompt 编辑</p>
                                    <button onclick="window.location.href='/membership'" class="btn-gold px-4 py-2 rounded-lg text-sm">
                                        升级解锁
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 操作按钮 -->
                            <div class="flex items-center justify-between">
                                <button onclick="saveAsPreset()" class="btn-outline px-4 py-2 rounded-lg">
                                    <i class="fas fa-save mr-2"></i>保存为 Preset
                                </button>
                                <div class="flex gap-3">
                                    <button onclick="resetConfig()" class="px-4 py-2 text-gray-400 hover:text-white transition">
                                        重置
                                    </button>
                                    <button onclick="applyConfig()" class="btn-gold px-6 py-2 rounded-lg">
                                        <i class="fas fa-check mr-2"></i>应用配置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>
    
    <!-- Preset 管理抽屉 -->
    <div id="presetDrawerOverlay" class="drawer-overlay" onclick="closePresetDrawer()">
        <div class="drawer" onclick="event.stopPropagation()">
            <div class="p-6 border-b border-gray-800">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold">Preset 管理</h3>
                    <button onclick="closePresetDrawer()" class="text-gray-400 hover:text-white p-2">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
            </div>
            
            <div class="p-6">
                <!-- 当前 Agent 的 Preset -->
                <div id="currentAgentPresets" class="mb-8">
                    <h4 class="text-sm text-gray-400 mb-3 flex items-center justify-between">
                        <span><span id="drawerAgentName"></span> 的 Preset</span>
                        <button onclick="createNewPreset()" class="text-yellow-500 hover:text-yellow-400 text-sm">
                            <i class="fas fa-plus mr-1"></i>新建
                        </button>
                    </h4>
                    <div id="agentPresetList" class="space-y-3">
                        <!-- 动态生成 -->
                    </div>
                </div>
                
                <!-- 官方推荐 Preset -->
                <div id="officialPresets">
                    <h4 class="text-sm text-gray-400 mb-3">官方推荐</h4>
                    <div id="officialPresetList" class="space-y-3">
                        <!-- 动态生成 -->
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- 新建/编辑 Preset 模态框 -->
    <div id="presetModal" class="fixed inset-0 bg-black/70 z-[150] hidden flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <h3 id="presetModalTitle" class="text-xl font-bold mb-6">新建 Preset</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-gray-400 mb-2">Preset 名称</label>
                    <input type="text" id="presetNameInput" class="form-input" placeholder="例如：保守分析配置">
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-400">设为默认</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="presetDefaultInput">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6">
                <button onclick="closePresetModal()" class="px-4 py-2 text-gray-400 hover:text-white">取消</button>
                <button onclick="savePreset()" class="btn-gold px-6 py-2 rounded-lg">保存</button>
            </div>
        </div>
    </div>
    
    <script>
        // ============================================
        // 全局状态
        // ============================================
        let currentUser = null;
        let selectedAgentType = null;
        let officialPresets = {};
        let agentSchemas = {};
        let userPresets = {};
        let agentSettings = {};
        let currentConfig = {};
        let editingPresetId = null;
        
        // 模型偏好配置（隐藏实际模型名）
        const MODEL_PREFERENCES = {
            standard: { label: '标准模式', description: '平衡效果与速度，适合大多数场景', icon: 'fa-balance-scale', recommended: true },
            fast: { label: '快速模式', description: '快速生成，适合初步筛选', icon: 'fa-bolt', recommended: false },
            rigorous: { label: '严谨分析', description: '更严谨的推理，适合重要决策', icon: 'fa-microscope', recommended: false },
            deep_reasoning: { label: '深度推理', description: '复杂问题深度思考', icon: 'fa-brain', recommended: false },
            chinese_enhanced: { label: '中文增强', description: '更好的中文表达和理解', icon: 'fa-language', recommended: false },
            quick_gen: { label: '极速生成', description: '最快速度，适合批量处理', icon: 'fa-rocket', recommended: false },
            balanced: { label: '均衡模式', description: '综合各方面表现', icon: 'fa-circle-half-stroke', recommended: false },
        };
        
        // Agent 显示名称映射
        const AGENT_NAMES = {
            PLANNING: { name: '分析规划', icon: 'fa-sitemap' },
            PROFITABILITY: { name: '利润分析', icon: 'fa-chart-line' },
            BALANCE_SHEET: { name: '资产负债分析', icon: 'fa-scale-balanced' },
            CASH_FLOW: { name: '现金流分析', icon: 'fa-money-bill-wave' },
            EARNINGS_QUALITY: { name: '盈利质量', icon: 'fa-gem' },
            TREND_INTERPRETATION: { name: '趋势解读', icon: 'fa-chart-area' },
            RISK: { name: '风险评估', icon: 'fa-shield-halved' },
            BUSINESS_INSIGHT: { name: '业务洞察', icon: 'fa-lightbulb' },
            BUSINESS_MODEL: { name: '商业模式', icon: 'fa-building' },
            INDUSTRY_COMPARISON: { name: '行业对比', icon: 'fa-users' },
            FORECAST: { name: '业绩预测', icon: 'fa-crystal-ball' },
            VALUATION: { name: '估值评估', icon: 'fa-coins' },
            FINAL_CONCLUSION: { name: '投资结论', icon: 'fa-flag-checkered' },
        };
        
        // ============================================
        // 初始化
        // ============================================
        async function init() {
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                showLoginRequired();
                return;
            }
            
            try {
                // 验证登录状态
                const userRes = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (!userRes.ok) {
                    showLoginRequired();
                    return;
                }
                
                const userData = await userRes.json();
                if (!userData.success) {
                    showLoginRequired();
                    return;
                }
                
                currentUser = userData.user;
                
                // 加载官方 Preset 和 Schema
                const [presetsRes, schemasRes, levelsRes, userPresetsRes, settingsRes] = await Promise.all([
                    fetch('/api/agent-presets/official/list'),
                    fetch('/api/agent-presets/schemas/all'),
                    fetch('/api/agent-presets/levels/all'),
                    fetch('/api/agent-presets', { headers: { 'Authorization': 'Bearer ' + token } }),
                    fetch('/api/agent-presets/settings/all', { headers: { 'Authorization': 'Bearer ' + token } }),
                ]);
                
                const [presetsData, schemasData, levelsData, userPresetsData, settingsData] = await Promise.all([
                    presetsRes.json(),
                    schemasRes.json(),
                    levelsRes.json(),
                    userPresetsRes.json(),
                    settingsRes.json(),
                ]);
                
                // 存储数据
                presetsData.presets.forEach(p => { officialPresets[p.agentType] = p; });
                agentSchemas = schemasData.schemas;
                
                // 用户 Preset 按 Agent 分组
                if (userPresetsData.success) {
                    userPresetsData.presets.forEach(p => {
                        if (!userPresets[p.agentType]) userPresets[p.agentType] = [];
                        userPresets[p.agentType].push(p);
                    });
                }
                
                // Agent Settings
                if (settingsData.success) {
                    settingsData.settings.forEach(s => { agentSettings[s.agentType] = s; });
                }
                
                // 渲染 Agent 列表
                renderAgentList(levelsData.levels);
                
                showMainContent();
                
                // 初始化增强版 Prompt 编辑器
                initPromptEditor();
                
            } catch (error) {
                console.error('Init error:', error);
                showToast('加载失败，请刷新重试', 'error');
            }
        }
        
        // ============================================
        // UI 状态切换
        // ============================================
        function showLoginRequired() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('loginPrompt').classList.remove('hidden');
            document.getElementById('mainContent').classList.add('hidden');
        }
        
        function showMainContent() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('loginPrompt').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
        }
        
        // ============================================
        // Agent 列表渲染
        // ============================================
        function renderAgentList(levels) {
            const container = document.getElementById('agentList');
            const levelLabels = {
                L0: { name: '核心 Agent', description: '系统核心，不可配置' },
                L1: { name: '分析 Agent', description: 'Pro 可配置参数' },
                L2: { name: '洞察 Agent', description: 'Elite 可编辑 Prompt' },
                L3: { name: '高级 Agent', description: 'Elite 专属' },
            };
            
            let html = '';
            
            ['L0', 'L1', 'L2', 'L3'].forEach(level => {
                const agents = levels[level] || [];
                if (agents.length === 0) return;
                
                html += \`
                    <div class="mb-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="level-tag level-\${level}">\${level}</span>
                            <span class="text-sm text-gray-400">\${levelLabels[level].name}</span>
                        </div>
                        <div class="space-y-1">
                \`;
                
                agents.forEach(agentType => {
                    const official = officialPresets[agentType];
                    const agentInfo = AGENT_NAMES[agentType] || { name: agentType, icon: 'fa-robot' };
                    const canConfigure = checkPermission(agentType).canConfigure;
                    const isL3 = level === 'L3';
                    
                    html += \`
                        <div class="agent-item rounded-lg p-3 flex items-center gap-3 \${!canConfigure && level !== 'L0' ? 'locked' : ''} \${isL3 ? 'l3-agent' : ''}"
                             onclick="selectAgent('\${agentType}')"
                             data-agent="\${agentType}">
                            <i class="fas \${agentInfo.icon} \${canConfigure || level === 'L0' ? 'gold-text' : 'text-gray-500'}"></i>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-medium text-sm truncate">\${agentInfo.name}</span>
                                    \${isL3 ? '<span class="elite-badge"><i class="fas fa-crown text-xs"></i>Elite</span>' : ''}
                                </div>
                            </div>
                            \${!canConfigure && level !== 'L0' ? '<i class="fas fa-lock text-gray-600 text-xs"></i>' : ''}
                        </div>
                    \`;
                });
                
                html += '</div></div>';
            });
            
            container.innerHTML = html;
        }
        
        // ============================================
        // 选择 Agent
        // ============================================
        function selectAgent(agentType) {
            selectedAgentType = agentType;
            
            // 更新列表选中状态
            document.querySelectorAll('.agent-item').forEach(el => {
                el.classList.toggle('active', el.dataset.agent === agentType);
            });
            
            // 显示配置面板
            document.getElementById('noAgentSelected').classList.add('hidden');
            document.getElementById('agentConfigPanel').classList.remove('hidden');
            
            // 渲染配置
            renderAgentConfig(agentType);
        }
        
        // ============================================
        // 渲染 Agent 配置
        // ============================================
        function renderAgentConfig(agentType) {
            const official = officialPresets[agentType];
            const schema = agentSchemas[agentType];
            const permission = checkPermission(agentType);
            const agentInfo = AGENT_NAMES[agentType] || { name: agentType };
            
            // 初始化当前配置
            currentConfig = {
                modelPreference: agentSettings[agentType]?.modelPreference || official.modelPreference,
                configJson: { ...official.presetConfigJson },
                promptText: null,
            };
            
            // 如果有默认 Preset，使用 Preset 的配置
            const defaultPreset = (userPresets[agentType] || []).find(p => p.isDefault);
            if (defaultPreset) {
                currentConfig.modelPreference = defaultPreset.modelPreference || currentConfig.modelPreference;
                currentConfig.configJson = { ...currentConfig.configJson, ...defaultPreset.presetConfigJson };
                currentConfig.promptText = defaultPreset.presetPromptText;
            }
            
            // 基本信息
            document.getElementById('agentName').textContent = agentInfo.name;
            document.getElementById('agentLevel').textContent = official.level;
            document.getElementById('agentLevel').className = 'level-tag level-' + official.level;
            document.getElementById('agentDescription').textContent = official.description;
            
            // L3 专属标识区域
            renderL3Header(official, permission);
            
            // 权限状态
            renderPermissionStatus(permission);
            
            // 模型偏好
            renderModelPreference(permission);
            
            // L1 参数配置
            renderL1Config(schema, permission);
            
            // 人格选择（仅 FINAL_CONCLUSION）
            renderPersonalitySection(official, permission);
            
            // L2 Prompt 编辑
            renderPromptSection(official, permission);
        }
        
        // ============================================
        // L3 专属标识渲染
        // ============================================
        function renderL3Header(official, permission) {
            let headerEl = document.getElementById('l3HeaderSection');
            
            // 如果元素不存在，创建它
            if (!headerEl) {
                const configPanel = document.getElementById('agentConfigPanel');
                const insertPoint = configPanel.querySelector('.space-y-6');
                if (insertPoint) {
                    const div = document.createElement('div');
                    div.id = 'l3HeaderSection';
                    insertPoint.insertBefore(div, insertPoint.firstChild);
                    headerEl = div;
                }
            }
            
            if (!headerEl) return;
            
            // 非 L3 隐藏
            if (official.level !== 'L3') {
                headerEl.innerHTML = '';
                return;
            }
            
            const features = {
                FORECAST: [
                    { icon: 'fa-chart-line', text: '多情景预测' },
                    { icon: 'fa-cogs', text: '可调假设风格' },
                    { icon: 'fa-percent', text: '置信区间分析' },
                ],
                VALUATION: [
                    { icon: 'fa-calculator', text: '多方法估值' },
                    { icon: 'fa-shield-alt', text: '安全边际计算' },
                    { icon: 'fa-bullseye', text: '目标价位预测' },
                ],
                FINAL_CONCLUSION: [
                    { icon: 'fa-user-tie', text: '分析人格定制' },
                    { icon: 'fa-tasks', text: '行动计划建议' },
                    { icon: 'fa-star', text: '多维评分体系' },
                ],
            };
            
            const agentFeatures = features[selectedAgentType] || [];
            
            headerEl.innerHTML = \`
                <div class="l3-config-header">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <span class="elite-badge"><i class="fas fa-crown text-xs"></i>Elite 专属</span>
                            <span class="text-sm text-gray-400">L3 高级 Agent</span>
                        </div>
                        \${!permission.canConfigure ? '<span class="text-xs text-yellow-500"><i class="fas fa-lock mr-1"></i>升级解锁</span>' : ''}
                    </div>
                    <div class="flex flex-wrap gap-3">
                        \${agentFeatures.map(f => \`
                            <div class="l3-feature-highlight">
                                <i class="fas \${f.icon} gold-text"></i>
                                <span class="text-gray-300">\${f.text}</span>
                            </div>
                        \`).join('')}
                    </div>
                </div>
            \`;
        }
        
        // 检查权限
        function checkPermission(agentType) {
            const official = officialPresets[agentType];
            if (!official) return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
            
            const tierOrder = { guest: 0, free: 1, pro: 2, elite: 3 };
            const userTier = currentUser?.tier || 'guest';
            const userTierLevel = tierOrder[userTier];
            
            if (official.level === 'L0') {
                return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
            }
            
            if (official.level === 'L1') {
                const canConfigure = userTierLevel >= tierOrder.pro;
                return { canConfigure, canEditPrompt: false, canChangeModel: canConfigure && official.allowModelChange };
            }
            
            if (official.level === 'L2') {
                const canConfigure = userTierLevel >= tierOrder.pro;
                return {
                    canConfigure,
                    canEditPrompt: userTierLevel >= tierOrder.elite && official.allowCustomPrompt,
                    canChangeModel: canConfigure && official.allowModelChange,
                };
            }
            
            if (official.level === 'L3') {
                const canConfigure = userTierLevel >= tierOrder.elite;
                return {
                    canConfigure,
                    canEditPrompt: canConfigure && official.allowCustomPrompt,
                    canChangeModel: canConfigure && official.allowModelChange,
                };
            }
            
            return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
        }
        
        // 渲染权限状态
        function renderPermissionStatus(permission) {
            const container = document.getElementById('agentPermission');
            
            if (permission.canConfigure) {
                container.innerHTML = \`
                    <span class="text-green-400 text-sm"><i class="fas fa-check-circle mr-1"></i>可配置</span>
                \`;
            } else {
                container.innerHTML = \`
                    <span class="text-gray-500 text-sm"><i class="fas fa-lock mr-1"></i>不可配置</span>
                \`;
            }
        }
        
        // ============================================
        // 模型偏好渲染
        // ============================================
        function renderModelPreference(permission) {
            const container = document.getElementById('modelOptions');
            const overlay = document.getElementById('modelPermissionOverlay');
            
            // 显示/隐藏权限遮罩
            overlay.classList.toggle('hidden', permission.canChangeModel);
            
            let html = '';
            
            Object.entries(MODEL_PREFERENCES).forEach(([key, model]) => {
                const isSelected = currentConfig.modelPreference === key;
                html += \`
                    <div class="model-card relative \${isSelected ? 'selected' : ''} \${model.recommended ? 'recommended' : ''}"
                         onclick="selectModel('\${key}')"
                         data-model="\${key}">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="fas \${model.icon} \${isSelected ? 'gold-text' : 'text-gray-400'}"></i>
                            <span class="font-medium">\${model.label}</span>
                        </div>
                        <p class="text-xs text-gray-500">\${model.description}</p>
                    </div>
                \`;
            });
            
            container.innerHTML = html;
        }
        
        function selectModel(modelKey) {
            const permission = checkPermission(selectedAgentType);
            if (!permission.canChangeModel) return;
            
            currentConfig.modelPreference = modelKey;
            
            // 更新 UI
            document.querySelectorAll('.model-card').forEach(el => {
                el.classList.toggle('selected', el.dataset.model === modelKey);
            });
        }
        
        // ============================================
        // L1 参数配置渲染
        // ============================================
        function renderL1Config(schema, permission) {
            const depthContainer = document.getElementById('depthTemplates');
            const configContainer = document.getElementById('configFields');
            const overlay = document.getElementById('configPermissionOverlay');
            const section = document.getElementById('l1ConfigSection');
            
            // L0 隐藏整个配置区域
            if (schema.level === 'L0') {
                section.classList.add('hidden');
                return;
            }
            section.classList.remove('hidden');
            
            // 显示/隐藏权限遮罩
            overlay.classList.toggle('hidden', permission.canConfigure);
            
            // 渲染深度模板
            const depths = [
                { value: 'quick', label: '快速', icon: 'fa-bolt', time: '约3分钟' },
                { value: 'standard', label: '标准', icon: 'fa-balance-scale', time: '约5分钟' },
                { value: 'deep', label: '深度', icon: 'fa-microscope', time: '约10分钟' },
            ];
            
            depthContainer.innerHTML = depths.map(d => \`
                <div class="depth-card \${currentConfig.configJson.analysisDepth === d.value ? 'selected' : ''}"
                     onclick="selectDepth('\${d.value}')"
                     data-depth="\${d.value}">
                    <i class="fas \${d.icon} text-2xl \${currentConfig.configJson.analysisDepth === d.value ? 'gold-text' : 'text-gray-500'} mb-2"></i>
                    <div class="font-semibold">\${d.label}</div>
                    <div class="text-xs text-gray-500 mt-1">\${d.time}</div>
                </div>
            \`).join('');
            
            // 渲染高级配置字段
            if (!schema.configFields || schema.configFields.length === 0) {
                configContainer.innerHTML = '<p class="text-gray-500 text-sm">此 Agent 暂无高级配置选项</p>';
                return;
            }
            
            let fieldsHtml = '';
            schema.configFields.forEach(field => {
                if (field.key === 'analysisDepth') return; // 深度已单独渲染
                
                const fieldValue = currentConfig.configJson[field.key] ?? field.default;
                const isLocked = field.minTier && !checkTierAccess(field.minTier);
                
                fieldsHtml += \`<div class="flex items-center justify-between \${isLocked ? 'opacity-50' : ''}">\`;
                fieldsHtml += \`<div class="flex-1"><div class="text-sm font-medium">\${field.label}</div>\`;
                if (field.description) fieldsHtml += \`<div class="text-xs text-gray-500 mt-1">\${field.description}</div>\`;
                fieldsHtml += '</div>';
                
                // 根据字段类型渲染不同控件
                if (field.type === 'boolean') {
                    fieldsHtml += \`
                        <label class="toggle-switch">
                            <input type="checkbox" \${fieldValue ? 'checked' : ''} \${isLocked ? 'disabled' : ''}
                                   onchange="updateConfigField('\${field.key}', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    \`;
                } else if (field.type === 'select') {
                    fieldsHtml += \`<select class="form-select w-40" \${isLocked ? 'disabled' : ''} onchange="updateConfigField('\${field.key}', this.value)">\`;
                    field.options.forEach(opt => {
                        fieldsHtml += \`<option value="\${opt.value}" \${fieldValue === opt.value ? 'selected' : ''}>\${opt.label}</option>\`;
                    });
                    fieldsHtml += '</select>';
                } else if (field.type === 'number') {
                    fieldsHtml += \`<input type="number" class="form-input w-24 text-center" value="\${fieldValue}" \${isLocked ? 'disabled' : ''}
                                          onchange="updateConfigField('\${field.key}', parseInt(this.value))">\`;
                } else if (field.type === 'multi_select') {
                    fieldsHtml += '</div><div class="flex flex-wrap gap-2 mt-2">';
                    field.options.forEach(opt => {
                        const isSelected = (fieldValue || []).includes(opt.value);
                        fieldsHtml += \`
                            <span class="tag-option \${isSelected ? 'selected' : ''}" 
                                  onclick="toggleMultiSelect('\${field.key}', '\${opt.value}')"
                                  data-field="\${field.key}" data-value="\${opt.value}">
                                \${opt.label}
                            </span>
                        \`;
                    });
                    fieldsHtml += '</div><div>';
                }
                
                if (isLocked) {
                    fieldsHtml += \`<i class="fas fa-lock text-gray-600 ml-2" title="需要 \${field.minTier} 会员"></i>\`;
                }
                
                fieldsHtml += '</div>';
            });
            
            configContainer.innerHTML = fieldsHtml;
        }
        
        function selectDepth(depth) {
            const permission = checkPermission(selectedAgentType);
            if (!permission.canConfigure) return;
            
            currentConfig.configJson.analysisDepth = depth;
            
            document.querySelectorAll('.depth-card').forEach(el => {
                el.classList.toggle('selected', el.dataset.depth === depth);
                el.querySelector('i').classList.toggle('gold-text', el.dataset.depth === depth);
                el.querySelector('i').classList.toggle('text-gray-500', el.dataset.depth !== depth);
            });
        }
        
        function updateConfigField(key, value) {
            currentConfig.configJson[key] = value;
        }
        
        function toggleMultiSelect(fieldKey, value) {
            const permission = checkPermission(selectedAgentType);
            if (!permission.canConfigure) return;
            
            if (!currentConfig.configJson[fieldKey]) {
                currentConfig.configJson[fieldKey] = [];
            }
            
            const arr = currentConfig.configJson[fieldKey];
            const idx = arr.indexOf(value);
            
            if (idx >= 0) {
                arr.splice(idx, 1);
            } else {
                arr.push(value);
            }
            
            // 更新 UI
            document.querySelectorAll(\`.tag-option[data-field="\${fieldKey}"][data-value="\${value}"]\`).forEach(el => {
                el.classList.toggle('selected', arr.includes(value));
            });
        }
        
        function toggleAdvancedConfig() {
            const content = document.getElementById('advancedConfig');
            const icon = document.getElementById('advancedIcon');
            content.classList.toggle('expanded');
            icon.style.transform = content.classList.contains('expanded') ? 'rotate(90deg)' : '';
        }
        
        function checkTierAccess(minTier) {
            const tierOrder = { free: 1, pro: 2, elite: 3 };
            const userTier = currentUser?.tier || 'free';
            return tierOrder[userTier] >= tierOrder[minTier];
        }
        
        // ============================================
        // 分析人格选择渲染（仅 FINAL_CONCLUSION）
        // ============================================
        const ANALYSIS_PERSONALITIES = {
            prudent: {
                id: 'prudent',
                name: '冷静审慎型',
                icon: 'fa-shield-alt',
                iconColor: 'text-blue-400',
                description: '强调风险提示，保守评估，适合风险厌恶型投资者',
                tags: ['保守估值', '风险优先', '谨慎措辞'],
            },
            decisive: {
                id: 'decisive',
                name: '决策导向型',
                icon: 'fa-bullseye',
                iconColor: 'text-green-400',
                description: '直接给出明确建议，适合追求效率的投资者',
                tags: ['明确结论', '操作建议', '高效决策'],
            },
            risk_aware: {
                id: 'risk_aware',
                name: '风险提示强化型',
                icon: 'fa-exclamation-triangle',
                iconColor: 'text-yellow-400',
                description: '每个结论都附带风险提示，适合机构合规需求',
                tags: ['合规导向', '全面风险', '免责声明'],
            },
        };
        
        function renderPersonalitySection(official, permission) {
            const section = document.getElementById('personalitySection');
            if (!section) return;
            
            // 只有 FINAL_CONCLUSION 才显示人格选择
            if (selectedAgentType !== 'FINAL_CONCLUSION') {
                section.classList.add('hidden');
                return;
            }
            
            section.classList.remove('hidden');
            
            const container = document.getElementById('personalityOptions');
            const overlay = document.getElementById('personalityPermissionOverlay');
            
            if (!container || !overlay) return;
            
            // 显示/隐藏权限遮罩
            overlay.classList.toggle('hidden', permission.canConfigure);
            
            // 获取当前人格设置
            const currentPersonality = currentConfig.configJson.analysisPersonality || 'decisive';
            
            let html = '';
            Object.entries(ANALYSIS_PERSONALITIES).forEach(([key, personality]) => {
                const isSelected = currentPersonality === key;
                html += \`
                    <div class="personality-card \${isSelected ? 'selected' : ''}" 
                         onclick="selectPersonality('\${key}')"
                         data-personality="\${key}">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800/50">
                                <i class="fas \${personality.icon} \${isSelected ? 'gold-text' : personality.iconColor}"></i>
                            </div>
                            <div>
                                <div class="font-semibold">\${personality.name}</div>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">\${personality.description}</p>
                        <div class="flex flex-wrap gap-1">
                            \${personality.tags.map(tag => \`<span class="personality-tag">\${tag}</span>\`).join('')}
                        </div>
                    </div>
                \`;
            });
            
            container.innerHTML = html;
        }
        
        function selectPersonality(personalityId) {
            const permission = checkPermission(selectedAgentType);
            if (!permission.canConfigure) return;
            
            currentConfig.configJson.analysisPersonality = personalityId;
            
            // 更新 UI
            document.querySelectorAll('.personality-card').forEach(el => {
                const isSelected = el.dataset.personality === personalityId;
                el.classList.toggle('selected', isSelected);
                const icon = el.querySelector('i');
                if (icon) {
                    const personality = ANALYSIS_PERSONALITIES[el.dataset.personality];
                    if (isSelected) {
                        icon.className = \`fas \${personality.icon} gold-text\`;
                    } else {
                        icon.className = \`fas \${personality.icon} \${personality.iconColor}\`;
                    }
                }
            });
        }
        
        // ============================================
        // L2 Prompt 编辑渲染
        // ============================================
        function renderPromptSection(official, permission) {
            const section = document.getElementById('promptSection');
            const overlay = document.getElementById('promptPermissionOverlay');
            const editor = document.getElementById('promptEditor');
            
            // 只有 L2/L3 且允许自定义 Prompt 才显示
            if ((official.level !== 'L2' && official.level !== 'L3') || !official.allowCustomPrompt) {
                section.classList.add('hidden');
                return;
            }
            
            section.classList.remove('hidden');
            overlay.classList.toggle('hidden', permission.canEditPrompt);
            
            editor.value = currentConfig.promptText || '';
            editor.disabled = !permission.canEditPrompt;
            
            editor.oninput = function() {
                currentConfig.promptText = this.value || null;
            };
        }
        
        function resetPrompt() {
            const permission = checkPermission(selectedAgentType);
            if (!permission.canEditPrompt) return;
            
            currentConfig.promptText = null;
            document.getElementById('promptEditor').value = '';
            showToast('已恢复默认 Prompt', 'info');
        }
        
        // ============================================
        // 配置操作
        // ============================================
        async function applyConfig() {
            if (!selectedAgentType) return;
            
            const token = localStorage.getItem('authToken');
            const permission = checkPermission(selectedAgentType);
            
            if (!permission.canConfigure) {
                showToast('无权限修改此配置', 'error');
                return;
            }
            
            try {
                // 更新 Agent Settings（模型偏好）
                if (permission.canChangeModel) {
                    await fetch('/api/agent-presets/settings/' + selectedAgentType, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ modelPreference: currentConfig.modelPreference })
                    });
                }
                
                showToast('配置已应用', 'success');
            } catch (error) {
                console.error('Apply config error:', error);
                showToast('保存失败', 'error');
            }
        }
        
        function resetConfig() {
            if (!selectedAgentType) return;
            renderAgentConfig(selectedAgentType);
            showToast('已重置为默认配置', 'info');
        }
        
        // ============================================
        // Preset 管理
        // ============================================
        function openPresetDrawer() {
            document.getElementById('presetDrawerOverlay').classList.add('open');
            renderPresetDrawer();
        }
        
        function closePresetDrawer() {
            document.getElementById('presetDrawerOverlay').classList.remove('open');
        }
        
        function renderPresetDrawer() {
            const agentName = document.getElementById('drawerAgentName');
            const agentList = document.getElementById('agentPresetList');
            const officialList = document.getElementById('officialPresetList');
            
            if (!selectedAgentType) {
                agentName.textContent = '未选择 Agent';
                agentList.innerHTML = '<p class="text-gray-500 text-sm">请先选择一个 Agent</p>';
                officialList.innerHTML = '';
                return;
            }
            
            const agentInfo = AGENT_NAMES[selectedAgentType] || { name: selectedAgentType };
            agentName.textContent = agentInfo.name;
            
            // 用户 Preset
            const presets = userPresets[selectedAgentType] || [];
            if (presets.length === 0) {
                agentList.innerHTML = '<p class="text-gray-500 text-sm">暂无自定义 Preset</p>';
            } else {
                agentList.innerHTML = presets.map(p => \`
                    <div class="preset-card \${p.isDefault ? 'default' : ''}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                \${p.isDefault ? '<i class="fas fa-star text-yellow-500 text-xs"></i>' : ''}
                                <span class="font-medium">\${p.presetName}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <button onclick="editPreset(\${p.id})" class="p-1.5 text-gray-500 hover:text-white" title="编辑">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="duplicatePreset(\${p.id})" class="p-1.5 text-gray-500 hover:text-white" title="复制">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button onclick="deletePreset(\${p.id})" class="p-1.5 text-gray-500 hover:text-red-400" title="删除">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 flex items-center gap-3">
                            <span>模型: \${MODEL_PREFERENCES[p.modelPreference]?.label || '默认'}</span>
                            <span>深度: \${p.presetConfigJson?.analysisDepth || '标准'}</span>
                        </div>
                        \${!p.isDefault ? \`
                            <button onclick="setDefaultPreset(\${p.id})" class="mt-2 text-xs text-yellow-500 hover:text-yellow-400">
                                设为默认
                            </button>
                        \` : ''}
                    </div>
                \`).join('');
            }
            
            // 官方推荐
            const official = officialPresets[selectedAgentType];
            if (official) {
                officialList.innerHTML = \`
                    <div class="preset-card">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="fas fa-certificate gold-text"></i>
                            <span class="font-medium">\${official.presetName}</span>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">\${official.description}</p>
                        <button onclick="copyOfficialPreset()" class="text-xs text-yellow-500 hover:text-yellow-400">
                            <i class="fas fa-plus mr-1"></i>复制到我的 Preset
                        </button>
                    </div>
                \`;
            }
        }
        
        function createNewPreset() {
            editingPresetId = null;
            document.getElementById('presetModalTitle').textContent = '新建 Preset';
            document.getElementById('presetNameInput').value = '';
            document.getElementById('presetDefaultInput').checked = false;
            document.getElementById('presetModal').classList.remove('hidden');
        }
        
        function closePresetModal() {
            document.getElementById('presetModal').classList.add('hidden');
        }
        
        async function savePreset() {
            const name = document.getElementById('presetNameInput').value.trim();
            const isDefault = document.getElementById('presetDefaultInput').checked;
            
            if (!name) {
                showToast('请输入 Preset 名称', 'error');
                return;
            }
            
            const token = localStorage.getItem('authToken');
            
            try {
                if (editingPresetId) {
                    // 更新
                    await fetch('/api/agent-presets/' + editingPresetId, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            presetName: name,
                            isDefault,
                            presetConfigJson: currentConfig.configJson,
                            modelPreference: currentConfig.modelPreference,
                            presetPromptText: currentConfig.promptText,
                        })
                    });
                    showToast('Preset 已更新', 'success');
                } else {
                    // 创建
                    const res = await fetch('/api/agent-presets', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            agentType: selectedAgentType,
                            presetName: name,
                            isDefault,
                            presetConfigJson: currentConfig.configJson,
                            modelPreference: currentConfig.modelPreference,
                            presetPromptText: currentConfig.promptText,
                        })
                    });
                    
                    const data = await res.json();
                    if (!data.success) {
                        showToast(data.error || '创建失败', 'error');
                        return;
                    }
                    
                    // 添加到本地缓存
                    if (!userPresets[selectedAgentType]) userPresets[selectedAgentType] = [];
                    userPresets[selectedAgentType].push(data.preset);
                    
                    showToast('Preset 创建成功', 'success');
                }
                
                closePresetModal();
                renderPresetDrawer();
                
            } catch (error) {
                console.error('Save preset error:', error);
                showToast('保存失败', 'error');
            }
        }
        
        function saveAsPreset() {
            if (!selectedAgentType) {
                showToast('请先选择一个 Agent', 'error');
                return;
            }
            
            const permission = checkPermission(selectedAgentType);
            if (!permission.canConfigure) {
                showToast('无权限创建 Preset', 'error');
                return;
            }
            
            createNewPreset();
        }
        
        async function setDefaultPreset(presetId) {
            const token = localStorage.getItem('authToken');
            
            try {
                await fetch('/api/agent-presets/' + presetId + '/set-default', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                // 更新本地缓存
                (userPresets[selectedAgentType] || []).forEach(p => {
                    p.isDefault = p.id === presetId;
                });
                
                renderPresetDrawer();
                showToast('已设为默认', 'success');
            } catch (error) {
                showToast('设置失败', 'error');
            }
        }
        
        async function deletePreset(presetId) {
            if (!confirm('确定要删除这个 Preset 吗？')) return;
            
            const token = localStorage.getItem('authToken');
            
            try {
                await fetch('/api/agent-presets/' + presetId, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                // 从本地缓存移除
                userPresets[selectedAgentType] = (userPresets[selectedAgentType] || []).filter(p => p.id !== presetId);
                
                renderPresetDrawer();
                showToast('Preset 已删除', 'success');
            } catch (error) {
                showToast('删除失败', 'error');
            }
        }
        
        async function duplicatePreset(presetId) {
            const token = localStorage.getItem('authToken');
            const preset = (userPresets[selectedAgentType] || []).find(p => p.id === presetId);
            if (!preset) return;
            
            const newName = prompt('请输入新名称', preset.presetName + ' 副本');
            if (!newName) return;
            
            try {
                const res = await fetch('/api/agent-presets/' + presetId + '/duplicate', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newName })
                });
                
                const data = await res.json();
                if (data.success) {
                    userPresets[selectedAgentType].push(data.preset);
                    renderPresetDrawer();
                    showToast('复制成功', 'success');
                } else {
                    showToast(data.error || '复制失败', 'error');
                }
            } catch (error) {
                showToast('复制失败', 'error');
            }
        }
        
        function editPreset(presetId) {
            const preset = (userPresets[selectedAgentType] || []).find(p => p.id === presetId);
            if (!preset) return;
            
            editingPresetId = presetId;
            document.getElementById('presetModalTitle').textContent = '编辑 Preset';
            document.getElementById('presetNameInput').value = preset.presetName;
            document.getElementById('presetDefaultInput').checked = preset.isDefault;
            document.getElementById('presetModal').classList.remove('hidden');
        }
        
        async function copyOfficialPreset() {
            const official = officialPresets[selectedAgentType];
            if (!official) return;
            
            const permission = checkPermission(selectedAgentType);
            if (!permission.canConfigure) {
                showToast('无权限创建 Preset', 'error');
                return;
            }
            
            // 填充当前配置
            currentConfig.configJson = { ...official.presetConfigJson };
            currentConfig.modelPreference = official.modelPreference;
            currentConfig.promptText = null;
            
            // 打开新建对话框
            editingPresetId = null;
            document.getElementById('presetModalTitle').textContent = '基于官方配置创建';
            document.getElementById('presetNameInput').value = official.presetName + ' (自定义)';
            document.getElementById('presetDefaultInput').checked = false;
            document.getElementById('presetModal').classList.remove('hidden');
        }
        
        // ============================================
        // 工具函数
        // ============================================
        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();
            
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => toast.remove(), 3000);
        }
        
        // ============================================
        // 增强版 Prompt 编辑器
        // ============================================
        const PROMPT_TEMPLATES = [
            {
                id: 'focus_risk',
                name: '风险关注',
                template: '请在分析时特别关注以下风险因素：\\n1. 财务风险\\n2. 经营风险\\n3. 行业风险\\n\\n输出时请用醒目方式标注重大风险。',
            },
            {
                id: 'table_output',
                name: '表格输出',
                template: '请以表格形式呈现关键数据对比，包括：\\n- 同比变化\\n- 环比变化\\n- 行业对比\\n\\n表格后请附简要说明。',
            },
            {
                id: 'concise',
                name: '精简模式',
                template: '请以精简模式输出：\\n- 总字数控制在 500 字以内\\n- 重点突出核心结论\\n- 省略次要细节',
            },
            {
                id: 'detailed',
                name: '详细分析',
                template: '请提供详细分析：\\n- 完整的数据支撑\\n- 多角度论证\\n- 历史对比分析\\n- 行业背景说明',
            },
            {
                id: 'conservative',
                name: '保守评估',
                template: '请采用保守估计方式：\\n- 估值使用悲观假设\\n- 充分考虑下行风险\\n- 结论措辞谨慎\\n- 避免过度乐观表述',
            },
        ];
        const MAX_PROMPT_LENGTH = 500;
        let promptPreviewVisible = false;
        
        function initPromptEditor() {
            const textarea = document.getElementById('promptEditor');
            if (!textarea) return;
            
            textarea.addEventListener('input', function() {
                updateCharCount();
                updatePromptPreview();
                currentConfig.promptText = this.value || null;
            });
            
            updateCharCount();
        }
        
        function updateCharCount() {
            const textarea = document.getElementById('promptEditor');
            const countEl = document.getElementById('promptEditorCharCount');
            if (!textarea || !countEl) return;
            
            const len = textarea.value.length;
            countEl.textContent = len + ' / ' + MAX_PROMPT_LENGTH;
            
            countEl.classList.remove('warning', 'error');
            if (len > MAX_PROMPT_LENGTH * 0.9) {
                countEl.classList.add('error');
            } else if (len > MAX_PROMPT_LENGTH * 0.7) {
                countEl.classList.add('warning');
            }
        }
        
        function insertPromptTemplate(templateId) {
            const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
            if (!template) return;
            
            const textarea = document.getElementById('promptEditor');
            if (!textarea || textarea.disabled) return;
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const templateText = template.template.replace(/\\\\n/g, '\\n');
            
            const newText = text.substring(0, start) + templateText + text.substring(end);
            if (newText.length > MAX_PROMPT_LENGTH) {
                showToast('模板内容过长，请先清空部分内容', 'warning');
                return;
            }
            
            textarea.value = newText;
            const newPos = start + templateText.length;
            textarea.setSelectionRange(newPos, newPos);
            textarea.focus();
            textarea.dispatchEvent(new Event('input'));
            
            showToast('已插入模板: ' + template.name, 'success');
        }
        
        function togglePromptPreview() {
            const preview = document.getElementById('promptEditorPreview');
            const btn = document.getElementById('promptEditorPreviewBtn');
            if (!preview || !btn) return;
            
            promptPreviewVisible = !promptPreviewVisible;
            preview.classList.toggle('active', promptPreviewVisible);
            btn.classList.toggle('preview-active', promptPreviewVisible);
            
            if (promptPreviewVisible) {
                updatePromptPreview();
            }
        }
        
        function updatePromptPreview() {
            if (!promptPreviewVisible) return;
            
            const textarea = document.getElementById('promptEditor');
            const content = document.getElementById('promptEditorPreviewContent');
            if (!textarea || !content) return;
            
            const text = textarea.value.trim();
            if (text) {
                const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');
                content.innerHTML = '<div>' + escaped + '</div>';
            } else {
                content.innerHTML = '<span class="prompt-preview-empty">暂无内容</span>';
            }
        }
        
        // 初始化
        init();
    </script>
</body>
</html>
`;

export default agentSettingsPageHtml;
