/**
 * 分析配置选择组件
 * 
 * 在分析启动前显示当前配置摘要，支持快速切换 Preset
 */

// 分析配置样式
export const analysisConfigStyles = `
    /* 分析配置选择区域 */
    .analysis-config-bar {
        background: rgba(212, 175, 55, 0.05);
        border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
    }
    
    .config-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }
    
    .config-label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #9ca3af;
        font-size: 14px;
    }
    
    .config-value {
        color: #d4af37;
        font-weight: 500;
    }
    
    .config-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .config-toggle-btn {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #9ca3af;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .config-toggle-btn:hover {
        border-color: rgba(212, 175, 55, 0.3);
        color: #d4af37;
    }
    
    .config-manage-btn {
        padding: 6px 12px;
        background: transparent;
        border: none;
        color: #9ca3af;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .config-manage-btn:hover {
        color: #d4af37;
    }
    
    /* 配置展开面板 */
    .config-expand-panel {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
    }
    
    .config-expand-panel.expanded {
        max-height: 400px;
    }
    
    .config-detail {
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin-top: 12px;
    }
    
    /* Preset 快速选择卡片 */
    .preset-quick-card {
        background: rgba(255, 255, 255, 0.03);
        border: 2px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .preset-quick-card:hover {
        border-color: rgba(212, 175, 55, 0.3);
    }
    
    .preset-quick-card.selected {
        border-color: #d4af37;
        background: rgba(212, 175, 55, 0.1);
    }
    
    .preset-quick-card.official {
        border-color: rgba(139, 92, 246, 0.3);
    }
    
    .preset-quick-card.official:hover {
        border-color: rgba(139, 92, 246, 0.5);
    }
    
    /* 模型偏好标签 */
    .model-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-size: 11px;
        color: #9ca3af;
    }
    
    .depth-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 4px;
        font-size: 11px;
        color: #60a5fa;
    }
`;

// 分析配置 HTML 模板
export const analysisConfigHtml = `
    <!-- 分析配置选择区域 -->
    <div id="analysisConfigBar" class="analysis-config-bar hidden">
        <div class="config-summary">
            <div class="config-label">
                <i class="fas fa-cog gold-text"></i>
                <span>分析配置：</span>
                <span id="currentConfigName" class="config-value">默认配置</span>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <span id="currentModelTag" class="model-tag">
                        <i class="fas fa-brain"></i>
                        <span>标准模式</span>
                    </span>
                    <span id="currentDepthTag" class="depth-tag">
                        <i class="fas fa-layer-group"></i>
                        <span>标准深度</span>
                    </span>
                </div>
                <div class="config-actions">
                    <button onclick="toggleConfigPanel()" class="config-toggle-btn">
                        <i class="fas fa-chevron-down mr-1" id="configToggleIcon"></i>
                        <span id="configToggleText">更多配置</span>
                    </button>
                    <button onclick="window.open('/settings/agents', '_blank')" class="config-manage-btn">
                        <i class="fas fa-cog mr-1"></i>管理配置
                    </button>
                </div>
            </div>
        </div>
        
        <!-- 展开的配置面板 -->
        <div id="configExpandPanel" class="config-expand-panel">
            <div class="config-detail">
                <div class="text-sm text-gray-400 mb-3">快速切换配置</div>
                <div id="presetQuickList" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <!-- 动态生成 Preset 卡片 -->
                </div>
            </div>
        </div>
    </div>
`;

