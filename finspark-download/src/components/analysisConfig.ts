/**
 * 分析配置选择组件 (v2 - 完全重构)
 * 
 * 设计改进：
 * 1. 游客也可见 - 使用 localStorage 存储偏好；登录用户同步到服务器
 * 2. 内联偏好编辑 - 分析深度、分析风格、包含预测、包含行业对比等
 * 3. 偏好实际影响分析 - 传递到 /api/analyze/start 的请求体中
 * 4. 响应式设计 - 移动端友好
 */

// 分析配置样式
export const analysisConfigStyles = `
    /* ======== 分析配置面板 v2 ======== */
    .ac-panel {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        margin-top: 32px;
        overflow: hidden;
        transition: border-color 0.3s;
    }
    .ac-panel:hover { border-color: rgba(212, 175, 55, 0.25); }

    /* 顶栏：标题 + 展开收起 */
    .ac-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .ac-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .ac-header-icon {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(212, 175, 55, 0.1);
        border-radius: 8px;
        color: #d4af37;
        font-size: 14px;
    }
    .ac-header-title {
        font-size: 15px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
    }
    .ac-header-subtitle {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        margin-top: 1px;
    }
    .ac-header-tags {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .ac-htag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
    }
    .ac-htag.depth { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
    .ac-htag.style { background: rgba(168, 85, 247, 0.12); color: #a78bfa; }
    .ac-htag.feature { background: rgba(16, 185, 129, 0.12); color: #34d399; }

    .ac-toggle-icon {
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        transition: transform 0.3s;
    }
    .ac-toggle-icon.open { transform: rotate(180deg); }

    /* 展开区域 */
    .ac-body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.35s ease;
    }
    .ac-body.expanded { max-height: 800px; }
    .ac-body-inner {
        padding: 0 20px 20px;
        border-top: 1px solid rgba(255,255,255,0.05);
    }

    /* 配置行 */
    .ac-section {
        padding: 16px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .ac-section:last-child { border-bottom: none; }
    .ac-section-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,0.7);
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .ac-section-title i {
        font-size: 12px;
        color: #d4af37;
        width: 16px;
        text-align: center;
    }

    /* 选项卡片组 - 分析深度 & 分析风格 */
    .ac-options {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    .ac-opt {
        flex: 1;
        min-width: 120px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.03);
        border: 1.5px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
    }
    .ac-opt:hover { border-color: rgba(212, 175, 55, 0.3); background: rgba(255,255,255,0.04); }
    .ac-opt.selected {
        border-color: #d4af37;
        background: rgba(212, 175, 55, 0.08);
        box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.15);
    }
    .ac-opt-icon {
        font-size: 18px;
        margin-bottom: 6px;
    }
    .ac-opt-name {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
        margin-bottom: 2px;
    }
    .ac-opt-desc {
        font-size: 11px;
        color: rgba(255,255,255,0.4);
        line-height: 1.4;
    }

    /* Toggle 开关行 */
    .ac-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        gap: 12px;
    }
    .ac-toggle-info {
        flex: 1;
        min-width: 0;
    }
    .ac-toggle-label {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255,255,255,0.85);
    }
    .ac-toggle-hint {
        font-size: 11px;
        color: rgba(255,255,255,0.35);
        margin-top: 2px;
    }
    .ac-switch {
        position: relative;
        width: 42px; height: 24px;
        flex-shrink: 0;
    }
    .ac-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .ac-switch-track {
        position: absolute; inset: 0;
        background: rgba(255,255,255,0.1);
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.3s;
    }
    .ac-switch-track::after {
        content: '';
        position: absolute;
        width: 18px; height: 18px;
        left: 3px; top: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.3s;
    }
    .ac-switch input:checked + .ac-switch-track {
        background: #d4af37;
    }
    .ac-switch input:checked + .ac-switch-track::after {
        transform: translateX(18px);
    }

    /* 游客提示 */
    .ac-guest-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(212, 175, 55, 0.06);
        border: 1px solid rgba(212, 175, 55, 0.15);
        border-radius: 8px;
        margin-top: 12px;
        font-size: 12px;
        color: rgba(255,255,255,0.5);
    }
    .ac-guest-hint a {
        color: #d4af37;
        text-decoration: underline;
        cursor: pointer;
    }

    /* 登录用户额外选项 */
    .ac-logged-only { display: none; }
    .ac-panel.logged-in .ac-logged-only { display: block; }

    /* 响应式 */
    @media (max-width: 767px) {
        .ac-panel { margin-top: 24px; }
        .ac-header { padding: 12px 16px; }
        .ac-header-tags { display: none; }
        .ac-body-inner { padding: 0 16px 16px; }
        .ac-options { flex-direction: column; }
        .ac-opt { min-width: unset; }
    }
`;

