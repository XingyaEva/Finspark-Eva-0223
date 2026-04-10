/**
 * QueryRouter 单元测试
 *
 * 验证意图路由决策的正确性，确保各路由类型能正确命中
 */
import { QueryRouter } from './queryRouter';

const router = new QueryRouter();

// ── 测试用例 ──────────────────────────────────────────────────────────────

const cases: Array<{
  question: string;
  expectedRoute: string;
  desc: string;
}> = [
  // ── RAG 默认路由 ────────────────────────────────────────────────────────
  { question: '茅台2024年营收是多少？', expectedRoute: 'rag', desc: '财报数值查询 → rag' },
  { question: '北方华创的研发投入占比', expectedRoute: 'rag', desc: '财报比例查询 → rag' },
  { question: '比亚迪的毛利率趋势如何？', expectedRoute: 'rag', desc: '历史趋势分析 → rag' },
  { question: '招商银行的资管规模', expectedRoute: 'rag', desc: '规模类数值 → rag' },
  { question: '海螺水泥的主要风险有哪些', expectedRoute: 'rag', desc: '风险分析 → rag' },

  // ── 实时数据路由 ──────────────────────────────────────────────────────────
  { question: '茅台今天的股价是多少？', expectedRoute: 'realtime', desc: '今天股价 → realtime' },
  { question: '比亚迪当前市值', expectedRoute: 'realtime', desc: '当前市值 → realtime' },
  { question: '招商银行现在的PE是多少', expectedRoute: 'realtime', desc: '当前PE → realtime' },
  { question: '宁德时代今日涨幅', expectedRoute: 'realtime', desc: '今日涨幅 → realtime' },
  { question: '茅台的实时换手率', expectedRoute: 'realtime', desc: '实时换手率 → realtime' },
  { question: '北方华创最新PB值', expectedRoute: 'realtime', desc: '最新PB → realtime' },

  // ── 完整分析路由 ──────────────────────────────────────────────────────────
  { question: '帮我全面分析一下比亚迪', expectedRoute: 'agent_report', desc: '全面分析请求 → agent_report' },
  { question: '茅台值不值得买入？', expectedRoute: 'agent_report', desc: '投资建议 → agent_report' },
  { question: '帮我生成一份招行的财报分析报告', expectedRoute: 'agent_report', desc: '生成报告 → agent_report' },
  { question: '比亚迪的商业模式分析', expectedRoute: 'agent_report', desc: '商业模式分析 → agent_report' },

  // ── 混合路由 ──────────────────────────────────────────────────────────────
  { question: '结合当前股价，茅台的估值合理吗', expectedRoute: 'hybrid', desc: '结合股价+估值 → hybrid' },
  { question: '目前估值下比亚迪值不值得投资', expectedRoute: 'hybrid', desc: '当前估值投资判断 → hybrid' },

  // ── 强制路由 ──────────────────────────────────────────────────────────────
  { question: '茅台2024年营收', expectedRoute: 'realtime', desc: '强制 realtime 覆盖' },
];

// ── 运行测试 ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const tc of cases.slice(0, -1)) {
  // 最后一条是强制路由，单独处理
  const decision = router.decide(tc.question);
  if (decision.route === tc.expectedRoute) {
    passed++;
    console.log(`  ✅ ${tc.desc}`);
  } else {
    failed++;
    const msg = `  ❌ ${tc.desc}\n     expected=${tc.expectedRoute}, got=${decision.route}, reason="${decision.reason}"`;
    failures.push(msg);
    console.log(msg);
  }
}

// 强制路由测试
const forceDecision = router.decide('茅台2024年营收', { forceRoute: 'realtime' });
if (forceDecision.route === 'realtime') {
  passed++;
  console.log(`  ✅ 强制路由 forceRoute=realtime`);
} else {
  failed++;
  failures.push(`  ❌ 强制路由失败: expected=realtime, got=${forceDecision.route}`);
}

// isComparativeQuery 测试
const compCases = [
  { q: '茅台和五粮液哪个毛利率更高', expected: true },
  { q: '比亚迪与宁德时代的营收对比', expected: true },
  { q: '茅台2024年营收', expected: false },
];
for (const cc of compCases) {
  const result = router.isComparativeQuery(cc.q);
  if (result === cc.expected) {
    passed++;
    console.log(`  ✅ isComparative: "${cc.q.slice(0, 20)}" → ${result}`);
  } else {
    failed++;
    failures.push(`  ❌ isComparative: "${cc.q.slice(0, 20)}" expected=${cc.expected}, got=${result}`);
  }
}

// ── 总结 ──────────────────────────────────────────────────────────────────
console.log(`\n📊 QueryRouter 测试结果: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
  console.log('\n失败详情:');
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log('所有测试通过 ✅');
}
