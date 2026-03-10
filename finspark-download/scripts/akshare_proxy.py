#!/usr/bin/env python3
"""
AKShare 港股数据代理服务

功能:
1. 提供 REST API 供 TypeScript 后端调用
2. 封装 AKShare 港股财务报表接口
3. 支持利润表、资产负债表、现金流量表
4. 支持 K 线数据和股票基本信息

运行方式:
    pip install fastapi uvicorn akshare pandas
    python scripts/akshare_proxy.py
    
    # 或使用 uvicorn 启动
    uvicorn akshare_proxy:app --host 0.0.0.0 --port 8000

API 端点:
    GET /health                      - 健康检查
    GET /hk/financial/{code}/{type}  - 获取港股财务报表
    GET /hk/kline/{code}             - 获取港股K线数据
    GET /hk/basic/{code}             - 获取港股基本信息
    GET /hk/company/{code}           - 获取港股公司信息
    GET /hk/daily_basic/{code}       - 获取港股每日指标
    GET /hk/fina_indicator/{code}    - 获取港股财务指标
    GET /hk/main_biz/{code}          - 获取港股主营业务构成

数据来源: AKShare (东方财富)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import akshare as ak
import pandas as pd
import numpy as np
from typing import Optional, Any
import traceback
import sys
import math
import json


def safe_json_dumps(obj: Any) -> str:
    """安全的 JSON 序列化，处理 NaN 和 Inf"""
    def sanitize(o):
        if isinstance(o, dict):
            return {k: sanitize(v) for k, v in o.items()}
        if isinstance(o, list):
            return [sanitize(item) for item in o]
        if isinstance(o, (float, np.floating)):
            if pd.isna(o) or np.isnan(o) or np.isinf(o):
                return 0
            return float(o)
        if isinstance(o, np.integer):
            return int(o)
        if pd.isna(o):
            return None
        return o
    
    return json.dumps(sanitize(obj), ensure_ascii=False)

# 创建 FastAPI 应用
app = FastAPI(
    title="AKShare HK Stock Proxy",
    description="港股财务数据代理服务 - 为 Finspark 提供港股三大财务报表数据",
    version="1.0.0"
)

# CORS 配置 - 允许所有来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ 健康检查 ============
@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "ok",
        "service": "akshare-hk-proxy",
        "version": "1.2.0",  # 更新版本号
        "akshare_version": ak.__version__ if hasattr(ak, '__version__') else "unknown"
    }


# ============ 诊断端点 ============
@app.get("/diagnose/{stock_code}")
async def diagnose_stock(stock_code: str):
    """
    诊断港股数据获取状态
    
    检查所有财务报表是否可以成功获取
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    results = {
        "stock_code": code,
        "akshare_version": ak.__version__ if hasattr(ak, '__version__') else "unknown",
        "reports": {}
    }
    
    for report_type, symbol in [("income", "利润表"), ("balance", "资产负债表"), ("cashflow", "现金流量表")]:
        try:
            df = ak.stock_financial_hk_report_em(
                stock=code,
                symbol=symbol,
                indicator="年度"
            )
            if df is not None and not df.empty:
                results["reports"][report_type] = {
                    "success": True,
                    "count": len(df),
                    "fields": df['STD_ITEM_NAME'].unique().tolist()[:10] if 'STD_ITEM_NAME' in df.columns else []
                }
            else:
                results["reports"][report_type] = {
                    "success": True,
                    "count": 0,
                    "message": "Empty data"
                }
        except Exception as e:
            results["reports"][report_type] = {
                "success": False,
                "error": str(e)
            }
    
    return results


# ============ 港股财务报表 ============
def clean_value(val):
    """清理单个值，确保可 JSON 序列化"""
    if val is None:
        return None
    if isinstance(val, (float, np.floating)):
        if pd.isna(val) or np.isnan(val) or np.isinf(val):
            return 0.0
        return float(val)
    if isinstance(val, np.integer):
        return int(val)
    if isinstance(val, (int, str, bool)):
        return val
    if pd.isna(val):
        return None
    # 其他类型转字符串
    return str(val)