// 分析配置 HTML 模板
export const analysisConfigHtml = `
    <div id="analysisConfigPanel" class="ac-panel">
        <!-- 顶栏 -->
        <div class="ac-header" onclick="toggleAnalysisConfig()">
            <div class="ac-header-left">
                <div class="ac-header-icon">
                    <i class="fas fa-sliders-h"></i>
                </div>
                <div>
                    <div class="ac-header-title">分析偏好配置</div>
                    <div class="ac-header-subtitle">自定义分析深度和风格，影响AI生成结果</div>
                </div>
            </div>
            <div class="ac-header-tags" id="acHeaderTags">
                <span class="ac-htag depth" id="acTagDepth"><i class="fas fa-layer-group"></i> 标准</span>
                <span class="ac-htag style" id="acTagStyle"><i class="fas fa-balance-scale"></i> 均衡</span>
            </div>
            <i class="fas fa-chevron-down ac-toggle-icon" id="acToggleIcon"></i>
        </div>

        <!-- 展开的配置体 -->
        <div class="ac-body" id="acBody">
            <div class="ac-body-inner">

                <!-- 分析深度 -->
                <div class="ac-section">
                    <div class="ac-section-title"><i class="fas fa-layer-group"></i> 分析深度</div>
                    <div class="ac-options" id="acDepthOptions">
                        <div class="ac-opt" data-depth="quick" onclick="setAcDepth('quick')">
                            <div class="ac-opt-icon">&#9889;</div>
                            <div class="ac-opt-name">快速分析</div>
                            <div class="ac-opt-desc">关键指标速览，约1-2分钟</div>
                        </div>
                        <div class="ac-opt selected" data-depth="standard" onclick="setAcDepth('standard')">
                            <div class="ac-opt-icon">&#128202;</div>
                            <div class="ac-opt-name">标准分析</div>
                            <div class="ac-opt-desc">全面分析各维度，约2-3分钟</div>
                        </div>
                        <div class="ac-opt" data-depth="deep" onclick="setAcDepth('deep')">
                            <div class="ac-opt-icon">&#128300;</div>
                            <div class="ac-opt-name">深度分析</div>
                            <div class="ac-opt-desc">深入推理与交叉验证，约3-5分钟</div>
                        </div>
                    </div>
                </div>

                <!-- 分析风格 (人格) -->
                <div class="ac-section">
                    <div class="ac-section-title"><i class="fas fa-user-tie"></i> 分析风格</div>
                    <div class="ac-options" id="acStyleOptions">
                        <div class="ac-opt" data-style="balanced" onclick="setAcStyle('balanced')">
                            <div class="ac-opt-icon">&#9878;&#65039;</div>
                            <div class="ac-opt-name">均衡客观</div>
                            <div class="ac-opt-desc">全面评估，不偏不倚</div>
                        </div>
                        <div class="ac-opt" data-style="prudent" onclick="setAcStyle('prudent')">
                            <div class="ac-opt-icon">&#128737;&#65039;</div>
                            <div class="ac-opt-name">冷静审慎</div>
                            <div class="ac-opt-desc">强调风险，保守评估</div>
                        </div>
                        <div class="ac-opt" data-style="decisive" onclick="setAcStyle('decisive')">
                            <div class="ac-opt-icon">&#127919;</div>
                            <div class="ac-opt-name">决策导向</div>
                            <div class="ac-opt-desc">结论明确，操作建议具体</div>
                        </div>
                        <div class="ac-opt" data-style="risk_aware" onclick="setAcStyle('risk_aware')">
                            <div class="ac-opt-icon">&#9888;&#65039;</div>
                            <div class="ac-opt-name">风险提示强化</div>
                            <div class="ac-opt-desc">每个结论都附带风险提示</div>
                        </div>
                    </div>
                </div>

                <!-- 可选模块 -->
                <div class="ac-section">
                    <div class="ac-section-title"><i class="fas fa-puzzle-piece"></i> 可选分析模块</div>
                    <div class="ac-toggle-row">
                        <div class="ac-toggle-info">
                            <div class="ac-toggle-label">业绩预测</div>
                            <div class="ac-toggle-hint">基于历史数据和行业趋势预测未来表现</div>
                        </div>
                        <label class="ac-switch">
                            <input type="checkbox" id="acIncludeForecast" checked onchange="setAcToggle('includeForecast', this.checked)">
                            <span class="ac-switch-track"></span>
                        </label>
                    </div>
                    <div class="ac-toggle-row">
                        <div class="ac-toggle-info">
                            <div class="ac-toggle-label">行业对比</div>
                            <div class="ac-toggle-hint">与同行业竞争对手进行横向对比分析</div>
                        </div>
                        <label class="ac-switch">
                            <input type="checkbox" id="acIncludeIndustryCompare" checked onchange="setAcToggle('includeIndustryCompare', this.checked)">
                            <span class="ac-switch-track"></span>
                        </label>
                    </div>
                    <div class="ac-toggle-row">
                        <div class="ac-toggle-info">
                            <div class="ac-toggle-label">财报漫画</div>
                            <div class="ac-toggle-hint">将分析结果生成趣味漫画解读</div>
                        </div>
                        <label class="ac-switch">
                            <input type="checkbox" id="acIncludeComic" checked onchange="setAcToggle('includeComic', this.checked)">
                            <span class="ac-switch-track"></span>
                        </label>
                    </div>
                </div>

                <!-- 登录用户专属 - Preset 快速切换 -->
                <div class="ac-section ac-logged-only" id="acPresetSection">
                    <div class="ac-section-title"><i class="fas fa-bookmark"></i> 我的配置预设 <span style="font-size:11px;color:rgba(255,255,255,0.3);font-weight:400;margin-left:4px;">(快速切换)</span></div>
                    <div class="ac-options" id="acPresetList">
                        <!-- 动态生成 -->
                    </div>
                </div>

                <!-- 游客提示 -->
                <div id="acGuestHint" class="ac-guest-hint" style="display:none;">
                    <i class="fas fa-info-circle" style="color:#d4af37;"></i>
                    <span>当前为游客模式，偏好存储在本地浏览器。<a onclick="openLoginModal()">登录</a>后可同步到云端并使用高级预设功能。</span>
                </div>
            </div>
        </div>
    </div>
`;

