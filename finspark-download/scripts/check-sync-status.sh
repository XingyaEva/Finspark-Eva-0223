#!/usr/bin/env bash
#
# check-sync-status.sh
# 查看所有同步任务状态，持续轮询直到全部完成
#
# 使用方式：
#   export FINSPARK_BASE_URL="https://你的线上域名"
#   bash scripts/check-sync-status.sh          # 查看一次
#   bash scripts/check-sync-status.sh --watch   # 持续轮询（每 30 秒刷新）
#

set -euo pipefail

BASE_URL="${FINSPARK_BASE_URL:-https://finspark-financial.pages.dev}"
AUTH_TOKEN="${FINSPARK_AUTH_TOKEN:-}"
WATCH_MODE="${1:-}"
POLL_INTERVAL=30

print_status() {
  echo ""
  echo "========================================"
  echo "  FinSpark RAG 同步任务状态  $(date +%H:%M:%S)"
  echo "========================================"
  echo ""

  RESPONSE=$(curl -s "${BASE_URL}/api/rag/sync/tasks?limit=50" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer ${AUTH_TOKEN}"} \
    --max-time 15 2>/dev/null || echo '{"success":false}')

  # 用 python3 格式化输出
  echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if not data.get('success'):
        print('  ❌ 获取任务列表失败')
        sys.exit(1)
    tasks = data.get('tasks', [])
    if not tasks:
        print('  暂无同步任务')
        sys.exit(0)

    # 统计
    stats = {}
    for t in tasks:
        s = t.get('status', 'unknown')
        stats[s] = stats.get(s, 0) + 1

    print(f'  总任务数: {len(tasks)}')
    for s, c in sorted(stats.items()):
        icon = {'completed':'✅','failed':'❌','pending':'⏳','searching':'🔍','downloading':'⬇️','parsing':'📄','ingesting':'💾'}.get(s, '❓')
        print(f'  {icon} {s}: {c}')

    print()
    print(f'  {\"代码\":<10} {\"名称\":<12} {\"类型\":<10} {\"年份\":<6} {\"状态\":<12} {\"进度\":<6} {\"Chunks\":<8} {\"备注\"}')
    print('  ' + '-' * 90)

    for t in tasks:
        code = t.get('stock_code', t.get('stockCode', ''))
        name = t.get('stock_name', t.get('stockName', ''))[:10]
        rtype = t.get('report_type', t.get('reportType', ''))
        year = str(t.get('report_year', t.get('reportYear', '')))
        status = t.get('status', '')
        progress = str(t.get('progress', 0)) + '%'
        chunks = str(t.get('chunk_count', t.get('chunkCount', '-')))
        err = (t.get('error_message', t.get('errorMessage', '')) or '')[:30]

        icon = {'completed':'✅','failed':'❌','pending':'⏳','searching':'🔍','downloading':'⬇️','parsing':'📄','ingesting':'💾'}.get(status, '❓')
        print(f'  {code:<10} {name:<12} {rtype:<10} {year:<6} {icon} {status:<10} {progress:<6} {chunks:<8} {err}')

    # 判断是否全部完成
    active = sum(1 for t in tasks if t.get('status') not in ('completed', 'failed'))
    if active == 0:
        print()
        print('  🎉 所有任务已完成！')
        sys.exit(0)
    else:
        print()
        print(f'  ⏳ 仍有 {active} 个任务进行中...')
        sys.exit(2)  # exit 2 表示还有进行中的任务

except Exception as e:
    print(f'  解析失败: {e}')
    sys.exit(1)
" 2>/dev/null
  return $?
}

if [[ "$WATCH_MODE" == "--watch" ]]; then
  echo "持续监控模式（每 ${POLL_INTERVAL} 秒刷新，Ctrl+C 退出）"
  while true; do
    print_status
    EXIT_CODE=$?
    if [[ $EXIT_CODE -eq 0 ]]; then
      echo ""
      echo "所有任务已完成，停止监控。"
      break
    fi
    sleep $POLL_INTERVAL
  done
else
  print_status
fi
