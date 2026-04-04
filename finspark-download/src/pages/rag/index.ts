/**
 * RAG Platform Page Generator — All Phases Complete (P.0 ~ P.16, 17 pages)
 *
 * Phase 1 active pages (P.0, P.1, P.2, P.4) wired to real backend APIs:
 *   P.0 Dashboard   — live KPIs, trend chart, recent Q&A, system status
 *   P.1 Upload      — text paste + chunking preview + progress bar
 *   P.2 Knowledge   — document list + chunk detail view with edit/delete
 *   P.4 Chat        — enhanced query (vector+BM25) + pipeline visualization
 *
 * Phase 2 pages (P.5~P.13) fully implemented:
 *   P.5  Retrieval Debug  — side-by-side vector vs BM25 comparison
 *   P.6  Test Sets        — CRUD + LLM generation + question expansion
 *   P.7  Evaluation       — batch evaluation + 4D scoring + history comparison
 *   P.8  Chat Logs        — QA log browser with detail modal & pipeline breakdown
 *   P.9  Intent Logs      — intent distribution, confidence, query rewrite viewer
 *   P.10 Pipeline Tracking — waterfall visualization, daily trend, step breakdown
 *   P.11 Model Config     — Embedding/LLM provider CRUD + connection testing
 *   P.12 Prompt Manager   — template editor + version history + rollback
 *   P.13 System Config    — global params + security + debug switches
 *
 * Phase 3 pages (P.3, P.14, P.15) implemented:
 *   P.3  Chunk Enhance     — HyDE questions + summary + entity tagging + dry run + batch
 *   P.14 Knowledge Settle  — extract + review/merge + apply to KB
 *   P.15 Health Check      — coverage/freshness/consistency 3D scoring + suggestions
 *
 * Phase 4 page (P.16) implemented:
 *   P.16 Version Management — timeline + Diff + A/B performance + regression + rollback
 *
 * All 17 pages fully implemented.
 */

import { wrapWithRagLayout } from '../../layouts/ragLayout';
import {
  ragPageHeader,
  ragKpiCard,
  ragComingSoon,
  ragEmptyState,
} from '../../components/ragCommon';

// ============================================================
// Helper: Coming Soon page generator
// ============================================================

function comingSoonPage(opts: {
  pageId: string;
  title: string;
  icon: string;
  description: string;
  phase: string;
  route: string;
}): string {
  return wrapWithRagLayout({
    title: opts.title,
    activePath: opts.route,
    body: ragComingSoon({
      title: opts.title,
      icon: opts.icon,
      description: opts.description,
      phase: opts.phase,
    }),
  });
}

// ============================================================
// P.0 Dashboard — Week 2 Enhanced
// ============================================================

export function generateRagDashboard(): string {
  const kpis = `
    <div class="rc-kpi-grid">
      ${ragKpiCard({ icon: 'fas fa-file-alt', color: 'blue', value: '--', label: '文档总数', trend: { direction: 'flat', text: '加载中' } })}
      ${ragKpiCard({ icon: 'fas fa-puzzle-piece', color: 'green', value: '--', label: '分块总数', trend: { direction: 'flat', text: '加载中' } })}
      ${ragKpiCard({ icon: 'fas fa-comments', color: 'purple', value: '--', label: '问答次数', trend: { direction: 'flat', text: '加载中' } })}
      ${ragKpiCard({ icon: 'fas fa-bullseye', color: 'amber', value: '--%', label: '检索准确率' })}
      ${ragKpiCard({ icon: 'fas fa-clock', color: 'gold', value: '--s', label: '平均响应时间' })}
    </div>`;

  const body = `
    ${ragPageHeader({ title: '平台仪表盘', icon: 'fas fa-tachometer-alt', subtitle: '一览 RAG 平台核心指标与系统状态' })}
    ${kpis}
    <div class="rc-grid-2" style="margin-bottom:24px;">
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-chart-line"></i> 问答量趋势（近 7 日）</div>
        <div id="trendChart" style="min-height:240px;padding:12px 0;">
          <div style="display:flex;align-items:flex-end;gap:8px;height:200px;padding:0 8px;">
            ${Array.from({length: 7}).map((_, i) => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div id="trendBar${i}" style="width:100%;min-height:4px;background:linear-gradient(to top,rgba(59,130,246,0.6),rgba(99,102,241,0.6));border-radius:4px 4px 0 0;transition:height 0.6s ease;"></div>
                <span id="trendLabel${i}" style="font-size:10px;color:#475569;">--</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-chart-pie"></i> 文档分类占比</div>
        <div id="categoryChart" style="min-height:240px;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:12px 0;">
          <div style="text-align:center;color:#475569;font-size:13px;"><i class="fas fa-chart-pie" style="font-size:20px;margin-bottom:6px;display:block;"></i>加载中...</div>
        </div>
      </div>
    </div>
    <div class="rc-grid-2">
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-history"></i> 最近问答记录</div>
        <div id="recentConversations" style="min-height:160px;max-height:360px;overflow-y:auto;">
          ${ragEmptyState({ icon: 'fas fa-comments', title: '暂无问答记录', description: '使用对话助手提问后，记录将在此处显示' })}
        </div>
      </div>
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-server"></i> 系统状态</div>
        <div id="systemStatus" style="min-height:160px;">
          <div style="display:grid;grid-template-columns:auto 1fr;gap:10px 16px;font-size:13px;padding:8px 0;">
            <span style="color:#64748b;">Embedding:</span><span id="sysEmbedding" style="color:#e2e8f0;">加载中...</span>
            <span style="color:#64748b;">LLM:</span><span id="sysLlm" style="color:#e2e8f0;">gpt-4.1 (VectorEngine)</span>
            <span style="color:#64748b;">BM25 索引:</span><span id="sysBm25" style="color:#e2e8f0;">加载中...</span>
            <span style="color:#64748b;">向量维度:</span><span id="sysDimensions" style="color:#e2e8f0;">加载中...</span>
            <span style="color:#64748b;">知识库状态:</span><span id="sysHealth" style="color:#e2e8f0;">加载中...</span>
          </div>
        </div>
      </div>
    </div>`;

  const scripts = `
    var catLabels = { annual_report:'年报', quarterly_report:'季报', research:'研报', announcement:'公告', general:'通用' };
    var catColors = { annual_report:'#3b82f6', quarterly_report:'#22c55e', research:'#a855f7', announcement:'#f59e0b', general:'#64748b' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadDashboard() {
      try {
        // Try enhanced dashboard endpoint first
        var resp = await fetch('/api/rag/stats/dashboard', { headers: getAuthHeaders() });
        var data = await resp.json();

        // Fallback to basic stats
        if (!data.success) {
          resp = await fetch('/api/rag/stats', { headers: getAuthHeaders() });
          data = await resp.json();
        }

        if (!data.success && data.totalDocuments === undefined) return;

        // --- KPI Cards ---
        var cards = document.querySelectorAll('.rc-kpi-value');
        var trends = document.querySelectorAll('.rc-kpi-trend');
        var totalDocs = data.totalDocuments || data.completedDocuments || 0;
        var totalChunks = data.totalChunks || 0;
        var totalConversations = data.totalConversations || data.qaCount || 0;
        if (cards[0]) cards[0].textContent = totalDocs.toLocaleString();
        if (cards[1]) cards[1].textContent = totalChunks.toLocaleString();
        if (cards[2]) cards[2].textContent = totalConversations.toLocaleString();

        // Weekly trends
        if (data.weeklyNewDocs !== undefined && trends[0]) {
          var dir = data.weeklyNewDocs > 0 ? 'up' : 'flat';
          trends[0].className = 'rc-kpi-trend ' + dir;
          trends[0].innerHTML = (dir === 'up' ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-minus"></i>') + ' 本周 +' + data.weeklyNewDocs;
        }
        if (data.weeklyNewChunks !== undefined && trends[1]) {
          var dir2 = data.weeklyNewChunks > 0 ? 'up' : 'flat';
          trends[1].className = 'rc-kpi-trend ' + dir2;
          trends[1].innerHTML = (dir2 === 'up' ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-minus"></i>') + ' 本周 +' + data.weeklyNewChunks;
        }
        if (data.weeklyNewConversations !== undefined && trends[2]) {
          var dir3 = data.weeklyNewConversations > 0 ? 'up' : 'flat';
          trends[2].className = 'rc-kpi-trend ' + dir3;
          trends[2].innerHTML = (dir3 === 'up' ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-minus"></i>') + ' 本周 +' + data.weeklyNewConversations;
        }

        // Retrieval accuracy
        if (data.retrievalAccuracy !== undefined && cards[3]) {
          cards[3].textContent = data.retrievalAccuracy + '%';
        }

        // Avg latency
        if (data.avgLatencyMs && cards[4]) {
          cards[4].textContent = (data.avgLatencyMs / 1000).toFixed(1) + 's';
        }

        // --- Trend chart (simple bars) ---
        if (data.trends && data.trends.dates) {
          var maxVal = Math.max.apply(null, data.trends.conversations) || 1;
          for (var i = 0; i < 7; i++) {
            var bar = document.getElementById('trendBar' + i);
            var label = document.getElementById('trendLabel' + i);
            if (bar && data.trends.conversations[i] !== undefined) {
              var h = Math.max(4, (data.trends.conversations[i] / maxVal) * 180);
              bar.style.height = h + 'px';
              bar.title = data.trends.conversations[i] + ' 次问答';
            }
            if (label && data.trends.dates[i]) label.textContent = data.trends.dates[i];
          }
        }

        // --- Category distribution ---
        if (data.categories && data.categories.length) {
          var total = data.categories.reduce(function(s, c) { return s + c.count; }, 0) || 1;
          document.getElementById('categoryChart').innerHTML = data.categories.map(function(c) {
            var pct = ((c.count / total) * 100).toFixed(1);
            var color = catColors[c.category] || '#64748b';
            return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;">' +
              '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;"></span>' +
              '<span style="flex:1;font-size:13px;color:#cbd5e1;">' + (catLabels[c.category] || c.category) + '</span>' +
              '<div style="flex:2;height:6px;background:rgba(15,23,42,0.5);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;"></div></div>' +
              '<span style="font-size:12px;color:#94a3b8;min-width:50px;text-align:right;">' + c.count + ' (' + pct + '%)</span>' +
              '</div>';
          }).join('');
        } else {
          document.getElementById('categoryChart').innerHTML = '<div style="text-align:center;color:#475569;font-size:13px;">暂无分类数据</div>';
        }

        // --- System status ---
        if (data.embeddingProvider || data.systemStatus) {
          var sys = data.systemStatus || {};
          document.getElementById('sysEmbedding').textContent = (sys.embeddingProvider || data.embeddingProvider || '--') + ' / ' + (sys.model || data.embeddingModel || '');
          document.getElementById('sysDimensions').textContent = (sys.dimensions || data.embeddingDimensions || data.dimensions || '--') + 'd';
          document.getElementById('sysBm25').innerHTML = (sys.bm25Ready || data.bm25Ready) ? '<span style="color:#4ade80;"><i class="fas fa-check-circle"></i> 就绪</span>' : '<span style="color:#f59e0b;"><i class="fas fa-exclamation-circle"></i> 未构建</span>';
          document.getElementById('sysHealth').innerHTML = totalDocs > 0 ? '<span style="color:#4ade80;"><i class="fas fa-check-circle"></i> 正常</span>' : '<span style="color:#64748b;">空库</span>';
        }

        // --- Recent conversations ---
        if (data.recentConversations && data.recentConversations.length) {
          document.getElementById('recentConversations').innerHTML = data.recentConversations.map(function(c) {
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-bottom:1px solid rgba(148,163,184,0.06);font-size:13px;">' +
              '<i class="fas fa-comment-dots" style="color:#3b82f6;margin-top:3px;"></i>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(c.question || c.user_query || '') + '</div>' +
                '<div style="font-size:11px;color:#475569;margin-top:2px;">' +
                  (c.time || c.created_at || '') +
                  (c.status === 'error' ? ' <span style="color:#f87171;"><i class="fas fa-times-circle"></i> 失败</span>' : '') +
                '</div>' +
              '</div></div>';
          }).join('');
        }

      } catch(e) { console.error('Dashboard load error:', e); }
    }

    // Load recent logs too
    async function loadRecentLogs() {
      try {
        var resp = await fetch('/api/rag/logs/recent?limit=8', { headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success && data.logs && data.logs.length) {
          var container = document.getElementById('recentConversations');
          container.innerHTML = data.logs.map(function(log) {
            var latency = log.total_latency_ms ? (log.total_latency_ms / 1000).toFixed(1) + 's' : '-';
            var intentBadge = log.intent_type ? '<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(168,85,247,0.12);color:#a855f7;font-size:10px;margin-left:4px;">' + log.intent_type + '</span>' : '';
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-bottom:1px solid rgba(148,163,184,0.06);font-size:13px;">' +
              '<i class="' + (log.status === 'error' ? 'fas fa-times-circle' : 'fas fa-comment-dots') + '" style="color:' + (log.status === 'error' ? '#f87171' : '#3b82f6') + ';margin-top:3px;"></i>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(log.user_query || '') + intentBadge + '</div>' +
                '<div style="font-size:11px;color:#475569;margin-top:2px;display:flex;gap:10px;">' +
                  '<span><i class="fas fa-clock"></i> ' + latency + '</span>' +
                  '<span><i class="fas fa-search"></i> V:' + (log.vector_results_count || 0) + ' B:' + (log.bm25_results_count || 0) + '</span>' +
                  '<span>' + (log.created_at || '') + '</span>' +
                '</div>' +
              '</div></div>';
          }).join('');
        }
      } catch(e) {}
    }

    loadDashboard();
    loadRecentLogs();
    // Auto-refresh every 30s
    setInterval(function() { loadDashboard(); loadRecentLogs(); }, 30000);
  `;

  return wrapWithRagLayout({
    title: '仪表盘总览',
    activePath: '/rag/dashboard',
    body,
    scripts,
  });
}

// ============================================================
// P.1 Upload — Week 2 Enhanced (chunking preview + progress)
// ============================================================

export function generateRagUpload(): string {
  const body = `
    ${ragPageHeader({
      title: '文档上传与解析',
      icon: 'fas fa-cloud-upload-alt',
      subtitle: '上传财报文档到知识库，支持文本粘贴与 PDF 智能解析（MinerU）',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '数据管理' }, { label: '文档上传' }],
    })}

    <div style="display:grid;grid-template-columns:1fr 380px;gap:20px;align-items:start;">
      <!-- Left: upload form -->
      <div class="rc-card">
        <div class="rc-tabs">
          <button class="rc-tab active" id="tabText" onclick="switchUploadTab('text',this)"><i class="fas fa-file-alt"></i> 文本粘贴</button>
          <button class="rc-tab" id="tabPdf" onclick="switchUploadTab('pdf',this)">
            <i class="fas fa-file-pdf" style="color:#ef4444;"></i> PDF 上传 <span style="font-size:9px;background:rgba(239,68,68,0.15);color:#ef4444;padding:1px 6px;border-radius:4px;margin-left:4px;">MinerU</span>
          </button>
        </div>

        <!-- ===== Text Upload Panel ===== -->
        <div id="textUploadPanel">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div>
              <label class="rc-label">文档标题 <span style="color:#ef4444;">*</span></label>
              <input class="rc-input" id="uploadTitle" placeholder="如：贵州茅台2024年报">
            </div>
            <div>
              <label class="rc-label">关联股票代码</label>
              <input class="rc-input" id="uploadStockCode" placeholder="如：600519.SH">
            </div>
            <div>
              <label class="rc-label">文档分类</label>
              <select class="rc-select" id="uploadCategory">
                <option value="general">通用文档</option>
                <option value="annual_report">年度报告</option>
                <option value="quarterly_report">季度报告</option>
                <option value="research">研究报告</option>
                <option value="announcement">公告</option>
              </select>
            </div>
            <div>
              <label class="rc-label">关联公司名称</label>
              <input class="rc-input" id="uploadStockName" placeholder="如：贵州茅台">
            </div>
          </div>

          <!-- Chunk parameters with live preview -->
          <div style="margin-bottom:16px;padding:14px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px solid rgba(148,163,184,0.08);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font-size:12px;font-weight:600;color:#94a3b8;"><i class="fas fa-cog" style="margin-right:4px;"></i> 分块参数</span>
              <button class="rc-btn rc-btn-outline rc-btn-sm" id="previewBtn" onclick="doPreview()" style="font-size:11px;padding:3px 10px;">
                <i class="fas fa-eye"></i> 预览分块
              </button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label class="rc-label">分块大小（字符）<span id="chunkSizeVal" style="color:#d4af37;margin-left:4px;">500</span></label>
                <input type="range" id="uploadChunkSize" min="100" max="2000" step="50" value="500" style="width:100%;accent-color:#d4af37;" oninput="document.getElementById('chunkSizeVal').textContent=this.value">
              </div>
              <div>
                <label class="rc-label">重叠大小（字符）<span id="overlapVal" style="color:#d4af37;margin-left:4px;">100</span></label>
                <input type="range" id="uploadChunkOverlap" min="0" max="500" step="10" value="100" style="width:100%;accent-color:#d4af37;" oninput="document.getElementById('overlapVal').textContent=this.value">
              </div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label class="rc-label">文档内容 <span style="color:#ef4444;">*</span></label>
            <textarea class="rc-input" id="uploadContent" rows="12" style="resize:vertical;line-height:1.6;" placeholder="粘贴财报文本内容...&#10;&#10;支持纯文本、Markdown 格式。&#10;可以直接从 PDF 中复制文本内容粘贴到这里。"></textarea>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:#475569;">
              <span id="contentLength">0 字符</span>
              <span>最大 500,000 字符</span>
            </div>
          </div>

          <!-- Progress bar -->
          <div id="uploadProgress" style="display:none;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:500;color:#94a3b8;">处理进度</span>
              <span id="progressPercent" style="font-size:12px;color:#d4af37;font-weight:600;">0%</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(15,23,42,0.6);border-radius:3px;overflow:hidden;">
              <div id="progressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#d4af37,#f5d75e);border-radius:3px;transition:width 0.4s ease;"></div>
            </div>
            <div id="progressSteps" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px;">
              <div class="rc-upload-step" data-step="validate"><span style="font-size:10px;color:#475569;"><i class="fas fa-check-circle"></i> 验证</span></div>
              <div class="rc-upload-step" data-step="chunk"><span style="font-size:10px;color:#475569;"><i class="fas fa-puzzle-piece"></i> 分块</span></div>
              <div class="rc-upload-step" data-step="embed"><span style="font-size:10px;color:#475569;"><i class="fas fa-vector-square"></i> 向量化</span></div>
              <div class="rc-upload-step" data-step="index"><span style="font-size:10px;color:#475569;"><i class="fas fa-search"></i> BM25索引</span></div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;">
            <button class="rc-btn rc-btn-primary" id="uploadBtn" onclick="doUpload()">
              <i class="fas fa-cloud-upload-alt"></i> 导入知识库
            </button>
            <button class="rc-btn rc-btn-outline" id="previewBtn2" onclick="doPreview()" style="font-size:12px;">
              <i class="fas fa-eye"></i> 预览分块
            </button>
            <span id="uploadStatus" style="font-size:13px;color:#64748b;"></span>
          </div>
        </div>

        <!-- ===== PDF Upload Panel ===== -->
        <div id="pdfUploadPanel" style="display:none;">
          <!-- MinerU status bar -->
          <div id="mineruStatus" style="margin-bottom:16px;padding:10px 14px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:8px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.12);">
            <i class="fas fa-circle-notch fa-spin" style="color:#3b82f6;"></i>
            <span>正在检查 MinerU API 状态...</span>
          </div>

          <!-- File drop zone -->
          <div id="pdfDropZone" style="margin-bottom:16px;padding:40px 20px;border:2px dashed rgba(148,163,184,0.2);border-radius:12px;text-align:center;cursor:pointer;transition:all 0.2s;"
               onclick="document.getElementById('pdfFileInput').click()"
               ondragover="event.preventDefault();this.style.borderColor='rgba(239,68,68,0.5)';this.style.background='rgba(239,68,68,0.03)';"
               ondragleave="this.style.borderColor='rgba(148,163,184,0.2)';this.style.background='transparent';"
               ondrop="handlePdfDrop(event)">
            <input type="file" id="pdfFileInput" accept=".pdf" style="display:none;" onchange="handlePdfSelect(this)">
            <div id="pdfDropContent">
              <i class="fas fa-file-pdf" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block;"></i>
              <div style="font-size:14px;color:#e2e8f0;margin-bottom:4px;">拖拽 PDF 文件到此处，或点击选择</div>
              <div style="font-size:11px;color:#475569;">支持 ≤ 200 MB / ≤ 600 页的 PDF 文件</div>
            </div>
            <div id="pdfFileInfo" style="display:none;">
              <i class="fas fa-file-pdf" style="font-size:32px;color:#ef4444;margin-bottom:8px;display:block;"></i>
              <div id="pdfFileName" style="font-size:14px;color:#e2e8f0;font-weight:500;margin-bottom:2px;"></div>
              <div id="pdfFileSize" style="font-size:11px;color:#64748b;"></div>
              <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="event.stopPropagation();clearPdfFile();" style="margin-top:8px;font-size:11px;padding:2px 10px;">
                <i class="fas fa-times"></i> 移除
              </button>
            </div>
          </div>

          <!-- PDF metadata form -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div>
              <label class="rc-label">文档标题（默认取文件名）</label>
              <input class="rc-input" id="pdfTitle" placeholder="自动从文件名提取">
            </div>
            <div>
              <label class="rc-label">关联股票代码</label>
              <input class="rc-input" id="pdfStockCode" placeholder="如：600519.SH">
            </div>
            <div>
              <label class="rc-label">文档分类</label>
              <select class="rc-select" id="pdfCategory">
                <option value="general">通用文档</option>
                <option value="annual_report">年度报告</option>
                <option value="quarterly_report">季度报告</option>
                <option value="research">研究报告</option>
                <option value="announcement">公告</option>
              </select>
            </div>
            <div>
              <label class="rc-label">关联公司名称</label>
              <input class="rc-input" id="pdfStockName" placeholder="如：贵州茅台">
            </div>
          </div>

          <!-- Parse options -->
          <div style="margin-bottom:16px;padding:14px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px solid rgba(148,163,184,0.08);">
            <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:10px;"><i class="fas fa-sliders-h" style="margin-right:4px;"></i> 解析参数</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label class="rc-label">解析模型</label>
                <select class="rc-select" id="pdfParseModel">
                  <option value="auto">自动选择 (推荐)</option>
                  <option value="pipeline">Pipeline (传统)</option>
                  <option value="vlm">VLM (视觉语言模型)</option>
                </select>
              </div>
              <div>
                <label class="rc-label">页码范围（留空=全部）</label>
                <input class="rc-input" id="pdfPageRange" placeholder="如：1-10 或 1,3,5">
              </div>
              <div style="display:flex;align-items:center;gap:16px;grid-column:span 2;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#94a3b8;">
                  <input type="checkbox" id="pdfEnableOcr" checked style="accent-color:#d4af37;"> OCR 识别
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#94a3b8;">
                  <input type="checkbox" id="pdfEnableTable" checked style="accent-color:#d4af37;"> 表格提取
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#94a3b8;">
                  <input type="checkbox" id="pdfEnableFormula" checked style="accent-color:#d4af37;"> 公式提取
                </label>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div>
                <label class="rc-label">分块大小（字符）<span id="pdfChunkSizeVal" style="color:#d4af37;margin-left:4px;">500</span></label>
                <input type="range" id="pdfChunkSize" min="100" max="2000" step="50" value="500" style="width:100%;accent-color:#d4af37;" oninput="document.getElementById('pdfChunkSizeVal').textContent=this.value">
              </div>
              <div>
                <label class="rc-label">重叠大小（字符）<span id="pdfOverlapVal" style="color:#d4af37;margin-left:4px;">100</span></label>
                <input type="range" id="pdfChunkOverlap" min="0" max="500" step="10" value="100" style="width:100%;accent-color:#d4af37;" oninput="document.getElementById('pdfOverlapVal').textContent=this.value">
              </div>
            </div>
          </div>

          <!-- PDF Progress bar -->
          <div id="pdfProgress" style="display:none;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:500;color:#94a3b8;">解析进度</span>
              <span id="pdfProgressPct" style="font-size:12px;color:#ef4444;font-weight:600;">0%</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(15,23,42,0.6);border-radius:3px;overflow:hidden;">
              <div id="pdfProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:3px;transition:width 0.4s ease;"></div>
            </div>
            <div id="pdfProgressSteps" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px;">
              <div class="rc-upload-step" data-step="upload"><span style="font-size:10px;color:#475569;"><i class="fas fa-upload"></i> 上传</span></div>
              <div class="rc-upload-step" data-step="parse"><span style="font-size:10px;color:#475569;"><i class="fas fa-cogs"></i> 解析</span></div>
              <div class="rc-upload-step" data-step="chunk"><span style="font-size:10px;color:#475569;"><i class="fas fa-puzzle-piece"></i> 分块</span></div>
              <div class="rc-upload-step" data-step="embed"><span style="font-size:10px;color:#475569;"><i class="fas fa-vector-square"></i> 向量化</span></div>
              <div class="rc-upload-step" data-step="index"><span style="font-size:10px;color:#475569;"><i class="fas fa-search"></i> 索引</span></div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;">
            <button class="rc-btn rc-btn-primary" id="pdfUploadBtn" onclick="doPdfUpload()" disabled style="background:linear-gradient(135deg,#ef4444,#dc2626);">
              <i class="fas fa-file-pdf"></i> 解析并导入知识库
            </button>
            <button class="rc-btn rc-btn-outline" id="pdfPreviewBtn" onclick="doPdfParseOnly()" disabled style="font-size:12px;">
              <i class="fas fa-eye"></i> 仅解析预览
            </button>
            <span id="pdfStatus" style="font-size:13px;color:#64748b;"></span>
          </div>
        </div>
      </div>

      <!-- Right: chunk preview panel -->
      <div class="rc-card" id="previewPanel">
        <div class="rc-card-title"><i class="fas fa-th-list"></i> 分块预览</div>
        <div id="previewStats" style="display:none;margin-bottom:12px;padding:10px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.12);border-radius:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
            <div><span style="color:#64748b;">总分块数:</span> <strong id="pvCount" style="color:#e2e8f0;">-</strong></div>
            <div><span style="color:#64748b;">平均长度:</span> <strong id="pvAvg" style="color:#e2e8f0;">-</strong></div>
            <div><span style="color:#64748b;">最大长度:</span> <strong id="pvMax" style="color:#e2e8f0;">-</strong></div>
            <div><span style="color:#64748b;">最小长度:</span> <strong id="pvMin" style="color:#e2e8f0;">-</strong></div>
          </div>
        </div>
        <div id="previewChunks" style="max-height:540px;overflow-y:auto;">
          <div style="text-align:center;padding:40px 16px;color:#475569;font-size:13px;">
            <i class="fas fa-th-list" style="font-size:28px;display:block;margin-bottom:10px;color:#334155;"></i>
            输入文本后点击「预览分块」<br>查看分块效果
          </div>
        </div>

        <!-- PDF parse result panel (shown after parse-only) -->
        <div id="pdfParseResult" style="display:none;margin-top:12px;">
          <div style="padding:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);border-radius:8px;margin-bottom:10px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
              <div><span style="color:#64748b;">页数:</span> <strong id="pvPages" style="color:#e2e8f0;">-</strong></div>
              <div><span style="color:#64748b;">内容长度:</span> <strong id="pvContentLen" style="color:#e2e8f0;">-</strong></div>
              <div><span style="color:#64748b;">解析模型:</span> <strong id="pvModel" style="color:#e2e8f0;">-</strong></div>
              <div><span style="color:#64748b;">耗时:</span> <strong id="pvDuration" style="color:#e2e8f0;">-</strong></div>
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Markdown 预览（前 2000 字符）</div>
          <pre id="pvMarkdown" style="max-height:360px;overflow-y:auto;padding:10px;background:rgba(15,23,42,0.5);border-radius:8px;font-size:11px;color:#cbd5e1;line-height:1.5;white-space:pre-wrap;word-break:break-all;border:1px solid rgba(148,163,184,0.08);"></pre>
        </div>
      </div>
    </div>`;

  const styles = `
    .rc-chunk-card { padding:10px;margin-bottom:8px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:8px;font-size:12px;color:#94a3b8;cursor:pointer;transition:border-color 0.15s; }
    .rc-chunk-card:hover { border-color:rgba(212,175,55,0.3); }
    .rc-chunk-card .rc-chunk-idx { font-size:10px;color:#475569;margin-bottom:4px;display:flex;justify-content:space-between; }
    .rc-chunk-card .rc-chunk-text { line-height:1.5;max-height:60px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
    .rc-upload-step.active span { color:#d4af37 !important; }
    .rc-upload-step.done span { color:#4ade80 !important; }
    #pdfDropZone.drag-over { border-color:rgba(239,68,68,0.5) !important;background:rgba(239,68,68,0.04) !important; }
    @media (max-width:1023px) {
      .rag-main > div:nth-child(2) { grid-template-columns:1fr !important; }
    }
  `;

  const scripts = `
    var currentPdfBase64 = null;
    var currentPdfFileName = null;

    var contentEl = document.getElementById('uploadContent');
    if (contentEl) contentEl.addEventListener('input', function() {
      document.getElementById('contentLength').textContent = this.value.length + ' 字符';
    });

    function switchUploadTab(tab, el) {
      document.querySelectorAll('.rc-tab').forEach(function(t) { t.classList.remove('active'); });
      el.classList.add('active');
      document.getElementById('textUploadPanel').style.display = tab === 'text' ? 'block' : 'none';
      document.getElementById('pdfUploadPanel').style.display = tab === 'pdf' ? 'block' : 'none';
      // Reset preview panel
      document.getElementById('pdfParseResult').style.display = 'none';
      if (tab === 'pdf') checkMineruHealth();
    }

    // ---- MinerU Health Check ----
    async function checkMineruHealth() {
      var el = document.getElementById('mineruStatus');
      el.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="color:#3b82f6;"></i> <span>正在检查 MinerU API 状态...</span>';
      el.style.background = 'rgba(59,130,246,0.06)';
      el.style.borderColor = 'rgba(59,130,246,0.12)';
      try {
        var resp = await fetch('/api/rag/upload/pdf/health', { headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.available) {
          el.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> <span>MinerU API 已就绪</span>';
          el.style.background = 'rgba(74,222,128,0.06)';
          el.style.borderColor = 'rgba(74,222,128,0.12)';
        } else {
          el.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i> <span>' + escapeHtml(data.message || 'MinerU 不可用') + '</span>';
          el.style.background = 'rgba(245,158,11,0.06)';
          el.style.borderColor = 'rgba(245,158,11,0.12)';
        }
      } catch(e) {
        el.innerHTML = '<i class="fas fa-times-circle" style="color:#ef4444;"></i> <span>MinerU 状态检查失败</span>';
        el.style.background = 'rgba(239,68,68,0.06)';
        el.style.borderColor = 'rgba(239,68,68,0.12)';
      }
    }

    // ---- PDF File Handling ----
    function handlePdfDrop(e) {
      e.preventDefault();
      e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)';
      e.currentTarget.style.background = 'transparent';
      var files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        processPdfFile(files[0]);
      } else {
        alert('请拖拽 PDF 文件');
      }
    }

    function handlePdfSelect(input) {
      if (input.files.length > 0) {
        processPdfFile(input.files[0]);
      }
    }

    function processPdfFile(file) {
      if (file.size > 200 * 1024 * 1024) {
        alert('文件大小超过 200 MB 限制');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('仅支持 PDF 文件');
        return;
      }

      currentPdfFileName = file.name;
      document.getElementById('pdfDropContent').style.display = 'none';
      document.getElementById('pdfFileInfo').style.display = 'block';
      document.getElementById('pdfFileName').textContent = file.name;
      document.getElementById('pdfFileSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';

      // Auto-fill title from filename
      var nameWithoutExt = file.name.replace(/\\.pdf$/i, '');
      if (!document.getElementById('pdfTitle').value) {
        document.getElementById('pdfTitle').value = nameWithoutExt;
      }

      // Convert to Base64
      var reader = new FileReader();
      reader.onload = function(e) {
        currentPdfBase64 = e.target.result.split(',')[1]; // Remove data URI prefix
        document.getElementById('pdfUploadBtn').disabled = false;
        document.getElementById('pdfPreviewBtn').disabled = false;
      };
      reader.readAsDataURL(file);
    }

    function clearPdfFile() {
      currentPdfBase64 = null;
      currentPdfFileName = null;
      document.getElementById('pdfDropContent').style.display = 'block';
      document.getElementById('pdfFileInfo').style.display = 'none';
      document.getElementById('pdfUploadBtn').disabled = true;
      document.getElementById('pdfPreviewBtn').disabled = true;
      document.getElementById('pdfFileInput').value = '';
      document.getElementById('pdfTitle').value = '';
      document.getElementById('pdfParseResult').style.display = 'none';
    }

    // ---- PDF Progress ----
    function setPdfProgress(pct, stepIdx) {
      document.getElementById('pdfProgressBar').style.width = pct + '%';
      document.getElementById('pdfProgressPct').textContent = Math.round(pct) + '%';
      var steps = document.querySelectorAll('#pdfProgressSteps .rc-upload-step');
      steps.forEach(function(s, i) {
        s.className = 'rc-upload-step' + (i < stepIdx ? ' done' : (i === stepIdx ? ' active' : ''));
      });
    }

    // ---- PDF Upload & Parse ----
    async function doPdfUpload() {
      if (!currentPdfBase64) { alert('请选择 PDF 文件'); return; }

      var btn = document.getElementById('pdfUploadBtn');
      var previewBtn = document.getElementById('pdfPreviewBtn');
      var status = document.getElementById('pdfStatus');
      var progress = document.getElementById('pdfProgress');
      
      btn.disabled = true; previewBtn.disabled = true;
      progress.style.display = 'block';
      status.innerHTML = '';

      setPdfProgress(5, 0);
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在上传 PDF 到 MinerU...';

      // Animate progress during API call
      var currentPct = 5;
      var progressInterval = setInterval(function() {
        if (currentPct < 85) {
          currentPct += Math.random() * 2;
          var stepIdx = currentPct < 20 ? 0 : (currentPct < 50 ? 1 : (currentPct < 70 ? 2 : 3));
          setPdfProgress(currentPct, stepIdx);
          var msgs = ['正在上传 PDF...', '正在解析 PDF (MinerU)...', '正在分块与向量化...', '正在构建索引...'];
          status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + msgs[stepIdx];
        }
      }, 1500);

      try {
        var resp = await fetch('/api/rag/upload/pdf', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({
            fileData: currentPdfBase64,
            fileName: currentPdfFileName,
            title: document.getElementById('pdfTitle').value.trim() || undefined,
            stockCode: document.getElementById('pdfStockCode').value.trim() || undefined,
            stockName: document.getElementById('pdfStockName').value.trim() || undefined,
            category: document.getElementById('pdfCategory').value,
            parseModel: document.getElementById('pdfParseModel').value,
            enableOcr: document.getElementById('pdfEnableOcr').checked,
            enableTable: document.getElementById('pdfEnableTable').checked,
            enableFormula: document.getElementById('pdfEnableFormula').checked,
            pageRange: document.getElementById('pdfPageRange').value.trim() || undefined,
            chunkSize: parseInt(document.getElementById('pdfChunkSize').value) || 500,
            chunkOverlap: parseInt(document.getElementById('pdfChunkOverlap').value) || 100,
            autoIngest: true,
          })
        });

        clearInterval(progressInterval);
        var data = await resp.json();

        if (data.success) {
          setPdfProgress(100, 4);
          var info = data.parsed || {};
          status.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> ' +
            '解析成功! ' + (data.chunkCount || 0) + ' 个分块已入库' +
            (info.pageCount ? ' (' + info.pageCount + ' 页)' : '') +
            (data.embeddingProvider ? ' [' + data.embeddingProvider + ' ' + data.embeddingDimensions + 'd]' : '');
          
          // Reset after success
          setTimeout(function() {
            clearPdfFile();
            progress.style.display = 'none';
          }, 4000);
        } else {
          setPdfProgress(0, -1);
          status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (data.error || 'PDF 上传失败');
          btn.disabled = false; previewBtn.disabled = false;
        }
      } catch(e) {
        clearInterval(progressInterval);
        setPdfProgress(0, -1);
        status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + e.message;
        btn.disabled = false; previewBtn.disabled = false;
      }
    }

    // ---- PDF Parse Only (Preview) ----
    async function doPdfParseOnly() {
      if (!currentPdfBase64) { alert('请选择 PDF 文件'); return; }

      var btn = document.getElementById('pdfPreviewBtn');
      var uploadBtn = document.getElementById('pdfUploadBtn');
      var status = document.getElementById('pdfStatus');
      var progress = document.getElementById('pdfProgress');

      btn.disabled = true; uploadBtn.disabled = true;
      progress.style.display = 'block';
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在解析 PDF...';
      setPdfProgress(10, 0);

      var progressInterval = setInterval(function() {
        var bar = document.getElementById('pdfProgressBar');
        var current = parseFloat(bar.style.width) || 10;
        if (current < 80) {
          current += Math.random() * 3;
          setPdfProgress(current, current < 30 ? 0 : 1);
        }
      }, 2000);

      try {
        var resp = await fetch('/api/rag/upload/pdf/parse-only', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({
            fileData: currentPdfBase64,
            fileName: currentPdfFileName,
            parseModel: document.getElementById('pdfParseModel').value,
            enableOcr: document.getElementById('pdfEnableOcr').checked,
            pageRange: document.getElementById('pdfPageRange').value.trim() || undefined,
          })
        });

        clearInterval(progressInterval);
        var data = await resp.json();

        if (data.success) {
          setPdfProgress(100, 1);
          status.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 解析完成 (' +
            (data.pageCount || '?') + ' 页, ' + (data.contentLength || 0) + ' 字符)';

          // Show parse result
          var resultPanel = document.getElementById('pdfParseResult');
          resultPanel.style.display = 'block';
          document.getElementById('pvPages').textContent = data.pageCount || '-';
          document.getElementById('pvContentLen').textContent = (data.contentLength || 0).toLocaleString() + ' 字符';
          document.getElementById('pvModel').textContent = data.model || '-';
          document.getElementById('pvDuration').textContent = ((data.parseDurationMs || 0) / 1000).toFixed(1) + ' 秒';
          document.getElementById('pvMarkdown').textContent = (data.markdown || '').substring(0, 2000);

          // Also preview chunking
          if (data.markdown) {
            var chunkSize = parseInt(document.getElementById('pdfChunkSize').value) || 500;
            var chunkOverlap = parseInt(document.getElementById('pdfChunkOverlap').value) || 100;
            try {
              var previewResp = await fetch('/api/rag/upload/preview', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
                body: JSON.stringify({ content: data.markdown, chunkSize: chunkSize, chunkOverlap: chunkOverlap })
              });
              var previewData = await previewResp.json();
              if (previewData.success) {
                document.getElementById('previewStats').style.display = 'block';
                document.getElementById('pvCount').textContent = previewData.stats.count;
                document.getElementById('pvAvg').textContent = Math.round(previewData.stats.avgLength) + ' 字';
                document.getElementById('pvMax').textContent = previewData.stats.maxLength + ' 字';
                document.getElementById('pvMin').textContent = previewData.stats.minLength + ' 字';
                var container = document.getElementById('previewChunks');
                container.innerHTML = previewData.chunks.map(function(chunk, i) {
                  return '<div class="rc-chunk-card">' +
                    '<div class="rc-chunk-idx"><span>#' + (i + 1) + '</span><span>' + chunk.length + ' 字</span></div>' +
                    '<div class="rc-chunk-text">' + escapeHtml(chunk) + '</div></div>';
                }).join('') + (previewData.hasMore ? '<div style="text-align:center;padding:8px;font-size:11px;color:#475569;">还有更多分块（仅展示前 20 个）</div>' : '');
              }
            } catch(pe) { /* ignore preview error */ }
          }

          progress.style.display = 'none';
        } else {
          setPdfProgress(0, -1);
          status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (data.error || '解析失败');
        }
        btn.disabled = false; uploadBtn.disabled = false;
      } catch(e) {
        clearInterval(progressInterval);
        setPdfProgress(0, -1);
        status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + e.message;
        btn.disabled = false; uploadBtn.disabled = false;
      }
    }

    // ---- Text Upload (original) ----
    async function doPreview() {
      var content = document.getElementById('uploadContent').value.trim();
      if (!content) { alert('请先输入文档内容'); return; }
      if (content.length < 10) { alert('内容太短，无法预览分块'); return; }

      var chunkSize = parseInt(document.getElementById('uploadChunkSize').value) || 500;
      var chunkOverlap = parseInt(document.getElementById('uploadChunkOverlap').value) || 100;
      var btn = document.getElementById('previewBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 预览中';

      try {
        var resp = await fetch('/api/rag/upload/preview', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ content: content, chunkSize: chunkSize, chunkOverlap: chunkOverlap })
        });
        var data = await resp.json();
        if (data.success) {
          document.getElementById('pdfParseResult').style.display = 'none';
          var statsEl = document.getElementById('previewStats');
          statsEl.style.display = 'block';
          document.getElementById('pvCount').textContent = data.stats.count;
          document.getElementById('pvAvg').textContent = Math.round(data.stats.avgLength) + ' 字';
          document.getElementById('pvMax').textContent = data.stats.maxLength + ' 字';
          document.getElementById('pvMin').textContent = data.stats.minLength + ' 字';

          var container = document.getElementById('previewChunks');
          container.innerHTML = data.chunks.map(function(chunk, i) {
            return '<div class="rc-chunk-card">' +
              '<div class="rc-chunk-idx"><span>#' + (i + 1) + '</span><span>' + chunk.length + ' 字</span></div>' +
              '<div class="rc-chunk-text">' + escapeHtml(chunk) + '</div>' +
              '</div>';
          }).join('') + (data.hasMore ? '<div style="text-align:center;padding:8px;font-size:11px;color:#475569;">还有更多分块（仅展示前 20 个）</div>' : '');
        } else {
          document.getElementById('previewChunks').innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">预览失败: ' + (data.error || '') + '</div>';
        }
      } catch(e) {
        document.getElementById('previewChunks').innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">预览请求失败</div>';
      }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-eye"></i> 预览分块';
    }

    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    function setProgress(pct, stepIdx) {
      document.getElementById('progressBar').style.width = pct + '%';
      document.getElementById('progressPercent').textContent = Math.round(pct) + '%';
      var steps = document.querySelectorAll('#progressSteps .rc-upload-step');
      steps.forEach(function(s, i) {
        s.className = 'rc-upload-step' + (i < stepIdx ? ' done' : (i === stepIdx ? ' active' : ''));
      });
    }

    async function doUpload() {
      var title = document.getElementById('uploadTitle').value.trim();
      var content = document.getElementById('uploadContent').value.trim();
      if (!title) { alert('请输入文档标题'); return; }
      if (!content) { alert('请输入文档内容'); return; }

      var btn = document.getElementById('uploadBtn');
      var status = document.getElementById('uploadStatus');
      var progress = document.getElementById('uploadProgress');
      btn.disabled = true; btn.style.opacity = '0.5';
      progress.style.display = 'block';
      status.innerHTML = '';

      setProgress(5, 0);
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在验证文档...';

      await new Promise(function(r) { setTimeout(r, 300); });
      setProgress(15, 0);
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在分块...';

      await new Promise(function(r) { setTimeout(r, 200); });
      setProgress(25, 1);
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在生成向量...';

      try {
        var progressInterval = setInterval(function() {
          var bar = document.getElementById('progressBar');
          var current = parseFloat(bar.style.width) || 25;
          if (current < 85) {
            current += Math.random() * 3;
            setProgress(current, current < 50 ? 1 : (current < 70 ? 2 : 3));
            status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' +
              (current < 50 ? '正在生成 Embedding 向量...' : (current < 70 ? '正在构建向量索引...' : '正在构建 BM25 索引...'));
          }
        }, 800);

        var resp = await fetch('/api/rag/upload', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({
            title: title,
            content: content,
            fileName: title + '.txt',
            stockCode: document.getElementById('uploadStockCode').value.trim() || undefined,
            stockName: document.getElementById('uploadStockName').value.trim() || undefined,
            category: document.getElementById('uploadCategory').value,
            chunkSize: parseInt(document.getElementById('uploadChunkSize').value) || 500,
            chunkOverlap: parseInt(document.getElementById('uploadChunkOverlap').value) || 100,
          })
        });
        clearInterval(progressInterval);
        var data = await resp.json();
        if (data.success) {
          setProgress(100, 3);
          status.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 上传成功! ' + data.chunkCount + ' 个分块已入库';
          status.innerHTML += data.embeddingProvider ? ' (' + data.embeddingProvider + ' ' + data.embeddingDimensions + 'd)' : '';
          document.getElementById('uploadTitle').value = '';
          document.getElementById('uploadContent').value = '';
          document.getElementById('contentLength').textContent = '0 字符';
          setTimeout(function() {
            btn.disabled = false; btn.style.opacity = '1';
            progress.style.display = 'none';
          }, 3000);
        } else {
          setProgress(0, -1);
          status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (data.error || '上传失败');
          btn.disabled = false; btn.style.opacity = '1';
        }
      } catch(e) {
        clearInterval(progressInterval);
        setProgress(0, -1);
        status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + e.message;
        btn.disabled = false; btn.style.opacity = '1';
      }
    }
  `;

  return wrapWithRagLayout({
    title: '文档上传与解析',
    activePath: '/rag/upload',
    body,
    scripts,
    styles,
  });
}