def df_to_json_safe(df: pd.DataFrame) -> list:
    """将 DataFrame 转换为 JSON 安全的字典列表"""
    records = []
    for idx, row in df.iterrows():
        record = {}
        for col in df.columns:
            record[col] = clean_value(row[col])
        records.append(record)
    return records


@app.get("/hk/financial/{stock_code}/{report_type}")
async def get_hk_financial(
    stock_code: str,
    report_type: str,
    indicator: str = Query("年度", description="年度 或 报告期")
):
    """
    获取港股财务报表
    
    Args:
        stock_code: 港股代码 (如 00700)
        report_type: 报表类型 (income/balance/cashflow)
        indicator: 年度/报告期
        
    Returns:
        JSON 格式的财务报表数据
    """
    # 报表类型映射
    symbol_map = {
        "income": "利润表",
        "balance": "资产负债表",
        "cashflow": "现金流量表"
    }
    
    if report_type not in symbol_map:
        return Response(
            content=json.dumps({
                "success": False,
                "error": f"Invalid report_type: {report_type}. Must be one of: income, balance, cashflow",
                "data": []
            }, ensure_ascii=False),
            media_type="application/json",
            status_code=400
        )
    
    # 标准化股票代码 (确保是5位数字)
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)  # 补齐到5位
    
    try:
        print(f"[AkshareProxy] 获取港股{symbol_map[report_type]}: {code}, 指标: {indicator}")
        sys.stdout.flush()
        
        # 调用 AKShare 接口
        df = ak.stock_financial_hk_report_em(
            stock=code,
            symbol=symbol_map[report_type],
            indicator=indicator
        )
        
        if df is None or df.empty:
            print(f"[AkshareProxy] 警告: {code} {symbol_map[report_type]}数据为空")
            sys.stdout.flush()
            result = {
                "success": True,
                "data": [],
                "message": f"No data found for {code}"
            }
            return Response(
                content=json.dumps(result, ensure_ascii=False),
                media_type="application/json"
            )
        
        # 使用安全的转换函数
        data = df_to_json_safe(df)
        
        print(f"[AkshareProxy] 成功获取 {len(data)} 条{symbol_map[report_type]}数据")
        sys.stdout.flush()
        
        result = {
            "success": True,
            "data": data,
            "count": len(data)
        }
        
        # 使用标准 json.dumps，因为数据已经被清理
        return Response(
            content=json.dumps(result, ensure_ascii=False),
            media_type="application/json"
        )
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        print(f"[AkshareProxy] 错误: {error_msg}", file=sys.stderr)
        sys.stderr.flush()
        
        result = {
            "success": False,
            "error": error_msg,
            "data": []
        }
        return Response(
            content=json.dumps(result, ensure_ascii=False),
            media_type="application/json"
        )


