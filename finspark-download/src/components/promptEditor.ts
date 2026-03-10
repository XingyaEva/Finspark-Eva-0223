/**
 * Prompt 编辑器增强组件
 * 
 * 功能：
 * - 等宽字体代码风格编辑区
 * - 字符计数（上限 500 字符）
 * - 快速模板插入
 * - 实时预览
 * - 撤销/重做（浏览器原生）
 */

// 预设模板
export const PROMPT_TEMPLATES = [
  {
    id: 'focus_risk',
    name: '风险关注',
    icon: 'fa-shield-alt',
    template: '请在分析时特别关注以下风险因素：\n1. 财务风险\n2. 经营风险\n3. 行业风险\n\n输出时请用醒目方式标注重大风险。',
  },
  {
    id: 'table_output',
    name: '表格输出',
    icon: 'fa-table',
    template: '请以表格形式呈现关键数据对比，包括：\n- 同比变化\n- 环比变化\n- 行业对比\n\n表格后请附简要说明。',
  },
  {
    id: 'concise',
    name: '精简模式',
    icon: 'fa-compress-alt',
    template: '请以精简模式输出：\n- 总字数控制在 500 字以内\n- 重点突出核心结论\n- 省略次要细节',
  },
  {
    id: 'detailed',
    name: '详细分析',
    icon: 'fa-expand-alt',
    template: '请提供详细分析：\n- 完整的数据支撑\n- 多角度论证\n- 历史对比分析\n- 行业背景说明',
  },
  {
    id: 'conservative',
    name: '保守评估',
    icon: 'fa-balance-scale',
    template: '请采用保守估计方式：\n- 估值使用悲观假设\n- 充分考虑下行风险\n- 结论措辞谨慎\n- 避免过度乐观表述',
  },
];

// 最大字符数
export const MAX_PROMPT_LENGTH = 500;

// 编辑器样式
export const promptEditorStyles = `
  /* Prompt 编辑器容器 */
  .prompt-editor-container {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
  }
  
  /* 工具栏 */
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
  .template-btn i {
    font-size: 10px;
  }
  
  /* 编辑区域 */
  .prompt-editor-area {
    position: relative;
  }
  
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
  .prompt-textarea::placeholder {
    color: #6b7280;
  }
  .prompt-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* 底部状态栏 */
  .prompt-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
  }
  
  .char-count {
    color: #9ca3af;
  }
  .char-count.warning {
    color: #fbbf24;
  }
  .char-count.error {
    color: #ef4444;
  }
  
  .prompt-actions {
    display: flex;
    gap: 8px;
  }
  
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
  
  /* 预览面板 */
  .prompt-preview {
    display: none;
    padding: 12px;
    background: rgba(212, 175, 55, 0.05);
    border-top: 1px solid rgba(212, 175, 55, 0.2);
    max-height: 200px;
    overflow-y: auto;
  }
  .prompt-preview.active {
    display: block;
  }
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
`;

// 编辑器 HTML 模板生成函数
export function generatePromptEditorHtml(editorId: string = 'promptEditor'): string {
  return `
    <div class="prompt-editor-container" id="${editorId}Container">
      <!-- 工具栏 -->
      <div class="prompt-toolbar">
        <span class="prompt-toolbar-label">快速模板:</span>
        ${PROMPT_TEMPLATES.map(t => `
          <button type="button" class="template-btn" onclick="insertPromptTemplate('${t.id}')" title="${t.name}">
            <i class="fas ${t.icon}"></i>
            <span>${t.name}</span>
          </button>
        `).join('')}
      </div>
      
      <!-- 编辑区域 -->
      <div class="prompt-editor-area">
        <textarea 
          id="${editorId}" 
          class="prompt-textarea" 
          placeholder="输入您的自定义分析要求...&#10;&#10;例如：&#10;- 请特别关注公司的现金流变化&#10;- 输出时使用表格对比关键指标&#10;- 结论请保持谨慎"
          maxlength="${MAX_PROMPT_LENGTH}"
        ></textarea>
      </div>
      
      <!-- 预览面板 -->
      <div class="prompt-preview" id="${editorId}Preview">
        <div class="prompt-preview-label">预览</div>
        <div class="prompt-preview-content" id="${editorId}PreviewContent">
          <span class="prompt-preview-empty">暂无内容</span>
        </div>
      </div>
      
      <!-- 底部状态栏 -->
      <div class="prompt-status-bar">
        <span class="char-count" id="${editorId}CharCount">0 / ${MAX_PROMPT_LENGTH}</span>
        <div class="prompt-actions">
          <button type="button" class="prompt-action-btn" onclick="togglePromptPreview()" id="${editorId}PreviewBtn">
            <i class="fas fa-eye"></i> 预览
          </button>
          <button type="button" class="prompt-action-btn" onclick="clearPromptEditor()">
            <i class="fas fa-eraser"></i> 清空
          </button>
        </div>
      </div>
    </div>
  `;
}