// ============================================================
// P.2 Knowledge Base Browser — Week 2 Enhanced
// ============================================================

export function generateRagKnowledgeBase(): string {
  const body = `
    ${ragPageHeader({
      title: '知识库浏览器',
      icon: 'fas fa-book-open',
      subtitle: '浏览、搜索和管理已上传的文档与分块',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '数据管理' }, { label: '知识库浏览器' }],
      actions: '<a href="/rag/upload" class="rc-btn rc-btn-primary rc-btn-sm"><i class="fas fa-plus"></i> 上传文档</a>',
    })}

    <!-- Document list view -->
    <div id="docListView">
      <div class="rc-card" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="rc-search">
            <i class="fas fa-search"></i>
            <input id="docSearch" placeholder="搜索文档标题或股票代码..." oninput="filterDocs()">
          </div>
          <div style="display:flex;gap:8px;">
            <select class="rc-select" id="filterCategory" style="max-width:140px;" onchange="loadDocs()">
              <option value="">全部分类</option>
              <option value="annual_report">年报</option>
              <option value="quarterly_report">季报</option>
              <option value="research">研报</option>
              <option value="announcement">公告</option>
              <option value="general">通用</option>
            </select>
            <select class="rc-select" id="filterStatus" style="max-width:120px;" onchange="loadDocs()">
              <option value="">全部状态</option>
              <option value="completed">已完成</option>
              <option value="processing">处理中</option>
              <option value="failed">失败</option>
            </select>
          </div>
        </div>
      </div>
      <div class="rc-card">
        <div class="rc-table-wrap">
          <table class="rc-table">
            <thead>
              <tr>
                <th>文档标题</th>
                <th>股票</th>
                <th>分类</th>
                <th>分块数</th>
                <th>状态</th>
                <th>上传时间</th>
                <th style="text-align:right;">操作</th>
              </tr>
            </thead>
            <tbody id="docsTable">
              <tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="rc-pagination" id="docsPagination"></div>
      </div>
    </div>

    <!-- Document detail view (Chunk browser) -->
    <div id="docDetailView" style="display:none;">
      <div style="margin-bottom:20px;">
        <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="backToList()" style="margin-bottom:12px;">
          <i class="fas fa-arrow-left"></i> 返回文档列表
        </button>
        <div class="rc-card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 id="detailDocTitle" style="font-size:18px;font-weight:600;color:#e2e8f0;margin-bottom:4px;"></h3>
              <div id="detailDocMeta" style="font-size:12px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap;"></div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="reindexDoc()" id="reindexBtn">
                <i class="fas fa-sync-alt"></i> 重建索引
              </button>
              <button class="rc-btn rc-btn-danger rc-btn-sm" onclick="deleteCurrentDoc()">
                <i class="fas fa-trash"></i> 删除文档
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chunk list -->
      <div class="rc-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div class="rc-card-title" style="margin:0;"><i class="fas fa-puzzle-piece"></i> 分块列表</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="rc-search" style="max-width:240px;">
              <i class="fas fa-search"></i>
              <input id="chunkSearch" placeholder="搜索分块内容..." oninput="searchChunks()">
            </div>
            <div class="rc-tabs" style="margin:0;border:none;gap:2px;">
              <button class="rc-tab active" onclick="filterChunkType('',this)" style="padding:6px 12px;font-size:11px;">全部</button>
              <button class="rc-tab" onclick="filterChunkType('text',this)" style="padding:6px 12px;font-size:11px;">文本</button>
              <button class="rc-tab" onclick="filterChunkType('table',this)" style="padding:6px 12px;font-size:11px;">表格</button>
            </div>
          </div>
        </div>
        <div id="chunksContainer" style="min-height:200px;"></div>
        <div class="rc-pagination" id="chunksPagination"></div>
      </div>
    </div>

    <!-- Chunk edit modal -->
    <div id="chunkEditModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
      <div style="background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:700px;max-height:90vh;overflow-y:auto;padding:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-edit" style="color:#d4af37;margin-right:8px;"></i>编辑分块</h3>
          <button onclick="closeEditModal()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">分块 ID: <span id="editChunkId" style="color:#d4af37;"></span></label>
        </div>
        <textarea class="rc-input" id="editChunkContent" rows="12" style="resize:vertical;line-height:1.6;margin-bottom:16px;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="rc-btn rc-btn-outline" onclick="closeEditModal()">取消</button>
          <button class="rc-btn rc-btn-primary" id="saveChunkBtn" onclick="saveChunkEdit()">
            <i class="fas fa-save"></i> 保存并重新向量化
          </button>
        </div>
        <div id="editStatus" style="margin-top:10px;font-size:12px;color:#64748b;"></div>
      </div>
    </div>`;

  const styles = `
    .rc-chunk-item {
      padding: 14px;
      margin-bottom: 10px;
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(148, 163, 184, 0.08);
      border-radius: 10px;
      transition: border-color 0.15s;
    }
    .rc-chunk-item:hover { border-color: rgba(148, 163, 184, 0.2); }
    .rc-chunk-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .rc-chunk-item-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      color: #475569;
    }
    .rc-chunk-item-actions { display: flex; gap: 6px; }
    .rc-chunk-item-content {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.7;
      max-height: 80px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .rc-chunk-item-content.expanded {
      max-height: none;
      -webkit-line-clamp: unset;
    }
    #chunkEditModal.show { display: flex !important; }
  `;

  const scripts = `
    var docsCache = [];
    var currentDocId = null;
    var currentChunkType = '';
    var chunkOffset = 0;
    var chunkLimit = 20;
    var categoryLabels = { annual_report:'年报', quarterly_report:'季报', research:'研报', announcement:'公告', general:'通用' };
    var statusLabels = { completed:'已完成', processing:'处理中', pending:'待处理', failed:'失败' };
    var statusClasses = { completed:'rc-status-completed', processing:'rc-status-processing', pending:'rc-status-pending', failed:'rc-status-failed' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ---- Document list ----
    async function loadDocs() {
      var params = new URLSearchParams();
      var cat = document.getElementById('filterCategory').value;
      var st = document.getElementById('filterStatus').value;
      if (cat) params.set('category', cat);
      if (st) params.set('status', st);
      params.set('limit', '50');
      try {
        var resp = await fetch('/api/rag/documents?' + params.toString(), { headers: getAuthHeaders() });
        var data = await resp.json();
        docsCache = (data.success && data.documents) ? data.documents : [];
        renderDocs(docsCache);
      } catch(e) {
        document.getElementById('docsTable').innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f87171;">加载失败</td></tr>';
      }
    }
    function renderDocs(docs) {
      var tbody = document.getElementById('docsTable');
      if (!docs.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无文档<br><a href="/rag/upload" style="color:#d4af37;font-size:12px;">去上传文档</a></td></tr>';
        return;
      }
      tbody.innerHTML = docs.map(function(d) {
        return '<tr>' +
          '<td><a href="#" onclick="viewDoc(' + d.id + ');return false;" style="font-weight:500;color:#e2e8f0;text-decoration:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + escapeHtml(d.title) + '</a></td>' +
          '<td>' + (d.stock_code ? escapeHtml(d.stock_code) : '<span style="color:#475569;">-</span>') + '</td>' +
          '<td>' + (categoryLabels[d.category] || d.category) + '</td>' +
          '<td>' + (d.chunk_count || 0) + '</td>' +
          '<td><span class="rc-status ' + (statusClasses[d.status]||'rc-status-pending') + '">' + (statusLabels[d.status]||d.status) + '</span></td>' +
          '<td style="font-size:12px;color:#64748b;">' + (d.created_at ? new Date(d.created_at).toLocaleDateString('zh-CN') : '-') + '</td>' +
          '<td style="text-align:right;">' +
            '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="viewDoc(' + d.id + ')" title="查看分块"><i class="fas fa-eye"></i></button> ' +
            '<button class="rc-btn rc-btn-sm rc-btn-danger" onclick="deleteDoc(' + d.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
          '</td></tr>';
      }).join('');
    }
    function filterDocs() {
      var q = document.getElementById('docSearch').value.toLowerCase();
      if (!q) { renderDocs(docsCache); return; }
      renderDocs(docsCache.filter(function(d) {
        return (d.title||'').toLowerCase().includes(q) || (d.stock_code||'').toLowerCase().includes(q);
      }));
    }
    async function deleteDoc(id) {
      if (!confirm('确定删除该文档？将同时删除所有分块和向量数据。')) return;
      try {
        var resp = await fetch('/api/rag/documents/' + id, { method:'DELETE', headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success) { loadDocs(); if (currentDocId === id) backToList(); }
        else alert('删除失败: ' + (data.error || ''));
      } catch(e) { alert('删除失败'); }
    }

    // ---- Document detail / chunk browser ----
    async function viewDoc(docId) {
      currentDocId = docId;
      chunkOffset = 0;
      currentChunkType = '';
      document.getElementById('docListView').style.display = 'none';
      document.getElementById('docDetailView').style.display = 'block';

      // Load document meta
      try {
        var resp = await fetch('/api/rag/documents/' + docId, { headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success && data.document) {
          var doc = data.document;
          document.getElementById('detailDocTitle').textContent = doc.title || '未命名文档';
          document.getElementById('detailDocMeta').innerHTML =
            '<span><i class="fas fa-hashtag"></i> ID: ' + doc.id + '</span>' +
            (doc.stock_code ? '<span><i class="fas fa-chart-line"></i> ' + escapeHtml(doc.stock_code) + '</span>' : '') +
            '<span><i class="fas fa-tag"></i> ' + (categoryLabels[doc.category] || doc.category || '通用') + '</span>' +
            '<span><i class="fas fa-puzzle-piece"></i> ' + (doc.chunk_count || 0) + ' 分块</span>' +
            '<span><i class="fas fa-calendar"></i> ' + (doc.created_at ? new Date(doc.created_at).toLocaleDateString('zh-CN') : '-') + '</span>';
        }
      } catch(e) {}

      loadChunks();
    }

    async function loadChunks() {
      var container = document.getElementById('chunksContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载分块中...</div>';

      var params = new URLSearchParams();
      params.set('documentId', currentDocId);
      params.set('limit', chunkLimit);
      params.set('offset', chunkOffset);
      if (currentChunkType) params.set('type', currentChunkType);
      var search = document.getElementById('chunkSearch') ? document.getElementById('chunkSearch').value.trim() : '';
      if (search) params.set('search', search);

      try {
        var resp = await fetch('/api/rag/chunks?' + params.toString(), { headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success) {
          renderChunks(data.chunks || [], data.total || 0);
        } else {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">加载分块失败: ' + (data.error || '') + '</div>';
        }
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">加载分块失败</div>';
      }
    }

    function renderChunks(chunks, total) {
      var container = document.getElementById('chunksContainer');
      if (!chunks.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-puzzle-piece" style="font-size:28px;display:block;margin-bottom:10px;color:#334155;"></i>暂无分块</div>';
        return;
      }
      container.innerHTML = chunks.map(function(chunk) {
        var typeBadge = chunk.chunk_type === 'table' ?
          '<span style="padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.12);color:#fbbf24;font-size:10px;">表格</span>' :
          '<span style="padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.12);color:#60a5fa;font-size:10px;">文本</span>';
        return '<div class="rc-chunk-item">' +
          '<div class="rc-chunk-item-header">' +
            '<div class="rc-chunk-item-meta">' +
              '<span style="font-weight:600;color:#94a3b8;">#' + (chunk.chunk_index !== undefined ? chunk.chunk_index : chunk.id) + '</span>' +
              typeBadge +
              '<span>' + ((chunk.content || '').length) + ' 字</span>' +
              (chunk.page_range ? '<span><i class="fas fa-file-alt"></i> P.' + chunk.page_range + '</span>' : '') +
            '</div>' +
            '<div class="rc-chunk-item-actions">' +
              '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="findSimilar(' + chunk.id + ')" title="查找相似分块"><i class="fas fa-search"></i></button>' +
              '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="editChunk(' + chunk.id + ')" title="编辑"><i class="fas fa-edit"></i></button>' +
              '<button class="rc-btn rc-btn-sm rc-btn-danger" onclick="deleteChunk(' + chunk.id + ')" title="删除" style="padding:4px 8px;"><i class="fas fa-trash"></i></button>' +
            '</div>' +
          '</div>' +
          '<div class="rc-chunk-item-content" id="chunkContent' + chunk.id + '" onclick="toggleChunkExpand(this)">' + escapeHtml(chunk.content || '') + '</div>' +
          '</div>';
      }).join('');

      // Pagination
      var totalPages = Math.ceil(total / chunkLimit);
      var currentPage = Math.floor(chunkOffset / chunkLimit) + 1;
      var pagEl = document.getElementById('chunksPagination');
      if (totalPages > 1) {
        pagEl.innerHTML =
          '<span>第 ' + currentPage + ' / ' + totalPages + ' 页 (共 ' + total + ' 条)</span>' +
          '<div class="rc-pagination-buttons">' +
            '<button class="rc-pagination-btn" onclick="chunkPage(-1)"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>' +
            '<button class="rc-pagination-btn" onclick="chunkPage(1)"' + (currentPage >= totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>' +
          '</div>';
      } else {
        pagEl.innerHTML = '<span>共 ' + total + ' 条</span>';
      }
    }

    function chunkPage(dir) {
      chunkOffset = Math.max(0, chunkOffset + dir * chunkLimit);
      loadChunks();
    }

    function filterChunkType(type, el) {
      currentChunkType = type;
      chunkOffset = 0;
      document.querySelectorAll('#docDetailView .rc-tab').forEach(function(t) { t.classList.remove('active'); });
      el.classList.add('active');
      loadChunks();
    }

    var searchDebounce;
    function searchChunks() {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function() { chunkOffset = 0; loadChunks(); }, 400);
    }

    function toggleChunkExpand(el) {
      el.classList.toggle('expanded');
    }

    function backToList() {
      document.getElementById('docListView').style.display = 'block';
      document.getElementById('docDetailView').style.display = 'none';
      currentDocId = null;
    }

    // ---- Chunk edit ----
    var editingChunkId = null;
    function editChunk(chunkId) {
      editingChunkId = chunkId;
      document.getElementById('editChunkId').textContent = chunkId;
      document.getElementById('editStatus').innerHTML = '';

      // Load chunk content
      fetch('/api/rag/chunks/' + chunkId, { headers: getAuthHeaders() })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success && data.chunk) {
            document.getElementById('editChunkContent').value = data.chunk.content || '';
            document.getElementById('chunkEditModal').classList.add('show');
          } else {
            alert('无法加载分块内容');
          }
        })
        .catch(function() { alert('加载分块失败'); });
    }

    function closeEditModal() {
      document.getElementById('chunkEditModal').classList.remove('show');
      editingChunkId = null;
    }

    async function saveChunkEdit() {
      var content = document.getElementById('editChunkContent').value.trim();
      if (!content) { alert('内容不能为空'); return; }

      var btn = document.getElementById('saveChunkBtn');
      var status = document.getElementById('editStatus');
      btn.disabled = true;
      status.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#d4af37;"></i> 正在保存并重新向量化...';

      try {
        var resp = await fetch('/api/rag/chunks/' + editingChunkId, {
          method: 'PUT',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ content: content })
        });
        var data = await resp.json();
        if (data.success) {
          status.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 保存成功，向量已更新';
          setTimeout(function() { closeEditModal(); loadChunks(); }, 1200);
        } else {
          status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (data.error || '保存失败');
        }
      } catch(e) {
        status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> 保存失败';
      }
      btn.disabled = false;
    }

    // ---- Chunk delete ----
    async function deleteChunk(chunkId) {
      if (!confirm('确定删除该分块？向量数据也将一并删除。')) return;
      try {
        var resp = await fetch('/api/rag/chunks/' + chunkId, { method: 'DELETE', headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success) loadChunks();
        else alert('删除失败: ' + (data.error || ''));
      } catch(e) { alert('删除失败'); }
    }

    // ---- Similar chunks ----
    async function findSimilar(chunkId) {
      alert('正在搜索相似分块...');
      try {
        var resp = await fetch('/api/rag/chunks/' + chunkId + '/similar', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ topK: 5 })
        });
        var data = await resp.json();
        if (data.success && data.results.length) {
          var msg = '相似分块（Top ' + data.results.length + '）：\\n\\n';
          data.results.forEach(function(r, i) {
            msg += (i + 1) + '. [文档: ' + r.documentTitle + '] 相似度: ' + (r.score * 100).toFixed(1) + '%\\n' + (r.content || '').substring(0, 100) + '...\\n\\n';
          });
          alert(msg);
        } else {
          alert('未找到相似分块');
        }
      } catch(e) { alert('搜索失败'); }
    }

    // ---- Reindex ----
    async function reindexDoc() {
      if (!currentDocId) return;
      var btn = document.getElementById('reindexBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重建中...';
      try {
        var resp = await fetch('/api/rag/chunks/reindex/' + currentDocId, {
          method: 'POST', headers: getAuthHeaders()
        });
        var data = await resp.json();
        if (data.success) {
          btn.innerHTML = '<i class="fas fa-check"></i> 已重建 (' + (data.tokenCount || 0) + ' tokens)';
          setTimeout(function() { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> 重建索引'; }, 2000);
        } else {
          alert('重建失败: ' + (data.error || ''));
          btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> 重建索引';
        }
      } catch(e) {
        alert('重建失败');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> 重建索引';
      }
    }

    function deleteCurrentDoc() {
      if (currentDocId) deleteDoc(currentDocId);
    }

    loadDocs();
  `;

  return wrapWithRagLayout({
    title: '知识库浏览器',
    activePath: '/rag/knowledge-base',
    body,
    scripts,
    styles,
  });
}

// ============================================================
// P.4 Chat Assistant — Week 2 Enhanced (Pipeline visualization)
// ============================================================