// 分析配置 JavaScript
export const analysisConfigScript = `
    // ============ 分析配置选择 ============
    let currentAnalysisConfig = {
        presetId: null,
        presetName: '默认配置',
        modelPreference: 'standard',
        depth: 'standard',
        source: 'official_default'
    };
    let availablePresets = [];
    let configPanelExpanded = false;
    
    // 模型偏好标签映射
    const MODEL_LABELS = {
        standard: { label: '标准模式', icon: 'fa-balance-scale' },
        fast: { label: '快速模式', icon: 'fa-bolt' },
        rigorous: { label: '严谨分析', icon: 'fa-microscope' },
        deep_reasoning: { label: '深度推理', icon: 'fa-brain' },
        chinese_enhanced: { label: '中文增强', icon: 'fa-language' },
        quick_gen: { label: '极速生成', icon: 'fa-rocket' },
        balanced: { label: '均衡模式', icon: 'fa-circle-half-stroke' },
    };
    
    // 深度标签映射
    const DEPTH_LABELS = {
        quick: { label: '快速', icon: 'fa-bolt' },
        standard: { label: '标准', icon: 'fa-layer-group' },
        deep: { label: '深度', icon: 'fa-microscope' },
    };
    
    // 加载用户配置
    async function loadAnalysisConfig() {
        const token = localStorage.getItem('authToken');
        const configBar = document.getElementById('analysisConfigBar');
        
        // 只有登录用户才显示配置选择
        if (!token) {
            configBar.classList.add('hidden');
            return;
        }
        
        try {
            // 获取用户的 Preset 列表
            const presetsRes = await fetch('/api/agent-presets', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const presetsData = await presetsRes.json();
            
            if (presetsData.success) {
                availablePresets = presetsData.presets || [];
                
                // 查找默认 Preset
                const defaultPreset = availablePresets.find(p => p.isDefault);
                if (defaultPreset) {
                    currentAnalysisConfig = {
                        presetId: defaultPreset.id,
                        presetName: defaultPreset.presetName,
                        modelPreference: defaultPreset.modelPreference || 'standard',
                        depth: defaultPreset.presetConfigJson?.analysisDepth || 'standard',
                        source: 'user_preset'
                    };
                }
            }
            
            // 更新 UI
            updateConfigDisplay();
            renderPresetQuickList();
            configBar.classList.remove('hidden');
            
        } catch (error) {
            console.error('Load analysis config error:', error);
            // 出错时隐藏配置栏
            configBar.classList.add('hidden');
        }
    }
    
    // 更新配置显示
    function updateConfigDisplay() {
        const nameEl = document.getElementById('currentConfigName');
        const modelTagEl = document.getElementById('currentModelTag');
        const depthTagEl = document.getElementById('currentDepthTag');
        
        // 配置名称
        nameEl.textContent = currentAnalysisConfig.presetName;
        
        // 模型标签
        const modelInfo = MODEL_LABELS[currentAnalysisConfig.modelPreference] || MODEL_LABELS.standard;
        modelTagEl.innerHTML = \`
            <i class="fas \${modelInfo.icon}"></i>
            <span>\${modelInfo.label}</span>
        \`;
        
        // 深度标签
        const depthInfo = DEPTH_LABELS[currentAnalysisConfig.depth] || DEPTH_LABELS.standard;
        depthTagEl.innerHTML = \`
            <i class="fas \${depthInfo.icon}"></i>
            <span>\${depthInfo.label}深度</span>
        \`;
    }
    
    // 渲染 Preset 快速选择列表
    function renderPresetQuickList() {
        const container = document.getElementById('presetQuickList');
        
        let html = '';
        
        // 官方默认配置
        html += \`
            <div class="preset-quick-card official \${currentAnalysisConfig.source === 'official_default' ? 'selected' : ''}"
                 onclick="selectPreset(null, '官方默认配置', 'standard', 'standard')">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-certificate text-purple-400"></i>
                    <span class="font-medium text-sm">官方默认</span>
                </div>
                <div class="flex gap-2">
                    <span class="model-tag"><i class="fas fa-balance-scale"></i>标准</span>
                    <span class="depth-tag"><i class="fas fa-layer-group"></i>标准</span>
                </div>
            </div>
        \`;
        
        // 用户 Preset
        availablePresets.slice(0, 7).forEach(preset => {
            const isSelected = currentAnalysisConfig.presetId === preset.id;
            const modelInfo = MODEL_LABELS[preset.modelPreference] || MODEL_LABELS.standard;
            const depthInfo = DEPTH_LABELS[preset.presetConfigJson?.analysisDepth] || DEPTH_LABELS.standard;
            
            html += \`
                <div class="preset-quick-card \${isSelected ? 'selected' : ''}"
                     onclick="selectPreset(\${preset.id}, '\${preset.presetName}', '\${preset.modelPreference || 'standard'}', '\${preset.presetConfigJson?.analysisDepth || 'standard'}')">
                    <div class="flex items-center gap-2 mb-2">
                        \${preset.isDefault ? '<i class="fas fa-star text-yellow-500 text-xs"></i>' : ''}
                        <span class="font-medium text-sm truncate">\${preset.presetName}</span>
                    </div>
                    <div class="flex gap-2">
                        <span class="model-tag"><i class="fas \${modelInfo.icon}"></i>\${modelInfo.label.substring(0, 4)}</span>
                        <span class="depth-tag"><i class="fas \${depthInfo.icon}"></i>\${depthInfo.label}</span>
                    </div>
                </div>
            \`;
        });
        
        container.innerHTML = html;
    }
    
    // 选择 Preset
    function selectPreset(presetId, name, model, depth) {
        currentAnalysisConfig = {
            presetId: presetId,
            presetName: name,
            modelPreference: model,
            depth: depth,
            source: presetId ? 'user_preset' : 'official_default'
        };
        
        updateConfigDisplay();
        renderPresetQuickList();
        
        // 收起面板
        if (configPanelExpanded) {
            toggleConfigPanel();
        }
    }
    
    // 切换配置面板展开/收起
    function toggleConfigPanel() {
        const panel = document.getElementById('configExpandPanel');
        const icon = document.getElementById('configToggleIcon');
        const text = document.getElementById('configToggleText');
        
        configPanelExpanded = !configPanelExpanded;
        panel.classList.toggle('expanded', configPanelExpanded);
        icon.style.transform = configPanelExpanded ? 'rotate(180deg)' : '';
        text.textContent = configPanelExpanded ? '收起' : '更多配置';
    }
    
    // 获取当前分析配置（供 startAnalysis 使用）
    function getAnalysisPresetOverrides() {
        if (!currentAnalysisConfig.presetId && currentAnalysisConfig.source === 'official_default') {
            return null; // 使用官方默认，不需要覆盖
        }
        
        // 返回 presetOverrides 格式
        return {
            // 这里可以根据需要为不同的 Agent 设置不同的 Preset
            // 目前简化处理：所有 Agent 使用相同的模型偏好
            globalModelPreference: currentAnalysisConfig.modelPreference,
            globalPresetId: currentAnalysisConfig.presetId,
        };
    }
`;

export default {
    analysisConfigStyles,
    analysisConfigHtml,
    analysisConfigScript,
};
