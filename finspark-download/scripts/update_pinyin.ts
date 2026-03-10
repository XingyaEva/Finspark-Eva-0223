// 更新股票表的拼音字段
// 运行方式: npx ts-node scripts/update_pinyin.ts

import { toPinyin, toPinyinAbbr } from '../src/services/pinyin';

// 这个脚本用于手动生成 SQL 更新语句
// 由于 D1 的限制，需要通过 wrangler 执行

const SAMPLE_STOCKS = [
  '贵州茅台', '五粮液', '泸州老窖', '山西汾酒', '洋河股份',
  '中芯国际', '宁德时代', '比亚迪', '隆基绿能', '通威股份',
  '招商银行', '工商银行', '农业银行', '建设银行', '中国银行',
  '中国平安', '中国人寿', '新华保险', '中信证券', '华泰证券',
  '格力电器', '美的集团', '海尔智家', '海康威视', '大华股份',
];

console.log('-- 拼音转换示例:');
for (const name of SAMPLE_STOCKS) {
  const pinyin = toPinyin(name);
  const abbr = toPinyinAbbr(name);
  console.log(`UPDATE stocks SET pinyin='${pinyin}', pinyin_abbr='${abbr}' WHERE name='${name}';`);
}

console.log('\n-- 使用 wrangler 执行以下命令更新所有股票的拼音:');
console.log('-- 1. 先应用迁移: npx wrangler d1 migrations apply genspark-financial-db --local');
console.log('-- 2. 然后运行更新脚本');