export function generateRagChat(): string {
  const body = `
    ${ragPageHeader({
      title: '对话助手',
      icon: 'fas fa-comments',
      subtitle: '基于知识库的智能问答，支持混合检索（向量 + BM25）与 Pipeline 可视化',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '检索与问答' }, { label: '对话助手' }],
    })}

    <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;">
      <!-- Chat area -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="rc-card" style="padding:0;overflow:hidden;flex:1;">
          <div id="chatHistory" style="min-height:480px;max-height:640px;overflow-y:auto;padding:24px;"></div>
          <div style="border-top:1px solid rgba(148,163,184,0.1);padding:16px;background:rgba(15,23,42,0.3);">
            <div style="display:flex;gap:10px;">
              <input class="rc-input" id="questionInput" placeholder="基于知识库提问..." style="flex:1;" onkeypress="if(event.key==='Enter')sendQuestion()">
              <button class="rc-btn rc-btn-primary" onclick="sendQuestion()" id="sendBtn"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div style="margin-top:8px;font-size:11px;color:#475569;display:flex;align-items:center;gap:12px;">
              <span><i class="fas fa-brain" style="color:#a855f7;margin-right:4px;"></i>增强 RAG</span>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="checkbox" id="enableBm25" checked style="accent-color:#d4af37;"> BM25
              </label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="checkbox" id="enableRerank" style="accent-color:#d4af37;"> LLM 重排
              </label>
              <span id="queryStatus"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Pipeline visualization -->
        <div class="rc-card" id="pipelineCard" style="display:none;">
          <div class="rc-card-title" style="margin-bottom:12px;"><i class="fas fa-stream"></i> Pipeline 工作流</div>
          <div id="pipelineSteps">
            <div class="rc-pipeline-step" id="pStep1"><div class="rc-pipeline-dot"></div><div class="rc-pipeline-info"><div class="rc-pipeline-name">意图识别</div><div class="rc-pipeline-time" id="pTime1">-</div></div></div>
            <div class="rc-pipeline-step" id="pStep2"><div class="rc-pipeline-dot"></div><div class="rc-pipeline-info"><div class="rc-pipeline-name">向量检索</div><div class="rc-pipeline-time" id="pTime2">-</div></div></div>
            <div class="rc-pipeline-step" id="pStep3"><div class="rc-pipeline-dot"></div><div class="rc-pipeline-info"><div class="rc-pipeline-name">BM25 检索</div><div class="rc-pipeline-time" id="pTime3">-</div></div></div>
            <div class="rc-pipeline-step" id="pStep4"><div class="rc-pipeline-dot"></div><div class="rc-pipeline-info"><div class="rc-pipeline-name">去重合并</div><div class="rc-pipeline-time" id="pTime4">-</div></div></div>
            <div class="rc-pipeline-step" id="pStep5"><div class="rc-pipeline-dot"></div><div class="rc-pipeline-info"><div class="rc-pipeline-name">LLM 生成</div><div class="rc-pipeline-time" id="pTime5">-</div></div></div>
          </div>
          <div id="pipelineSummary" style="margin-top:10px;padding:8px;background:rgba(15,23,42,0.4);border-radius:6px;font-size:11px;color:#64748b;display:none;">
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;">
              <span>意图类型:</span><span id="psIntent" style="color:#a855f7;font-weight:500;">-</span>
              <span>检索合计:</span><span id="psRetrieved" style="color:#3b82f6;">-</span>
              <span>去重后:</span><span id="psDedup" style="color:#22c55e;">-</span>
              <span>总耗时:</span><span id="psLatency" style="color:#d4af37;font-weight:600;">-</span>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="rc-card">
          <div class="rc-card-title"><i class="fas fa-chart-pie"></i> 知识库统计</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:rgba(15,23,42,0.4);border-radius:8px;padding:12px;text-align:center;">
              <div id="statDocs" style="font-size:22px;font-weight:700;color:#3b82f6;">-</div>
              <div style="font-size:11px;color:#64748b;">文档数</div>
            </div>
            <div style="background:rgba(15,23,42,0.4);border-radius:8px;padding:12px;text-align:center;">
              <div id="statChunks" style="font-size:22px;font-weight:700;color:#22c55e;">-</div>
              <div style="font-size:11px;color:#64748b;">分块数</div>
            </div>
          </div>
        </div>

        <!-- Sources -->
        <div class="rc-card" style="flex:1;">
          <div class="rc-card-title"><i class="fas fa-quote-left"></i> 引用来源</div>
          <div id="sourcesPanel" style="max-height:400px;overflow-y:auto;">
            <div style="text-align:center;padding:24px;color:#475569;font-size:13px;">提问后将显示引用来源</div>
          </div>
        </div>
      </div>
    </div>`;

  const styles = `
    .rc-pipeline-step { display:flex;align-items:center;gap:10px;padding:6px 0;position:relative; }
    .rc-pipeline-step:not(:last-child)::after { content:'';position:absolute;left:7px;top:26px;width:2px;height:calc(100% - 12px);background:rgba(148,163,184,0.1); }
    .rc-pipeline-dot { width:16px;height:16px;border-radius:50%;border:2px solid rgba(148,163,184,0.2);background:transparent;flex-shrink:0;transition:all 0.3s;position:relative;z-index:1; }
    .rc-pipeline-step.running .rc-pipeline-dot { border-color:#d4af37;background:rgba(212,175,55,0.2);box-shadow:0 0 8px rgba(212,175,55,0.3); }
    .rc-pipeline-step.done .rc-pipeline-dot { border-color:#4ade80;background:#4ade80; }
    .rc-pipeline-step.done::after { background:rgba(74,222,128,0.3); }
    .rc-pipeline-step.error .rc-pipeline-dot { border-color:#f87171;background:#f87171; }
    .rc-pipeline-info { flex:1;display:flex;justify-content:space-between;align-items:center; }
    .rc-pipeline-name { font-size:12px;color:#94a3b8; }
    .rc-pipeline-step.done .rc-pipeline-name { color:#e2e8f0; }
    .rc-pipeline-time { font-size:11px;color:#475569;font-family:monospace; }
    .rc-pipeline-step.done .rc-pipeline-time { color:#d4af37; }
    .rc-source-card { background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px;margin-bottom:8px;transition:border-color 0.15s;cursor:pointer; }
    .rc-source-card:hover { border-color:rgba(59,130,246,0.35); }
    .rc-source-card.bm25 { background:rgba(34,197,94,0.06);border-color:rgba(34,197,94,0.15); }
    .rc-source-card.bm25:hover { border-color:rgba(34,197,94,0.35); }
    .rc-source-card.both { background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.15); }
    .rc-source-card.both:hover { border-color:rgba(168,85,247,0.35); }
    @media (max-width: 1023px) {
      .rag-main > div:last-child { grid-template-columns: 1fr !important; }
    }
  `;

  const scripts = `
    var conversationHistory = [];
    var currentSessionId = null;
    var isProcessing = false;
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function scrollChat() { var el = document.getElementById('chatHistory'); setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50); }

    // Welcome message
    document.getElementById('chatHistory').innerHTML =
      '<div style="display:flex;gap:10px;">' +
      '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-brain" style="color:white;font-size:14px;"></i></div>' +
      '<div style="background:rgba(51,65,85,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;border-top-left-radius:4px;padding:14px;max-width:80%;font-size:13px;color:#cbd5e1;">' +
      '<p style="font-weight:600;color:#e2e8f0;margin-bottom:6px;">你好！我是 RAG 知识库助手 (增强版)</p>' +
      '<p>我基于向量 + BM25 混合检索来回答你的问题，支持意图识别和 Pipeline 可视化。</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;">' +
      '<button onclick="askPreset(this.textContent)" class="rc-preset-btn">这家公司的营业收入是多少？</button>' +
      '<button onclick="askPreset(this.textContent)" class="rc-preset-btn">公司的主要风险有哪些？</button>' +
      '<button onclick="askPreset(this.textContent)" class="rc-preset-btn">毛利率和净利率的变化趋势？</button>' +
      '<button onclick="askPreset(this.textContent)" class="rc-preset-btn">分析公司的竞争优势</button>' +
      '</div></div></div>';

    function askPreset(q) { document.getElementById('questionInput').value = q; sendQuestion(); }

    // ---- Pipeline visualization helpers ----
    function resetPipeline() {
      for (var i = 1; i <= 5; i++) {
        var step = document.getElementById('pStep' + i);
        step.className = 'rc-pipeline-step';
        document.getElementById('pTime' + i).textContent = '-';
      }
      document.getElementById('pipelineSummary').style.display = 'none';
    }
    function setPipelineStep(stepIdx, status, time) {
      var step = document.getElementById('pStep' + stepIdx);
      step.className = 'rc-pipeline-step ' + status;
      if (time) document.getElementById('pTime' + stepIdx).textContent = time;
    }
    function showPipelineData(pipeline) {
      document.getElementById('pipelineCard').style.display = 'block';
      resetPipeline();

      // Intent
      if (pipeline.intent) {
        setPipelineStep(1, 'done', pipeline.intent.latencyMs + 'ms');
      }
      // Vector
      setPipelineStep(2, 'done', pipeline.vectorResults + ' 条');
      // BM25
      if (pipeline.bm25Results !== undefined) {
        setPipelineStep(3, 'done', pipeline.bm25Results + ' 条');
      } else {
        setPipelineStep(3, 'done', '跳过');
      }
      // Dedup
      setPipelineStep(4, 'done', pipeline.dedupCount + ' 条');
      // LLM
      setPipelineStep(5, 'done', pipeline.totalLatencyMs + 'ms');

      // Summary
      var summary = document.getElementById('pipelineSummary');
      summary.style.display = 'block';
      document.getElementById('psIntent').textContent = (pipeline.intent ? pipeline.intent.type : '-') + (pipeline.intent && pipeline.intent.confidence ? ' (' + Math.round(pipeline.intent.confidence * 100) + '%)' : '');
      document.getElementById('psRetrieved').textContent = 'V:' + (pipeline.vectorResults || 0) + ' + B:' + (pipeline.bm25Results || 0);
      document.getElementById('psDedup').textContent = pipeline.dedupCount || 0;
      document.getElementById('psLatency').textContent = (pipeline.totalLatencyMs / 1000).toFixed(2) + 's';
    }

    // ---- Send question via enhanced API ----
    async function sendQuestion() {
      var input = document.getElementById('questionInput');
      var question = input.value.trim();
      if (!question || isProcessing) return;
      isProcessing = true;
      input.value = '';
      document.getElementById('sendBtn').disabled = true;

      // User bubble
      var chat = document.getElementById('chatHistory');
      chat.innerHTML += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">' +
        '<div style="background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:12px;border-top-right-radius:4px;padding:12px;max-width:75%;font-size:13px;color:white;">' + escapeHtml(question) + '</div>' +
        '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-user" style="color:white;font-size:13px;"></i></div></div>';

      // Loading
      var loadId = 'ld-' + Date.now();
      chat.innerHTML += '<div id="' + loadId + '" style="display:flex;gap:10px;margin-top:12px;">' +
        '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-brain" style="color:white;font-size:14px;"></i></div>' +
        '<div style="background:rgba(51,65,85,0.6);border-radius:12px;border-top-left-radius:4px;padding:14px;"><i class="fas fa-spinner fa-spin" style="color:#64748b;"></i><span style="margin-left:8px;font-size:12px;color:#64748b;">Pipeline 执行中...</span></div></div>';
      scrollChat();

      // Start pipeline animation
      document.getElementById('pipelineCard').style.display = 'block';
      resetPipeline();
      setPipelineStep(1, 'running', '...');
      document.getElementById('queryStatus').innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:4px;"></i>Pipeline 执行中...';

      var enableBm25 = document.getElementById('enableBm25').checked;
      var enableRerank = document.getElementById('enableRerank').checked;

      try {
        var resp = await fetch('/api/rag/query/enhanced', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({
            question: question,
            sessionId: currentSessionId,
            config: {
              enableBm25: enableBm25,
              enableRerank: enableRerank,
              topK: 5,
              minScore: 0.25,
            },
            conversationHistory: conversationHistory
          })
        });
        var data = await resp.json();
        var loading = document.getElementById(loadId);
        if (loading) loading.remove();

        if (data.success) {
          currentSessionId = data.sessionId;

          // Show Pipeline data
          if (data.pipeline) showPipelineData(data.pipeline);

          // Render answer with simple markdown
          var answer = (data.answer || '').replace(/\\*\\*(.+?)\\*\\*/g, '<strong style="color:#fbbf24;">$1</strong>').replace(/\\n/g, '<br>');
          chat.innerHTML += '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-brain" style="color:white;font-size:14px;"></i></div>' +
            '<div style="background:rgba(51,65,85,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;border-top-left-radius:4px;padding:14px;max-width:80%;font-size:13px;color:#cbd5e1;line-height:1.7;">' + answer + '</div></div>';
          conversationHistory.push({ role:'user', content:question }, { role:'assistant', content: data.answer });

          // Sources with type badge
          var sp = document.getElementById('sourcesPanel');
          if (data.sources && data.sources.length) {
            sp.innerHTML = data.sources.map(function(s, i) {
              var srcLabel = s.source === 'both' ? '混合' : (s.source === 'bm25' ? 'BM25' : '向量');
              var srcClass = s.source === 'both' ? 'both' : (s.source === 'bm25' ? 'bm25' : '');
              var scorePct = Math.round((s.relevanceScore || 0) * 100);
              return '<div class="rc-source-card ' + srcClass + '">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
                  '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.15);color:#60a5fa;">来源' + (i+1) + '</span>' +
                  '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(168,85,247,0.12);color:#a855f7;">' + srcLabel + '</span>' +
                  '<span style="font-size:10px;color:#475569;">' + scorePct + '%</span>' +
                '</div>' +
                '<div style="font-size:11px;color:#94a3b8;font-weight:500;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(s.documentTitle||'') + '</div>' +
                '<p style="font-size:11px;color:#64748b;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5;">' + escapeHtml(s.chunkContent||'') + '</p>' +
                (s.pageRange ? '<div style="font-size:10px;color:#475569;margin-top:4px;"><i class="fas fa-file-alt"></i> P.' + s.pageRange + '</div>' : '') +
                '</div>';
            }).join('');
          }
          document.getElementById('queryStatus').innerHTML = '<i class="fas fa-check" style="color:#4ade80;margin-right:4px;"></i>' + (data.sources ? data.sources.length : 0) + ' 个来源 | ' + ((data.pipeline ? data.pipeline.totalLatencyMs : 0) / 1000).toFixed(1) + 's';
        } else {
          chat.innerHTML += '<div style="display:flex;gap:10px;margin-top:12px;"><div style="background:rgba(239,68,68,0.1);border-radius:12px;padding:14px;font-size:13px;color:#f87171;">查询失败: ' + escapeHtml(data.error||'未知错误') + '</div></div>';
          document.getElementById('queryStatus').textContent = '';
        }
      } catch(e) {
        var loading2 = document.getElementById(loadId);
        if (loading2) loading2.remove();
        chat.innerHTML += '<div style="padding:12px;color:#f87171;font-size:13px;">查询出错: ' + escapeHtml(e.message) + '</div>';
        document.getElementById('queryStatus').textContent = '';
      }
      scrollChat();
      isProcessing = false;
      document.getElementById('sendBtn').disabled = false;
    }

    // Load stats
    (async function() {
      try {
        var resp = await fetch('/api/rag/stats', { headers: getAuthHeaders() });
        var data = await resp.json();
        if (data.success || data.completedDocuments !== undefined) {
          document.getElementById('statDocs').textContent = (data.completedDocuments || data.totalDocuments || 0);
          document.getElementById('statChunks').textContent = (data.totalChunks || 0);
        }
      } catch(e) {}
    })();
  `;

  return wrapWithRagLayout({
    title: '对话助手',
    activePath: '/rag/chat',
    body,
    scripts,
    styles,
  });
}

// ============================================================
// Coming Soon pages (P.3, P.5 ~ P.16)
// ============================================================

export function generateRagChunkEnhance(): string {
  const body = `
    ${ragPageHeader({
      title: 'Chunk 质量增强',
      icon: 'fas fa-magic',
      subtitle: 'HyDE 问题改写 + 摘要增强 + 实体标注 — 提升检索召回率的核心工具',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '数据管理' }, { label: 'Chunk 质量增强' }],
    })}

    <!-- Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;" id="enhanceStatsRow">
      ${ragKpiCard({ id: 'stat-total', label: '总 Chunk 数', value: '-', icon: 'fas fa-puzzle-piece', color: '#3b82f6' })}
      ${ragKpiCard({ id: 'stat-questions', label: '已生成问题', value: '-', icon: 'fas fa-question-circle', color: '#8b5cf6' })}
      ${ragKpiCard({ id: 'stat-summaries', label: '已生成摘要', value: '-', icon: 'fas fa-align-left', color: '#10b981' })}
      ${ragKpiCard({ id: 'stat-entities', label: '已标注实体', value: '-', icon: 'fas fa-tags', color: '#f59e0b' })}
      ${ragKpiCard({ id: 'stat-qcount', label: '问题总数', value: '-', icon: 'fas fa-list-ol', color: '#ef4444' })}
    </div>

    <!-- Strategy Cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;" id="strategyCards">
      <div class="rc-card enhance-strategy-card" data-strategy="hyde_questions" onclick="selectStrategy('hyde_questions')" style="cursor:pointer;border:2px solid transparent;transition:all .2s;">
        <div style="text-align:center;padding:20px 16px;">
          <div style="font-size:36px;color:#3b82f6;margin-bottom:12px;"><i class="fas fa-question-circle"></i></div>
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;">HyDE 问题改写</h3>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">为每个 Chunk 生成 3~5 个假设性查询问题，构建问题→Chunk 反向索引，大幅提升检索召回率</p>
        </div>
      </div>
      <div class="rc-card enhance-strategy-card" data-strategy="summary" onclick="selectStrategy('summary')" style="cursor:pointer;border:2px solid transparent;transition:all .2s;">
        <div style="text-align:center;padding:20px 16px;">
          <div style="font-size:36px;color:#10b981;margin-bottom:12px;"><i class="fas fa-align-left"></i></div>
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;">摘要增强</h3>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">为每个 Chunk 生成 50~100 字结构化摘要 + 关键词列表，辅助粗排和展示</p>
        </div>
      </div>
      <div class="rc-card enhance-strategy-card" data-strategy="entity_tagging" onclick="selectStrategy('entity_tagging')" style="cursor:pointer;border:2px solid transparent;transition:all .2s;">
        <div style="text-align:center;padding:20px 16px;">
          <div style="font-size:36px;color:#f59e0b;margin-bottom:12px;"><i class="fas fa-tags"></i></div>
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;">自动实体标注</h3>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">自动提取命名实体(公司/人名/指标/日期) + 主题标签，支持精确筛选</p>
        </div>
      </div>
    </div>

    <!-- Config Panel (shown after selecting strategy) -->
    <div id="configPanel" class="rc-card" style="display:none;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:15px;"><i class="fas fa-cog" style="color:#3b82f6;margin-right:8px;"></i>增强配置</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <label class="rc-label">目标文档</label>
          <select class="rc-input" id="enhDocSelect" style="width:100%;"><option value="">全部文档</option></select>
        </div>
        <div>
          <label class="rc-label">当前策略</label>
          <input class="rc-input" id="enhStrategyName" readonly style="width:100%;background:#f1f5f9;">
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:16px;">
        <button class="rc-btn rc-btn-secondary" onclick="runDryRun()" id="dryRunBtn"><i class="fas fa-flask"></i> 试运行 (3 Chunk)</button>
        <button class="rc-btn rc-btn-primary" onclick="runBatch()" id="batchBtn" disabled><i class="fas fa-rocket"></i> 批量增强</button>
      </div>
    </div>

    <!-- Dry Run Results -->
    <div id="dryRunResults" style="display:none;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:15px;"><i class="fas fa-eye" style="color:#8b5cf6;margin-right:8px;"></i>试运行结果</h3>
      <div id="dryRunList"></div>
    </div>

    <!-- Batch Progress -->
    <div id="batchProgress" class="rc-card" style="display:none;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;font-size:15px;"><i class="fas fa-tasks" style="color:#10b981;margin-right:8px;"></i>批量处理进度</h3>
      <div style="background:#e2e8f0;border-radius:8px;height:24px;overflow:hidden;margin-bottom:12px;">
        <div id="batchBar" style="height:100%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);width:0%;transition:width .3s;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;">0%</div>
      </div>
      <div style="display:flex;gap:24px;font-size:13px;color:#64748b;">
        <span>已处理: <strong id="batchProcessed">0</strong> / <strong id="batchTotal">0</strong></span>
        <span>Token 消耗: <strong id="batchTokens">0</strong></span>
        <span>状态: <strong id="batchStatus">等待中</strong></span>
      </div>
    </div>
  `;

  const styles = `
    .enhance-strategy-card:hover { border-color: #3b82f6 !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59,130,246,.15); }
    .enhance-strategy-card.selected { border-color: #3b82f6 !important; background: #eff6ff; }
    .dry-run-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .quality-stars { color: #f59e0b; font-size: 14px; }
  `;

  const scripts = `
    let selectedStrategy = null;
    let currentTaskId = null;

    async function loadEnhanceStats() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/enhance/stats', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success) {
          document.querySelector('#stat-total .kpi-value')&&(document.querySelector('#stat-total .kpi-value').textContent = d.data.total_chunks);
          document.querySelector('#stat-questions .kpi-value')&&(document.querySelector('#stat-questions .kpi-value').textContent = d.data.with_questions);
          document.querySelector('#stat-summaries .kpi-value')&&(document.querySelector('#stat-summaries .kpi-value').textContent = d.data.with_summary);
          document.querySelector('#stat-entities .kpi-value')&&(document.querySelector('#stat-entities .kpi-value').textContent = d.data.with_entities);
          document.querySelector('#stat-qcount .kpi-value')&&(document.querySelector('#stat-qcount .kpi-value').textContent = d.data.question_count);
        }
      } catch(e) { console.warn('Failed to load enhance stats', e); }
    }

    async function loadDocuments() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/documents?limit=100', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success && d.data) {
          const sel = document.getElementById('enhDocSelect');
          d.data.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.title || 'Document #' + doc.id;
            sel.appendChild(opt);
          });
        }
      } catch(e) {}
    }

    function selectStrategy(s) {
      selectedStrategy = s;
      document.querySelectorAll('.enhance-strategy-card').forEach(c => c.classList.remove('selected'));
      document.querySelector('[data-strategy="'+s+'"]').classList.add('selected');
      const names = { hyde_questions: 'HyDE 问题改写', summary: '摘要增强', entity_tagging: '自动实体标注' };
      document.getElementById('enhStrategyName').value = names[s] || s;
      document.getElementById('configPanel').style.display = 'block';
      document.getElementById('dryRunResults').style.display = 'none';
      document.getElementById('batchProgress').style.display = 'none';
      document.getElementById('batchBtn').disabled = true;
    }

    async function runDryRun() {
      if (!selectedStrategy) return;
      const btn = document.getElementById('dryRunBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 试运行中...';
      try {
        const token = localStorage.getItem('auth_token') || '';
        const docId = document.getElementById('enhDocSelect').value;
        const body = { strategy: selectedStrategy };
        if (docId) body.document_id = Number(docId);
        const r = await fetch('/api/rag/knowledge/enhance/dry-run', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success && d.data) {
          renderDryRunResults(d.data);
          document.getElementById('batchBtn').disabled = false;
        } else { alert(d.error || 'Dry run failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-flask"></i> 试运行 (3 Chunk)';
    }

    function renderDryRunResults(results) {
      const container = document.getElementById('dryRunList');
      container.innerHTML = results.map((r,i) => {
        const stars = '★'.repeat(Math.round(r.quality_score)) + '☆'.repeat(5 - Math.round(r.quality_score));
        let resultHtml = '';
        if (selectedStrategy === 'hyde_questions') {
          const qs = Array.isArray(r.result) ? r.result.map(q => '<li>' + escHtml(q.question || q) + '</li>').join('') : '';
          resultHtml = '<ul style="margin:8px 0;padding-left:20px;font-size:13px;">' + qs + '</ul>';
        } else if (selectedStrategy === 'summary') {
          const s = r.result;
          resultHtml = '<p style="font-size:13px;margin:8px 0;">' + escHtml(s.summary || '') + '</p><div style="font-size:12px;color:#64748b;">关键词: ' + (s.keywords||[]).join(', ') + '</div>';
        } else {
          const t = r.result;
          resultHtml = '<div style="font-size:13px;margin:8px 0;"><strong>实体:</strong> ' + (t.entities||[]).map(e=>e.name+'('+e.type+')').join(', ') + '<br><strong>主题:</strong> ' + (t.topics||[]).join(', ') + '</div>';
        }
        return '<div class="dry-run-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:13px;color:#64748b;">Chunk #'+r.chunk_id+'</span><span class="quality-stars">'+stars+'</span></div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">'+escHtml(r.chunk_content_preview)+'...</div>'+resultHtml+'<div style="font-size:11px;color:#94a3b8;margin-top:8px;">Token: '+r.tokens_used+' | 耗时: '+r.latency_ms+'ms</div></div>';
      }).join('');
      document.getElementById('dryRunResults').style.display = 'block';
    }

    async function runBatch() {
      if (!selectedStrategy) return;
      if (!confirm('确定要开始批量增强？此操作将消耗 Token 并可能需要较长时间。')) return;
      const btn = document.getElementById('batchBtn');
      btn.disabled = true;
      document.getElementById('batchProgress').style.display = 'block';
      document.getElementById('batchStatus').textContent = '运行中';
      try {
        const token = localStorage.getItem('auth_token') || '';
        const docId = document.getElementById('enhDocSelect').value;
        const body = { strategy: selectedStrategy };
        if (docId) body.document_id = Number(docId);
        const r = await fetch('/api/rag/knowledge/enhance/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success && d.data) {
          const data = d.data;
          document.getElementById('batchProcessed').textContent = data.success_count;
          document.getElementById('batchTotal').textContent = data.total_chunks;
          document.getElementById('batchTokens').textContent = data.total_tokens;
          document.getElementById('batchStatus').textContent = '已完成';
          const pct = data.total_chunks > 0 ? Math.round(data.success_count / data.total_chunks * 100) : 0;
          document.getElementById('batchBar').style.width = pct + '%';
          document.getElementById('batchBar').textContent = pct + '%';
          loadEnhanceStats();
        } else { document.getElementById('batchStatus').textContent = '失败: ' + (d.error || ''); }
      } catch(e) { document.getElementById('batchStatus').textContent = '错误: ' + e.message; }
      btn.disabled = false;
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    loadEnhanceStats();
    loadDocuments();
  `;

  return wrapWithRagLayout({ title: 'Chunk 质量增强', activePath: '/rag/chunk-enhance', styles, body, scripts });
}

export function generateRagKnowledgeSettle(): string {
  const body = `
    ${ragPageHeader({
      title: '对话知识沉淀',
      icon: 'fas fa-archive',
      subtitle: '从高质量问答对话中自动提取知识 → 过滤 → 合并 → 审核 → 入库，形成持续优化闭环',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '数据管理' }, { label: '对话知识沉淀' }],
    })}

    <!-- Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;" id="ksStatsRow">
      ${ragKpiCard({ id: 'ks-total', label: '已提取', value: '-', icon: 'fas fa-download', color: '#3b82f6' })}
      ${ragKpiCard({ id: 'ks-pending', label: '待审核', value: '-', icon: 'fas fa-clock', color: '#f59e0b' })}
      ${ragKpiCard({ id: 'ks-accepted', label: '已接受', value: '-', icon: 'fas fa-check-circle', color: '#10b981' })}
      ${ragKpiCard({ id: 'ks-settled', label: '已沉淀', value: '-', icon: 'fas fa-archive', color: '#8b5cf6' })}
      ${ragKpiCard({ id: 'ks-applied', label: '已入库', value: '-', icon: 'fas fa-database', color: '#ef4444' })}
    </div>

    <!-- Tab Bar -->
    <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:0;">
      <button class="ks-tab active" onclick="switchKsTab('extract')" id="tabExtract" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-download"></i> 知识提取
      </button>
      <button class="ks-tab" onclick="switchKsTab('review')" id="tabReview" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-clipboard-check"></i> 审核与合并
      </button>
      <button class="ks-tab" onclick="switchKsTab('settled')" id="tabSettled" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-archive"></i> 已沉淀知识
      </button>
    </div>

    <!-- Extract Panel -->
    <div id="panelExtract">
      <div class="rc-card" style="margin-bottom:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;"><i class="fas fa-robot" style="color:#3b82f6;margin-right:8px;"></i>批量知识提取</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:flex-end;">
          <div><label class="rc-label">开始日期</label><input class="rc-input" id="ksFromDate" type="date" style="width:100%;"></div>
          <div><label class="rc-label">结束日期</label><input class="rc-input" id="ksToDate" type="date" style="width:100%;"></div>
          <div><label class="rc-label">最多处理</label><input class="rc-input" id="ksLimit" type="number" value="30" min="1" max="100" style="width:100%;"></div>
          <button class="rc-btn rc-btn-primary" onclick="runBatchExtract()" id="batchExtractBtn"><i class="fas fa-magic"></i> 开始提取</button>
        </div>
      </div>
      <div id="extractResult" style="display:none;" class="rc-card">
        <div style="display:flex;gap:24px;font-size:13px;color:#64748b;">
          <span>处理对话: <strong id="exProcessed">0</strong></span>
          <span>提取条目: <strong id="exItems">0</strong></span>
          <span>Token 消耗: <strong id="exTokens">0</strong></span>
        </div>
      </div>
    </div>

    <!-- Review Panel -->
    <div id="panelReview" style="display:none;">
      <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;">
        <select class="rc-input" id="ksTypeFilter" onchange="loadExtracted()" style="width:150px;">
          <option value="">全部类型</option>
          <option value="fact">事实</option>
          <option value="procedure">流程</option>
          <option value="definition">定义</option>
          <option value="rule">规则</option>
          <option value="insight">洞察</option>
        </select>
        <select class="rc-input" id="ksStatusFilter" onchange="loadExtracted()" style="width:150px;">
          <option value="pending">待审核</option>
          <option value="accepted">已接受</option>
          <option value="rejected">已拒绝</option>
          <option value="">全部状态</option>
        </select>
        <button class="rc-btn rc-btn-secondary" onclick="mergeSelected()" id="mergeBtn" disabled><i class="fas fa-compress-arrows-alt"></i> 合并选中</button>
      </div>
      <div id="extractedList"></div>
    </div>

    <!-- Settled Panel -->
    <div id="panelSettled" style="display:none;">
      <div id="settledList"></div>
    </div>
  `;

  const styles = `
    .ks-tab.active { color: #3b82f6; border-bottom-color: #3b82f6 !important; font-weight: 600; }
    .ks-tab:hover { color: #3b82f6; }
    .knowledge-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; transition: all .2s; }
    .knowledge-card:hover { border-color: #cbd5e1; }
    .knowledge-card.selected-for-merge { border-color: #8b5cf6; background: #f5f3ff; }
    .type-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .type-fact { background: #dbeafe; color: #1d4ed8; }
    .type-procedure { background: #dcfce7; color: #15803d; }
    .type-definition { background: #fef3c7; color: #92400e; }
    .type-rule { background: #fce7f3; color: #9d174d; }
    .type-insight { background: #e0e7ff; color: #3730a3; }
  `;

  const scripts = `
    let ksCurrentTab = 'extract';
    let selectedForMerge = new Set();

    function switchKsTab(tab) {
      ksCurrentTab = tab;
      ['extract','review','settled'].forEach(t => {
        document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
        document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
      });
      if (tab === 'review') loadExtracted();
      if (tab === 'settled') loadSettled();
    }

    async function loadKsStats() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/knowledge/stats', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success) {
          const s = d.data;
          document.querySelector('#ks-total .kpi-value')&&(document.querySelector('#ks-total .kpi-value').textContent = s.total_extracted);
          document.querySelector('#ks-pending .kpi-value')&&(document.querySelector('#ks-pending .kpi-value').textContent = s.pending_review);
          document.querySelector('#ks-accepted .kpi-value')&&(document.querySelector('#ks-accepted .kpi-value').textContent = s.accepted);
          document.querySelector('#ks-settled .kpi-value')&&(document.querySelector('#ks-settled .kpi-value').textContent = s.settled);
          document.querySelector('#ks-applied .kpi-value')&&(document.querySelector('#ks-applied .kpi-value').textContent = s.applied);
        }
      } catch(e) {}
    }

    async function runBatchExtract() {
      const btn = document.getElementById('batchExtractBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提取中...';
      try {
        const token = localStorage.getItem('auth_token') || '';
        const body = { limit: Number(document.getElementById('ksLimit').value) || 30 };
        const from = document.getElementById('ksFromDate').value;
        const to = document.getElementById('ksToDate').value;
        if (from) body.from_date = from;
        if (to) body.to_date = to;
        const r = await fetch('/api/rag/knowledge/knowledge/batch-extract', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
          document.getElementById('extractResult').style.display = 'block';
          document.getElementById('exProcessed').textContent = d.data.processed;
          document.getElementById('exItems').textContent = d.data.total_items_extracted;
          document.getElementById('exTokens').textContent = d.data.total_tokens;
          loadKsStats();
        } else { alert(d.error || 'Extraction failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 开始提取';
    }

    async function loadExtracted() {
      const token = localStorage.getItem('auth_token') || '';
      const type = document.getElementById('ksTypeFilter').value;
      const status = document.getElementById('ksStatusFilter').value;
      let url = '/api/rag/knowledge/knowledge/extracted?limit=50';
      if (type) url += '&knowledge_type=' + type;
      if (status) url += '&status=' + status;
      try {
        const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success) renderExtracted(d.data || []);
      } catch(e) {}
    }

    function renderExtracted(items) {
      const container = document.getElementById('extractedList');
      if (!items.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-inbox" style="font-size:32px;margin-bottom:12px;display:block;"></i>暂无数据</div>'; return; }
      container.innerHTML = items.map(item => {
        const typeClass = 'type-' + item.knowledge_type;
        return '<div class="knowledge-card" data-id="'+item.id+'" onclick="toggleMergeSelect(this,'+item.id+')">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
          + '<div><span class="type-badge '+typeClass+'">'+item.knowledge_type+'</span> <strong style="margin-left:8px;">'+escHtml(item.title)+'</strong></div>'
          + '<div style="font-size:12px;color:#94a3b8;">置信度: '+Math.round(item.confidence*100)+'%</div></div>'
          + '<p style="font-size:13px;color:#475569;margin:0 0 8px;line-height:1.6;">'+escHtml(item.content)+'</p>'
          + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
          + (item.status === 'pending' ? '<button class="rc-btn rc-btn-sm" onclick="event.stopPropagation();reviewItem('+item.id+',\\'accept\\')"><i class="fas fa-check"></i> 接受</button><button class="rc-btn rc-btn-sm rc-btn-secondary" onclick="event.stopPropagation();reviewItem('+item.id+',\\'reject\\')"><i class="fas fa-times"></i> 拒绝</button>' : '<span style="font-size:12px;color:#94a3b8;">'+item.status+'</span>')
          + '</div></div>';
      }).join('');
    }

    function toggleMergeSelect(el, id) {
      if (selectedForMerge.has(id)) { selectedForMerge.delete(id); el.classList.remove('selected-for-merge'); }
      else { selectedForMerge.add(id); el.classList.add('selected-for-merge'); }
      document.getElementById('mergeBtn').disabled = selectedForMerge.size < 2;
    }

    async function reviewItem(id, action) {
      try {
        const token = localStorage.getItem('auth_token') || '';
        await fetch('/api/rag/knowledge/knowledge/'+id+'/review', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action })
        });
        loadExtracted(); loadKsStats();
      } catch(e) { alert('Error: ' + e.message); }
    }

    async function mergeSelected() {
      if (selectedForMerge.size < 2) return;
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/knowledge/merge', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ ids: Array.from(selectedForMerge) })
        });
        const d = await r.json();
        if (d.success) { selectedForMerge.clear(); loadExtracted(); loadKsStats(); alert('合并成功: ' + d.data.merged_title); }
        else { alert(d.error || 'Merge failed'); }
      } catch(e) { alert('Error: ' + e.message); }
    }

    async function loadSettled() {
      const token = localStorage.getItem('auth_token') || '';
      try {
        const r = await fetch('/api/rag/knowledge/knowledge/settled?limit=50', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success) {
          const items = d.data || [];
          const container = document.getElementById('settledList');
          if (!items.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-archive" style="font-size:32px;margin-bottom:12px;display:block;"></i>暂无已沉淀知识</div>'; return; }
          container.innerHTML = items.map(item => {
            const typeClass = 'type-' + item.knowledge_type;
            return '<div class="knowledge-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div><span class="type-badge '+typeClass+'">'+item.knowledge_type+'</span> <strong style="margin-left:8px;">'+escHtml(item.title)+'</strong></div><span style="font-size:12px;padding:2px 8px;border-radius:4px;background:'+(item.status==='applied'?'#dcfce7;color:#15803d':'#fef3c7;color:#92400e')+';">'+item.status+'</span></div><p style="font-size:13px;color:#475569;margin:0 0 8px;line-height:1.6;">'+escHtml(item.content)+'</p><div style="font-size:12px;color:#94a3b8;">来源数: '+item.source_count+' | 创建: '+item.created_at+'</div></div>';
          }).join('');
        }
      } catch(e) {}
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

    loadKsStats();
  `;

  return wrapWithRagLayout({ title: '对话知识沉淀', activePath: '/rag/knowledge-settle', styles, body, scripts });
}