# ============ 港股K线数据 ============
@app.get("/hk/kline/{stock_code}")
async def get_hk_kline(
    stock_code: str,
    days: int = Query(180, description="获取最近N天的数据"),
    adjust: str = Query("qfq", description="复权类型: qfq(前复权), hfq(后复权), 空(不复权)")
):
    """
    获取港股K线数据
    
    Args:
        stock_code: 港股代码 (如 00700)
        days: 获取最近N天的数据
        adjust: 复权类型
        
    Returns:
        JSON 格式的K线数据
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股K线: {code}, 天数: {days}, 复权: {adjust}")
        
        # 调用 AKShare 接口
        df = ak.stock_hk_hist(
            symbol=code,
            period="daily",
            adjust=adjust if adjust else ""
        )
        
        if df is None or df.empty:
            return {
                "success": True,
                "data": [],
                "message": f"No kline data found for {code}"
            }
        
        # 取最近N天
        df = df.tail(days)
        
        # 标准化列名
        column_map = {
            '日期': 'date',
            '开盘': 'open',
            '收盘': 'close',
            '最高': 'high',
            '最低': 'low',
            '成交量': 'volume',
            '成交额': 'amount',
            '振幅': 'amplitude',
            '涨跌幅': 'pct_chg',
            '涨跌额': 'change',
            '换手率': 'turnover_rate'
        }
        
        df = df.rename(columns=column_map)
        
        # 确保日期格式正确
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y%m%d')
        
        data = df.to_dict(orient="records")
        
        print(f"[AkshareProxy] 成功获取 {len(data)} 条K线数据")
        
        return {
            "success": True,
            "data": data,
            "count": len(data)
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        print(f"[AkshareProxy] 错误: {error_msg}", file=sys.stderr)
        
        return {
            "success": False,
            "error": error_msg,
            "data": []
        }


# ============ 港股基本信息 ============
@app.get("/hk/basic/{stock_code}")
async def get_hk_basic(stock_code: str):
    """
    获取港股基本信息
    
    Args:
        stock_code: 港股代码 (如 00700)
        
    Returns:
        JSON 格式的股票基本信息
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股基本信息: {code}")
        
        # 获取港股通成分股列表 (包含基本信息)
        try:
            df = ak.stock_hk_ggt_components_em()
            
            if df is not None and not df.empty:
                # 查找匹配的股票
                stock_info = df[df['代码'].str.contains(code, na=False)]
                
                if not stock_info.empty:
                    row = stock_info.iloc[0]
                    return {
                        "success": True,
                        "data": {
                            "code": code,
                            "name": row.get('名称', ''),
                            "industry": '港股',
                            "list_date": ''
                        }
                    }
        except Exception as e:
            print(f"[AkshareProxy] 获取港股通成分股失败: {e}")
        
        # 备用方案：从K线数据获取股票名称
        try:
            df = ak.stock_hk_hist(symbol=code, period="daily", adjust="qfq")
            if df is not None and not df.empty:
                return {
                    "success": True,
                    "data": {
                        "code": code,
                        "name": code,  # 暂无名称
                        "industry": '港股',
                        "list_date": ''
                    }
                }
        except Exception as e:
            print(f"[AkshareProxy] 备用方案失败: {e}")
        
        return {
            "success": True,
            "data": {
                "code": code,
                "name": code,
                "industry": '港股',
                "list_date": ''
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": error_msg,
            "data": None
        }


# ============ 港股公司信息 ============
@app.get("/hk/company/{stock_code}")
async def get_hk_company(stock_code: str):
    """
    获取港股公司信息
    
    Args:
        stock_code: 港股代码 (如 00700)
        
    Returns:
        JSON 格式的公司信息
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股公司信息: {code}")
        
        # 尝试获取公司概况
        try:
            df = ak.stock_hk_company_profile_em(symbol=code)
            
            if df is not None and not df.empty:
                # 将数据转换为字典
                company_data = {}
                for _, row in df.iterrows():
                    key = str(row.iloc[0]).strip() if len(row) > 0 else ''
                    value = str(row.iloc[1]).strip() if len(row) > 1 else ''
                    if key:
                        company_data[key] = value
                
                return {
                    "success": True,
                    "data": {
                        "chairman": company_data.get('董事长', ''),
                        "manager": company_data.get('总经理', ''),
                        "secretary": company_data.get('董秘', ''),
                        "reg_capital": 0,
                        "setup_date": company_data.get('成立日期', ''),
                        "introduction": company_data.get('公司介绍', ''),
                        "website": company_data.get('公司网址', ''),
                        "email": company_data.get('电子邮箱', ''),
                        "office": company_data.get('办公地址', ''),
                        "employees": 0,
                        "main_business": company_data.get('主营业务', '')
                    }
                }
        except Exception as e:
            print(f"[AkshareProxy] 获取公司概况失败: {e}")
        
        return {
            "success": True,
            "data": None
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": error_msg,
            "data": None
        }


# ============ 港股每日指标 ============
@app.get("/hk/daily_basic/{stock_code}")
async def get_hk_daily_basic(stock_code: str):
    """
    获取港股每日基本指标 (PE/PB/市值等)
    
    Args:
        stock_code: 港股代码 (如 00700)
        
    Returns:
        JSON 格式的每日指标数据
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股每日指标: {code}")
        
        # 尝试从估值对比接口获取
        try:
            df = ak.stock_hk_valuation_comparison_em(symbol=code)
            
            if df is not None and not df.empty:
                # 取最新一条数据
                latest = df.iloc[-1] if len(df) > 0 else None
                
                if latest is not None:
                    # 列名映射 (AKShare 返回的实际列名)
                    # 市盈率-TTM, 市盈率-LYR, 市净率-MRQ, 市净率-LYR, 市销率-TTM, 市销率-LYR
                    pe_ttm = float(latest.get('市盈率-TTM', 0) or 0)
                    pe = float(latest.get('市盈率-LYR', 0) or pe_ttm or 0)
                    pb = float(latest.get('市净率-MRQ', 0) or latest.get('市净率-LYR', 0) or 0)
                    ps_ttm = float(latest.get('市销率-TTM', 0) or 0)
                    ps = float(latest.get('市销率-LYR', 0) or ps_ttm or 0)
                    
                    print(f"[AkshareProxy] 港股估值数据: PE-TTM={pe_ttm}, PE={pe}, PB={pb}")
                    
                    return {
                        "success": True,
                        "data": [{
                            "trade_date": "",  # 估值对比接口不返回日期
                            "close": 0.0,  # 估值对比接口不返回收盘价
                            "pe": pe,
                            "pe_ttm": pe_ttm,
                            "pb": pb,
                            "ps": ps,
                            "ps_ttm": ps_ttm,
                            "turnover_rate": 0,
                            "volume_ratio": 0,
                            "dv_ratio": 0,
                            "dv_ttm": 0,
                            "total_share": 0,
                            "float_share": 0,
                            "free_share": 0,
                            "total_mv": 0.0,  # 估值对比接口不返回市值
                            "circ_mv": 0.0
                        }]
                    }
        except Exception as e:
            print(f"[AkshareProxy] 获取估值对比失败: {e}")
        
        # 备用：从K线数据获取基本信息
        try:
            df = ak.stock_hk_hist(symbol=code, period="daily", adjust="qfq")
            if df is not None and not df.empty:
                latest = df.iloc[-1]
                return {
                    "success": True,
                    "data": [{
                        "trade_date": str(latest.get('日期', '')).replace('-', ''),
                        "close": float(latest.get('收盘', 0) or 0),
                        "turnover_rate": float(latest.get('换手率', 0) or 0),
                        "pe": 0,
                        "pe_ttm": 0,
                        "pb": 0,
                        "ps": 0,
                        "ps_ttm": 0,
                        "volume_ratio": 0,
                        "dv_ratio": 0,
                        "dv_ttm": 0,
                        "total_share": 0,
                        "float_share": 0,
                        "free_share": 0,
                        "total_mv": 0,
                        "circ_mv": 0
                    }]
                }
        except Exception as e:
            print(f"[AkshareProxy] 备用方案失败: {e}")
        
        return {
            "success": True,
            "data": []
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": error_msg,
            "data": []
        }


# ============ 港股财务指标 ============
@app.get("/hk/fina_indicator/{stock_code}")
async def get_hk_fina_indicator(stock_code: str):
    """
    获取港股财务指标 (ROE/毛利率等)
    
    Args:
        stock_code: 港股代码 (如 00700)
        
    Returns:
        JSON 格式的财务指标数据
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股财务指标: {code}")
        
        # 尝试获取财务指标
        try:
            df = ak.stock_hk_financial_indicator_em(symbol=code)
            
            if df is not None and not df.empty:
                # 转换数据
                data = []
                for _, row in df.iterrows():
                    data.append({
                        "end_date": str(row.get('报告期', '')).replace('-', ''),
                        "roe": float(row.get('净资产收益率', 0) or 0),
                        "roa": float(row.get('总资产净利率', 0) or 0),
                        "gross_margin": float(row.get('毛利率', 0) or 0),
                        "netprofit_margin": float(row.get('净利率', 0) or 0),
                        "debt_to_assets": float(row.get('资产负债率', 0) or 0),
                        "current_ratio": float(row.get('流动比率', 0) or 0),
                        "quick_ratio": float(row.get('速动比率', 0) or 0),
                        "eps": float(row.get('每股收益', 0) or 0),
                        "bps": float(row.get('每股净资产', 0) or 0),
                        "netprofit_yoy": float(row.get('净利润同比', 0) or 0),
                        "or_yoy": float(row.get('营收同比', 0) or 0),
                        "op_yoy": 0,
                        "ebt_yoy": 0,
                        "tr_yoy": 0,
                        "ocfps": 0,
                        "fcff": 0,
                        "fcfe": 0,
                        "assets_turn": 0,
                        "ar_turn": 0,
                        "ca_turn": 0,
                        "fa_turn": 0,
                        "saleexp_to_gr": 0,
                        "adminexp_of_gr": 0,
                        "finaexp_of_gr": 0,
                        "cash_ratio": 0,
                        "debt_to_eqt": 0,
                        "roe_waa": float(row.get('净资产收益率', 0) or 0),
                        "roe_dt": float(row.get('净资产收益率', 0) or 0),
                        "dt_eps": float(row.get('每股收益', 0) or 0),
                    })
                
                return {
                    "success": True,
                    "data": data,
                    "count": len(data)
                }
        except Exception as e:
            print(f"[AkshareProxy] 获取财务指标失败: {e}")
        
        return {
            "success": True,
            "data": []
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": error_msg,
            "data": []
        }


# ============ 港股主营业务构成 ============
@app.get("/hk/main_biz/{stock_code}")
async def get_hk_main_biz(stock_code: str):
    """
    获取港股主营业务构成
    
    Args:
        stock_code: 港股代码 (如 00700)
        
    Returns:
        JSON 格式的主营业务构成数据
    """
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股主营业务构成: {code}")
        
        # 港股暂无直接的主营业务构成接口
        # 返回空数据
        return {
            "success": True,
            "data": [],
            "message": "Hong Kong stocks do not have detailed business segment data available"
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": error_msg,
            "data": []
        }


# ============ 港股列表（港股通成分股）============
@app.get("/hk/stock_list")
async def get_hk_stock_list():
    """
    获取港股通成分股列表（可通过港股通交易的港股）
    
    Returns:
        JSON 格式的港股列表
    """
    try:
        print(f"[AkshareProxy] 获取港股通成分股列表...")
        
        # 获取港股通成分股
        df = ak.stock_hk_ggt_components_em()
        
        if df is None or df.empty:
            return {
                "success": True,
                "data": [],
                "count": 0,
                "message": "No HK stock data found"
            }
        
        # 转换为标准格式
        stocks = []
        for _, row in df.iterrows():
            code = str(row.get('代码', '')).strip()
            name = str(row.get('名称', '')).strip()
            
            if code and name:
                stocks.append({
                    "ts_code": f"{code}.HK",
                    "symbol": code,
                    "name": name,
                    "market": "HK",
                    "stock_type": "HK"
                })
        
        print(f"[AkshareProxy] 成功获取 {len(stocks)} 只港股通成分股")
        
        return {
            "success": True,
            "data": stocks,
            "count": len(stocks)
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        print(f"[AkshareProxy] 错误: {error_msg}", file=sys.stderr)
        
        return {
            "success": False,
            "error": error_msg,
            "data": [],
            "count": 0
        }


# ============ 所有港股列表（实时行情）============
@app.get("/hk/all_stocks")
async def get_all_hk_stocks():
    """
    获取所有港股列表（从实时行情获取）
    
    Returns:
        JSON 格式的所有港股列表
    """
    try:
        print(f"[AkshareProxy] 获取所有港股列表...")
        
        # 获取港股实时行情
        df = ak.stock_hk_spot_em()
        
        if df is None or df.empty:
            return {
                "success": True,
                "data": [],
                "count": 0,
                "message": "No HK stock data found"
            }
        
        # 转换为标准格式
        stocks = []
        for _, row in df.iterrows():
            code = str(row.get('代码', '')).strip()
            name = str(row.get('名称', '')).strip()
            
            if code and name:
                stocks.append({
                    "ts_code": f"{code}.HK",
                    "symbol": code,
                    "name": name,
                    "market": "HK",
                    "stock_type": "HK"
                })
        
        print(f"[AkshareProxy] 成功获取 {len(stocks)} 只港股")
        
        return {
            "success": True,
            "data": stocks,
            "count": len(stocks)
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        print(f"[AkshareProxy] 错误: {error_msg}", file=sys.stderr)
        
        return {
            "success": False,
            "error": error_msg,
            "data": [],
            "count": 0
        }


# ============ 主程序入口 ============
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("AKShare 港股数据代理服务")
    print("=" * 60)
    print(f"AKShare 版本: {ak.__version__ if hasattr(ak, '__version__') else 'unknown'}")
    print("启动地址: http://0.0.0.0:8000")
    print("API 文档: http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