// 编辑器脚本
export const promptEditorScript = `
  // Prompt 模板数据
  const PROMPT_TEMPLATES = ${JSON.stringify(PROMPT_TEMPLATES)};
  const MAX_PROMPT_LENGTH = ${MAX_PROMPT_LENGTH};
  
  let promptPreviewVisible = false;
  
  // 初始化编辑器
  function initPromptEditor(editorId = 'promptEditor') {
    const textarea = document.getElementById(editorId);
    if (!textarea) return;
    
    // 监听输入事件
    textarea.addEventListener('input', function() {
      updateCharCount(editorId);
      updatePreview(editorId);
      // 触发配置更新
      if (typeof currentConfig !== 'undefined') {
        currentConfig.promptText = this.value || null;
      }
    });
    
    // 初始化字符计数
    updateCharCount(editorId);
  }
  
  // 更新字符计数
  function updateCharCount(editorId = 'promptEditor') {
    const textarea = document.getElementById(editorId);
    const countEl = document.getElementById(editorId + 'CharCount');
    if (!textarea || !countEl) return;
    
    const len = textarea.value.length;
    countEl.textContent = len + ' / ' + MAX_PROMPT_LENGTH;
    
    // 根据长度设置样式
    countEl.classList.remove('warning', 'error');
    if (len > MAX_PROMPT_LENGTH * 0.9) {
      countEl.classList.add('error');
    } else if (len > MAX_PROMPT_LENGTH * 0.7) {
      countEl.classList.add('warning');
    }
  }
  
  // 插入模板
  function insertPromptTemplate(templateId) {
    const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    const textarea = document.getElementById('promptEditor');
    if (!textarea || textarea.disabled) return;
    
    // 获取当前光标位置
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    // 检查是否会超出长度限制
    const newText = text.substring(0, start) + template.template + text.substring(end);
    if (newText.length > MAX_PROMPT_LENGTH) {
      showToast('模板内容过长，请先清空部分内容', 'warning');
      return;
    }
    
    // 插入模板
    textarea.value = newText;
    
    // 更新光标位置
    const newPos = start + template.template.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
    
    // 触发 input 事件
    textarea.dispatchEvent(new Event('input'));
    
    showToast('已插入模板: ' + template.name, 'success');
  }
  
  // 切换预览
  function togglePromptPreview() {
    const preview = document.getElementById('promptEditorPreview');
    const btn = document.getElementById('promptEditorPreviewBtn');
    if (!preview || !btn) return;
    
    promptPreviewVisible = !promptPreviewVisible;
    preview.classList.toggle('active', promptPreviewVisible);
    btn.classList.toggle('preview-active', promptPreviewVisible);
    
    if (promptPreviewVisible) {
      updatePreview('promptEditor');
    }
  }
  
  // 更新预览
  function updatePreview(editorId = 'promptEditor') {
    if (!promptPreviewVisible) return;
    
    const textarea = document.getElementById(editorId);
    const content = document.getElementById(editorId + 'PreviewContent');
    if (!textarea || !content) return;
    
    const text = textarea.value.trim();
    if (text) {
      content.innerHTML = '<div>' + escapeHtml(text) + '</div>';
    } else {
      content.innerHTML = '<span class="prompt-preview-empty">暂无内容</span>';
    }
  }
  
  // 清空编辑器
  function clearPromptEditor() {
    const textarea = document.getElementById('promptEditor');
    if (!textarea || textarea.disabled) return;
    
    if (textarea.value && !confirm('确定要清空当前内容吗？')) {
      return;
    }
    
    textarea.value = '';
    textarea.dispatchEvent(new Event('input'));
    showToast('已清空', 'info');
  }
  
  // HTML 转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\\n/g, '<br>');
  }
  
  // 在页面加载后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPromptEditor());
  } else {
    initPromptEditor();
  }
`;

export default {
  promptEditorStyles,
  generatePromptEditorHtml,
  promptEditorScript,
  PROMPT_TEMPLATES,
  MAX_PROMPT_LENGTH,
};