export function generateRagRetrievalDebug(): string {
  const body = `
    ${ragPageHeader({
      title: '检索调试台',
      icon: 'fas fa-flask',
      subtitle: '并行对比向量检索与 BM25 关键词检索结果，可视化调试检索参数',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '检索与问答' }, { label: '检索调试台' }],
    })}

    <!-- Query input -->
    <div class="rc-card" style="margin-bottom:20px;">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <div style="flex:1;min-width:300px;">
          <label class="rc-label">检索查询</label>
          <input class="rc-input" id="debugQuery" placeholder="输入要测试的问题或关键词..." onkeypress="if(event.key==='Enter')runDebugSearch()">
        </div>
        <div style="min-width:120px;">
          <label class="rc-label">向量 TopK</label>
          <input class="rc-input" id="vecTopK" type="number" min="1" max="20" value="10" style="width:100%;">
        </div>
        <div style="min-width:120px;">
          <label class="rc-label">BM25 TopK</label>
          <input class="rc-input" id="bm25TopK" type="number" min="1" max="20" value="10" style="width:100%;">
        </div>
        <div style="min-width:120px;">
          <label class="rc-label">最低分</label>
          <input class="rc-input" id="minScore" type="number" min="0" max="1" step="0.05" value="0.15" style="width:100%;">
        </div>
        <button class="rc-btn rc-btn-primary" onclick="runDebugSearch()" id="debugBtn">
          <i class="fas fa-search"></i> 并行检索
        </button>
      </div>
    </div>

    <!-- Summary stats -->
    <div id="debugSummary" style="display:none;margin-bottom:20px;">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
        <div class="rc-card" style="padding:14px;text-align:center;">
          <div id="sumVec" style="font-size:20px;font-weight:700;color:#3b82f6;">0</div>
          <div style="font-size:11px;color:#64748b;">向量结果</div>
        </div>
        <div class="rc-card" style="padding:14px;text-align:center;">
          <div id="sumBm25" style="font-size:20px;font-weight:700;color:#22c55e;">0</div>
          <div style="font-size:11px;color:#64748b;">BM25 结果</div>
        </div>
        <div class="rc-card" style="padding:14px;text-align:center;">
          <div id="sumOverlap" style="font-size:20px;font-weight:700;color:#a855f7;">0</div>
          <div style="font-size:11px;color:#64748b;">重叠 Chunk</div>
        </div>
        <div class="rc-card" style="padding:14px;text-align:center;">
          <div id="sumVecTime" style="font-size:20px;font-weight:700;color:#f59e0b;">-</div>
          <div style="font-size:11px;color:#64748b;">向量耗时</div>
        </div>
        <div class="rc-card" style="padding:14px;text-align:center;">
          <div id="sumBm25Time" style="font-size:20px;font-weight:700;color:#f59e0b;">-</div>
          <div style="font-size:11px;color:#64748b;">BM25 耗时</div>
        </div>
      </div>
    </div>

    <!-- Side-by-side results -->
    <div class="rc-grid-2">
      <div class="rc-card">
        <div class="rc-card-title" style="color:#3b82f6;"><i class="fas fa-vector-square"></i> 向量检索结果</div>
        <div id="vecResults" style="min-height:200px;max-height:600px;overflow-y:auto;">
          ${ragEmptyState({ icon: 'fas fa-vector-square', title: '向量检索', description: '输入查询后执行向量相似度检索' })}
        </div>
      </div>
      <div class="rc-card">
        <div class="rc-card-title" style="color:#22c55e;"><i class="fas fa-key"></i> BM25 关键词检索结果</div>
        <div id="bm25Results" style="min-height:200px;max-height:600px;overflow-y:auto;">
          ${ragEmptyState({ icon: 'fas fa-key', title: 'BM25 检索', description: '输入查询后执行 BM25 关键词检索' })}
        </div>
      </div>
    </div>`;

  const styles = `
    .debug-chunk { padding:12px;margin-bottom:8px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:8px;font-size:12px;transition:border-color 0.15s; }
    .debug-chunk:hover { border-color:rgba(148,163,184,0.25); }
    .debug-chunk.overlap { border-left:3px solid #a855f7; }
    .debug-chunk-head { display:flex;justify-content:space-between;align-items:center;margin-bottom:6px; }
    .debug-score { font-weight:700;font-family:monospace; }
    .debug-chunk-body { color:#94a3b8;line-height:1.6;max-height:60px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;cursor:pointer; }
    .debug-chunk-body.expanded { max-height:none;-webkit-line-clamp:unset; }
    .debug-matched { display:flex;flex-wrap:wrap;gap:4px;margin-top:6px; }
    .debug-matched span { padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.1);color:#4ade80;font-size:10px; }
  `;

  const scripts = `
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function runDebugSearch() {
      var query = document.getElementById('debugQuery').value.trim();
      if (!query) { alert('请输入检索查询'); return; }
      var vecTopK = parseInt(document.getElementById('vecTopK').value) || 10;
      var bm25TopK = parseInt(document.getElementById('bm25TopK').value) || 10;
      var minScore = parseFloat(document.getElementById('minScore').value) || 0.15;
      var btn = document.getElementById('debugBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检索中...';
      document.getElementById('vecResults').innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 向量检索中...</div>';
      document.getElementById('bm25Results').innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> BM25 检索中...</div>';

      var vecStart = Date.now(), bm25Start = Date.now();
      var vecData = null, bm25Data = null, vecTime = 0, bm25Time = 0;

      try {
        var [vecResp, bm25Resp] = await Promise.all([
          fetch('/api/rag/search', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ query: query, topK: vecTopK, minScore: minScore })
          }).then(function(r) { vecTime = Date.now() - vecStart; return r.json(); }),
          fetch('/api/rag/bm25/search', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ query: query, topK: bm25TopK })
          }).then(function(r) { bm25Time = Date.now() - bm25Start; return r.json(); })
        ]);
        vecData = vecResp; bm25Data = bm25Resp;
      } catch(e) { console.error(e); }

      btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> 并行检索';

      var vecResults = (vecData && vecData.results) || [];
      var bm25Results = (bm25Data && bm25Data.results) || [];

      // Find overlapping chunk IDs
      var vecChunkIds = new Set(vecResults.map(function(r) { return r.chunkIndex !== undefined ? r.documentId + '_' + r.chunkIndex : r.documentId; }));
      var bm25ChunkIds = new Set(bm25Results.map(function(r) { return r.chunkId; }));
      var overlapCount = 0;
      bm25Results.forEach(function(r) {
        vecResults.forEach(function(v) {
          if (r.content && v.content && r.content.substring(0,100) === v.content.substring(0,100)) overlapCount++;
        });
      });

      // Summary
      document.getElementById('debugSummary').style.display = 'block';
      document.getElementById('sumVec').textContent = vecResults.length;
      document.getElementById('sumBm25').textContent = bm25Results.length;
      document.getElementById('sumOverlap').textContent = overlapCount;
      document.getElementById('sumVecTime').textContent = vecTime + 'ms';
      document.getElementById('sumBm25Time').textContent = bm25Time + 'ms';

      // Render vector results
      if (vecResults.length) {
        document.getElementById('vecResults').innerHTML = vecResults.map(function(r, i) {
          var pct = Math.round((r.score || 0) * 100);
          return '<div class="debug-chunk"><div class="debug-chunk-head">' +
            '<span style="color:#64748b;">#' + (i+1) + ' <span style="color:#94a3b8;">' + escapeHtml(r.documentTitle || 'Doc ' + r.documentId) + '</span></span>' +
            '<span class="debug-score" style="color:#3b82f6;">' + pct + '%</span>' +
            '</div><div class="debug-chunk-body" onclick="this.classList.toggle(\'expanded\')">' + escapeHtml(r.content || '') + '</div></div>';
        }).join('');
      } else {
        document.getElementById('vecResults').innerHTML = '<div style="text-align:center;padding:30px;color:#475569;">无向量检索结果</div>';
      }

      // Render BM25 results
      if (bm25Results.length) {
        document.getElementById('bm25Results').innerHTML = bm25Results.map(function(r, i) {
          var tokens = r.matchedTokens || [];
          return '<div class="debug-chunk"><div class="debug-chunk-head">' +
            '<span style="color:#64748b;">#' + (i+1) + ' <span style="color:#94a3b8;">Chunk ' + r.chunkId + '</span></span>' +
            '<span class="debug-score" style="color:#22c55e;">' + (r.score || 0).toFixed(3) + '</span>' +
            '</div><div class="debug-chunk-body" onclick="this.classList.toggle(\'expanded\')">' + escapeHtml(r.content || '') + '</div>' +
            (tokens.length ? '<div class="debug-matched">' + tokens.map(function(t) { return '<span>' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
            '</div>';
        }).join('');
      } else {
        document.getElementById('bm25Results').innerHTML = '<div style="text-align:center;padding:30px;color:#475569;">无 BM25 检索结果</div>';
      }
    }
  `;

  return wrapWithRagLayout({
    title: '检索调试台',
    activePath: '/rag/retrieval-debug',
    body,
    scripts,
    styles,
  });
}

export function generateRagTestSets(): string {
  const body = `
    ${ragPageHeader({
      title: '测试集管理',
      icon: 'fas fa-clipboard-list',
      subtitle: '创建和管理标准化问答测试集，支持手动添加、LLM 自动生成和问题扩写',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '评测' }, { label: '测试集管理' }],
      actions: '<button class="rc-btn rc-btn-primary rc-btn-sm" onclick="showCreateModal()"><i class="fas fa-plus"></i> 新建测试集</button>',
    })}

    <!-- Test set list -->
    <div class="rc-card" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div class="rc-card-title" style="margin:0;"><i class="fas fa-folder-open"></i> 测试集列表</div>
        <select class="rc-select" id="tsStatusFilter" style="max-width:140px;" onchange="loadTestSets()">
          <option value="active">活跃</option>
          <option value="all">全部</option>
          <option value="archived">已归档</option>
        </select>
      </div>
      <div class="rc-table-wrap">
        <table class="rc-table">
          <thead>
            <tr>
              <th>测试集名称</th>
              <th>题目数</th>
              <th>最近评分</th>
              <th>最近评测</th>
              <th>创建时间</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody id="tsTableBody">
            <tr><td colspan="6" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Test set detail panel -->
    <div id="tsDetailPanel" style="display:none;">
      <div style="margin-bottom:16px;">
        <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="backToList()"><i class="fas fa-arrow-left"></i> 返回列表</button>
      </div>
      <div class="rc-card" style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 id="tsDetailName" style="font-size:18px;font-weight:600;color:#e2e8f0;margin-bottom:4px;"></h3>
            <div id="tsDetailMeta" style="font-size:12px;color:#64748b;display:flex;gap:16px;"></div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="showAddQuestionModal()"><i class="fas fa-plus"></i> 手动添加</button>
            <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="showGenModal()"><i class="fas fa-magic"></i> LLM 生成</button>
            <a class="rc-btn rc-btn-primary rc-btn-sm" href="/rag/evaluation" style="text-decoration:none;"><i class="fas fa-play"></i> 发起评测</a>
          </div>
        </div>
      </div>

      <!-- Questions table -->
      <div class="rc-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div class="rc-card-title" style="margin:0;"><i class="fas fa-list-ol"></i> 题目列表</div>
          <div style="display:flex;gap:8px;">
            <select class="rc-select" id="qTypeFilter" style="max-width:140px;" onchange="loadQuestions()">
              <option value="">全部类型</option>
              <option value="factual">事实 (factual)</option>
              <option value="number">数值 (number)</option>
              <option value="name">名称 (name)</option>
              <option value="boolean">布尔 (boolean)</option>
              <option value="comparative">对比 (comparative)</option>
              <option value="open">开放 (open)</option>
            </select>
            <select class="rc-select" id="qDiffFilter" style="max-width:120px;" onchange="loadQuestions()">
              <option value="">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
        </div>
        <div id="questionsContainer" style="min-height:200px;"></div>
        <div class="rc-pagination" id="qPagination"></div>
      </div>
    </div>

    <!-- Create test set modal -->
    <div id="createTsModal" class="ts-modal-overlay" style="display:none;">
      <div class="ts-modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-plus-circle" style="color:#d4af37;margin-right:8px;"></i>新建测试集</h3>
          <button onclick="closeModal('createTsModal')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div style="margin-bottom:16px;">
          <label class="rc-label">测试集名称 <span style="color:#ef4444;">*</span></label>
          <input class="rc-input" id="newTsName" placeholder="如：年报基础问答测试集">
        </div>
        <div style="margin-bottom:16px;">
          <label class="rc-label">描述</label>
          <textarea class="rc-input" id="newTsDesc" rows="3" placeholder="测试集用途说明..."></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="rc-btn rc-btn-outline" onclick="closeModal('createTsModal')">取消</button>
          <button class="rc-btn rc-btn-primary" onclick="createTestSet()"><i class="fas fa-check"></i> 创建</button>
        </div>
      </div>
    </div>

    <!-- Add question modal -->
    <div id="addQModal" class="ts-modal-overlay" style="display:none;">
      <div class="ts-modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-plus" style="color:#d4af37;margin-right:8px;"></i>添加测试题</h3>
          <button onclick="closeModal('addQModal')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">问题 <span style="color:#ef4444;">*</span></label>
          <input class="rc-input" id="newQQuestion" placeholder="输入测试问题...">
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">标准答案 <span style="color:#ef4444;">*</span></label>
          <textarea class="rc-input" id="newQAnswer" rows="3" placeholder="输入期望的标准答案..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label class="rc-label">题目类型</label>
            <select class="rc-select" id="newQType">
              <option value="factual">事实 (factual)</option>
              <option value="number">数值 (number)</option>
              <option value="name">名称 (name)</option>
              <option value="boolean">布尔 (boolean)</option>
              <option value="comparative">对比 (comparative)</option>
              <option value="open">开放 (open)</option>
            </select>
          </div>
          <div>
            <label class="rc-label">难度</label>
            <select class="rc-select" id="newQDiff">
              <option value="easy">简单</option>
              <option value="medium" selected>中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="rc-btn rc-btn-outline" onclick="closeModal('addQModal')">取消</button>
          <button class="rc-btn rc-btn-primary" onclick="addQuestion()"><i class="fas fa-check"></i> 添加</button>
        </div>
      </div>
    </div>

    <!-- LLM generate modal -->
    <div id="genModal" class="ts-modal-overlay" style="display:none;">
      <div class="ts-modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-magic" style="color:#d4af37;margin-right:8px;"></i>LLM 自动生成题目</h3>
          <button onclick="closeModal('genModal')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">选择文档 <span style="color:#ef4444;">*</span></label>
          <select class="rc-select" id="genDocId" style="width:100%;"><option value="">加载中...</option></select>
        </div>
        <div style="margin-bottom:16px;">
          <label class="rc-label">生成数量</label>
          <input class="rc-input" id="genCount" type="number" min="1" max="20" value="5">
        </div>
        <div id="genStatus" style="margin-bottom:12px;font-size:13px;color:#64748b;"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="rc-btn rc-btn-outline" onclick="closeModal('genModal')">取消</button>
          <button class="rc-btn rc-btn-primary" id="genBtn" onclick="generateQuestions()"><i class="fas fa-magic"></i> 开始生成</button>
        </div>
      </div>
    </div>`;

  const styles = `
    .ts-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center; }
    .ts-modal-content { background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:600px;max-height:90vh;overflow-y:auto;padding:28px; }
    .q-row { padding:14px;margin-bottom:8px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:10px;transition:border-color 0.15s; }
    .q-row:hover { border-color:rgba(148,163,184,0.2); }
    .q-type-badge { display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500; }
    .q-type-factual { background:rgba(59,130,246,0.12);color:#60a5fa; }
    .q-type-number { background:rgba(34,197,94,0.12);color:#4ade80; }
    .q-type-name { background:rgba(168,85,247,0.12);color:#a855f7; }
    .q-type-boolean { background:rgba(245,158,11,0.12);color:#fbbf24; }
    .q-type-comparative { background:rgba(236,72,153,0.12);color:#f472b6; }
    .q-type-open { background:rgba(148,163,184,0.12);color:#94a3b8; }
    .q-diff-badge { display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px; }
    .q-diff-easy { background:rgba(34,197,94,0.1);color:#4ade80; }
    .q-diff-medium { background:rgba(245,158,11,0.1);color:#fbbf24; }
    .q-diff-hard { background:rgba(239,68,68,0.1);color:#f87171; }
  `;

  const scripts = `
    var currentTsId = null;
    var qOffset = 0, qLimit = 20;
    var typeLabels = { factual:'事实', number:'数值', name:'名称', boolean:'布尔', comparative:'对比', open:'开放' };
    var diffLabels = { easy:'简单', medium:'中等', hard:'困难' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function showModal(id) { document.getElementById(id).style.display = 'flex'; }
    function closeModal(id) { document.getElementById(id).style.display = 'none'; }
    function showCreateModal() { showModal('createTsModal'); }
    function showAddQuestionModal() { showModal('addQModal'); }
    function showGenModal() { loadDocsForGen(); showModal('genModal'); }

    // --- Test set list ---
    async function loadTestSets() {
      var status = document.getElementById('tsStatusFilter').value;
      try {
        var resp = await fetch('/api/rag/enhance/test-sets?status=' + status + '&limit=50', { headers: getAuthHeaders() });
        var d = await resp.json();
        renderTestSets(d.sets || []);
      } catch(e) {
        document.getElementById('tsTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#f87171;">加载失败</td></tr>';
      }
    }
    function renderTestSets(sets) {
      var tbody = document.getElementById('tsTableBody');
      if (!sets.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-clipboard-list" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无测试集<br><button class="rc-btn rc-btn-primary rc-btn-sm" onclick="showCreateModal()" style="margin-top:8px;"><i class="fas fa-plus"></i> 创建测试集</button></td></tr>';
        return;
      }
      tbody.innerHTML = sets.map(function(s) {
        var score = s.last_eval_score !== null ? '<span style="color:#d4af37;font-weight:600;">' + s.last_eval_score.toFixed(1) + '</span>' : '<span style="color:#475569;">-</span>';
        var evalAt = s.last_eval_at ? new Date(s.last_eval_at).toLocaleDateString('zh-CN') : '-';
        var created = s.created_at ? new Date(s.created_at).toLocaleDateString('zh-CN') : '-';
        return '<tr>' +
          '<td><a href="#" onclick="viewTestSet(' + s.id + ');return false;" style="font-weight:500;color:#e2e8f0;text-decoration:none;">' + escapeHtml(s.name) + '</a>' +
          (s.description ? '<div style="font-size:11px;color:#475569;margin-top:2px;">' + escapeHtml(s.description).substring(0, 60) + '</div>' : '') + '</td>' +
          '<td><span style="font-weight:600;color:#3b82f6;">' + s.question_count + '</span></td>' +
          '<td>' + score + '</td>' +
          '<td style="font-size:12px;color:#64748b;">' + evalAt + '</td>' +
          '<td style="font-size:12px;color:#64748b;">' + created + '</td>' +
          '<td style="text-align:right;">' +
            '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="viewTestSet(' + s.id + ')" title="查看"><i class="fas fa-eye"></i></button> ' +
            '<button class="rc-btn rc-btn-sm rc-btn-danger" onclick="deleteTestSet(' + s.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
          '</td></tr>';
      }).join('');
    }
    async function createTestSet() {
      var name = document.getElementById('newTsName').value.trim();
      if (!name) { alert('请输入测试集名称'); return; }
      try {
        var resp = await fetch('/api/rag/enhance/test-sets', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ name: name, description: document.getElementById('newTsDesc').value.trim() })
        });
        var d = await resp.json();
        if (d.success) { closeModal('createTsModal'); document.getElementById('newTsName').value=''; document.getElementById('newTsDesc').value=''; loadTestSets(); }
        else alert('创建失败: ' + (d.error || ''));
      } catch(e) { alert('创建失败'); }
    }
    async function deleteTestSet(id) {
      if (!confirm('确定删除该测试集？将同时删除所有题目和评测记录。')) return;
      try {
        var resp = await fetch('/api/rag/enhance/test-sets/' + id, { method:'DELETE', headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success) { loadTestSets(); if (currentTsId === id) backToList(); }
        else alert('删除失败: ' + (d.error || ''));
      } catch(e) { alert('删除失败'); }
    }

    // --- Test set detail ---
    async function viewTestSet(id) {
      currentTsId = id; qOffset = 0;
      document.querySelector('.rc-card').parentElement.querySelector('.rc-card').style.display = 'none';
      document.getElementById('tsDetailPanel').style.display = 'block';
      try {
        var resp = await fetch('/api/rag/enhance/test-sets/' + id, { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success && d.testSet) {
          document.getElementById('tsDetailName').textContent = d.testSet.name;
          document.getElementById('tsDetailMeta').innerHTML =
            '<span><i class="fas fa-hashtag"></i> ID: ' + d.testSet.id + '</span>' +
            '<span><i class="fas fa-list-ol"></i> ' + d.testSet.question_count + ' 题</span>' +
            (d.testSet.last_eval_score !== null ? '<span><i class="fas fa-star" style="color:#d4af37;"></i> ' + d.testSet.last_eval_score.toFixed(1) + ' 分</span>' : '') +
            '<span><i class="fas fa-calendar"></i> ' + new Date(d.testSet.created_at).toLocaleDateString('zh-CN') + '</span>';
        }
      } catch(e) {}
      loadQuestions();
    }
    function backToList() {
      document.getElementById('tsDetailPanel').style.display = 'none';
      document.querySelector('.rc-card').parentElement.querySelector('.rc-card').style.display = '';
      currentTsId = null;
    }

    // --- Questions ---
    async function loadQuestions() {
      if (!currentTsId) return;
      var container = document.getElementById('questionsContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
      var type = document.getElementById('qTypeFilter').value;
      var diff = document.getElementById('qDiffFilter').value;
      var params = 'limit=' + qLimit + '&offset=' + qOffset;
      if (type) params += '&type=' + type;
      if (diff) params += '&difficulty=' + diff;
      try {
        var resp = await fetch('/api/rag/enhance/test-sets/' + currentTsId + '/questions?' + params, { headers: getAuthHeaders() });
        var d = await resp.json();
        renderQuestions(d.questions || [], d.total || 0);
      } catch(e) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">加载失败</div>'; }
    }
    function renderQuestions(questions, total) {
      var container = document.getElementById('questionsContainer');
      if (!questions.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#475569;"><i class="fas fa-list-ol" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无题目<br><span style="font-size:12px;">点击「手动添加」或「LLM 生成」来创建题目</span></div>';
        return;
      }
      container.innerHTML = questions.map(function(q, i) {
        return '<div class="q-row">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:12px;color:#475569;font-weight:600;">#' + (qOffset + i + 1) + '</span>' +
              '<span class="q-type-badge q-type-' + q.question_type + '">' + (typeLabels[q.question_type] || q.question_type) + '</span>' +
              '<span class="q-diff-badge q-diff-' + q.difficulty + '">' + (diffLabels[q.difficulty] || q.difficulty) + '</span>' +
              '<span style="font-size:10px;color:#475569;padding:2px 6px;border-radius:4px;background:rgba(148,163,184,0.08);">' + q.source + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="expandQuestion(' + q.id + ')" title="LLM 扩写"><i class="fas fa-expand-arrows-alt"></i></button>' +
              '<button class="rc-btn rc-btn-sm rc-btn-danger" onclick="deleteQuestion(' + q.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:13px;color:#e2e8f0;margin-bottom:4px;"><strong>Q:</strong> ' + escapeHtml(q.question) + '</div>' +
          '<div style="font-size:12px;color:#94a3b8;"><strong style="color:#4ade80;">A:</strong> ' + escapeHtml(q.expected_answer) + '</div>' +
          '</div>';
      }).join('');
      // Pagination
      var pages = Math.ceil(total / qLimit);
      var current = Math.floor(qOffset / qLimit) + 1;
      document.getElementById('qPagination').innerHTML = pages > 1 ?
        '<span>第 ' + current + '/' + pages + ' 页 (共 ' + total + ' 题)</span><div class="rc-pagination-buttons"><button class="rc-pagination-btn" onclick="qPage(-1)"' + (current <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button><button class="rc-pagination-btn" onclick="qPage(1)"' + (current >= pages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button></div>' :
        '<span>共 ' + total + ' 题</span>';
    }
    function qPage(dir) { qOffset = Math.max(0, qOffset + dir * qLimit); loadQuestions(); }

    async function addQuestion() {
      var q = document.getElementById('newQQuestion').value.trim();
      var a = document.getElementById('newQAnswer').value.trim();
      if (!q || !a) { alert('问题和标准答案不能为空'); return; }
      try {
        var resp = await fetch('/api/rag/enhance/test-sets/' + currentTsId + '/questions', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ question: q, expectedAnswer: a, questionType: document.getElementById('newQType').value, difficulty: document.getElementById('newQDiff').value })
        });
        var d = await resp.json();
        if (d.success) { closeModal('addQModal'); document.getElementById('newQQuestion').value=''; document.getElementById('newQAnswer').value=''; loadQuestions(); }
        else alert('添加失败: ' + (d.error || ''));
      } catch(e) { alert('添加失败'); }
    }
    async function deleteQuestion(qId) {
      if (!confirm('确定删除该题目？')) return;
      try {
        var resp = await fetch('/api/rag/enhance/questions/' + qId + '?testSetId=' + currentTsId, { method:'DELETE', headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success) loadQuestions();
        else alert('删除失败: ' + (d.error || ''));
      } catch(e) { alert('删除失败'); }
    }
    async function expandQuestion(qId) {
      if (!confirm('使用 LLM 为该题目生成 3 个改写变体？')) return;
      try {
        var resp = await fetch('/api/rag/enhance/questions/' + qId + '/expand', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ count: 3 })
        });
        var d = await resp.json();
        if (d.success) alert('已生成 ' + d.variants.length + ' 个改写变体');
        else alert('扩写失败: ' + (d.error || ''));
      } catch(e) { alert('扩写失败'); }
    }

    // --- LLM generate ---
    async function loadDocsForGen() {
      try {
        var resp = await fetch('/api/rag/documents?limit=100', { headers: getAuthHeaders() });
        var d = await resp.json();
        var docs = d.documents || [];
        var sel = document.getElementById('genDocId');
        sel.innerHTML = docs.length ? docs.map(function(doc) {
          return '<option value="' + doc.id + '">' + escapeHtml(doc.title) + ' (' + (doc.chunk_count || 0) + ' chunks)</option>';
        }).join('') : '<option value="">暂无文档</option>';
      } catch(e) {}
    }
    async function generateQuestions() {
      var docId = parseInt(document.getElementById('genDocId').value);
      var count = parseInt(document.getElementById('genCount').value) || 5;
      if (!docId) { alert('请选择文档'); return; }
      var btn = document.getElementById('genBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
      document.getElementById('genStatus').innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#d4af37;"></i> 正在调用 LLM 生成题目，请稍候...';
      try {
        var resp = await fetch('/api/rag/enhance/test-sets/' + currentTsId + '/generate', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ documentId: docId, count: count })
        });
        var d = await resp.json();
        if (d.success) {
          document.getElementById('genStatus').innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 成功生成 ' + d.generated + ' 道题目';
          setTimeout(function() { closeModal('genModal'); loadQuestions(); }, 1500);
        } else {
          document.getElementById('genStatus').innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (d.error || '生成失败');
        }
      } catch(e) {
        document.getElementById('genStatus').innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> 生成请求失败';
      }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 开始生成';
    }

    loadTestSets();
  `;

  return wrapWithRagLayout({
    title: '测试集管理',
    activePath: '/rag/test-sets',
    body,
    scripts,
    styles,
  });
}

