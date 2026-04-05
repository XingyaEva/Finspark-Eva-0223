#!/usr/bin/env bash
#
# batch-sync-seed-reports.sh
# 批量同步种子财报到 RAG 知识库
#
# 选取 15 家代表性 A 股公司（覆盖 10 个行业），每家拉取最新年报。
# 通过线上 /api/rag/sync/trigger 接口逐个触发异步同步任务。
#
# 使用方式：
#   export FINSPARK_BASE_URL="https://你的线上域名"
#   export FINSPARK_AUTH_TOKEN="你的认证 token"   # 如果有 auth 的话
#   bash scripts/batch-sync-seed-reports.sh
#
# 注意事项：
#   - 每次调用间隔 5 秒，避免触发巨潮或 MinerU 的限流
#   - 同步是异步的，脚本只负责触发，实际入库需要几分钟/份
#   - 可通过 /api/rag/sync/tasks 查看所有任务进度
#

set -euo pipefail

# ========== 配置 ==========
BASE_URL="${FINSPARK_BASE_URL:-https://finspark-financial.pages.dev}"
AUTH_TOKEN="${FINSPARK_AUTH_TOKEN:-}"
REPORT_YEAR="${REPORT_YEAR:-2024}"       # 默认拉取 2024 年报
REPORT_TYPE="${REPORT_TYPE:-annual}"     # 默认年报
INTERVAL_SEC="${INTERVAL_SEC:-5}"        # 请求间隔（秒）

# ========== 15 家种子公司（10 行业 × 每行业 1-2 家） ==========
#
# 选取原则：
#   1. 每个行业至少 1 家，确保测试集覆盖行业多样性
#   2. 优先选市值大、数据质量高、财报规范的龙头
#   3. 兼顾不同交易所（上交所 60xxxx + 深交所 00xxxx/30xxxx + 科创板 68xxxx）
#   4. 兼顾不同难度（简单如茅台、困难如寒武纪亏损企业）

declare -a COMPANIES=(
  # 格式: "股票代码|公司名称|行业|难度"

  # 行业 2: 消费电子与硬件
  "002475|立讯精密|消费电子|medium"

  # 行业 3: 半导体与电子制造
  "002371|北方华创|半导体|medium"
  "688256|寒武纪|半导体(AI芯片)|hard"

  # 行业 4: 新能源车与汽车产业链
  "002594|比亚迪|新能源车|medium"
  "300750|宁德时代|动力电池|medium"

  # 行业 5: 能源、电力与公用事业
  "601857|中国石油|能源|easy"
  "600900|长江电力|电力|easy"

  # 行业 6: 金融 — 银行
  "600036|招商银行|银行|easy"

  # 行业 7: 金融 — 保险券商
  "601318|中国平安|保险|medium"
  "600030|中信证券|券商|medium"

  # 行业 8: 医药与医疗
  "300760|迈瑞医疗|医疗器械|medium"

  # 行业 9: 食品饮料与大众消费
  "600519|贵州茅台|白酒|easy"
  "000858|五粮液|白酒|easy"

  # 行业 10: 基建与资源材料
  "601899|紫金矿业|矿业|medium"
  "600585|海螺水泥|建材|easy"
)

# ========== 构建 Auth Header ==========
AUTH_HEADER=""
if [[ -n "$AUTH_TOKEN" ]]; then
  AUTH_HEADER="-H \"Authorization: Bearer ${AUTH_TOKEN}\""
fi

# ========== 执行同步 ==========
echo "========================================"
echo "  FinSpark RAG 种子财报批量同步"
echo "========================================"
echo ""
echo "目标：${BASE_URL}"
echo "报告类型：${REPORT_TYPE}  |  年份：${REPORT_YEAR}"
echo "公司数量：${#COMPANIES[@]} 家"
echo "请求间隔：${INTERVAL_SEC} 秒"
echo ""
echo "----------------------------------------"

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for entry in "${COMPANIES[@]}"; do
  IFS='|' read -r code name industry difficulty <<< "$entry"

  echo -n "[$(date +%H:%M:%S)] ${code} ${name} (${industry}, ${difficulty}) ... "

  # 调用 sync/trigger API
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/rag/sync/trigger" \
    -H "Content-Type: application/json" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer ${AUTH_TOKEN}"} \
    -d "{
      \"stockCode\": \"${code}\",
      \"stockName\": \"${name}\",
      \"reportType\": \"${REPORT_TYPE}\",
      \"reportYear\": ${REPORT_YEAR}
    }" \
    --max-time 30 \
    2>/dev/null || echo '{"success":false,"error":"网络错误"}')

  # 解析结果
  SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || true)
  TASK_ID=$(echo "$RESPONSE" | grep -o '"taskId":[0-9]*' | grep -o '[0-9]*' || true)
  STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//' || true)
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | sed 's/"error":"//;s/"//' || true)

  if [[ -n "$SUCCESS" ]]; then
    if [[ "$STATUS" == "already_ingested" ]]; then
      echo "⏭️  已入库，跳过"
      SKIP_COUNT=$((SKIP_COUNT + 1))
    elif [[ -n "$TASK_ID" && "$TASK_ID" != "0" ]]; then
      echo "✅ 任务已创建 (taskId: ${TASK_ID})"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo "⏭️  ${STATUS:-已存在}"
      SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
  else
    echo "❌ 失败: ${ERROR:-未知错误}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # 间隔等待（避免限流）
  sleep "$INTERVAL_SEC"
done

echo ""
echo "========================================"
echo "  同步触发完成"
echo "========================================"
echo ""
echo "  ✅ 新建任务: ${SUCCESS_COUNT}"
echo "  ⏭️  已存在/跳过: ${SKIP_COUNT}"
echo "  ❌ 失败: ${FAIL_COUNT}"
echo ""
echo "  查看进度: ${BASE_URL}/api/rag/sync/tasks"
echo "  RAG 面板: ${BASE_URL}/rag/dashboard"
echo ""
echo "  提示: 每份财报入库约需 2-5 分钟 (PDF下载 + MinerU解析 + 向量化)"
echo "  可用以下命令轮询任务状态："
echo ""
echo "  curl -s '${BASE_URL}/api/rag/sync/tasks?limit=20' | python3 -m json.tool"
echo ""