// 分析配置 JavaScript
export const analysisConfigScript = `
    // ============ 分析配置 v2 ============
    const AC_STORAGE_KEY = 'finspark_analysis_prefs';
    
    // 默认配置
    const AC_DEFAULTS = {
        depth: 'standard',
        style: 'balanced',
        includeForecast: true,
        includeIndustryCompare: true,
        includeComic: true,
        presetId: null,
        modelPreference: 'standard',
    };

    // 从 localStorage 读取或使用默认值
    let analysisPrefs = { ...AC_DEFAULTS };
    try {
        const saved = localStorage.getItem(AC_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            analysisPrefs = { ...AC_DEFAULTS, ...parsed };
        }
    } catch(e) {}

    let acExpanded = false;
    let acAvailablePresets = [];
    let acIsLoggedIn = false;

    // ---- 深度标签映射 ----
    const AC_DEPTH_MAP = {
        quick:    { label: '快速', icon: 'fa-bolt' },
        standard: { label: '标准', icon: 'fa-layer-group' },
        deep:     { label: '深度', icon: 'fa-microscope' },
    };
    const AC_STYLE_MAP = {
        balanced:   { label: '均衡', icon: 'fa-balance-scale' },
        prudent:    { label: '审慎', icon: 'fa-shield-halved' },
        decisive:   { label: '决策', icon: 'fa-bullseye' },
        risk_aware: { label: '风控', icon: 'fa-triangle-exclamation' },
    };

    // ---- 保存到 localStorage ----
    function saveAcPrefs() {
        try {
            localStorage.setItem(AC_STORAGE_KEY, JSON.stringify(analysisPrefs));
        } catch(e) {}
    }

    // ---- 同步到服务器 (仅登录用户) ----
    async function syncAcPrefsToServer() {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        try {
            await fetch('/api/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    analysisDepth: analysisPrefs.depth,
                    includeForecast: analysisPrefs.includeForecast,
                    includeIndustryCompare: analysisPrefs.includeIndustryCompare,
                    includeComic: analysisPrefs.includeComic,
                })
            });
        } catch(e) {
            console.warn('[AC] Sync to server failed:', e);
        }
    }

    // ---- 展开/收起 ----
    function toggleAnalysisConfig() {
        acExpanded = !acExpanded;
        const body = document.getElementById('acBody');
        const icon = document.getElementById('acToggleIcon');
        body.classList.toggle('expanded', acExpanded);
        icon.classList.toggle('open', acExpanded);
    }

    // ---- 设置分析深度 ----
    function setAcDepth(depth) {
        analysisPrefs.depth = depth;
        saveAcPrefs();
        syncAcPrefsToServer();
        updateAcUI();
    }

    // ---- 设置分析风格 ----
    function setAcStyle(style) {
        analysisPrefs.style = style;
        saveAcPrefs();
        updateAcUI();
    }

    // ---- 设置 Toggle 开关 ----
    function setAcToggle(key, value) {
        analysisPrefs[key] = value;
        saveAcPrefs();
        syncAcPrefsToServer();
    }

    // ---- 更新 UI ----
    function updateAcUI() {
        // 顶栏标签
        const depthInfo = AC_DEPTH_MAP[analysisPrefs.depth] || AC_DEPTH_MAP.standard;
        const styleInfo = AC_STYLE_MAP[analysisPrefs.style] || AC_STYLE_MAP.balanced;
        const tagDepth = document.getElementById('acTagDepth');
        const tagStyle = document.getElementById('acTagStyle');
        if (tagDepth) tagDepth.innerHTML = '<i class="fas ' + depthInfo.icon + '"></i> ' + depthInfo.label;
        if (tagStyle) tagStyle.innerHTML = '<i class="fas ' + styleInfo.icon + '"></i> ' + styleInfo.label;

        // 深度选项卡
        document.querySelectorAll('#acDepthOptions .ac-opt').forEach(el => {
            el.classList.toggle('selected', el.dataset.depth === analysisPrefs.depth);
        });

        // 风格选项卡
        document.querySelectorAll('#acStyleOptions .ac-opt').forEach(el => {
            el.classList.toggle('selected', el.dataset.style === analysisPrefs.style);
        });

        // Toggle 开关
        const fcEl = document.getElementById('acIncludeForecast');
        const icEl = document.getElementById('acIncludeIndustryCompare');
        const cmEl = document.getElementById('acIncludeComic');
        if (fcEl) fcEl.checked = analysisPrefs.includeForecast;
        if (icEl) icEl.checked = analysisPrefs.includeIndustryCompare;
        if (cmEl) cmEl.checked = analysisPrefs.includeComic;

        // 游客提示
        const guestHint = document.getElementById('acGuestHint');
        if (guestHint) {
            guestHint.style.display = acIsLoggedIn ? 'none' : 'flex';
        }

        // 登录用户面板
        const panel = document.getElementById('analysisConfigPanel');
        if (panel) {
            panel.classList.toggle('logged-in', acIsLoggedIn);
        }
    }

    // ---- 渲染用户 Preset 列表 ----
    function renderAcPresets() {
        const container = document.getElementById('acPresetList');
        if (!container || acAvailablePresets.length === 0) return;

        let html = '';
        acAvailablePresets.slice(0, 6).forEach(preset => {
            const isSelected = analysisPrefs.presetId === preset.id;
            html += '<div class="ac-opt ' + (isSelected ? 'selected' : '') + '" onclick="selectAcPreset(' + preset.id + ')" style="min-width:100px;flex:0 1 auto;">' +
                '<div class="ac-opt-name" style="font-size:12px;">' + (preset.isDefault ? '<i class="fas fa-star" style="color:#d4af37;font-size:10px;margin-right:4px;"></i>' : '') + preset.presetName + '</div>' +
                '<div class="ac-opt-desc">' + (preset.modelPreference || 'standard') + '</div>' +
            '</div>';
        });
        container.innerHTML = html;
    }

    // ---- 选择 Preset ----
    function selectAcPreset(presetId) {
        const preset = acAvailablePresets.find(p => p.id === presetId);
        if (!preset) return;
        analysisPrefs.presetId = preset.id;
        analysisPrefs.modelPreference = preset.modelPreference || 'standard';
        if (preset.presetConfigJson?.analysisDepth) {
            analysisPrefs.depth = preset.presetConfigJson.analysisDepth;
        }
        saveAcPrefs();
        updateAcUI();
        renderAcPresets();
    }

    // ---- 加载初始配置 ----
    async function loadAnalysisConfig() {
        const token = localStorage.getItem('authToken');
        acIsLoggedIn = !!token;

        // 如果登录，尝试从服务器加载偏好并合并
        if (token) {
            try {
                // 加载用户偏好
                const prefsRes = await fetch('/api/preferences', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const prefsData = await prefsRes.json();
                if (prefsData.success && prefsData.preferences) {
                    const sp = prefsData.preferences;
                    if (sp.analysisDepth) analysisPrefs.depth = sp.analysisDepth;
                    if (typeof sp.includeForecast === 'boolean') analysisPrefs.includeForecast = sp.includeForecast;
                    if (typeof sp.includeIndustryCompare === 'boolean') analysisPrefs.includeIndustryCompare = sp.includeIndustryCompare;
                    if (typeof sp.includeComic === 'boolean') analysisPrefs.includeComic = sp.includeComic;
                    saveAcPrefs();
                }
            } catch(e) {
                console.warn('[AC] Load server preferences failed:', e);
            }

            try {
                // 加载用户 Preset 列表
                const presetsRes = await fetch('/api/agent-presets', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const presetsData = await presetsRes.json();
                if (presetsData.success) {
                    acAvailablePresets = presetsData.presets || [];
                    // 如果有默认 Preset 且用户没有手动选过
                    if (!analysisPrefs.presetId) {
                        const defaultP = acAvailablePresets.find(p => p.isDefault);
                        if (defaultP) {
                            analysisPrefs.presetId = defaultP.id;
                            analysisPrefs.modelPreference = defaultP.modelPreference || 'standard';
                        }
                    }
                    renderAcPresets();
                }
            } catch(e) {
                console.warn('[AC] Load presets failed:', e);
            }
        }

        updateAcUI();
    }

    // ---- 获取分析配置（供 startAnalysis 使用）----
    // 返回格式化的配置对象，将附加到 /api/analyze/start 请求
    function getAnalysisPresetOverrides() {
        const overrides = {};
        
        // 模型偏好（来自 Preset 或默认）
        if (analysisPrefs.presetId) {
            overrides.globalPresetId = analysisPrefs.presetId;
        }
        if (analysisPrefs.modelPreference && analysisPrefs.modelPreference !== 'standard') {
            overrides.globalModelPreference = analysisPrefs.modelPreference;
        }

        return Object.keys(overrides).length > 0 ? overrides : null;
    }

    // ---- 获取完整分析偏好（新增，供 startAnalysis 请求体使用）----
    function getAnalysisUserPreferences() {
        return {
            analysisDepth: analysisPrefs.depth || 'standard',
            analysisStyle: analysisPrefs.style || 'balanced',
            includeForecast: analysisPrefs.includeForecast !== false,
            includeIndustryCompare: analysisPrefs.includeIndustryCompare !== false,
            includeComic: analysisPrefs.includeComic !== false,
        };
    }
`;

export default {
    analysisConfigStyles,
    analysisConfigHtml,
    analysisConfigScript,
};