export function generateRagEvaluation(): string {
  const body = `
    ${ragPageHeader({
      title: '批量评测与打分',
      icon: 'fas fa-chart-bar',
      subtitle: '基于测试集批量运行 RAG 问答，自动四维打分（精确匹配 / 语义 / 召回 / 引用），追踪效果趋势',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '评测' }, { label: '批量评测' }],
      actions: '<button class="rc-btn rc-btn-primary rc-btn-sm" onclick="showNewEvalModal()"><i class="fas fa-play"></i> 新建评测</button>',
    })}

    <!-- Evaluation list -->
    <div class="rc-card" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div class="rc-card-title" style="margin:0;"><i class="fas fa-tasks"></i> 评测任务列表</div>
        <div style="display:flex;gap:8px;">
          <select class="rc-select" id="evalTsFilter" style="max-width:200px;" onchange="loadEvaluations()">
            <option value="">全部测试集</option>
          </select>
          <select class="rc-select" id="evalStatusFilter" style="max-width:140px;" onchange="loadEvaluations()">
            <option value="">全部状态</option>
            <option value="completed">已完成</option>
            <option value="running">运行中</option>
            <option value="pending">待运行</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>
      <div class="rc-table-wrap">
        <table class="rc-table">
          <thead>
            <tr>
              <th>评测名称</th>
              <th>测试集</th>
              <th>进度</th>
              <th>总分</th>
              <th>精确</th>
              <th>语义</th>
              <th>召回</th>
              <th>引用</th>
              <th>状态</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody id="evalTableBody">
            <tr><td colspan="10" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Evaluation detail panel -->
    <div id="evalDetailPanel" style="display:none;">
      <div style="margin-bottom:16px;">
        <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="backToEvalList()"><i class="fas fa-arrow-left"></i> 返回列表</button>
      </div>

      <!-- Score summary cards -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
        <div class="rc-card" style="padding:16px;text-align:center;">
          <div id="edOverall" style="font-size:24px;font-weight:700;color:#d4af37;">-</div>
          <div style="font-size:11px;color:#64748b;">总分</div>
        </div>
        <div class="rc-card" style="padding:16px;text-align:center;">
          <div id="edExact" style="font-size:24px;font-weight:700;color:#3b82f6;">-</div>
          <div style="font-size:11px;color:#64748b;">精确匹配</div>
        </div>
        <div class="rc-card" style="padding:16px;text-align:center;">
          <div id="edSemantic" style="font-size:24px;font-weight:700;color:#22c55e;">-</div>
          <div style="font-size:11px;color:#64748b;">语义匹配</div>
        </div>
        <div class="rc-card" style="padding:16px;text-align:center;">
          <div id="edRecall" style="font-size:24px;font-weight:700;color:#a855f7;">-</div>
          <div style="font-size:11px;color:#64748b;">召回率</div>
        </div>
        <div class="rc-card" style="padding:16px;text-align:center;">
          <div id="edCitation" style="font-size:24px;font-weight:700;color:#f59e0b;">-</div>
          <div style="font-size:11px;color:#64748b;">引用准确</div>
        </div>
      </div>

      <!-- Score breakdown -->
      <div class="rc-grid-2" style="margin-bottom:20px;">
        <div class="rc-card">
          <div class="rc-card-title"><i class="fas fa-chart-pie"></i> 按类型分数</div>
          <div id="edByType" style="min-height:120px;"></div>
        </div>
        <div class="rc-card">
          <div class="rc-card-title"><i class="fas fa-layer-group"></i> 按难度分数</div>
          <div id="edByDiff" style="min-height:120px;"></div>
        </div>
      </div>

      <!-- Per-question results -->
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-list-ol"></i> 逐题结果</div>
        <div id="evalResultsContainer" style="min-height:200px;max-height:600px;overflow-y:auto;"></div>
      </div>
    </div>

    <!-- New evaluation modal -->
    <div id="newEvalModal" class="eval-modal-overlay" style="display:none;">
      <div class="eval-modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-play-circle" style="color:#d4af37;margin-right:8px;"></i>新建评测任务</h3>
          <button onclick="closeEvalModal()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">评测名称 <span style="color:#ef4444;">*</span></label>
          <input class="rc-input" id="newEvalName" placeholder="如：v2.1 混合检索评测">
        </div>
        <div style="margin-bottom:12px;">
          <label class="rc-label">选择测试集 <span style="color:#ef4444;">*</span></label>
          <select class="rc-select" id="newEvalTs" style="width:100%;"><option value="">加载中...</option></select>
        </div>
        <div style="margin-bottom:12px;padding:14px;background:rgba(15,23,42,0.4);border-radius:10px;border:1px solid rgba(148,163,184,0.08);">
          <span style="font-size:12px;font-weight:600;color:#94a3b8;display:block;margin-bottom:10px;"><i class="fas fa-cog"></i> RAG 配置</span>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="rc-label">检索策略</label>
              <select class="rc-select" id="evalStrategy"><option value="hybrid">混合 (Vector+BM25)</option><option value="vector">仅向量</option><option value="bm25">仅 BM25</option></select>
            </div>
            <div>
              <label class="rc-label">TopK</label>
              <input class="rc-input" id="evalTopK" type="number" min="1" max="20" value="5">
            </div>
            <div>
              <label class="rc-label">最低分阈值</label>
              <input class="rc-input" id="evalMinScore" type="number" min="0" max="1" step="0.05" value="0.25">
            </div>
            <div style="display:flex;align-items:flex-end;">
              <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;cursor:pointer;">
                <input type="checkbox" id="evalRerank" style="accent-color:#d4af37;"> 启用 LLM 重排
              </label>
            </div>
          </div>
        </div>
        <div id="newEvalStatus" style="margin-bottom:12px;font-size:13px;color:#64748b;"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="rc-btn rc-btn-outline" onclick="closeEvalModal()">取消</button>
          <button class="rc-btn rc-btn-primary" id="createEvalBtn" onclick="createAndRunEval()"><i class="fas fa-play"></i> 创建并运行</button>
        </div>
      </div>
    </div>`;

  const styles = `
    .eval-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center; }
    .eval-modal-content { background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:600px;max-height:90vh;overflow-y:auto;padding:28px; }
    .er-row { padding:12px;margin-bottom:6px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:8px;font-size:12px; }
    .er-row.correct { border-left:3px solid #4ade80; }
    .er-row.wrong { border-left:3px solid #f87171; }
    .eval-score-bar { height:6px;border-radius:3px;background:rgba(15,23,42,0.6);overflow:hidden; }
    .eval-score-fill { height:100%;border-radius:3px; }
  `;

  const scripts = `
    var currentEvalId = null;
    var typeLabels = { factual:'事实', number:'数值', name:'名称', boolean:'布尔', comparative:'对比', open:'开放' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function showNewEvalModal() { loadTestSetsForEval(); document.getElementById('newEvalModal').style.display = 'flex'; }
    function closeEvalModal() { document.getElementById('newEvalModal').style.display = 'none'; }

    async function loadTestSetsForFilters() {
      try {
        var resp = await fetch('/api/rag/enhance/test-sets?status=active&limit=100', { headers: getAuthHeaders() });
        var d = await resp.json();
        var sets = d.sets || [];
        var sel = document.getElementById('evalTsFilter');
        sel.innerHTML = '<option value="">全部测试集</option>' + sets.map(function(s) {
          return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
        }).join('');
      } catch(e) {}
    }
    async function loadTestSetsForEval() {
      try {
        var resp = await fetch('/api/rag/enhance/test-sets?status=active&limit=100', { headers: getAuthHeaders() });
        var d = await resp.json();
        var sets = d.sets || [];
        var sel = document.getElementById('newEvalTs');
        sel.innerHTML = sets.length ? sets.map(function(s) {
          return '<option value="' + s.id + '">' + escapeHtml(s.name) + ' (' + s.question_count + ' 题)</option>';
        }).join('') : '<option value="">暂无测试集</option>';
      } catch(e) {}
    }

    async function loadEvaluations() {
      var tsId = document.getElementById('evalTsFilter').value;
      var status = document.getElementById('evalStatusFilter').value;
      var params = 'limit=50';
      if (tsId) params += '&testSetId=' + tsId;
      if (status) params += '&status=' + status;
      try {
        var resp = await fetch('/api/rag/enhance/evaluations?' + params, { headers: getAuthHeaders() });
        var d = await resp.json();
        renderEvaluations(d.evaluations || []);
      } catch(e) {
        document.getElementById('evalTableBody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:#f87171;">加载失败</td></tr>';
      }
    }
    function renderEvaluations(evals) {
      var tbody = document.getElementById('evalTableBody');
      if (!evals.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-chart-bar" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无评测记录</td></tr>';
        return;
      }
      tbody.innerHTML = evals.map(function(e) {
        var pct = e.total_questions > 0 ? Math.round((e.completed_questions / e.total_questions) * 100) : 0;
        var statusMap = { completed:'<span style="color:#4ade80;"><i class="fas fa-check-circle"></i> 完成</span>', running:'<span style="color:#d4af37;"><i class="fas fa-spinner fa-spin"></i> 运行中</span>', pending:'<span style="color:#64748b;"><i class="fas fa-clock"></i> 待运行</span>', failed:'<span style="color:#f87171;"><i class="fas fa-times-circle"></i> 失败</span>' };
        function sc(v) { return v !== null && v !== undefined ? '<span style="font-weight:600;">' + v.toFixed(1) + '</span>' : '-'; }
        return '<tr>' +
          '<td style="font-weight:500;color:#e2e8f0;">' + escapeHtml(e.name) + '</td>' +
          '<td style="font-size:12px;color:#94a3b8;">ID:' + e.test_set_id + '</td>' +
          '<td><div class="eval-score-bar" style="width:60px;"><div class="eval-score-fill" style="width:' + pct + '%;background:#3b82f6;"></div></div><span style="font-size:10px;color:#64748b;margin-left:4px;">' + pct + '%</span></td>' +
          '<td style="color:#d4af37;font-weight:600;">' + sc(e.overall_score) + '</td>' +
          '<td style="color:#3b82f6;">' + sc(e.exact_match_score) + '</td>' +
          '<td style="color:#22c55e;">' + sc(e.semantic_score) + '</td>' +
          '<td style="color:#a855f7;">' + sc(e.recall_score) + '</td>' +
          '<td style="color:#f59e0b;">' + sc(e.citation_score) + '</td>' +
          '<td>' + (statusMap[e.status] || e.status) + '</td>' +
          '<td style="text-align:right;">' +
            (e.status === 'completed' ? '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="viewEvalDetail(' + e.id + ')" title="查看结果"><i class="fas fa-eye"></i></button>' : '') +
            (e.status === 'pending' ? ' <button class="rc-btn rc-btn-sm rc-btn-primary" onclick="runEval(' + e.id + ')" title="运行"><i class="fas fa-play"></i></button>' : '') +
          '</td></tr>';
      }).join('');
    }

    async function createAndRunEval() {
      var name = document.getElementById('newEvalName').value.trim();
      var tsId = parseInt(document.getElementById('newEvalTs').value);
      if (!name) { alert('请输入评测名称'); return; }
      if (!tsId) { alert('请选择测试集'); return; }
      var btn = document.getElementById('createEvalBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
      document.getElementById('newEvalStatus').innerHTML = '';
      try {
        var resp = await fetch('/api/rag/enhance/evaluations', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({
            name: name, testSetId: tsId,
            config: {
              searchStrategy: document.getElementById('evalStrategy').value,
              topK: parseInt(document.getElementById('evalTopK').value) || 5,
              minScore: parseFloat(document.getElementById('evalMinScore').value) || 0.25,
              enableRerank: document.getElementById('evalRerank').checked,
              rerankWeight: 0.7
            }
          })
        });
        var d = await resp.json();
        if (d.success) {
          document.getElementById('newEvalStatus').innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 评测已创建，正在运行...';
          // Trigger run
          await fetch('/api/rag/enhance/evaluations/' + d.evaluation.id + '/run', { method:'POST', headers: getAuthHeaders() });
          setTimeout(function() { closeEvalModal(); loadEvaluations(); }, 1500);
        } else {
          document.getElementById('newEvalStatus').innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (d.error || '创建失败');
        }
      } catch(e) {
        document.getElementById('newEvalStatus').innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> 创建失败';
      }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> 创建并运行';
    }
    async function runEval(evalId) {
      try {
        await fetch('/api/rag/enhance/evaluations/' + evalId + '/run', { method:'POST', headers: getAuthHeaders() });
        loadEvaluations();
      } catch(e) { alert('运行失败'); }
    }

    async function viewEvalDetail(evalId) {
      currentEvalId = evalId;
      document.querySelector('.rc-card').parentElement.querySelector('.rc-card').style.display = 'none';
      document.getElementById('evalDetailPanel').style.display = 'block';
      try {
        var resp = await fetch('/api/rag/enhance/evaluations/' + evalId, { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success && d.evaluation) {
          var e = d.evaluation;
          document.getElementById('edOverall').textContent = e.overall_score !== null ? e.overall_score.toFixed(1) : '-';
          document.getElementById('edExact').textContent = e.exact_match_score !== null ? e.exact_match_score.toFixed(1) : '-';
          document.getElementById('edSemantic').textContent = e.semantic_score !== null ? e.semantic_score.toFixed(1) : '-';
          document.getElementById('edRecall').textContent = e.recall_score !== null ? e.recall_score.toFixed(1) : '-';
          document.getElementById('edCitation').textContent = e.citation_score !== null ? e.citation_score.toFixed(1) : '-';

          // By type
          var byType = e.scores_by_type ? (typeof e.scores_by_type === 'string' ? JSON.parse(e.scores_by_type) : e.scores_by_type) : {};
          document.getElementById('edByType').innerHTML = Object.keys(byType).length ?
            Object.entries(byType).map(function(kv) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;"><span style="width:50px;font-size:12px;color:#94a3b8;">' + (typeLabels[kv[0]] || kv[0]) + '</span><div class="eval-score-bar" style="flex:1;"><div class="eval-score-fill" style="width:' + kv[1] + '%;background:#3b82f6;"></div></div><span style="font-size:12px;color:#d4af37;font-weight:600;min-width:40px;text-align:right;">' + kv[1] + '</span></div>';
            }).join('') : '<div style="text-align:center;color:#475569;padding:20px;">暂无数据</div>';

          // By difficulty
          var byDiff = e.scores_by_difficulty ? (typeof e.scores_by_difficulty === 'string' ? JSON.parse(e.scores_by_difficulty) : e.scores_by_difficulty) : {};
          var diffColors = { easy:'#4ade80', medium:'#fbbf24', hard:'#f87171' };
          var diffLabels = { easy:'简单', medium:'中等', hard:'困难' };
          document.getElementById('edByDiff').innerHTML = Object.keys(byDiff).length ?
            Object.entries(byDiff).map(function(kv) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;"><span style="width:50px;font-size:12px;color:#94a3b8;">' + (diffLabels[kv[0]] || kv[0]) + '</span><div class="eval-score-bar" style="flex:1;"><div class="eval-score-fill" style="width:' + kv[1] + '%;background:' + (diffColors[kv[0]] || '#64748b') + ';"></div></div><span style="font-size:12px;color:#d4af37;font-weight:600;min-width:40px;text-align:right;">' + kv[1] + '</span></div>';
            }).join('') : '<div style="text-align:center;color:#475569;padding:20px;">暂无数据</div>';
        }
      } catch(e) {}
      loadEvalResults(evalId);
    }
    async function loadEvalResults(evalId) {
      var container = document.getElementById('evalResultsContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
      try {
        var resp = await fetch('/api/rag/enhance/evaluations/' + evalId + '/results', { headers: getAuthHeaders() });
        var d = await resp.json();
        var results = d.results || [];
        if (!results.length) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#475569;">暂无逐题结果</div>';
          return;
        }
        container.innerHTML = results.map(function(r, i) {
          var scoreColor = r.score >= 70 ? '#4ade80' : (r.score >= 40 ? '#fbbf24' : '#f87171');
          return '<div class="er-row ' + (r.is_correct ? 'correct' : 'wrong') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
              '<span style="color:#475569;font-weight:600;">#' + (i+1) + ' <span class="q-type-badge q-type-' + (r.question_type || 'factual') + '">' + (typeLabels[r.question_type] || r.question_type || '-') + '</span></span>' +
              '<span style="font-weight:700;color:' + scoreColor + ';">' + (r.score !== null ? r.score.toFixed(1) : '-') + '</span>' +
            '</div>' +
            '<div style="color:#e2e8f0;margin-bottom:4px;"><strong>Q:</strong> ' + escapeHtml(r.question_text || '') + '</div>' +
            '<div style="color:#94a3b8;margin-bottom:2px;"><strong style="color:#4ade80;">Expected:</strong> ' + escapeHtml(r.expected_answer || '') + '</div>' +
            '<div style="color:#94a3b8;margin-bottom:4px;"><strong style="color:#3b82f6;">Model:</strong> ' + escapeHtml((r.model_answer || '').substring(0, 200)) + '</div>' +
            (r.scoring_reason ? '<div style="font-size:11px;color:#475569;">' + escapeHtml(r.scoring_reason) + '</div>' : '') +
            (r.latency_ms ? '<div style="font-size:10px;color:#475569;margin-top:2px;"><i class="fas fa-clock"></i> ' + (r.latency_ms / 1000).toFixed(1) + 's</div>' : '') +
            '</div>';
        }).join('');
      } catch(e) { container.innerHTML = '<div style="text-align:center;color:#f87171;">加载失败</div>'; }
    }
    function backToEvalList() {
      document.getElementById('evalDetailPanel').style.display = 'none';
      document.querySelector('.rc-card').parentElement.querySelector('.rc-card').style.display = '';
      currentEvalId = null;
    }

    loadTestSetsForFilters();
    loadEvaluations();
    // Auto-refresh running evaluations
    setInterval(function() { loadEvaluations(); }, 15000);
  `;

  return wrapWithRagLayout({
    title: '批量评测与打分',
    activePath: '/rag/evaluation',
    body,
    scripts,
    styles,
  });
}

export function generateRagHealthCheck(): string {
  const body = `
    ${ragPageHeader({
      title: '知识库健康度检查',
      icon: 'fas fa-heartbeat',
      subtitle: '覆盖率(40%) + 新鲜度(30%) + 一致性(30%) 三维健康评分，自动生成改进建议',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '评测中心' }, { label: '健康度检查' }],
    })}

    <!-- Action Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <button class="rc-btn rc-btn-primary" onclick="runHealthCheck()" id="healthRunBtn"><i class="fas fa-play"></i> 运行健康检查</button>
      <select class="rc-input" id="healthReportSelect" onchange="loadReportDetail(this.value)" style="width:250px;">
        <option value="">选择历史报告...</option>
      </select>
    </div>

    <!-- Score Overview -->
    <div id="scoreOverview" style="display:none;margin-bottom:24px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;">
        <!-- Overall Score -->
        <div class="rc-card" style="text-align:center;padding:24px;">
          <div id="overallScoreRing" style="position:relative;width:100px;height:100px;margin:0 auto 12px;">
            <svg viewBox="0 0 100 100" style="transform:rotate(-90deg);width:100px;height:100px;">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" stroke-width="8"/>
              <circle id="scoreCircle" cx="50" cy="50" r="42" fill="none" stroke="#3b82f6" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="264" stroke-linecap="round" style="transition:stroke-dashoffset 1s;"/>
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:700;" id="overallScoreNum">-</div>
          </div>
          <div style="font-size:14px;font-weight:600;">综合健康分</div>
        </div>
        <!-- Coverage -->
        <div class="rc-card health-dim-card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <i class="fas fa-bullseye" style="color:#3b82f6;font-size:18px;"></i>
            <span style="font-weight:600;">覆盖率</span>
            <span style="margin-left:auto;font-size:11px;color:#94a3b8;">权重 40%</span>
          </div>
          <div style="font-size:28px;font-weight:700;color:#3b82f6;" id="coverageScore">-</div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;margin-top:8px;"><div id="coverageBar" style="height:100%;background:#3b82f6;border-radius:4px;width:0%;transition:width .8s;"></div></div>
        </div>
        <!-- Freshness -->
        <div class="rc-card health-dim-card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <i class="fas fa-clock" style="color:#10b981;font-size:18px;"></i>
            <span style="font-weight:600;">新鲜度</span>
            <span style="margin-left:auto;font-size:11px;color:#94a3b8;">权重 30%</span>
          </div>
          <div style="font-size:28px;font-weight:700;color:#10b981;" id="freshnessScore">-</div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;margin-top:8px;"><div id="freshnessBar" style="height:100%;background:#10b981;border-radius:4px;width:0%;transition:width .8s;"></div></div>
        </div>
        <!-- Consistency -->
        <div class="rc-card health-dim-card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <i class="fas fa-balance-scale" style="color:#f59e0b;font-size:18px;"></i>
            <span style="font-weight:600;">一致性</span>
            <span style="margin-left:auto;font-size:11px;color:#94a3b8;">权重 30%</span>
          </div>
          <div style="font-size:28px;font-weight:700;color:#f59e0b;" id="consistencyScore">-</div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;margin-top:8px;"><div id="consistencyBar" style="height:100%;background:#f59e0b;border-radius:4px;width:0%;transition:width .8s;"></div></div>
        </div>
      </div>
    </div>

    <!-- Tab Bar for Details -->
    <div id="healthTabs" style="display:none;margin-bottom:20px;border-bottom:2px solid #e2e8f0;">
      <button class="hc-tab active" onclick="switchHcTab('suggestions')" id="hcTabSuggestions" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-lightbulb"></i> 改进建议
      </button>
      <button class="hc-tab" onclick="switchHcTab('coverage')" id="hcTabCoverage" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-bullseye"></i> 覆盖率详情
      </button>
      <button class="hc-tab" onclick="switchHcTab('freshness')" id="hcTabFreshness" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-clock"></i> 新鲜度详情
      </button>
      <button class="hc-tab" onclick="switchHcTab('consistency')" id="hcTabConsistency" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-balance-scale"></i> 一致性详情
      </button>
      <button class="hc-tab" onclick="switchHcTab('history')" id="hcTabHistory" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
        <i class="fas fa-history"></i> 历史报告
      </button>
    </div>

    <div id="hcPanelSuggestions"></div>
    <div id="hcPanelCoverage" style="display:none;"></div>
    <div id="hcPanelFreshness" style="display:none;"></div>
    <div id="hcPanelConsistency" style="display:none;"></div>
    <div id="hcPanelHistory" style="display:none;"></div>
  `;

  const styles = `
    .hc-tab.active { color: #3b82f6; border-bottom-color: #3b82f6 !important; font-weight: 600; }
    .hc-tab:hover { color: #3b82f6; }
    .suggestion-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .suggestion-card.critical { border-left: 4px solid #ef4444; }
    .suggestion-card.high { border-left: 4px solid #f59e0b; }
    .suggestion-card.medium { border-left: 4px solid #3b82f6; }
    .suggestion-card.low { border-left: 4px solid #94a3b8; }
    .severity-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .sev-critical { background: #fef2f2; color: #dc2626; }
    .sev-high { background: #fffbeb; color: #d97706; }
    .sev-medium { background: #eff6ff; color: #2563eb; }
    .sev-low { background: #f1f5f9; color: #64748b; }
    .health-dim-card { transition: transform .2s; }
    .health-dim-card:hover { transform: translateY(-2px); }
  `;

  const scripts = `
    let currentReportData = null;

    async function loadReportList() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/health/reports?limit=20', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success && d.data) {
          const sel = document.getElementById('healthReportSelect');
          sel.innerHTML = '<option value="">选择历史报告...</option>';
          d.data.forEach(rpt => {
            const opt = document.createElement('option');
            opt.value = rpt.id;
            opt.textContent = (rpt.completed_at || rpt.created_at).slice(0,10) + ' - 总分: ' + (rpt.overall_score != null ? rpt.overall_score : 'N/A');
            sel.appendChild(opt);
          });
          // auto-load latest completed
          const latest = d.data.find(r => r.status === 'completed');
          if (latest) { sel.value = latest.id; loadReportDetail(latest.id); }
        }
      } catch(e) {}
    }

    async function runHealthCheck() {
      const btn = document.getElementById('healthRunBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/health/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}'
        });
        const d = await r.json();
        if (d.success && d.data) {
          await loadReportDetail(d.data.report_id);
          loadReportList();
        } else { alert(d.error || 'Health check failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> 运行健康检查';
    }

    async function loadReportDetail(reportId) {
      if (!reportId) return;
      try {
        const token = localStorage.getItem('auth_token') || '';
        const r = await fetch('/api/rag/knowledge/health/reports/' + reportId, { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d.success && d.data) {
          currentReportData = d.data;
          renderScores(d.data);
          renderSuggestions(d.data);
          renderCoverageDetail(d.data);
          renderFreshnessDetail(d.data);
          renderConsistencyDetail(d.data);
          renderHistoryTab();
          document.getElementById('scoreOverview').style.display = 'block';
          document.getElementById('healthTabs').style.display = 'flex';
        }
      } catch(e) {}
    }

    function renderScores(rpt) {
      const overall = rpt.overall_score || 0;
      document.getElementById('overallScoreNum').textContent = Math.round(overall);
      const offset = 264 - (264 * overall / 100);
      document.getElementById('scoreCircle').style.strokeDashoffset = offset;
      const color = overall >= 70 ? '#10b981' : overall >= 40 ? '#f59e0b' : '#ef4444';
      document.getElementById('scoreCircle').style.stroke = color;
      document.getElementById('overallScoreNum').style.color = color;

      document.getElementById('coverageScore').textContent = Math.round(rpt.coverage_score || 0);
      document.getElementById('coverageBar').style.width = (rpt.coverage_score || 0) + '%';
      document.getElementById('freshnessScore').textContent = Math.round(rpt.freshness_score || 0);
      document.getElementById('freshnessBar').style.width = (rpt.freshness_score || 0) + '%';
      document.getElementById('consistencyScore').textContent = Math.round(rpt.consistency_score || 0);
      document.getElementById('consistencyBar').style.width = (rpt.consistency_score || 0) + '%';
    }

    function renderSuggestions(rpt) {
      let suggestions = [];
      try { suggestions = JSON.parse(rpt.suggestions || '[]'); } catch(e) {}
      const container = document.getElementById('hcPanelSuggestions');
      if (!suggestions.length) {
        container.innerHTML = '<div class="rc-card" style="text-align:center;padding:40px;color:#10b981;"><i class="fas fa-check-circle" style="font-size:32px;margin-bottom:12px;display:block;"></i>知识库状态良好，暂无改进建议</div>';
        return;
      }
      container.innerHTML = suggestions.map(s => {
        return '<div class="suggestion-card '+s.severity+'"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>'+escHtml(s.title)+'</strong><span class="severity-badge sev-'+s.severity+'">'+s.severity+'</span></div><p style="font-size:13px;color:#475569;margin:0 0 8px;">'+escHtml(s.description)+'</p><div style="font-size:12px;color:#3b82f6;"><i class="fas fa-wrench"></i> '+escHtml(s.action)+'</div></div>';
      }).join('');
    }

    function renderCoverageDetail(rpt) {
      let details = {};
      try { details = JSON.parse(rpt.coverage_details || '{}'); } catch(e) {}
      const covered = (details.covered_topics || []).map(t => '<span style="display:inline-block;padding:4px 10px;background:#dcfce7;color:#15803d;border-radius:4px;font-size:12px;margin:2px;">'+escHtml(t)+'</span>').join(' ');
      const missing = (details.missing_topics || []).map(t => '<span style="display:inline-block;padding:4px 10px;background:#fef2f2;color:#dc2626;border-radius:4px;font-size:12px;margin:2px;">'+escHtml(t)+'</span>').join(' ');
      document.getElementById('hcPanelCoverage').innerHTML = '<div class="rc-card"><h4 style="margin:0 0 12px;">已覆盖主题</h4><div>'+(covered||'<span style="color:#94a3b8;">无数据</span>')+'</div><h4 style="margin:16px 0 12px;">缺失主题</h4><div>'+(missing||'<span style="color:#94a3b8;">无数据</span>')+'</div>'+(details.reasoning?'<p style="margin-top:16px;font-size:13px;color:#64748b;padding:12px;background:#f8fafc;border-radius:8px;">'+escHtml(details.reasoning)+'</p>':'')+'</div>';
    }

    function renderFreshnessDetail(rpt) {
      let details = {};
      try { details = JSON.parse(rpt.freshness_details || '{}'); } catch(e) {}
      document.getElementById('hcPanelFreshness').innerHTML = '<div class="rc-card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;"><div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#10b981;">'+(details.fresh||0)+'</div><div style="font-size:12px;color:#64748b;">新鲜 Chunk</div></div><div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#f59e0b;">'+(details.stale||0)+'</div><div style="font-size:12px;color:#64748b;">过期 Chunk</div></div><div style="text-align:center;"><div style="font-size:24px;font-weight:700;">'+(details.total||0)+'</div><div style="font-size:12px;color:#64748b;">总 Chunk</div></div></div><p style="font-size:13px;color:#64748b;">过期阈值: '+(details.stale_threshold_days||90)+' 天未更新</p></div>';
    }

    function renderConsistencyDetail(rpt) {
      let details = {};
      try { details = JSON.parse(rpt.consistency_details || '{}'); } catch(e) {}
      const dups = (details.duplicates || []).map(d => '<div class="suggestion-card medium" style="font-size:13px;"><strong>重复 x'+d.count+':</strong> '+escHtml(d.content_preview)+'...<br><span style="font-size:11px;color:#94a3b8;">IDs: '+d.ids+'</span></div>').join('');
      const conflicts = (details.conflicts || []).map(c => '<div class="suggestion-card high" style="font-size:13px;"><strong>冲突:</strong> Chunk #'+c.chunk_a+' vs #'+c.chunk_b+'<br>'+escHtml(c.description)+'</div>').join('');
      document.getElementById('hcPanelConsistency').innerHTML = '<div class="rc-card"><h4 style="margin:0 0 12px;">重复内容 ('+((details.duplicates||[]).length)+')</h4>'+(dups||'<p style="color:#94a3b8;">未发现重复</p>')+'<h4 style="margin:16px 0 12px;">内容冲突 ('+((details.conflicts||[]).length)+')</h4>'+(conflicts||'<p style="color:#94a3b8;">未发现冲突</p>')+'</div>';
    }

    function renderHistoryTab() {
      const sel = document.getElementById('healthReportSelect');
      const opts = Array.from(sel.options).filter(o => o.value);
      if (!opts.length) { document.getElementById('hcPanelHistory').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">暂无历史报告</div>'; return; }
      document.getElementById('hcPanelHistory').innerHTML = '<div class="rc-card"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="padding:10px;text-align:left;">日期</th><th style="padding:10px;text-align:center;">总分</th><th style="padding:10px;text-align:center;">覆盖率</th><th style="padding:10px;text-align:center;">新鲜度</th><th style="padding:10px;text-align:center;">一致性</th><th style="padding:10px;text-align:center;">问题数</th></tr></thead><tbody id="historyTableBody"></tbody></table></div>';
      // populate from dropdown data (simplified - we use the text)
      const tbody = document.getElementById('historyTableBody');
      tbody.innerHTML = opts.map(o => '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="loadReportDetail('+o.value+')"><td style="padding:10px;">'+escHtml(o.textContent)+'</td><td colspan="5" style="padding:10px;text-align:center;color:#94a3b8;">点击查看详情</td></tr>').join('');
    }

    function switchHcTab(tab) {
      ['suggestions','coverage','freshness','consistency','history'].forEach(t => {
        document.getElementById('hcPanel' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
        const tabEl = document.getElementById('hcTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (tabEl) tabEl.classList.toggle('active', t === tab);
      });
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

    loadReportList();
  `;

  return wrapWithRagLayout({ title: '知识库健康度检查', activePath: '/rag/health-check', styles, body, scripts });
}

