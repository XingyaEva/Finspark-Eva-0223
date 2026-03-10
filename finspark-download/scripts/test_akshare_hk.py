#!/usr/bin/env python3
"""
AkShare 港股接口验证脚本
用于测试 AkShare 的港股数据接口可用性和数据质量

运行方式：
    cd /home/user/webapp/finspark-download
    python3 scripts/test_akshare_hk.py
"""

import sys
import time
from datetime import datetime, timedelta

try:
    import akshare as ak
    import pandas as pd
except ImportError:
    print("请先安装依赖: pip install akshare pandas")
    sys.exit(1)


def print_header(title: str):
    """打印标题"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_result(name: str, success: bool, data_count: int = 0, error: str = None):
    """打印测试结果"""
    if success:
        print(f"  ✅ {name}: {data_count} 条记录")
    else:
        print(f"  ❌ {name}: {error}")


def test_hk_stock_list():
    """测试港股通成分股列表"""
    print_header("测试1: 港股通成分股列表 (stock_hk_ggt_components_em)")
    try:
        df = ak.stock_hk_ggt_components_em()
        print_result("港股通成分股", True, len(df))
        print(f"  字段: {list(df.columns)}")
        print(f"  前3只股票:")
        for i, row in df.head(3).iterrows():
            print(f"    - {row.get('代码', row.get('code', 'N/A'))} {row.get('名称', row.get('name', 'N/A'))}")
        return True, df
    except Exception as e:
        print_result("港股通成分股", False, error=str(e))
        return False, None


def test_hk_history(symbol: str = "00700"):
    """测试港股历史日线数据"""
    print_header(f"测试2: 港股历史日线 (stock_hk_hist) - {symbol}")
    try:
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
        
        df = ak.stock_hk_hist(
            symbol=symbol,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq"  # 前复权
        )
        print_result(f"{symbol} 日线数据", True, len(df))
        print(f"  字段: {list(df.columns)}")
        print(f"  日期范围: {df['日期'].min()} ~ {df['日期'].max()}")
        print(f"  最新收盘价: {df['收盘'].iloc[-1] if len(df) > 0 else 'N/A'}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 日线数据", False, error=str(e))
        return False, None


def test_hk_financial(symbol: str = "00700"):
    """测试港股财务指标"""
    print_header(f"测试3: 港股财务指标 (stock_hk_financial_indicator_em) - {symbol}")
    try:
        df = ak.stock_hk_financial_indicator_em(symbol=symbol)
        print_result(f"{symbol} 财务指标", True, len(df))
        print(f"  字段: {list(df.columns)}")
        if len(df) > 0:
            row = df.iloc[0]
            print(f"  基本每股收益: {row.get('基本每股收益', 'N/A')}")
            print(f"  每股净资产: {row.get('每股净资产', 'N/A')}")
            print(f"  总市值: {row.get('总市值', 'N/A')}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 财务指标", False, error=str(e))
        return False, None


def test_hk_company_profile(symbol: str = "00700"):
    """测试港股公司概况"""
    print_header(f"测试4: 港股公司概况 (stock_hk_company_profile_em) - {symbol}")
    try:
        df = ak.stock_hk_company_profile_em(symbol=symbol)
        print_result(f"{symbol} 公司概况", True, len(df))
        if len(df) > 0:
            for col in ['公司名称', '英文名称', '成立日期', '所属行业', '董事长']:
                if col in df.columns:
                    print(f"  {col}: {df[col].iloc[0]}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 公司概况", False, error=str(e))
        return False, None


def test_hk_dividend(symbol: str = "00700"):
    """测试港股分红派息"""
    print_header(f"测试5: 港股分红派息 (stock_hk_dividend_payout_em) - {symbol}")
    try:
        df = ak.stock_hk_dividend_payout_em(symbol=symbol)
        print_result(f"{symbol} 分红记录", True, len(df))
        print(f"  字段: {list(df.columns)}")
        if len(df) > 0:
            print(f"  最近一次分红:")
            row = df.iloc[0]
            for col in ['财政年度', '分红方案', '除净日']:
                if col in df.columns:
                    print(f"    {col}: {row[col]}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 分红记录", False, error=str(e))
        return False, None


def test_hk_security_profile(symbol: str = "00700"):
    """测试港股证券资料"""
    print_header(f"测试6: 港股证券资料 (stock_hk_security_profile_em) - {symbol}")
    try:
        df = ak.stock_hk_security_profile_em(symbol=symbol)
        print_result(f"{symbol} 证券资料", True, len(df))
        if len(df) > 0:
            for col in ['证券代码', '上市日期', '发行价', '每手', '沪港通标的', '深港通标的']:
                if col in df.columns:
                    print(f"  {col}: {df[col].iloc[0]}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 证券资料", False, error=str(e))
        return False, None


def test_hk_growth_comparison(symbol: str = "00700"):
    """测试港股成长性对比"""
    print_header(f"测试7: 港股成长性对比 (stock_hk_growth_comparison_em) - {symbol}")
    try:
        df = ak.stock_hk_growth_comparison_em(symbol=symbol)
        print_result(f"{symbol} 成长性对比", True, len(df))
        print(f"  字段: {list(df.columns)}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 成长性对比", False, error=str(e))
        return False, None


def test_hk_valuation_comparison(symbol: str = "00700"):
    """测试港股估值对比"""
    print_header(f"测试8: 港股估值对比 (stock_hk_valuation_comparison_em) - {symbol}")
    try:
        df = ak.stock_hk_valuation_comparison_em(symbol=symbol)
        print_result(f"{symbol} 估值对比", True, len(df))
        print(f"  字段: {list(df.columns)}")
        return True, df
    except Exception as e:
        print_result(f"{symbol} 估值对比", False, error=str(e))
        return False, None


def main():
    """主函数"""
    print("\n" + "=" * 70)
    print("  AkShare 港股数据接口测试")
    print(f"  测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  AkShare 版本: {ak.__version__}")
    print("=" * 70)
    
    # 测试股票代码
    test_symbol = "00700"  # 腾讯控股
    
    # 运行所有测试
    tests = [
        ("港股通成分股列表", test_hk_stock_list),
        ("港股历史日线", lambda: test_hk_history(test_symbol)),
        ("港股财务指标", lambda: test_hk_financial(test_symbol)),
        ("港股公司概况", lambda: test_hk_company_profile(test_symbol)),
        ("港股分红派息", lambda: test_hk_dividend(test_symbol)),
        ("港股证券资料", lambda: test_hk_security_profile(test_symbol)),
        ("港股成长性对比", lambda: test_hk_growth_comparison(test_symbol)),
        ("港股估值对比", lambda: test_hk_valuation_comparison(test_symbol)),
    ]
    
    results = []
    for name, test_func in tests:
        success, data = test_func()
        results.append((name, success))
        time.sleep(0.5)  # 避免请求过快
    
    # 打印汇总
    print_header("测试结果汇总")
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"  {status} - {name}")
    
    print(f"\n  总计: {passed}/{total} 测试通过")
    print(f"  通过率: {passed/total*100:.1f}%")
    
    # 返回状态码
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