export function generateRagVersions(): string {
  const body = `
    ${ragPageHeader({
      title: '版本与性能对比',
      icon: 'fas fa-code-branch',
      subtitle: '管理知识库版本快照，对比不同版本的检索性能与质量指标，支持 Diff / A-B 评测 / 回归测试 / 回滚',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '版本管控' }, { label: '版本管理' }],
    })}

    <!-- KPI Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="vTotalVersions" style="font-size:22px;font-weight:700;color:#3b82f6;">-</div>
        <div style="font-size:11px;color:#64748b;">总版本数</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="vActiveVersions" style="font-size:22px;font-weight:700;color:#10b981;">-</div>
        <div style="font-size:11px;color:#64748b;">活跃版本</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="vAvgScore" style="font-size:22px;font-weight:700;color:#f59e0b;">-</div>
        <div style="font-size:11px;color:#64748b;">平均评分</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="vBenchmarks" style="font-size:22px;font-weight:700;color:#a855f7;">-</div>
        <div style="font-size:11px;color:#64748b;">性能基准</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="vRegressions" style="font-size:22px;font-weight:700;color:#ec4899;">-</div>
        <div style="font-size:11px;color:#64748b;">回归测试</div>
      </div>
    </div>

    <!-- Tab Bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div style="border-bottom:2px solid #e2e8f0;display:flex;">
        <button class="v-tab active" onclick="switchVTab('timeline')" id="vTabTimeline" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
          <i class="fas fa-stream"></i> 版本时间线
        </button>
        <button class="v-tab" onclick="switchVTab('diff')" id="vTabDiff" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
          <i class="fas fa-code-compare"></i> Diff 对比
        </button>
        <button class="v-tab" onclick="switchVTab('compare')" id="vTabCompare" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
          <i class="fas fa-chart-bar"></i> A/B 性能对比
        </button>
        <button class="v-tab" onclick="switchVTab('regression')" id="vTabRegression" style="padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-weight:500;">
          <i class="fas fa-vials"></i> 回归测试
        </button>
      </div>
      <button class="rc-btn rc-btn-primary" onclick="showCreateModal()"><i class="fas fa-plus"></i> 创建版本快照</button>
    </div>

    <!-- Timeline Panel -->
    <div id="vPanelTimeline">
      <div class="rc-card" style="margin-bottom:16px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="rc-search" style="flex:1;">
            <i class="fas fa-search"></i>
            <input id="vSearchInput" placeholder="搜索版本名称或标签..." oninput="debounceLoadVersions()">
          </div>
          <select class="rc-select" id="vStatusFilter" style="max-width:140px;" onchange="loadVersions()">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="archived">已归档</option>
            <option value="rolled_back">已回滚</option>
          </select>
        </div>
      </div>
      <div id="vTimelineContainer">
        ${ragEmptyState({ icon: 'fas fa-code-branch', title: '暂无版本记录', description: '点击"创建版本快照"来保存当前知识库状态' })}
      </div>
      <div id="vPagination" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;"></div>
    </div>

    <!-- Diff Panel -->
    <div id="vPanelDiff" style="display:none;">
      <div class="rc-card" style="margin-bottom:16px;">
        <div style="display:flex;gap:16px;align-items:flex-end;">
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 A (基线)</label><select class="rc-select" id="diffVersionA" style="width:100%;"></select></div>
          <div style="padding-bottom:8px;"><i class="fas fa-arrows-alt-h" style="font-size:20px;color:#94a3b8;"></i></div>
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 B (目标)</label><select class="rc-select" id="diffVersionB" style="width:100%;"></select></div>
          <button class="rc-btn rc-btn-primary" onclick="runDiff()" id="diffBtn"><i class="fas fa-exchange-alt"></i> 运行 Diff</button>
        </div>
      </div>
      <div id="diffResults"></div>
    </div>

    <!-- Compare Panel -->
    <div id="vPanelCompare" style="display:none;">
      <div class="rc-card" style="margin-bottom:16px;">
        <div style="display:flex;gap:16px;align-items:flex-end;">
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 A (基线)</label><select class="rc-select" id="cmpVersionA" style="width:100%;"></select></div>
          <div style="padding-bottom:8px;"><i class="fas fa-arrows-alt-h" style="font-size:20px;color:#94a3b8;"></i></div>
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 B (目标)</label><select class="rc-select" id="cmpVersionB" style="width:100%;"></select></div>
          <button class="rc-btn rc-btn-primary" onclick="runCompare()" id="cmpBtn"><i class="fas fa-chart-bar"></i> A/B 对比</button>
        </div>
      </div>
      <div id="compareResults"></div>
    </div>

    <!-- Regression Panel -->
    <div id="vPanelRegression" style="display:none;">
      <div class="rc-card" style="margin-bottom:16px;">
        <div style="display:flex;gap:16px;align-items:flex-end;">
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 A (基线)</label><select class="rc-select" id="regVersionA" style="width:100%;"></select></div>
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">版本 B (目标)</label><select class="rc-select" id="regVersionB" style="width:100%;"></select></div>
          <button class="rc-btn rc-btn-primary" onclick="runRegression()" id="regBtn"><i class="fas fa-vials"></i> 运行回归</button>
        </div>
      </div>
      <div id="regressionResults"></div>
      <div class="rc-card" style="margin-top:16px;">
        <div class="rc-card-title"><i class="fas fa-history"></i> 回归测试历史</div>
        <div id="regressionHistory">${ragEmptyState({ icon: 'fas fa-vials', title: '暂无回归测试', description: '选择两个版本并运行回归测试' })}</div>
      </div>
    </div>

    <!-- Create Version Modal -->
    <div id="createVersionModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999;display:none;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:16px;padding:32px;width:480px;max-width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h3 style="margin:0;font-size:18px;"><i class="fas fa-camera" style="color:#3b82f6;margin-right:8px;"></i>创建版本快照</h3>
          <button onclick="hideCreateModal()" style="border:none;background:none;font-size:20px;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">版本名称 <span style="color:#ef4444;">*</span></label>
          <input class="rc-input" id="newVerName" placeholder="例如: 上线前基线 / 添加年报文档后" style="width:100%;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">版本号 (可选)</label>
          <input class="rc-input" id="newVerLabel" placeholder="留空自动生成 (如 v1.0)" style="width:100%;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">描述</label>
          <textarea class="rc-input" id="newVerDesc" rows="3" placeholder="描述本版本的主要变更..." style="width:100%;resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">标签 (逗号分隔)</label>
          <input class="rc-input" id="newVerTags" placeholder="例如: baseline, v1" style="width:100%;">
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button class="rc-btn" onclick="hideCreateModal()">取消</button>
          <button class="rc-btn rc-btn-primary" onclick="createVersion()" id="createVerBtn"><i class="fas fa-save"></i> 创建快照</button>
        </div>
      </div>
    </div>

    <!-- Version Detail Modal -->
    <div id="versionDetailModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999;display:none;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:16px;padding:32px;width:600px;max-width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h3 id="detailTitle" style="margin:0;font-size:18px;"></h3>
          <button onclick="hideDetailModal()" style="border:none;background:none;font-size:20px;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <div id="detailContent"></div>
      </div>
    </div>
  `;

  const styles = `
    .v-tab.active { color: #3b82f6; border-bottom-color: #3b82f6 !important; font-weight: 600; }
    .v-tab:hover { color: #3b82f6; }
    .v-timeline-item { display: flex; gap: 16px; margin-bottom: 0; position: relative; }
    .v-timeline-line { width: 3px; background: #e2e8f0; position: absolute; left: 18px; top: 40px; bottom: -16px; }
    .v-timeline-dot { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 14px; z-index: 1; }
    .v-timeline-dot.active { background: #dbeafe; color: #3b82f6; border: 2px solid #3b82f6; }
    .v-timeline-dot.archived { background: #f1f5f9; color: #94a3b8; border: 2px solid #cbd5e1; }
    .v-timeline-dot.rolled_back { background: #fef2f2; color: #ef4444; border: 2px solid #ef4444; }
    .v-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; transition: all .2s; margin-bottom: 16px; }
    .v-card:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,.1); }
    .v-status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .v-status.active { background: #dcfce7; color: #15803d; }
    .v-status.archived { background: #f1f5f9; color: #64748b; }
    .v-status.rolled_back { background: #fef2f2; color: #dc2626; }
    .v-tag { display: inline-block; padding: 2px 6px; background: #eff6ff; color: #3b82f6; border-radius: 3px; font-size: 10px; margin-right: 4px; }
    .diff-stat { display: flex; gap: 24px; margin-bottom: 16px; }
    .diff-stat-item { text-align: center; }
    .diff-stat-num { font-size: 28px; font-weight: 700; }
    .diff-added { color: #10b981; }
    .diff-removed { color: #ef4444; }
    .diff-modified { color: #f59e0b; }
    .diff-unchanged { color: #94a3b8; }
    .diff-chunk { padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; font-size: 13px; }
    .diff-chunk.added { background: #f0fdf4; border-left: 3px solid #10b981; }
    .diff-chunk.removed { background: #fef2f2; border-left: 3px solid #ef4444; }
    .diff-chunk.modified { background: #fffbeb; border-left: 3px solid #f59e0b; }
    .cmp-metric { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .cmp-metric:last-child { border-bottom: none; }
    .cmp-label { width: 120px; font-weight: 600; font-size: 13px; }
    .cmp-bar { flex: 1; display: flex; align-items: center; gap: 8px; }
    .cmp-value { width: 60px; text-align: center; font-weight: 700; font-size: 14px; }
    .cmp-diff { width: 80px; text-align: center; font-size: 13px; font-weight: 600; }
    .cmp-diff.positive { color: #10b981; }
    .cmp-diff.negative { color: #ef4444; }
    .cmp-diff.neutral { color: #94a3b8; }
    .rec-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .rec-upgrade { background: #dcfce7; color: #15803d; }
    .rec-rollback { background: #fef2f2; color: #dc2626; }
    .rec-neutral { background: #f1f5f9; color: #64748b; }
    .reg-row { display: flex; gap: 8px; padding: 8px 12px; border-radius: 8px; margin-bottom: 4px; font-size: 13px; align-items: center; }
    .reg-row.improved { background: #f0fdf4; }
    .reg-row.degraded { background: #fef2f2; }
    .reg-row.unchanged { background: #f8fafc; }
  `;

  const scripts = `
    var vLimit = 10, vOffset = 0, allVersions = [];
    var debounceTimer = null;

    function debounceLoadVersions() { clearTimeout(debounceTimer); debounceTimer = setTimeout(function() { vOffset = 0; loadVersions(); }, 300); }

    async function apiFetch(path, opts) {
      var token = localStorage.getItem('auth_token') || '';
      var headers = { Authorization: 'Bearer ' + token };
      if (opts && opts.body) headers['Content-Type'] = 'application/json';
      var r = await fetch(path, Object.assign({ headers: headers }, opts || {}));
      return r.json();
    }

    // ========== Stats ==========
    async function loadStats() {
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/stats');
        if (d.success && d.data) {
          document.getElementById('vTotalVersions').textContent = d.data.total_versions;
          document.getElementById('vActiveVersions').textContent = d.data.active_versions;
          document.getElementById('vAvgScore').textContent = d.data.avg_score != null ? d.data.avg_score : '-';
          document.getElementById('vBenchmarks').textContent = d.data.total_benchmarks;
          document.getElementById('vRegressions').textContent = d.data.total_regressions;
        }
      } catch(e) {}
    }

    // ========== Version List ==========
    async function loadVersions() {
      try {
        var search = document.getElementById('vSearchInput').value;
        var status = document.getElementById('vStatusFilter').value;
        var params = 'limit=' + vLimit + '&offset=' + vOffset;
        if (search) params += '&search=' + encodeURIComponent(search);
        if (status) params += '&status=' + status;
        var d = await apiFetch('/api/rag/knowledge/versions?' + params);
        if (d.success) {
          allVersions = d.data || [];
          renderTimeline(allVersions, d.total || 0);
          populateVersionSelects(allVersions);
        }
      } catch(e) {}
    }

    function renderTimeline(versions, total) {
      var c = document.getElementById('vTimelineContainer');
      if (!versions.length) {
        c.innerHTML = '<div class="rc-card" style="text-align:center;padding:40px;"><i class="fas fa-code-branch" style="font-size:32px;color:#cbd5e1;margin-bottom:12px;display:block;"></i><div style="color:#94a3b8;">暂无版本记录</div></div>';
        document.getElementById('vPagination').innerHTML = '';
        return;
      }
      c.innerHTML = versions.map(function(v, i) {
        var tags = []; try { tags = JSON.parse(v.tags || '[]'); } catch(e) {}
        var tagsHtml = tags.map(function(t) { return '<span class="v-tag">' + escHtml(t) + '</span>'; }).join('');
        var isLast = i === versions.length - 1;
        return '<div class="v-timeline-item">' +
          (!isLast ? '<div class="v-timeline-line"></div>' : '') +
          '<div class="v-timeline-dot ' + v.status + '">' + v.version_label.replace('v','') + '</div>' +
          '<div class="v-card" onclick="showVersionDetail(' + v.id + ')">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
              '<div><strong style="font-size:15px;">' + escHtml(v.version_label) + ' - ' + escHtml(v.name) + '</strong>' +
              '<span class="v-status ' + v.status + '" style="margin-left:8px;">' + v.status + '</span></div>' +
              '<div style="font-size:12px;color:#94a3b8;">' + (v.created_at || '').slice(0, 16).replace('T',' ') + '</div>' +
            '</div>' +
            (v.description ? '<div style="font-size:13px;color:#64748b;margin-bottom:8px;">' + escHtml(v.description) + '</div>' : '') +
            '<div style="display:flex;gap:16px;align-items:center;font-size:12px;color:#64748b;">' +
              '<span><i class="fas fa-file"></i> ' + v.total_documents + ' 文档</span>' +
              '<span><i class="fas fa-puzzle-piece"></i> ' + v.total_chunks + ' Chunks</span>' +
              (v.eval_score != null ? '<span><i class="fas fa-star" style="color:#f59e0b;"></i> ' + v.eval_score + '</span>' : '') +
              (v.embedding_model ? '<span><i class="fas fa-brain"></i> ' + escHtml(v.embedding_model) + '</span>' : '') +
              (tagsHtml ? '<span>' + tagsHtml + '</span>' : '') +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;">' +
              '<button class="rc-btn" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();archiveVersion(' + v.id + ')"><i class="fas fa-archive"></i> 归档</button>' +
              '<button class="rc-btn" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();rollbackVersion(' + v.id + ')"><i class="fas fa-undo"></i> 回滚</button>' +
              '<button class="rc-btn" style="font-size:11px;padding:4px 10px;color:#ef4444;" onclick="event.stopPropagation();deleteVersion(' + v.id + ')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
          '</div></div>';
      }).join('');

      // Pagination
      var pages = Math.ceil(total / vLimit);
      var current = Math.floor(vOffset / vLimit) + 1;
      document.getElementById('vPagination').innerHTML = pages > 1 ?
        '<span style="font-size:13px;color:#64748b;">第 ' + current + '/' + pages + ' 页 (共 ' + total + ' 个版本)</span>' +
        '<button class="rc-btn" onclick="vPage(-1)"' + (current <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>' +
        '<button class="rc-btn" onclick="vPage(1)"' + (current >= pages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>' :
        '<span style="font-size:13px;color:#64748b;">共 ' + total + ' 个版本</span>';
    }

    function vPage(dir) { vOffset = Math.max(0, vOffset + dir * vLimit); loadVersions(); }

    function populateVersionSelects(versions) {
      var selectors = ['diffVersionA','diffVersionB','cmpVersionA','cmpVersionB','regVersionA','regVersionB'];
      selectors.forEach(function(id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var curVal = sel.value;
        sel.innerHTML = '<option value="">选择版本...</option>';
        versions.forEach(function(v) {
          var opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.version_label + ' - ' + v.name + (v.eval_score != null ? ' (' + v.eval_score + ')' : '');
          sel.appendChild(opt);
        });
        if (curVal) sel.value = curVal;
      });
    }

    // ========== Create Version ==========
    function showCreateModal() { document.getElementById('createVersionModal').style.display = 'flex'; }
    function hideCreateModal() { document.getElementById('createVersionModal').style.display = 'none'; }

    async function createVersion() {
      var name = document.getElementById('newVerName').value.trim();
      if (!name) { alert('请输入版本名称'); return; }
      var btn = document.getElementById('createVerBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
      try {
        var body = { name: name };
        var label = document.getElementById('newVerLabel').value.trim();
        var desc = document.getElementById('newVerDesc').value.trim();
        var tags = document.getElementById('newVerTags').value.trim();
        if (label) body.version_label = label;
        if (desc) body.description = desc;
        if (tags) body.tags = tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
        var d = await apiFetch('/api/rag/knowledge/versions', { method: 'POST', body: JSON.stringify(body) });
        if (d.success) {
          hideCreateModal();
          document.getElementById('newVerName').value = '';
          document.getElementById('newVerLabel').value = '';
          document.getElementById('newVerDesc').value = '';
          document.getElementById('newVerTags').value = '';
          loadVersions();
          loadStats();
          alert('版本 ' + d.data.version_label + ' 创建成功！');
        } else { alert(d.error || 'Creation failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 创建快照';
    }

    // ========== Version Actions ==========
    async function archiveVersion(id) {
      if (!confirm('确认归档此版本？')) return;
      await apiFetch('/api/rag/knowledge/versions/' + id, { method: 'PUT', body: JSON.stringify({ status: 'archived' }) });
      loadVersions(); loadStats();
    }
    async function rollbackVersion(id) {
      if (!confirm('确认回滚到此版本？将创建一个新的回滚标记版本。')) return;
      var d = await apiFetch('/api/rag/knowledge/versions/' + id + '/rollback', { method: 'POST', body: '{}' });
      if (d.success) { alert('已回滚，新版本 ID: ' + d.data.new_version_id); loadVersions(); loadStats(); }
      else alert(d.error || 'Rollback failed');
    }
    async function deleteVersion(id) {
      if (!confirm('确认删除此版本？此操作不可恢复。')) return;
      await apiFetch('/api/rag/knowledge/versions/' + id, { method: 'DELETE' });
      loadVersions(); loadStats();
    }

    // ========== Version Detail ==========
    async function showVersionDetail(id) {
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/' + id);
        if (!d.success || !d.data) return;
        var v = d.data;
        document.getElementById('detailTitle').innerHTML = '<i class="fas fa-code-branch" style="color:#3b82f6;margin-right:8px;"></i>' + escHtml(v.version_label) + ' - ' + escHtml(v.name);
        var config = {}; try { config = JSON.parse(v.config_snapshot || '{}'); } catch(e) {}
        var tags = []; try { tags = JSON.parse(v.tags || '[]'); } catch(e) {}
        document.getElementById('detailContent').innerHTML =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
            '<div><strong style="font-size:12px;color:#64748b;">状态</strong><div><span class="v-status ' + v.status + '">' + v.status + '</span></div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">创建时间</strong><div>' + (v.created_at||'').slice(0,16).replace('T',' ') + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">文档数</strong><div>' + v.total_documents + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">Chunk 数</strong><div>' + v.total_chunks + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">嵌入模型</strong><div>' + escHtml(v.embedding_model || 'N/A') + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">LLM 模型</strong><div>' + escHtml(v.llm_model || 'N/A') + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">切片策略</strong><div>' + escHtml(v.chunk_strategy || 'N/A') + '</div></div>' +
            '<div><strong style="font-size:12px;color:#64748b;">评测分数</strong><div style="font-weight:700;color:#f59e0b;">' + (v.eval_score != null ? v.eval_score : 'N/A') + '</div></div>' +
          '</div>' +
          (v.description ? '<div style="margin-bottom:12px;"><strong style="font-size:12px;color:#64748b;">描述</strong><div style="font-size:13px;">' + escHtml(v.description) + '</div></div>' : '') +
          (tags.length ? '<div style="margin-bottom:12px;"><strong style="font-size:12px;color:#64748b;">标签</strong><div style="margin-top:4px;">' + tags.map(function(t) { return '<span class="v-tag">' + escHtml(t) + '</span>'; }).join('') + '</div></div>' : '');
        document.getElementById('versionDetailModal').style.display = 'flex';
      } catch(e) {}
    }
    function hideDetailModal() { document.getElementById('versionDetailModal').style.display = 'none'; }

    // ========== Diff ==========
    async function runDiff() {
      var a = document.getElementById('diffVersionA').value;
      var b = document.getElementById('diffVersionB').value;
      if (!a || !b) { alert('请选择两个版本'); return; }
      if (a === b) { alert('请选择不同的版本'); return; }
      var btn = document.getElementById('diffBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 对比中...';
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/diff', { method: 'POST', body: JSON.stringify({ version_a_id: Number(a), version_b_id: Number(b) }) });
        if (d.success && d.data) { renderDiff(d.data); }
        else { alert(d.error || 'Diff failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-exchange-alt"></i> 运行 Diff';
    }

    function renderDiff(diff) {
      var html = '<div class="rc-card"><div class="diff-stat">' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-added">+' + diff.added + '</div><div style="font-size:12px;color:#64748b;">新增</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-removed">-' + diff.removed + '</div><div style="font-size:12px;color:#64748b;">删除</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-modified">~' + diff.modified + '</div><div style="font-size:12px;color:#64748b;">修改</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-unchanged">' + diff.unchanged + '</div><div style="font-size:12px;color:#64748b;">未变</div></div>' +
        '</div></div>';

      if (diff.added_chunks && diff.added_chunks.length) {
        html += '<div class="rc-card" style="margin-top:12px;"><h4 style="margin:0 0 12px;color:#10b981;"><i class="fas fa-plus-circle"></i> 新增 Chunk (' + diff.added + ')</h4>';
        diff.added_chunks.forEach(function(c) {
          html += '<div class="diff-chunk added"><strong>Chunk #' + c.chunk_id + '</strong><br>' + escHtml(c.preview) + '</div>';
        });
        html += '</div>';
      }
      if (diff.removed_chunks && diff.removed_chunks.length) {
        html += '<div class="rc-card" style="margin-top:12px;"><h4 style="margin:0 0 12px;color:#ef4444;"><i class="fas fa-minus-circle"></i> 删除 Chunk (' + diff.removed + ')</h4>';
        diff.removed_chunks.forEach(function(c) {
          html += '<div class="diff-chunk removed"><strong>Chunk #' + c.chunk_id + '</strong><br>' + escHtml(c.preview) + '</div>';
        });
        html += '</div>';
      }
      if (diff.modified_chunks && diff.modified_chunks.length) {
        html += '<div class="rc-card" style="margin-top:12px;"><h4 style="margin:0 0 12px;color:#f59e0b;"><i class="fas fa-edit"></i> 修改 Chunk (' + diff.modified + ')</h4>';
        diff.modified_chunks.forEach(function(c) {
          html += '<div class="diff-chunk modified"><strong>Chunk #' + c.chunk_id + '</strong><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;"><div style="padding:8px;background:#fef2f2;border-radius:6px;font-size:12px;"><strong style="color:#ef4444;">Before:</strong><br>' + escHtml(c.preview_old) + '</div><div style="padding:8px;background:#f0fdf4;border-radius:6px;font-size:12px;"><strong style="color:#10b981;">After:</strong><br>' + escHtml(c.preview_new) + '</div></div></div>';
        });
        html += '</div>';
      }
      document.getElementById('diffResults').innerHTML = html;
    }

    // ========== A/B Compare ==========
    async function runCompare() {
      var a = document.getElementById('cmpVersionA').value;
      var b = document.getElementById('cmpVersionB').value;
      if (!a || !b) { alert('请选择两个版本'); return; }
      if (a === b) { alert('请选择不同的版本'); return; }
      var btn = document.getElementById('cmpBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 对比中...';
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/compare', { method: 'POST', body: JSON.stringify({ version_a_id: Number(a), version_b_id: Number(b) }) });
        if (d.success && d.data) { renderCompare(d.data); }
        else { alert(d.error || 'Compare failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-chart-bar"></i> A/B 对比';
    }

    function renderCompare(data) {
      var pc = data.performance_comparison;
      var vA = data.version_a; var vB = data.version_b;

      function metricRow(label, metric, isLatency) {
        var valA = metric.a != null ? metric.a.toFixed(1) : 'N/A';
        var valB = metric.b != null ? metric.b.toFixed(1) : 'N/A';
        var d = metric.diff;
        var diffClass = d == null ? 'neutral' : (isLatency ? (d < 0 ? 'positive' : d > 0 ? 'negative' : 'neutral') : (d > 0 ? 'positive' : d < 0 ? 'negative' : 'neutral'));
        var diffText = d == null ? '-' : (d > 0 ? '+' : '') + d.toFixed(1);
        return '<div class="cmp-metric"><div class="cmp-label">' + label + '</div><div class="cmp-value" style="color:#3b82f6;">' + valA + '</div><div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;position:relative;margin:0 12px;"><div style="position:absolute;left:50%;top:-3px;width:2px;height:12px;background:#94a3b8;"></div></div><div class="cmp-value" style="color:#10b981;">' + valB + '</div><div class="cmp-diff ' + diffClass + '">' + diffText + '</div></div>';
      }

      var recClass = data.recommendation === 'upgrade' ? 'rec-upgrade' : data.recommendation === 'rollback' ? 'rec-rollback' : 'rec-neutral';
      var recText = data.recommendation === 'upgrade' ? 'UPGRADE' : data.recommendation === 'rollback' ? 'ROLLBACK' : 'NEUTRAL';

      var html = '<div class="rc-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<div><span style="font-weight:700;color:#3b82f6;">' + escHtml(vA ? vA.version_label : 'A') + '</span> vs <span style="font-weight:700;color:#10b981;">' + escHtml(vB ? vB.version_label : 'B') + '</span></div>' +
          '<span class="rec-badge ' + recClass + '"><i class="fas fa-' + (data.recommendation === 'upgrade' ? 'arrow-up' : data.recommendation === 'rollback' ? 'arrow-down' : 'equals') + '"></i> ' + recText + '</span>' +
        '</div>' +
        '<div style="display:flex;padding:8px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#94a3b8;font-weight:600;">' +
          '<div style="width:120px;">指标</div><div style="width:60px;text-align:center;">版本 A</div><div style="flex:1;"></div><div style="width:60px;text-align:center;">版本 B</div><div style="width:80px;text-align:center;">差值</div>' +
        '</div>' +
        metricRow('总分', pc.overall, false) +
        metricRow('精确匹配', pc.exact_match, false) +
        metricRow('语义相似', pc.semantic, false) +
        metricRow('召回率', pc.recall, false) +
        metricRow('引用准确', pc.citation, false) +
        metricRow('延迟 (ms)', pc.latency, true) +
        '</div>';

      // Diff summary
      var diff = data.diff;
      html += '<div class="rc-card" style="margin-top:12px;"><h4 style="margin:0 0 12px;"><i class="fas fa-code-compare"></i> Chunk 变化概览</h4>' +
        '<div class="diff-stat">' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-added">+' + diff.added + '</div><div style="font-size:12px;color:#64748b;">新增</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-removed">-' + diff.removed + '</div><div style="font-size:12px;color:#64748b;">删除</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-modified">~' + diff.modified + '</div><div style="font-size:12px;color:#64748b;">修改</div></div>' +
        '<div class="diff-stat-item"><div class="diff-stat-num diff-unchanged">' + diff.unchanged + '</div><div style="font-size:12px;color:#64748b;">未变</div></div>' +
        '</div></div>';

      document.getElementById('compareResults').innerHTML = html;
    }

    // ========== Regression ==========
    async function runRegression() {
      var a = document.getElementById('regVersionA').value;
      var b = document.getElementById('regVersionB').value;
      if (!a || !b) { alert('请选择两个版本'); return; }
      if (a === b) { alert('请选择不同的版本'); return; }
      var btn = document.getElementById('regBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 运行中...';
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/regression', { method: 'POST', body: JSON.stringify({ version_a_id: Number(a), version_b_id: Number(b) }) });
        if (d.success && d.data) {
          // Load the completed regression result
          setTimeout(async function() {
            var r = await apiFetch('/api/rag/knowledge/versions/regression/' + d.data.regression_id);
            if (r.success && r.data) { renderRegression(r.data); }
            loadRegressionHistory();
            loadStats();
          }, 500);
        } else { alert(d.error || 'Regression failed'); }
      } catch(e) { alert('Error: ' + e.message); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-vials"></i> 运行回归';
    }

    function renderRegression(reg) {
      var summary = {}; try { summary = JSON.parse(reg.summary || '{}'); } catch(e) {}
      var details = []; try { details = JSON.parse(reg.comparison_details || '[]'); } catch(e) {}

      var recClass = reg.recommendation === 'upgrade' ? 'rec-upgrade' : reg.recommendation === 'rollback' ? 'rec-rollback' : 'rec-neutral';
      var recText = reg.recommendation === 'upgrade' ? 'UPGRADE' : reg.recommendation === 'rollback' ? 'ROLLBACK' : 'NEUTRAL';

      var html = '<div class="rc-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<h4 style="margin:0;"><i class="fas fa-vials"></i> 回归测试结果</h4>' +
          '<div><span class="v-status ' + reg.status + '">' + reg.status + '</span> <span class="rec-badge ' + recClass + '">' + recText + '</span></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px;">' +
          '<div style="text-align:center;padding:12px;background:#f8fafc;border-radius:8px;"><div style="font-size:24px;font-weight:700;color:' + (reg.score_diff > 0 ? '#10b981' : reg.score_diff < 0 ? '#ef4444' : '#94a3b8') + ';">' + (reg.score_diff > 0 ? '+' : '') + (reg.score_diff||0).toFixed(1) + '</div><div style="font-size:11px;color:#64748b;">分差</div></div>' +
          '<div style="text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#10b981;">' + reg.improved_count + '</div><div style="font-size:11px;color:#64748b;">改善</div></div>' +
          '<div style="text-align:center;padding:12px;background:#fef2f2;border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#ef4444;">' + reg.degraded_count + '</div><div style="font-size:11px;color:#64748b;">退步</div></div>' +
          '<div style="text-align:center;padding:12px;background:#f8fafc;border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#94a3b8;">' + reg.unchanged_count + '</div><div style="font-size:11px;color:#64748b;">持平</div></div>' +
        '</div>';

      if (summary.analysis) {
        html += '<div style="padding:12px;background:#f8fafc;border-radius:8px;margin-bottom:16px;font-size:13px;"><strong>分析:</strong> ' + escHtml(summary.analysis) + '</div>';
      }
      if (summary.key_findings && summary.key_findings.length) {
        html += '<div style="margin-bottom:16px;"><strong style="font-size:13px;">关键发现:</strong><ul style="margin:6px 0 0 20px;font-size:13px;">';
        summary.key_findings.forEach(function(f) { html += '<li>' + escHtml(f) + '</li>'; });
        html += '</ul></div>';
      }

      // Per-question details
      if (details.length) {
        html += '<div style="margin-top:12px;"><strong style="font-size:13px;">逐题对比 (' + details.length + '):</strong><div style="margin-top:8px;max-height:300px;overflow-y:auto;">';
        details.forEach(function(d) {
          html += '<div class="reg-row ' + d.direction + '"><span style="width:16px;text-align:center;">' +
            (d.direction === 'improved' ? '<i class="fas fa-arrow-up" style="color:#10b981;"></i>' : d.direction === 'degraded' ? '<i class="fas fa-arrow-down" style="color:#ef4444;"></i>' : '<i class="fas fa-equals" style="color:#94a3b8;"></i>') +
            '</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(d.question) + '</span><span style="width:50px;text-align:center;">' + (d.score_a||0).toFixed(1) + '</span><span style="width:20px;text-align:center;color:#94a3b8;">&rarr;</span><span style="width:50px;text-align:center;">' + (d.score_b||0).toFixed(1) + '</span><span style="width:60px;text-align:center;font-weight:600;color:' + (d.diff > 0 ? '#10b981' : d.diff < 0 ? '#ef4444' : '#94a3b8') + ';">' + (d.diff > 0 ? '+' : '') + d.diff.toFixed(1) + '</span></div>';
        });
        html += '</div></div>';
      }

      html += '</div>';
      document.getElementById('regressionResults').innerHTML = html;
    }

    async function loadRegressionHistory() {
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/regressions/list?limit=10');
        if (d.success && d.data && d.data.length) {
          var c = document.getElementById('regressionHistory');
          c.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="padding:8px;text-align:left;">时间</th><th style="padding:8px;text-align:center;">版本 A</th><th style="padding:8px;text-align:center;">版本 B</th><th style="padding:8px;text-align:center;">分差</th><th style="padding:8px;text-align:center;">建议</th><th style="padding:8px;text-align:center;">状态</th></tr></thead><tbody>' +
            d.data.map(function(r) {
              var recClass = r.recommendation === 'upgrade' ? 'rec-upgrade' : r.recommendation === 'rollback' ? 'rec-rollback' : 'rec-neutral';
              return '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="loadRegressionDetail(' + r.id + ')"><td style="padding:8px;">' + (r.created_at||'').slice(0,16).replace('T',' ') + '</td><td style="padding:8px;text-align:center;">ID ' + r.version_a_id + '</td><td style="padding:8px;text-align:center;">ID ' + r.version_b_id + '</td><td style="padding:8px;text-align:center;font-weight:700;color:' + (r.score_diff > 0 ? '#10b981' : r.score_diff < 0 ? '#ef4444' : '#94a3b8') + ';">' + (r.score_diff > 0 ? '+' : '') + (r.score_diff||0).toFixed(1) + '</td><td style="padding:8px;text-align:center;"><span class="rec-badge ' + recClass + '">' + (r.recommendation||'N/A') + '</span></td><td style="padding:8px;text-align:center;"><span class="v-status ' + r.status + '">' + r.status + '</span></td></tr>';
            }).join('') + '</tbody></table>';
        }
      } catch(e) {}
    }

    async function loadRegressionDetail(id) {
      try {
        var d = await apiFetch('/api/rag/knowledge/versions/regression/' + id);
        if (d.success && d.data) { renderRegression(d.data); }
      } catch(e) {}
    }

    // ========== Tab Switch ==========
    function switchVTab(tab) {
      ['timeline','diff','compare','regression'].forEach(function(t) {
        document.getElementById('vPanel' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
        var tabEl = document.getElementById('vTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (tabEl) tabEl.classList.toggle('active', t === tab);
      });
    }

    function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    // Init
    loadStats();
    loadVersions();
    loadRegressionHistory();
  `;

  return wrapWithRagLayout({ title: '版本与性能对比', activePath: '/rag/versions', styles, body, scripts });
}

export function generateRagLogChat(): string {
  const body = `
    ${ragPageHeader({
      title: '对话日志',
      icon: 'fas fa-history',
      subtitle: '查看所有问答对话的完整记录，包含检索来源、意图类型和响应时间',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '运维监控' }, { label: '对话日志' }],
    })}

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="logTotal" style="font-size:22px;font-weight:700;color:#3b82f6;">-</div>
        <div style="font-size:11px;color:#64748b;">总查询数</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="logSuccess" style="font-size:22px;font-weight:700;color:#4ade80;">-</div>
        <div style="font-size:11px;color:#64748b;">成功率</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="logAvgLatency" style="font-size:22px;font-weight:700;color:#f59e0b;">-</div>
        <div style="font-size:11px;color:#64748b;">平均延迟</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="logHybrid" style="font-size:22px;font-weight:700;color:#a855f7;">-</div>
        <div style="font-size:11px;color:#64748b;">混合检索占比</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="rc-card" style="margin-bottom:20px;">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="rc-search" style="flex:1;min-width:200px;">
          <i class="fas fa-search"></i>
          <input id="logSearchInput" placeholder="搜索查询内容..." oninput="debounceLoadLogs()">
        </div>
        <select class="rc-select" id="filterIntent" style="max-width:140px;" onchange="loadLogs()">
          <option value="">全部意图</option>
          <option value="number">数值</option>
          <option value="name">名称</option>
          <option value="boolean">布尔</option>
          <option value="comparative">对比</option>
          <option value="open">开放</option>
          <option value="string">文本</option>
        </select>
        <select class="rc-select" id="filterLogStatus" style="max-width:120px;" onchange="loadLogs()">
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
        <span id="logCount" style="font-size:12px;color:#64748b;"></span>
      </div>
    </div>

    <!-- Log table -->
    <div class="rc-card">
      <div class="rc-table-wrap">
        <table class="rc-table">
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th>查询内容</th>
              <th>意图</th>
              <th>检索</th>
              <th>耗时</th>
              <th>状态</th>
              <th>时间</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody id="logTableBody">
            <tr><td colspan="8" style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rc-pagination" id="logPagination"></div>
    </div>

    <!-- Detail modal -->
    <div id="logDetailModal" class="log-modal-overlay" style="display:none;">
      <div class="log-modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-file-alt" style="color:#d4af37;margin-right:8px;"></i>查询日志详情</h3>
          <button onclick="closeLogDetail()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div id="logDetailContent"></div>
      </div>
    </div>`;

  const styles = `
    .intent-badge { display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500; }
    .intent-number { background:rgba(59,130,246,0.12);color:#60a5fa; }
    .intent-name { background:rgba(34,197,94,0.12);color:#4ade80; }
    .intent-boolean { background:rgba(245,158,11,0.12);color:#fbbf24; }
    .intent-comparative { background:rgba(168,85,247,0.12);color:#a855f7; }
    .intent-open { background:rgba(236,72,153,0.12);color:#f472b6; }
    .intent-string { background:rgba(148,163,184,0.12);color:#94a3b8; }
    .log-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center; }
    .log-modal-content { background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:800px;max-height:90vh;overflow-y:auto;padding:28px; }
    .log-detail-grid { display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:13px; }
    .log-detail-grid dt { color:#64748b;white-space:nowrap; }
    .log-detail-grid dd { color:#e2e8f0;margin:0; }
    .log-latency-bar { height:6px;border-radius:3px;overflow:hidden;background:rgba(15,23,42,0.6); }
    .log-latency-fill { height:100%;border-radius:3px; }
  `;

  const scripts = `
    var logOffset = 0, logLimit = 20;
    var intentLabels = { number:'数值', name:'名称', boolean:'布尔', comparative:'对比', open:'开放', string:'文本' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    var searchTimer;
    function debounceLoadLogs() { clearTimeout(searchTimer); searchTimer = setTimeout(function() { logOffset = 0; loadLogs(); }, 400); }

    async function loadLogStats() {
      try {
        var resp = await fetch('/api/rag/logs/stats', { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success) {
          var rs = d.retrievalStats || {};
          document.getElementById('logTotal').textContent = (rs.total_queries || 0).toLocaleString();
          var sRate = rs.total_queries > 0 ? ((rs.success_count || 0) / rs.total_queries * 100).toFixed(1) + '%' : '-';
          document.getElementById('logSuccess').textContent = sRate;
          document.getElementById('logAvgLatency').textContent = rs.avg_latency ? (rs.avg_latency / 1000).toFixed(1) + 's' : '-';
          var hybridPct = rs.total_queries > 0 ? ((rs.hybrid_count || 0) / rs.total_queries * 100).toFixed(0) + '%' : '-';
          document.getElementById('logHybrid').textContent = hybridPct;
        }
      } catch(e) {}
    }

    async function loadLogs() {
      var intent = document.getElementById('filterIntent').value;
      var status = document.getElementById('filterLogStatus').value;
      var params = new URLSearchParams();
      if (intent) params.set('intentType', intent);
      if (status) params.set('status', status);
      params.set('limit', logLimit);
      params.set('offset', logOffset);
      try {
        var resp = await fetch('/api/rag/logs/recent?' + params.toString(), { headers: getAuthHeaders() });
        var d = await resp.json();
        var logs = d.logs || (d.success ? d.logs : []) || [];
        renderLogs(logs);
        document.getElementById('logCount').textContent = logs.length + ' 条日志';
      } catch(e) {
        document.getElementById('logTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:#f87171;">加载失败</td></tr>';
      }
    }

    function renderLogs(logs) {
      var tbody = document.getElementById('logTableBody');
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#64748b;">暂无日志记录</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map(function(l, i) {
        var intentClass = 'intent-' + (l.intent_type || 'string');
        var latency = l.total_latency_ms ? (l.total_latency_ms / 1000).toFixed(1) + 's' : '-';
        var retrieval = 'V:' + (l.vector_results_count || 0) + ' B:' + (l.bm25_results_count || 0);
        var statusHtml = l.status === 'error' ? '<span style="color:#f87171;"><i class="fas fa-times-circle"></i> 失败</span>' : '<span style="color:#4ade80;"><i class="fas fa-check-circle"></i> 成功</span>';
        var time = l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';
        return '<tr>' +
          '<td style="color:#475569;">' + (logOffset + i + 1) + '</td>' +
          '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e2e8f0;">' + escapeHtml(l.user_query || '') + '</td>' +
          '<td><span class="intent-badge ' + intentClass + '">' + (intentLabels[l.intent_type] || l.intent_type || '-') + '</span>' + (l.intent_confidence ? '<span style="font-size:10px;color:#475569;margin-left:4px;">' + Math.round(l.intent_confidence * 100) + '%</span>' : '') + '</td>' +
          '<td style="font-size:12px;color:#94a3b8;font-family:monospace;">' + retrieval + '</td>' +
          '<td style="font-size:12px;color:#d4af37;font-family:monospace;">' + latency + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td style="font-size:11px;color:#64748b;">' + time + '</td>' +
          '<td style="text-align:right;"><button class="rc-btn rc-btn-sm rc-btn-outline" onclick="viewLogDetail(' + l.id + ')" title="详情"><i class="fas fa-eye"></i></button></td>' +
          '</tr>';
      }).join('');
    }

    async function viewLogDetail(logId) {
      try {
        var resp = await fetch('/api/rag/logs/detail/' + logId, { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success && d.log) {
          var l = d.log;
          var totalMs = l.total_latency_ms || 1;
          function barWidth(ms) { return Math.max(2, Math.min(100, (ms / totalMs * 100))); }
          var html = '<dl class="log-detail-grid">' +
            '<dt>查询:</dt><dd style="font-weight:500;">' + escapeHtml(l.user_query || '') + '</dd>' +
            (l.rewritten_query ? '<dt>改写:</dt><dd style="color:#d4af37;">' + escapeHtml(l.rewritten_query) + '</dd>' : '') +
            '<dt>意图:</dt><dd><span class="intent-badge intent-' + (l.intent_type || 'string') + '">' + (intentLabels[l.intent_type] || l.intent_type || '-') + '</span> 置信度: ' + (l.intent_confidence ? Math.round(l.intent_confidence * 100) + '%' : '-') + '</dd>' +
            '<dt>实体:</dt><dd>' + (l.intent_entities && l.intent_entities.length ? l.intent_entities.map(function(e) { return '<span style="padding:1px 6px;border-radius:4px;background:rgba(59,130,246,0.1);color:#60a5fa;font-size:11px;margin-right:4px;">' + escapeHtml(e) + '</span>'; }).join('') : '<span style="color:#475569;">无</span>') + '</dd>' +
            '<dt>会话:</dt><dd style="font-size:11px;font-family:monospace;color:#64748b;">' + (l.session_id || '-') + '</dd>' +
            '</dl>' +
            '<div style="margin-top:16px;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:8px;">Pipeline 耗时分解</div>' +
            '<div style="display:grid;gap:8px;">' +
              '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;">意图识别</span><span style="color:#d4af37;">' + (l.intent_latency_ms || 0) + 'ms</span></div><div class="log-latency-bar"><div class="log-latency-fill" style="width:' + barWidth(l.intent_latency_ms || 0) + '%;background:#a855f7;"></div></div></div>' +
              '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;">向量检索 (' + (l.vector_results_count || 0) + ' 条, Top ' + ((l.vector_top_score || 0) * 100).toFixed(0) + '%)</span><span style="color:#d4af37;">' + (l.vector_latency_ms || 0) + 'ms</span></div><div class="log-latency-bar"><div class="log-latency-fill" style="width:' + barWidth(l.vector_latency_ms || 0) + '%;background:#3b82f6;"></div></div></div>' +
              '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;">BM25 检索 (' + (l.bm25_results_count || 0) + ' 条, Top ' + (l.bm25_top_score || 0).toFixed(2) + ')</span><span style="color:#d4af37;">' + (l.bm25_latency_ms || 0) + 'ms</span></div><div class="log-latency-bar"><div class="log-latency-fill" style="width:' + barWidth(l.bm25_latency_ms || 0) + '%;background:#22c55e;"></div></div></div>' +
              (l.rerank_enabled ? '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;">LLM 重排 (' + l.rerank_input_count + ' → ' + l.rerank_output_count + ')</span><span style="color:#d4af37;">' + (l.rerank_latency_ms || 0) + 'ms</span></div><div class="log-latency-bar"><div class="log-latency-fill" style="width:' + barWidth(l.rerank_latency_ms || 0) + '%;background:#f59e0b;"></div></div></div>' : '') +
              '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;">LLM 生成 (' + (l.llm_model || '') + ', ' + (l.llm_input_tokens || 0) + ' → ' + (l.llm_output_tokens || 0) + ' tokens)</span><span style="color:#d4af37;">' + (l.llm_latency_ms || 0) + 'ms</span></div><div class="log-latency-bar"><div class="log-latency-fill" style="width:' + barWidth(l.llm_latency_ms || 0) + '%;background:#ef4444;"></div></div></div>' +
            '</div>' +
            '<div style="margin-top:12px;padding:10px;background:rgba(15,23,42,0.4);border-radius:8px;">' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:#64748b;">总耗时</span><span style="color:#d4af37;font-weight:700;">' + (totalMs / 1000).toFixed(2) + 's</span></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;"><span style="color:#64748b;">去重后来源</span><span style="color:#e2e8f0;">' + (l.dedup_count || 0) + ' 条</span></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;"><span style="color:#64748b;">状态</span>' + (l.status === 'error' ? '<span style="color:#f87171;">' + escapeHtml(l.error_message || '失败') + '</span>' : '<span style="color:#4ade80;">成功</span>') + '</div>' +
            '</div>';

          // Sources
          if (l.sources_json && l.sources_json.length) {
            html += '<div style="margin-top:16px;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:8px;">引用来源</div>';
            html += l.sources_json.map(function(s) {
              return '<div style="padding:6px 10px;margin-bottom:4px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.1);border-radius:6px;font-size:11px;display:flex;justify-content:space-between;">' +
                '<span>Doc ' + (s.doc_id || '-') + ' / Chunk ' + (s.chunk_id || '-') + (s.page ? ' / P.' + s.page : '') + '</span>' +
                '<span style="color:#d4af37;">' + Math.round((s.score || 0) * 100) + '%</span></div>';
            }).join('');
          }

          document.getElementById('logDetailContent').innerHTML = html;
          document.getElementById('logDetailModal').style.display = 'flex';
        }
      } catch(e) { alert('加载详情失败'); }
    }

    function closeLogDetail() {
      document.getElementById('logDetailModal').style.display = 'none';
    }

    loadLogStats();
    loadLogs();
  `;

  return wrapWithRagLayout({
    title: '对话日志',
    activePath: '/rag/logs/chat',
    body,
    scripts,
    styles,
  });
}

export function generateRagLogIntent(): string {
  const body = `
    ${ragPageHeader({
      title: '意图识别日志',
      icon: 'fas fa-crosshairs',
      subtitle: '查看意图分类、实体提取、查询改写的详细执行记录与效果分析',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '运维监控' }, { label: '意图识别日志' }],
    })}

    <!-- Intent distribution -->
    <div class="rc-grid-2" style="margin-bottom:20px;">
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-chart-pie"></i> 意图类型分布</div>
        <div id="intentDistribution" style="min-height:180px;">
          <div style="text-align:center;padding:40px;color:#475569;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
        </div>
      </div>
      <div class="rc-card">
        <div class="rc-card-title"><i class="fas fa-chart-bar"></i> 意图置信度分布</div>
        <div id="confidenceChart" style="min-height:180px;">
          <div style="text-align:center;padding:40px;color:#475569;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
        </div>
      </div>
    </div>

    <!-- Intent log table -->
    <div class="rc-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div class="rc-card-title" style="margin:0;"><i class="fas fa-list"></i> 意图识别记录</div>
        <div style="display:flex;gap:8px;">
          <select class="rc-select" id="intentFilter" style="max-width:140px;" onchange="loadIntentLogs()">
            <option value="">全部意图</option>
            <option value="number">数值 (number)</option>
            <option value="name">名称 (name)</option>
            <option value="boolean">布尔 (boolean)</option>
            <option value="comparative">对比 (comparative)</option>
            <option value="open">开放 (open)</option>
            <option value="string">文本 (string)</option>
          </select>
        </div>
      </div>
      <div id="intentLogsContainer" style="min-height:200px;"></div>
    </div>`;

  const styles = `
    .intent-row { padding:14px;margin-bottom:8px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:10px;transition:border-color 0.15s; }
    .intent-row:hover { border-color:rgba(148,163,184,0.2); }
    .intent-row-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
    .intent-badge-lg { display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600; }
    .intent-badge-lg.number { background:rgba(59,130,246,0.15);color:#60a5fa; }
    .intent-badge-lg.name { background:rgba(34,197,94,0.15);color:#4ade80; }
    .intent-badge-lg.boolean { background:rgba(245,158,11,0.15);color:#fbbf24; }
    .intent-badge-lg.comparative { background:rgba(168,85,247,0.15);color:#a855f7; }
    .intent-badge-lg.open { background:rgba(236,72,153,0.15);color:#f472b6; }
    .intent-badge-lg.string { background:rgba(148,163,184,0.15);color:#94a3b8; }
    .intent-entity { display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(59,130,246,0.1);color:#60a5fa;font-size:11px;margin-right:4px;margin-bottom:4px; }
    .intent-rewrite { margin-top:6px;padding:8px 12px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.12);border-radius:6px;font-size:12px; }
    .intent-conf-bar { width:80px;height:4px;border-radius:2px;background:rgba(15,23,42,0.6);overflow:hidden;display:inline-block;vertical-align:middle;margin-left:6px; }
    .intent-conf-fill { height:100%;border-radius:2px; }
    .intent-dist-row { display:flex;align-items:center;gap:10px;padding:8px 0; }
    .intent-dist-bar { flex:2;height:8px;background:rgba(15,23,42,0.5);border-radius:4px;overflow:hidden; }
    .intent-dist-fill { height:100%;border-radius:4px; }
  `;

  const scripts = `
    var intentLabels = { number:'数值', name:'名称', boolean:'布尔', comparative:'对比', open:'开放', string:'文本' };
    var intentColors = { number:'#3b82f6', name:'#22c55e', boolean:'#f59e0b', comparative:'#a855f7', open:'#ec4899', string:'#64748b' };
    var intentIcons = { number:'fa-hashtag', name:'fa-user', boolean:'fa-toggle-on', comparative:'fa-balance-scale', open:'fa-lightbulb', string:'fa-font' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadIntentStats() {
      try {
        var resp = await fetch('/api/rag/logs/stats', { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success) {
          // Intent distribution
          var dist = d.intentDistribution || [];
          if (dist.length) {
            var maxCount = Math.max.apply(null, dist.map(function(x) { return x.count; })) || 1;
            document.getElementById('intentDistribution').innerHTML = dist.map(function(item) {
              var color = intentColors[item.intent_type] || '#64748b';
              var pct = (item.count / maxCount * 100).toFixed(0);
              return '<div class="intent-dist-row">' +
                '<span style="width:60px;font-size:12px;color:' + color + ';font-weight:500;"><i class="fas ' + (intentIcons[item.intent_type] || 'fa-tag') + '" style="margin-right:4px;"></i>' + (intentLabels[item.intent_type] || item.intent_type) + '</span>' +
                '<div class="intent-dist-bar"><div class="intent-dist-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
                '<span style="min-width:40px;text-align:right;font-size:12px;color:#94a3b8;">' + item.count + '</span>' +
                '</div>';
            }).join('');
          } else {
            document.getElementById('intentDistribution').innerHTML = '<div style="text-align:center;padding:40px;color:#475569;">暂无数据</div>';
          }

          // Confidence distribution (build from logs)
          var rs = d.retrievalStats || {};
          var total = rs.total_queries || 0;
          document.getElementById('confidenceChart').innerHTML =
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 0;">' +
              '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:#3b82f6;">' + total + '</div><div style="font-size:11px;color:#64748b;">总查询</div></div>' +
              '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:#4ade80;">' + (rs.success_count || 0) + '</div><div style="font-size:11px;color:#64748b;">成功</div></div>' +
              '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:#f59e0b;">' + (rs.avg_latency ? (rs.avg_latency / 1000).toFixed(1) + 's' : '-') + '</div><div style="font-size:11px;color:#64748b;">平均延迟</div></div>' +
              '<div style="text-align:center;"><div style="font-size:20px;font-weight:700;color:#a855f7;">' + (rs.hybrid_count || 0) + '</div><div style="font-size:11px;color:#64748b;">混合检索</div></div>' +
            '</div>';
        }
      } catch(e) {}
    }

    async function loadIntentLogs() {
      var intentType = document.getElementById('intentFilter').value;
      var container = document.getElementById('intentLogsContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

      try {
        var params = new URLSearchParams({ limit: '30' });
        if (intentType) params.set('intentType', intentType);
        var resp = await fetch('/api/rag/logs/recent?' + params.toString(), { headers: getAuthHeaders() });
        var d = await resp.json();
        var logs = d.logs || [];

        if (!logs.length) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#475569;"><i class="fas fa-crosshairs" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无意图识别记录</div>';
          return;
        }

        container.innerHTML = logs.map(function(l) {
          var color = intentColors[l.intent_type] || '#64748b';
          var confPct = Math.round((l.intent_confidence || 0) * 100);
          var confColor = confPct >= 80 ? '#4ade80' : (confPct >= 50 ? '#fbbf24' : '#f87171');
          return '<div class="intent-row">' +
            '<div class="intent-row-head">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span class="intent-badge-lg ' + (l.intent_type || 'string') + '"><i class="fas ' + (intentIcons[l.intent_type] || 'fa-tag') + '"></i> ' + (intentLabels[l.intent_type] || l.intent_type || '-') + '</span>' +
                '<span style="font-size:11px;color:#64748b;">' + confPct + '%<span class="intent-conf-bar"><span class="intent-conf-fill" style="width:' + confPct + '%;background:' + confColor + ';"></span></span></span>' +
              '</div>' +
              '<div style="font-size:11px;color:#475569;">' + (l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '') + ' | ' + (l.total_latency_ms ? (l.total_latency_ms / 1000).toFixed(1) + 's' : '-') + '</div>' +
            '</div>' +
            '<div style="font-size:13px;color:#e2e8f0;margin-bottom:4px;">' + escapeHtml(l.user_query || '') + '</div>' +
            (l.rewritten_query ? '<div class="intent-rewrite"><span style="color:#d4af37;font-weight:500;">改写:</span> <span style="color:#cbd5e1;">' + escapeHtml(l.rewritten_query) + '</span></div>' : '') +
            '</div>';
        }).join('');
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">加载失败</div>';
      }
    }

    loadIntentStats();
    loadIntentLogs();
  `;

  return wrapWithRagLayout({
    title: '意图识别日志',
    activePath: '/rag/logs/intent',
    body,
    scripts,
    styles,
  });
}

export function generateRagLogPipeline(): string {
  const body = `
    ${ragPageHeader({
      title: 'Pipeline 追踪',
      icon: 'fas fa-stream',
      subtitle: '可视化展示每次问答的完整 Pipeline 执行链路与各步骤耗时',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '运维监控' }, { label: 'Pipeline 追踪' }],
    })}

    <!-- Pipeline overview stats -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="plTotal" style="font-size:20px;font-weight:700;color:#3b82f6;">-</div>
        <div style="font-size:11px;color:#64748b;">总执行</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="plAvgIntent" style="font-size:20px;font-weight:700;color:#a855f7;">-</div>
        <div style="font-size:11px;color:#64748b;">平均意图延迟</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="plAvgVec" style="font-size:20px;font-weight:700;color:#3b82f6;">-</div>
        <div style="font-size:11px;color:#64748b;">平均向量延迟</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="plAvgBm25" style="font-size:20px;font-weight:700;color:#22c55e;">-</div>
        <div style="font-size:11px;color:#64748b;">平均BM25延迟</div>
      </div>
      <div class="rc-card" style="padding:14px;text-align:center;">
        <div id="plAvgLlm" style="font-size:20px;font-weight:700;color:#ef4444;">-</div>
        <div style="font-size:11px;color:#64748b;">平均LLM延迟</div>
      </div>
    </div>

    <!-- Daily trend -->
    <div class="rc-card" style="margin-bottom:20px;">
      <div class="rc-card-title"><i class="fas fa-chart-line"></i> 每日查询量趋势（近 7 日）</div>
      <div id="dailyTrend" style="display:flex;align-items:flex-end;gap:10px;height:160px;padding:8px;">
        <div style="text-align:center;color:#475569;font-size:13px;width:100%;">加载中...</div>
      </div>
    </div>

    <!-- Pipeline execution list -->
    <div class="rc-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div class="rc-card-title" style="margin:0;"><i class="fas fa-stream"></i> Pipeline 执行记录</div>
        <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="loadPipelineLogs()" id="plRefresh">
          <i class="fas fa-sync-alt"></i> 刷新
        </button>
      </div>
      <div id="pipelineLogsContainer" style="min-height:200px;"></div>
    </div>

    <!-- Pipeline detail modal -->
    <div id="plDetailModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
      <div style="background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:700px;max-height:90vh;overflow-y:auto;padding:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-stream" style="color:#d4af37;margin-right:8px;"></i>Pipeline 详情</h3>
          <button onclick="closePlDetail()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div id="plDetailContent"></div>
      </div>
    </div>`;

  const styles = `
    .pl-row { padding:14px;margin-bottom:8px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.08);border-radius:10px;cursor:pointer;transition:border-color 0.15s; }
    .pl-row:hover { border-color:rgba(212,175,55,0.25); }
    .pl-waterfall { display:flex;align-items:center;gap:2px;height:20px;margin-top:8px; }
    .pl-waterfall-seg { height:100%;border-radius:3px;min-width:2px;transition:width 0.3s; }
    .pl-step-dot { width:12px;height:12px;border-radius:50%;border:2px solid;flex-shrink:0; }
    .pl-step-dot.done { border-color:#4ade80;background:#4ade80; }
    .pl-step-dot.running { border-color:#d4af37;background:rgba(212,175,55,0.3); }
    .pl-step-dot.error { border-color:#f87171;background:#f87171; }
    .pl-step-dot.pending { border-color:rgba(148,163,184,0.2);background:transparent; }
    #plDetailModal.show { display:flex !important; }
  `;

  const scripts = `
    var stepColors = { intent:'#a855f7', vector:'#3b82f6', bm25:'#22c55e', rerank:'#f59e0b', llm:'#ef4444' };
    var stepLabels = { intent:'意图识别', vector:'向量检索', bm25:'BM25检索', rerank:'LLM重排', llm:'LLM生成' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadPipelineStats() {
      try {
        var resp = await fetch('/api/rag/logs/stats', { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success) {
          var rs = d.retrievalStats || {};
          document.getElementById('plTotal').textContent = (rs.total_queries || 0).toLocaleString();
          document.getElementById('plAvgVec').textContent = rs.avg_vector_latency ? Math.round(rs.avg_vector_latency) + 'ms' : '-';
          document.getElementById('plAvgBm25').textContent = rs.avg_bm25_latency ? Math.round(rs.avg_bm25_latency) + 'ms' : '-';
          document.getElementById('plAvgLlm').textContent = rs.avg_llm_latency ? Math.round(rs.avg_llm_latency) + 'ms' : '-';
          document.getElementById('plAvgIntent').textContent = '-';

          // Daily trend chart
          var trend = d.dailyTrend || [];
          if (trend.length) {
            var maxVal = Math.max.apply(null, trend.map(function(t) { return t.count; })) || 1;
            document.getElementById('dailyTrend').innerHTML = trend.map(function(t) {
              var h = Math.max(4, (t.count / maxVal) * 140);
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;">' +
                '<span style="font-size:11px;font-weight:600;color:#d4af37;">' + t.count + '</span>' +
                '<div style="width:100%;height:' + h + 'px;background:linear-gradient(to top,rgba(59,130,246,0.6),rgba(168,85,247,0.4));border-radius:4px 4px 0 0;"></div>' +
                '<span style="font-size:10px;color:#475569;">' + (t.date || '').substring(5) + '</span>' +
                '</div>';
            }).join('');
          } else {
            document.getElementById('dailyTrend').innerHTML = '<div style="text-align:center;color:#475569;width:100%;">暂无趋势数据</div>';
          }
        }
      } catch(e) {}
    }

    async function loadPipelineLogs() {
      var container = document.getElementById('pipelineLogsContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

      try {
        var resp = await fetch('/api/rag/logs/recent?limit=30', { headers: getAuthHeaders() });
        var d = await resp.json();
        var logs = d.logs || [];

        if (!logs.length) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#475569;"><i class="fas fa-stream" style="font-size:24px;display:block;margin-bottom:8px;"></i>暂无 Pipeline 执行记录<br><span style="font-size:12px;">使用对话助手提问后，记录将在此处显示</span></div>';
          return;
        }

        container.innerHTML = logs.map(function(l) {
          var totalMs = l.total_latency_ms || 1;
          // Build waterfall segments
          var segments = [
            { key:'intent', ms: l.intent_latency_ms || 0 },
            { key:'vector', ms: l.vector_latency_ms || 0 },
            { key:'bm25', ms: l.bm25_latency_ms || 0 },
            { key:'llm', ms: l.llm_latency_ms || 0 }
          ];
          var waterfallHtml = segments.map(function(s) {
            var w = Math.max(2, (s.ms / totalMs * 100));
            return '<div class="pl-waterfall-seg" style="width:' + w + '%;background:' + (stepColors[s.key] || '#64748b') + ';" title="' + (stepLabels[s.key] || s.key) + ': ' + s.ms + 'ms"></div>';
          }).join('');

          var statusIcon = l.status === 'error' ? '<i class="fas fa-times-circle" style="color:#f87171;"></i>' : '<i class="fas fa-check-circle" style="color:#4ade80;"></i>';
          var time = l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';

          return '<div class="pl-row" onclick="viewPlDetail(' + l.id + ')">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:13px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + statusIcon + ' ' + escapeHtml(l.user_query || '') + '</div>' +
                '<div style="font-size:11px;color:#475569;margin-top:2px;">V:' + (l.vector_results_count || 0) + ' B:' + (l.bm25_results_count || 0) + ' → ' + (l.dedup_count || 0) + ' | ' + time + '</div>' +
              '</div>' +
              '<div style="text-align:right;min-width:80px;">' +
                '<div style="font-size:14px;font-weight:700;color:#d4af37;font-family:monospace;">' + (totalMs / 1000).toFixed(2) + 's</div>' +
                '<div style="font-size:10px;color:#475569;">' + (l.llm_input_tokens || 0) + '+' + (l.llm_output_tokens || 0) + ' tok</div>' +
              '</div>' +
            '</div>' +
            '<div class="pl-waterfall">' + waterfallHtml + '</div>' +
            '<div style="display:flex;gap:12px;margin-top:4px;font-size:10px;color:#475569;">' +
              segments.map(function(s) { return '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + stepColors[s.key] + ';margin-right:3px;"></span>' + (stepLabels[s.key] || s.key) + ' ' + s.ms + 'ms'; }).join('</span>') +
            '</span></div>' +
            '</div>';
        }).join('');
      } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">加载失败</div>';
      }
    }

    async function viewPlDetail(logId) {
      try {
        var resp = await fetch('/api/rag/logs/detail/' + logId, { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success && d.log) {
          var l = d.log;
          var totalMs = l.total_latency_ms || 1;
          var steps = [
            { name:'意图识别', icon:'fas fa-crosshairs', color:'#a855f7', ms:l.intent_latency_ms||0, detail:'类型: ' + (l.intent_type||'-') + ' | 置信度: ' + Math.round((l.intent_confidence||0)*100) + '%' },
            { name:'向量检索', icon:'fas fa-vector-square', color:'#3b82f6', ms:l.vector_latency_ms||0, detail:(l.vector_results_count||0) + ' 条结果 | Top: ' + ((l.vector_top_score||0)*100).toFixed(0) + '%' },
            { name:'BM25 检索', icon:'fas fa-key', color:'#22c55e', ms:l.bm25_latency_ms||0, detail:(l.bm25_results_count||0) + ' 条结果 | Top: ' + (l.bm25_top_score||0).toFixed(2) },
          ];
          if (l.rerank_enabled) {
            steps.push({ name:'LLM 重排', icon:'fas fa-sort-amount-down', color:'#f59e0b', ms:l.rerank_latency_ms||0, detail:(l.rerank_input_count||0) + ' → ' + (l.rerank_output_count||0) + ' | ' + (l.rerank_model||'') });
          }
          steps.push({ name:'LLM 生成', icon:'fas fa-robot', color:'#ef4444', ms:l.llm_latency_ms||0, detail:(l.llm_model||'') + ' | ' + (l.llm_input_tokens||0) + ' → ' + (l.llm_output_tokens||0) + ' tokens | T=' + (l.llm_temperature||0) });

          var html = '<div style="margin-bottom:16px;padding:10px;background:rgba(15,23,42,0.4);border-radius:8px;">' +
            '<div style="font-size:13px;color:#e2e8f0;margin-bottom:4px;">' + escapeHtml(l.user_query || '') + '</div>' +
            (l.rewritten_query ? '<div style="font-size:12px;color:#d4af37;"><i class="fas fa-pen"></i> ' + escapeHtml(l.rewritten_query) + '</div>' : '') +
            '</div>';

          html += '<div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:10px;">Pipeline 步骤</div>';
          html += steps.map(function(s) {
            var pct = (s.ms / totalMs * 100).toFixed(1);
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.06);">' +
              '<div style="width:20px;height:20px;border-radius:50%;background:' + s.color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="' + s.icon + '" style="color:white;font-size:9px;"></i></div>' +
              '<div style="flex:1;">' +
                '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:#e2e8f0;">' + s.name + '</span><span style="color:#d4af37;font-weight:600;font-family:monospace;">' + s.ms + 'ms (' + pct + '%)</span></div>' +
                '<div style="font-size:11px;color:#64748b;">' + s.detail + '</div>' +
                '<div style="height:4px;background:rgba(15,23,42,0.6);border-radius:2px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + s.color + ';border-radius:2px;"></div></div>' +
              '</div></div>';
          }).join('');

          html += '<div style="margin-top:12px;padding:10px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.12);border-radius:8px;">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:#94a3b8;">总耗时</span><span style="color:#d4af37;font-weight:700;font-size:16px;">' + (totalMs / 1000).toFixed(2) + 's</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;"><span style="color:#64748b;">去重后来源</span><span style="color:#e2e8f0;">' + (l.dedup_count || 0) + ' 条</span></div>' +
            '</div>';

          document.getElementById('plDetailContent').innerHTML = html;
          document.getElementById('plDetailModal').classList.add('show');
        }
      } catch(e) { alert('加载详情失败'); }
    }

    function closePlDetail() {
      document.getElementById('plDetailModal').classList.remove('show');
    }

    loadPipelineStats();
    loadPipelineLogs();
  `;

  return wrapWithRagLayout({
    title: 'Pipeline 追踪',
    activePath: '/rag/logs/pipeline',
    body,
    scripts,
    styles,
  });
}

export function generateRagSettingsModels(): string {
  const body = `
    ${ragPageHeader({
      title: '模型与 Provider 配置',
      icon: 'fas fa-server',
      subtitle: '管理 RAG 平台各环节使用的模型、Provider 和 API Key 配置',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '设置' }, { label: '模型配置' }],
    })}

    <div id="modelConfigList" style="min-height:200px;">
      <div style="text-align:center;padding:40px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
    </div>`;

  const styles = `
    .mc-card { background:rgba(30,41,59,0.7);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px;margin-bottom:16px;transition:border-color 0.2s; }
    .mc-card:hover { border-color:rgba(148,163,184,0.2); }
    .mc-usage-badge { display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(212,175,55,0.12);color:#d4af37; }
    .mc-field { margin-bottom:12px; }
    .mc-field-label { font-size:11px;color:#64748b;margin-bottom:4px; }
    .mc-test-btn { font-size:11px; }
    .mc-test-result { margin-top:8px;font-size:12px;padding:8px 12px;border-radius:6px; }
    .mc-test-result.success { background:rgba(74,222,128,0.08);color:#4ade80;border:1px solid rgba(74,222,128,0.15); }
    .mc-test-result.error { background:rgba(248,113,113,0.08);color:#f87171;border:1px solid rgba(248,113,113,0.15); }
  `;

  const scripts = `
    var usageLabels = { embedding:'Embedding 模型', rag_chat:'RAG 问答 LLM', rerank:'LLM 重排', intent:'意图识别', question_gen:'题目生成', eval_scoring:'评测打分' };
    var usageIcons = { embedding:'fa-vector-square', rag_chat:'fa-robot', rerank:'fa-sort-amount-down', intent:'fa-crosshairs', question_gen:'fa-magic', eval_scoring:'fa-star' };
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadModelConfigs() {
      try {
        var resp = await fetch('/api/rag/ops/models', { headers: getAuthHeaders() });
        var d = await resp.json();
        renderModelConfigs(d.configs || []);
      } catch(e) {
        document.getElementById('modelConfigList').innerHTML = '<div style="text-align:center;color:#f87171;">加载失败</div>';
      }
    }
    function renderModelConfigs(configs) {
      var container = document.getElementById('modelConfigList');
      if (!configs.length) {
        container.innerHTML = '<div class="rc-card" style="text-align:center;padding:40px;color:#475569;">暂无模型配置<br><span style="font-size:12px;">请先运行 migration 0024</span></div>';
        return;
      }
      container.innerHTML = configs.map(function(cfg) {
        var extra = cfg.extra_config || {};
        return '<div class="mc-card" id="mc-' + cfg.usage + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<i class="fas ' + (usageIcons[cfg.usage] || 'fa-cog') + '" style="color:#d4af37;font-size:16px;"></i>' +
              '<span class="mc-usage-badge">' + (usageLabels[cfg.usage] || cfg.usage) + '</span>' +
              '<span style="font-size:12px;color:' + (cfg.is_active ? '#4ade80' : '#f87171') + ';"><i class="fas fa-circle" style="font-size:8px;"></i> ' + (cfg.is_active ? '启用' : '禁用') + '</span>' +
            '</div>' +
            '<button class="rc-btn rc-btn-outline rc-btn-sm mc-test-btn" onclick="testConnection(\'' + cfg.usage + '\',\'' + escapeHtml(cfg.provider) + '\',\'' + escapeHtml(cfg.base_url || '') + '\',\'' + escapeHtml(cfg.api_key_ref || '') + '\')"><i class="fas fa-plug"></i> 测试连接</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">' +
            '<div class="mc-field"><div class="mc-field-label">Provider</div><select class="rc-select" id="mc-provider-' + cfg.usage + '" style="width:100%;"><option value="dashscope"' + (cfg.provider==='dashscope'?' selected':'') + '>DashScope</option><option value="vectorengine"' + (cfg.provider==='vectorengine'?' selected':'') + '>VectorEngine</option><option value="openai"' + (cfg.provider==='openai'?' selected':'') + '>OpenAI</option></select></div>' +
            '<div class="mc-field"><div class="mc-field-label">模型名称</div><input class="rc-input" id="mc-model-' + cfg.usage + '" value="' + escapeHtml(cfg.model_name) + '"></div>' +
            '<div class="mc-field"><div class="mc-field-label">API Key 引用</div><input class="rc-input" id="mc-apikey-' + cfg.usage + '" value="' + escapeHtml(cfg.api_key_ref || '') + '" placeholder="环境变量名"></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:12px;">' +
            '<div class="mc-field"><div class="mc-field-label">Base URL</div><input class="rc-input" id="mc-url-' + cfg.usage + '" value="' + escapeHtml(cfg.base_url || '') + '"></div>' +
            '<div class="mc-field"><div class="mc-field-label">额外配置 (JSON)</div><input class="rc-input" id="mc-extra-' + cfg.usage + '" value=\'' + JSON.stringify(extra) + '\'></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button class="rc-btn rc-btn-primary rc-btn-sm" onclick="saveModelConfig(\'' + cfg.usage + '\')"><i class="fas fa-save"></i> 保存</button>' +
          '</div>' +
          '<div id="mc-result-' + cfg.usage + '"></div>' +
          '</div>';
      }).join('');
    }

    async function saveModelConfig(usage) {
      var provider = document.getElementById('mc-provider-' + usage).value;
      var modelName = document.getElementById('mc-model-' + usage).value.trim();
      var apiKeyRef = document.getElementById('mc-apikey-' + usage).value.trim();
      var baseUrl = document.getElementById('mc-url-' + usage).value.trim();
      var extraStr = document.getElementById('mc-extra-' + usage).value.trim();
      var extraConfig;
      try { extraConfig = extraStr ? JSON.parse(extraStr) : {}; } catch(e) { alert('额外配置 JSON 格式错误'); return; }

      try {
        var resp = await fetch('/api/rag/ops/models/' + usage, {
          method:'PUT',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ provider:provider, modelName:modelName, apiKeyRef:apiKeyRef, baseUrl:baseUrl, extraConfig:extraConfig })
        });
        var d = await resp.json();
        var resultEl = document.getElementById('mc-result-' + usage);
        if (d.success) {
          resultEl.innerHTML = '<div class="mc-test-result success"><i class="fas fa-check-circle"></i> 配置已保存</div>';
        } else {
          resultEl.innerHTML = '<div class="mc-test-result error"><i class="fas fa-times-circle"></i> ' + (d.error || '保存失败') + '</div>';
        }
        setTimeout(function() { resultEl.innerHTML = ''; }, 3000);
      } catch(e) { alert('保存失败'); }
    }

    async function testConnection(usage, provider, baseUrl, apiKeyRef) {
      var resultEl = document.getElementById('mc-result-' + usage);
      resultEl.innerHTML = '<div class="mc-test-result" style="color:#d4af37;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.12);"><i class="fas fa-spinner fa-spin"></i> 测试连接中...</div>';
      try {
        var resp = await fetch('/api/rag/ops/models/test-connection', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ provider:provider, baseUrl:baseUrl, apiKeyRef:apiKeyRef })
        });
        var d = await resp.json();
        if (d.success && d.success !== false) {
          resultEl.innerHTML = '<div class="mc-test-result success"><i class="fas fa-check-circle"></i> 连接成功 | ' + (d.latencyMs || '-') + 'ms' + (d.model ? ' | ' + d.model : '') + '</div>';
        } else {
          resultEl.innerHTML = '<div class="mc-test-result error"><i class="fas fa-times-circle"></i> 连接失败: ' + (d.error || '未知错误') + '</div>';
        }
      } catch(e) {
        resultEl.innerHTML = '<div class="mc-test-result error"><i class="fas fa-times-circle"></i> 请求失败</div>';
      }
    }

    loadModelConfigs();
  `;

  return wrapWithRagLayout({
    title: '模型与 Provider 配置',
    activePath: '/rag/settings/models',
    body,
    scripts,
    styles,
  });
}

export function generateRagSettingsPrompts(): string {
  const body = `
    ${ragPageHeader({
      title: 'Prompt 模板管理',
      icon: 'fas fa-file-code',
      subtitle: '管理 RAG 平台各环节的 System Prompt 模板，支持版本控制与一键回退',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '设置' }, { label: 'Prompt 管理' }],
    })}

    <div style="display:grid;grid-template-columns:320px 1fr;gap:20px;align-items:start;">
      <!-- Left: template list -->
      <div class="rc-card">
        <div class="rc-card-title" style="margin-bottom:12px;"><i class="fas fa-list"></i> Prompt 模板</div>
        <div id="promptList" style="min-height:200px;">
          <div style="text-align:center;padding:30px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
        </div>
      </div>

      <!-- Right: editor panel -->
      <div>
        <div class="rc-card" id="promptEditorPanel" style="display:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h3 id="ptTitle" style="font-size:16px;font-weight:600;color:#e2e8f0;"></h3>
              <div id="ptMeta" style="font-size:12px;color:#64748b;margin-top:4px;"></div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="rc-btn rc-btn-outline rc-btn-sm" onclick="showVersionHistory()"><i class="fas fa-history"></i> 版本历史</button>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label class="rc-label">模板变量</label>
            <div id="ptVariables" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
          </div>
          <div style="margin-bottom:12px;">
            <label class="rc-label">Prompt 内容</label>
            <textarea class="rc-input" id="ptContent" rows="16" style="resize:vertical;line-height:1.6;font-family:'Courier New',monospace;font-size:13px;"></textarea>
          </div>
          <div style="margin-bottom:12px;">
            <label class="rc-label">变更说明</label>
            <input class="rc-input" id="ptChangeNote" placeholder="描述本次修改内容...">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button class="rc-btn rc-btn-primary" onclick="savePrompt()"><i class="fas fa-save"></i> 保存新版本</button>
          </div>
          <div id="ptSaveStatus" style="margin-top:8px;font-size:12px;"></div>
        </div>
        <div id="promptEmptyState" class="rc-card" style="text-align:center;padding:60px 20px;color:#475569;">
          <i class="fas fa-file-code" style="font-size:32px;display:block;margin-bottom:12px;color:#334155;"></i>
          选择左侧的 Prompt 模板进行编辑
        </div>
      </div>
    </div>

    <!-- Version history modal -->
    <div id="versionModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
      <div style="background:#1e293b;border:1px solid rgba(148,163,184,0.15);border-radius:16px;width:90%;max-width:700px;max-height:90vh;overflow-y:auto;padding:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-size:16px;font-weight:600;color:#e2e8f0;"><i class="fas fa-history" style="color:#d4af37;margin-right:8px;"></i>版本历史</h3>
          <button onclick="closeVersionModal()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
        </div>
        <div id="versionList" style="min-height:100px;"></div>
      </div>
    </div>`;

  const styles = `
    .pt-item { padding:12px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all 0.15s; }
    .pt-item:hover { background:rgba(59,130,246,0.06);border-color:rgba(59,130,246,0.15); }
    .pt-item.active { background:rgba(212,175,55,0.08);border-color:rgba(212,175,55,0.25); }
    .pt-item-key { font-size:11px;color:#d4af37;font-weight:600;margin-bottom:2px; }
    .pt-item-name { font-size:13px;color:#e2e8f0;font-weight:500; }
    .pt-item-desc { font-size:11px;color:#64748b;margin-top:2px; }
    .pt-var { display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(59,130,246,0.1);color:#60a5fa;font-size:11px;font-family:monospace; }
    .ver-item { padding:12px;margin-bottom:8px;border:1px solid rgba(148,163,184,0.08);border-radius:8px;background:rgba(15,23,42,0.4); }
    .ver-item.current { border-color:rgba(212,175,55,0.3);background:rgba(212,175,55,0.04); }
    #versionModal.show { display:flex !important; }
    @media (max-width:1023px) {
      .rag-main > div:last-child { grid-template-columns:1fr !important; }
    }
  `;

  const scripts = `
    var currentPtKey = null;
    var promptsCache = [];
    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadPromptTemplates() {
      try {
        var resp = await fetch('/api/rag/ops/prompts', { headers: getAuthHeaders() });
        var d = await resp.json();
        promptsCache = d.templates || [];
        renderPromptList(promptsCache);
      } catch(e) {
        document.getElementById('promptList').innerHTML = '<div style="text-align:center;color:#f87171;">加载失败</div>';
      }
    }
    function renderPromptList(templates) {
      var container = document.getElementById('promptList');
      if (!templates.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#475569;">暂无模板</div>';
        return;
      }
      container.innerHTML = templates.map(function(t) {
        return '<div class="pt-item' + (currentPtKey === t.template_key ? ' active' : '') + '" onclick="selectPrompt(\'' + t.template_key + '\')">' +
          '<div class="pt-item-key">' + t.template_key + '</div>' +
          '<div class="pt-item-name">' + escapeHtml(t.display_name) + '</div>' +
          (t.description ? '<div class="pt-item-desc">' + escapeHtml(t.description).substring(0, 50) + '</div>' : '') +
          '</div>';
      }).join('');
    }

    async function selectPrompt(key) {
      currentPtKey = key;
      renderPromptList(promptsCache);
      document.getElementById('promptEditorPanel').style.display = 'block';
      document.getElementById('promptEmptyState').style.display = 'none';
      try {
        var resp = await fetch('/api/rag/ops/prompts/' + key, { headers: getAuthHeaders() });
        var d = await resp.json();
        if (d.success && d.template) {
          var t = d.template;
          document.getElementById('ptTitle').textContent = t.display_name;
          document.getElementById('ptMeta').innerHTML =
            '<span>' + t.template_key + '</span>' +
            (t.usage_context ? ' | <span>' + escapeHtml(t.usage_context) + '</span>' : '') +
            (t.current_version_id ? ' | <span style="color:#d4af37;">版本 ID: ' + t.current_version_id + '</span>' : '');

          var vars = t.variables ? (typeof t.variables === 'string' ? JSON.parse(t.variables) : t.variables) : [];
          document.getElementById('ptVariables').innerHTML = vars.length ?
            vars.map(function(v) { return '<span class="pt-var">{' + v + '}</span>'; }).join('') :
            '<span style="font-size:11px;color:#475569;">无变量</span>';

          document.getElementById('ptContent').value = t.currentContent || '';
          document.getElementById('ptChangeNote').value = '';
          document.getElementById('ptSaveStatus').innerHTML = '';
        }
      } catch(e) {}
    }

    async function savePrompt() {
      if (!currentPtKey) return;
      var content = document.getElementById('ptContent').value.trim();
      if (!content) { alert('Prompt 内容不能为空'); return; }
      var changeNote = document.getElementById('ptChangeNote').value.trim();
      var status = document.getElementById('ptSaveStatus');
      status.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#d4af37;"></i> 正在保存...';
      try {
        var resp = await fetch('/api/rag/ops/prompts/' + currentPtKey, {
          method:'PUT',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ content:content, changeNote:changeNote })
        });
        var d = await resp.json();
        if (d.success) {
          status.innerHTML = '<i class="fas fa-check-circle" style="color:#4ade80;"></i> 已保存为新版本';
          setTimeout(function() { status.innerHTML = ''; }, 3000);
        } else {
          status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> ' + (d.error || '保存失败');
        }
      } catch(e) {
        status.innerHTML = '<i class="fas fa-times-circle" style="color:#f87171;"></i> 保存失败';
      }
    }

    async function showVersionHistory() {
      if (!currentPtKey) return;
      document.getElementById('versionModal').classList.add('show');
      document.getElementById('versionList').innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
      try {
        var resp = await fetch('/api/rag/ops/prompts/' + currentPtKey + '/versions', { headers: getAuthHeaders() });
        var d = await resp.json();
        var versions = d.versions || [];
        if (!versions.length) {
          document.getElementById('versionList').innerHTML = '<div style="text-align:center;padding:20px;color:#475569;">暂无版本历史</div>';
          return;
        }
        // Get current version id
        var pt = promptsCache.find(function(t) { return t.template_key === currentPtKey; });
        var currentVerId = pt ? pt.current_version_id : null;
        document.getElementById('versionList').innerHTML = versions.map(function(v) {
          var isCurrent = v.id === currentVerId;
          return '<div class="ver-item' + (isCurrent ? ' current' : '') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-weight:600;color:#d4af37;">' + v.version_label + '</span>' +
                (isCurrent ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,0.12);color:#4ade80;">当前</span>' : '') +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:11px;color:#475569;">' + (v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '-') + '</span>' +
                (!isCurrent ? '<button class="rc-btn rc-btn-sm rc-btn-outline" onclick="revertToVersion(' + v.id + ')"><i class="fas fa-undo"></i> 回退</button>' : '') +
              '</div>' +
            '</div>' +
            (v.change_note ? '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">' + escapeHtml(v.change_note) + '</div>' : '') +
            '<div style="font-size:11px;color:#64748b;max-height:60px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-family:monospace;background:rgba(15,23,42,0.4);padding:6px 8px;border-radius:4px;">' + escapeHtml(v.content || '').substring(0, 300) + '</div>' +
            '</div>';
        }).join('');
      } catch(e) {
        document.getElementById('versionList').innerHTML = '<div style="text-align:center;color:#f87171;">加载失败</div>';
      }
    }
    function closeVersionModal() { document.getElementById('versionModal').classList.remove('show'); }

    async function revertToVersion(versionId) {
      if (!confirm('确定回退到该版本？')) return;
      try {
        var resp = await fetch('/api/rag/ops/prompts/' + currentPtKey + '/revert', {
          method:'POST',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ versionId: versionId })
        });
        var d = await resp.json();
        if (d.success) {
          closeVersionModal();
          selectPrompt(currentPtKey);
          loadPromptTemplates();
        } else { alert('回退失败: ' + (d.error || '')); }
      } catch(e) { alert('回退失败'); }
    }

    loadPromptTemplates();
  `;

  return wrapWithRagLayout({
    title: 'Prompt 模板管理',
    activePath: '/rag/settings/prompts',
    body,
    scripts,
    styles,
  });
}

export function generateRagSettingsSystem(): string {
  const body = `
    ${ragPageHeader({
      title: '系统配置',
      icon: 'fas fa-sliders-h',
      subtitle: '全局参数配置：检索策略、TopK、BM25 权重、LLM 温度、安全策略、调试开关等',
      breadcrumbs: [{ label: 'RAG 平台', href: '/rag/dashboard' }, { label: '设置' }, { label: '系统配置' }],
      actions: '<button class="rc-btn rc-btn-primary rc-btn-sm" onclick="saveAllConfigs()"><i class="fas fa-save"></i> 保存全部修改</button>',
    })}

    <!-- Save status bar -->
    <div id="scSaveStatus" style="display:none;margin-bottom:16px;padding:10px 16px;border-radius:8px;font-size:13px;"></div>

    <!-- Storage stats KPI row -->
    <div class="rc-kpi-grid" id="scStorageKpi" style="margin-bottom:24px;">
      <div class="rc-kpi-card"><div class="rc-skeleton" style="height:80px;"></div></div>
      <div class="rc-kpi-card"><div class="rc-skeleton" style="height:80px;"></div></div>
      <div class="rc-kpi-card"><div class="rc-skeleton" style="height:80px;"></div></div>
      <div class="rc-kpi-card"><div class="rc-skeleton" style="height:80px;"></div></div>
    </div>

    <!-- Category tabs -->
    <div class="rc-tabs" id="scTabs">
      <button class="rc-tab active" data-cat="rag" onclick="switchCategory('rag',this)"><i class="fas fa-search"></i> 检索参数</button>
      <button class="rc-tab" data-cat="chunking" onclick="switchCategory('chunking',this)"><i class="fas fa-puzzle-piece"></i> 分块参数</button>
      <button class="rc-tab" data-cat="limits" onclick="switchCategory('limits',this)"><i class="fas fa-tachometer-alt"></i> 限制与配额</button>
      <button class="rc-tab" data-cat="security" onclick="switchCategory('security',this)"><i class="fas fa-shield-alt"></i> 安全策略</button>
      <button class="rc-tab" data-cat="debug" onclick="switchCategory('debug',this)"><i class="fas fa-bug"></i> 调试开关</button>
    </div>

    <!-- Config cards container -->
    <div id="scConfigContainer" style="min-height:300px;">
      <div style="text-align:center;padding:60px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
    </div>`;

  const styles = `
    .sc-group { margin-bottom:20px; }
    .sc-group-title { font-size:14px;font-weight:600;color:#d4af37;margin-bottom:14px;display:flex;align-items:center;gap:8px; }
    .sc-item { display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(30,41,59,0.7);border:1px solid rgba(148,163,184,0.1);border-radius:10px;margin-bottom:10px;transition:border-color 0.2s; }
    .sc-item:hover { border-color:rgba(148,163,184,0.2); }
    .sc-item.modified { border-color:rgba(212,175,55,0.4);background:rgba(212,175,55,0.03); }
    .sc-item-info { flex:1;min-width:0;margin-right:20px; }
    .sc-item-key { font-size:12px;font-family:'Courier New',monospace;color:#94a3b8;margin-bottom:2px; }
    .sc-item-desc { font-size:13px;color:#e2e8f0;line-height:1.4; }
    .sc-item-type { font-size:10px;color:#475569;margin-top:2px; }
    .sc-item-control { flex-shrink:0;display:flex;align-items:center;gap:8px; }
    .sc-input-num { width:100px;padding:6px 10px;border-radius:6px;border:1px solid rgba(148,163,184,0.15);background:rgba(15,23,42,0.5);color:#e2e8f0;font-size:13px;text-align:right;outline:none; }
    .sc-input-num:focus { border-color:rgba(212,175,55,0.4); }
    .sc-input-text { width:180px;padding:6px 10px;border-radius:6px;border:1px solid rgba(148,163,184,0.15);background:rgba(15,23,42,0.5);color:#e2e8f0;font-size:13px;outline:none; }
    .sc-input-text:focus { border-color:rgba(212,175,55,0.4); }
    .sc-select { width:180px;padding:6px 10px;border-radius:6px;border:1px solid rgba(148,163,184,0.15);background:rgba(15,23,42,0.5);color:#e2e8f0;font-size:13px;outline:none;cursor:pointer; }
    .sc-toggle { position:relative;width:44px;height:24px;border-radius:12px;cursor:pointer;transition:background 0.2s;border:none;outline:none; }
    .sc-toggle.on { background:#22c55e; }
    .sc-toggle.off { background:#475569; }
    .sc-toggle::after { content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2); }
    .sc-toggle.on::after { transform:translateX(20px); }
    .sc-unit { font-size:11px;color:#64748b; }
    .sc-default { font-size:10px;color:#475569;cursor:pointer;text-decoration:underline;margin-top:2px; }
    .sc-default:hover { color:#94a3b8; }
    .sc-modified-count { display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#d4af37;margin-left:8px; }
  `;

  const scripts = `
    var allConfigs = [];
    var originalValues = {};
    var modifiedKeys = new Set();
    var currentCategory = 'rag';

    // Config metadata: category, description, type, unit, default, options
    var configMeta = {
      default_search_strategy: { cat:'rag', desc:'默认检索策略', type:'select', options:['hybrid','vector','bm25'], default:'hybrid' },
      default_top_k:           { cat:'rag', desc:'默认返回 Top-K 数量', type:'number', min:1, max:50, default:5 },
      default_min_score:       { cat:'rag', desc:'最低相关性得分阈值', type:'number', min:0, max:1, step:0.01, default:0.25 },
      rerank_weight:           { cat:'rag', desc:'Rerank 重排权重（0=仅原始分, 1=仅重排分）', type:'number', min:0, max:1, step:0.05, default:0.7 },
      default_chunk_size:      { cat:'chunking', desc:'默认分块大小（字符数）', type:'number', min:100, max:5000, step:50, default:500, unit:'chars' },
      default_overlap:         { cat:'chunking', desc:'默认分块重叠长度', type:'number', min:0, max:500, step:10, default:100, unit:'chars' },
      default_chunk_strategy:  { cat:'chunking', desc:'默认分块策略', type:'select', options:['recursive','sentence','paragraph','fixed'], default:'recursive' },
      max_document_size_mb:    { cat:'limits', desc:'单文档最大大小', type:'number', min:1, max:200, default:50, unit:'MB' },
      max_document_chars:      { cat:'limits', desc:'单文档最大字符数', type:'number', min:10000, max:5000000, step:10000, default:500000, unit:'chars' },
      max_documents_per_user:  { cat:'limits', desc:'每用户最大文档数', type:'number', min:1, max:10000, default:200 },
      max_chunks_per_user:     { cat:'limits', desc:'每用户最大分块数', type:'number', min:100, max:500000, step:1000, default:50000 },
      rate_limit_per_minute:   { cat:'limits', desc:'每分钟 API 调用限制', type:'number', min:1, max:1000, default:30, unit:'次/分' },
      enable_user_isolation:   { cat:'security', desc:'启用用户数据隔离', type:'boolean', default:true },
      enable_content_moderation:{ cat:'security', desc:'启用内容审核', type:'boolean', default:false },
      enable_rate_limiting:    { cat:'security', desc:'启用 API 频率限制', type:'boolean', default:true },
      enable_debug_log:        { cat:'debug', desc:'启用调试日志', type:'boolean', default:true },
      enable_latency_tracking: { cat:'debug', desc:'启用延迟追踪', type:'boolean', default:true },
      enable_dry_run:          { cat:'debug', desc:'启用 Dry Run（不实际调用 LLM）', type:'boolean', default:false },
    };

    function escHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    async function loadSystemConfigs() {
      try {
        var resp = await fetch('/api/rag/ops/system/configs', { headers: getAuthHeaders() });
        var d = await resp.json();
        allConfigs = d.configs || [];
        // Store original values
        originalValues = {};
        allConfigs.forEach(function(c) { originalValues[c.config_key] = c.config_value; });
        modifiedKeys.clear();
        renderConfigs();
      } catch(e) {
        document.getElementById('scConfigContainer').innerHTML = '<div class="rc-card" style="text-align:center;padding:40px;color:#f87171;"><i class="fas fa-exclamation-circle"></i> 加载系统配置失败</div>';
      }
    }

    async function loadStorageStats() {
      try {
        var resp = await fetch('/api/rag/ops/system/storage-stats', { headers: getAuthHeaders() });
        var d = await resp.json();
        if (!d.success) return;
        var kpi = document.getElementById('scStorageKpi');
        kpi.innerHTML =
          '<div class="rc-kpi-card"><div class="rc-kpi-icon blue"><i class="fas fa-file-alt"></i></div><div class="rc-kpi-value">' + (d.documents || 0) + '</div><div class="rc-kpi-label">文档总数</div></div>' +
          '<div class="rc-kpi-card"><div class="rc-kpi-icon green"><i class="fas fa-puzzle-piece"></i></div><div class="rc-kpi-value">' + (d.chunks || 0) + '</div><div class="rc-kpi-label">分块总数</div></div>' +
          '<div class="rc-kpi-card"><div class="rc-kpi-icon purple"><i class="fas fa-comments"></i></div><div class="rc-kpi-value">' + (d.messages || 0) + '</div><div class="rc-kpi-label">问答消息</div></div>' +
          '<div class="rc-kpi-card"><div class="rc-kpi-icon amber"><i class="fas fa-clipboard-list"></i></div><div class="rc-kpi-value">' + (d.testQuestions || 0) + '</div><div class="rc-kpi-label">测试题目</div></div>';
      } catch(e) { /* silent */ }
    }

    function switchCategory(cat, btn) {
      currentCategory = cat;
      document.querySelectorAll('#scTabs .rc-tab').forEach(function(t) { t.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      renderConfigs();
    }

    function getConfigValue(key) {
      var cfg = allConfigs.find(function(c) { return c.config_key === key; });
      return cfg ? cfg.config_value : null;
    }

    function renderConfigs() {
      var container = document.getElementById('scConfigContainer');
      // Filter configs by category
      var keys = Object.keys(configMeta).filter(function(k) { return configMeta[k].cat === currentCategory; });
      if (!keys.length) {
        container.innerHTML = '<div class="rc-card" style="text-align:center;padding:40px;color:#475569;">该分类下暂无配置项</div>';
        return;
      }

      var html = '<div class="sc-group">';
      keys.forEach(function(key) {
        var meta = configMeta[key];
        var val = getConfigValue(key);
        var isModified = modifiedKeys.has(key);
        html += '<div class="sc-item' + (isModified ? ' modified' : '') + '" id="sc-row-' + key + '">';
        html += '<div class="sc-item-info">';
        html += '<div class="sc-item-key">' + escHtml(key) + '</div>';
        html += '<div class="sc-item-desc">' + escHtml(meta.desc) + '</div>';
        html += '<div class="sc-item-type">' + meta.type + (meta.unit ? ' | ' + meta.unit : '') + ' | 默认: ' + meta.default + '</div>';
        if (val !== null && val !== String(meta.default)) {
          html += '<div class="sc-default" onclick="resetToDefault(\\''+key+'\\')">重置为默认值</div>';
        }
        html += '</div>';
        html += '<div class="sc-item-control">';

        if (meta.type === 'boolean') {
          var boolVal = val === 'true' || val === '1';
          html += '<button class="sc-toggle ' + (boolVal ? 'on' : 'off') + '" id="sc-val-' + key + '" onclick="toggleBool(\\''+key+'\\')"></button>';
          html += '<span class="sc-unit" id="sc-bool-label-' + key + '">' + (boolVal ? '已启用' : '已关闭') + '</span>';
        } else if (meta.type === 'select') {
          html += '<select class="sc-select" id="sc-val-' + key + '" onchange="markModified(\\''+key+'\\',this.value)">';
          (meta.options || []).forEach(function(opt) {
            html += '<option value="' + opt + '"' + (val === opt ? ' selected' : '') + '>' + opt + '</option>';
          });
          html += '</select>';
        } else {
          // number
          html += '<input type="number" class="sc-input-num" id="sc-val-' + key + '" value="' + (val || meta.default) + '"' +
            (meta.min !== undefined ? ' min="' + meta.min + '"' : '') +
            (meta.max !== undefined ? ' max="' + meta.max + '"' : '') +
            (meta.step ? ' step="' + meta.step + '"' : '') +
            ' onchange="markModified(\\''+key+'\\',this.value)">';
          if (meta.unit) html += '<span class="sc-unit">' + meta.unit + '</span>';
        }

        html += '</div></div>';
      });
      html += '</div>';

      container.innerHTML = html;
    }

    function toggleBool(key) {
      var btn = document.getElementById('sc-val-' + key);
      var label = document.getElementById('sc-bool-label-' + key);
      var isOn = btn.classList.contains('on');
      btn.classList.toggle('on', !isOn);
      btn.classList.toggle('off', isOn);
      label.textContent = !isOn ? '已启用' : '已关闭';
      markModified(key, (!isOn).toString());
    }

    function markModified(key, newValue) {
      var row = document.getElementById('sc-row-' + key);
      if (String(newValue) !== String(originalValues[key])) {
        modifiedKeys.add(key);
        if (row) row.classList.add('modified');
      } else {
        modifiedKeys.delete(key);
        if (row) row.classList.remove('modified');
      }
    }

    function resetToDefault(key) {
      var meta = configMeta[key];
      if (!meta) return;
      var el = document.getElementById('sc-val-' + key);
      if (!el) return;
      if (meta.type === 'boolean') {
        var defBool = meta.default === true || meta.default === 'true';
        el.classList.toggle('on', defBool);
        el.classList.toggle('off', !defBool);
        var label = document.getElementById('sc-bool-label-' + key);
        if (label) label.textContent = defBool ? '已启用' : '已关闭';
        markModified(key, String(defBool));
      } else if (meta.type === 'select') {
        el.value = String(meta.default);
        markModified(key, String(meta.default));
      } else {
        el.value = meta.default;
        markModified(key, String(meta.default));
      }
    }

    function collectAllValues() {
      var vals = {};
      Object.keys(configMeta).forEach(function(key) {
        var el = document.getElementById('sc-val-' + key);
        if (!el) return;
        var meta = configMeta[key];
        if (meta.type === 'boolean') {
          vals[key] = el.classList.contains('on') ? 'true' : 'false';
        } else {
          vals[key] = el.value;
        }
      });
      return vals;
    }

    async function saveAllConfigs() {
      var statusEl = document.getElementById('scSaveStatus');
      // Collect only modified values
      var allVals = collectAllValues();
      var toSave = {};
      modifiedKeys.forEach(function(key) {
        if (allVals[key] !== undefined) toSave[key] = allVals[key];
      });

      if (Object.keys(toSave).length === 0) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(148,163,184,0.08)';
        statusEl.style.color = '#94a3b8';
        statusEl.style.border = '1px solid rgba(148,163,184,0.12)';
        statusEl.innerHTML = '<i class="fas fa-info-circle"></i> 没有需要保存的修改';
        setTimeout(function(){ statusEl.style.display='none'; }, 3000);
        return;
      }

      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(212,175,55,0.06)';
      statusEl.style.color = '#d4af37';
      statusEl.style.border = '1px solid rgba(212,175,55,0.12)';
      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在保存 ' + Object.keys(toSave).length + ' 项配置...';

      try {
        var resp = await fetch('/api/rag/ops/system/configs', {
          method:'PUT',
          headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
          body: JSON.stringify({ configs: toSave })
        });
        var d = await resp.json();
        if (d.success) {
          // Update original values
          Object.keys(toSave).forEach(function(k) { originalValues[k] = toSave[k]; });
          modifiedKeys.clear();
          renderConfigs();
          statusEl.style.background = 'rgba(74,222,128,0.08)';
          statusEl.style.color = '#4ade80';
          statusEl.style.border = '1px solid rgba(74,222,128,0.15)';
          statusEl.innerHTML = '<i class="fas fa-check-circle"></i> 已成功保存 ' + (d.updated || Object.keys(toSave).length) + ' 项配置';
        } else {
          statusEl.style.background = 'rgba(248,113,113,0.08)';
          statusEl.style.color = '#f87171';
          statusEl.style.border = '1px solid rgba(248,113,113,0.15)';
          statusEl.innerHTML = '<i class="fas fa-times-circle"></i> 保存失败: ' + (d.error || '未知错误');
        }
        setTimeout(function(){ statusEl.style.display='none'; }, 4000);
      } catch(e) {
        statusEl.style.background = 'rgba(248,113,113,0.08)';
        statusEl.style.color = '#f87171';
        statusEl.style.border = '1px solid rgba(248,113,113,0.15)';
        statusEl.innerHTML = '<i class="fas fa-times-circle"></i> 请求失败，请重试';
        setTimeout(function(){ statusEl.style.display='none'; }, 4000);
      }
    }

    // Init
    loadSystemConfigs();
    loadStorageStats();
  `;

  return wrapWithRagLayout({
    title: '系统配置',
    activePath: '/rag/settings/system',
    body,
    scripts,
    styles,
  });
}
