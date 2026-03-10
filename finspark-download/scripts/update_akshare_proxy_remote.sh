#!/bin/bash
#
# AKShare 港股数据代理服务 - 快速更新脚本 (无需完整部署)
# 
# 使用方法:
#   1. SSH 登录到远程服务器: ssh root@47.110.92.210
#   2. 下载并执行此脚本:
#      curl -sSL https://raw.githubusercontent.com/XingyaEva/Finspark0116/genspark_ai_developer/finspark-download/scripts/update_akshare_proxy_remote.sh | bash
#   
#   或者手动复制脚本内容执行
#

set -e

echo "=============================================="
echo "  AKShare 港股数据代理服务 - 快速更新脚本"
echo "=============================================="
echo ""

DEPLOY_DIR="/opt/akshare-proxy"

# 检查目录是否存在
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "错误: 目录 $DEPLOY_DIR 不存在，请先运行完整部署脚本"
    exit 1
fi

cd $DEPLOY_DIR

# 激活虚拟环境
source venv/bin/activate

# 安装 numpy (如果缺少)
pip install numpy -q 2>/dev/null || true

echo "正在更新代理服务代码..."

# 备份旧文件
cp akshare_proxy.py akshare_proxy.py.bak.$(date +%Y%m%d_%H%M%S)

# 更新代理代码 - 关键修复: NaN/Inf 处理
cat > akshare_proxy.py << 'PYTHON_CODE'
#!/usr/bin/env python3
"""
AKShare 港股数据代理服务 v1.3.0

修复: NaN/Inf 值导致的 JSON 序列化错误
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
import json

app = FastAPI(
    title="AKShare HK Stock Proxy",
    description="港股财务数据代理服务",
    version="1.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "akshare-hk-proxy",
        "version": "1.3.0",
        "akshare_version": ak.__version__ if hasattr(ak, '__version__') else "unknown"
    }


@app.get("/diagnose/{stock_code}")
async def diagnose_stock(stock_code: str):
    """诊断港股数据获取状态"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    results = {
        "stock_code": code,
        "akshare_version": ak.__version__ if hasattr(ak, '__version__') else "unknown",
        "reports": {}
    }
    
    for report_type, symbol in [("income", "利润表"), ("balance", "资产负债表"), ("cashflow", "现金流量表")]:
        try:
            df = ak.stock_financial_hk_report_em(stock=code, symbol=symbol, indicator="年度")
            if df is not None and not df.empty:
                results["reports"][report_type] = {
                    "success": True,
                    "count": len(df),
                    "fields": df['STD_ITEM_NAME'].unique().tolist()[:10] if 'STD_ITEM_NAME' in df.columns else []
                }
            else:
                results["reports"][report_type] = {"success": True, "count": 0, "message": "Empty data"}
        except Exception as e:
            results["reports"][report_type] = {"success": False, "error": str(e)}
    
    return results


@app.get("/hk/financial/{stock_code}/{report_type}")
async def get_hk_financial(
    stock_code: str,
    report_type: str,
    indicator: str = Query("年度", description="年度 或 报告期")
):
    symbol_map = {"income": "利润表", "balance": "资产负债表", "cashflow": "现金流量表"}
    
    if report_type not in symbol_map:
        return Response(
            content=json.dumps({"success": False, "error": f"Invalid report_type", "data": []}, ensure_ascii=False),
            media_type="application/json", status_code=400
        )
    
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股{symbol_map[report_type]}: {code}")
        sys.stdout.flush()
        
        df = ak.stock_financial_hk_report_em(stock=code, symbol=symbol_map[report_type], indicator=indicator)
        
        if df is None or df.empty:
            return Response(
                content=json.dumps({"success": True, "data": [], "message": f"No data for {code}"}, ensure_ascii=False),
                media_type="application/json"
            )
        
        data = df_to_json_safe(df)
        print(f"[AkshareProxy] 成功获取 {len(data)} 条数据")
        
        return Response(
            content=json.dumps({"success": True, "data": data, "count": len(data)}, ensure_ascii=False),
            media_type="application/json"
        )
        
    except Exception as e:
        traceback.print_exc()
        return Response(
            content=json.dumps({"success": False, "error": str(e), "data": []}, ensure_ascii=False),
            media_type="application/json"
        )


@app.get("/hk/kline/{stock_code}")
async def get_hk_kline(
    stock_code: str,
    days: int = Query(180, description="获取最近N天的数据"),
    adjust: str = Query("qfq", description="复权类型")
):
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    try:
        df = ak.stock_hk_hist(symbol=code, period="daily", adjust=adjust if adjust else "")
        
        if df is None or df.empty:
            return {"success": True, "data": [], "message": f"No kline data for {code}"}
        
        df = df.tail(days)
        column_map = {'日期': 'date', '开盘': 'open', '收盘': 'close', '最高': 'high', '最低': 'low',
                      '成交量': 'volume', '成交额': 'amount', '涨跌幅': 'pct_chg', '涨跌额': 'change', '换手率': 'turnover_rate'}
        df = df.rename(columns=column_map)
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y%m%d')
        
        return {"success": True, "data": df_to_json_safe(df), "count": len(df)}
        
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e), "data": []}


@app.get("/hk/basic/{stock_code}")
async def get_hk_basic(stock_code: str):
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    try:
        df = ak.stock_hk_ggt_components_em()
        if df is not None and not df.empty:
            stock_info = df[df['代码'].str.contains(code, na=False)]
            if not stock_info.empty:
                row = stock_info.iloc[0]
                return {"success": True, "data": {"code": code, "name": row.get('名称', ''), "industry": '港股', "list_date": ''}}
        
        return {"success": True, "data": {"code": code, "name": code, "industry": '港股', "list_date": ''}}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.get("/hk/company/{stock_code}")
async def get_hk_company(stock_code: str):
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    try:
        df = ak.stock_hk_company_profile_em(symbol=code)
        if df is not None and not df.empty:
            company_data = {}
            for _, row in df.iterrows():
                key = str(row.iloc[0]).strip() if len(row) > 0 else ''
                value = str(row.iloc[1]).strip() if len(row) > 1 else ''
                if key:
                    company_data[key] = value
            
            return {"success": True, "data": {
                "chairman": company_data.get('董事长', ''),
                "manager": company_data.get('总经理', ''),
                "setup_date": company_data.get('成立日期', ''),
                "introduction": company_data.get('公司介绍', ''),
                "main_business": company_data.get('主营业务', '')
            }}
        return {"success": True, "data": None}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.get("/hk/daily_basic/{stock_code}")
async def get_hk_daily_basic(stock_code: str):
    code = stock_code.replace('.HK', '').replace('.hk', '').strip().zfill(5)
    
    try:
        df = ak.stock_hk_valuation_comparison_em(symbol=code)
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            return {"success": True, "data": [{
                "trade_date": str(latest.get('日期', '')).replace('-', ''),
                "close": float(clean_value(latest.get('收盘价', 0)) or 0),
                "pe": float(clean_value(latest.get('市盈率', 0)) or 0),
                "pb": float(clean_value(latest.get('市净率', 0)) or 0),
                "total_mv": float(clean_value(latest.get('总市值', 0)) or 0),
            }]}
    except:
        pass
    return {"success": True, "data": []}


@app.get("/hk/fina_indicator/{stock_code}")
async def get_hk_fina_indicator(stock_code: str):
    return {"success": True, "data": []}


@app.get("/hk/main_biz/{stock_code}")
async def get_hk_main_biz(stock_code: str):
    return {"success": True, "data": [], "message": "HK stocks do not have detailed business segment data"}


@app.get("/hk/stock_list")
async def get_hk_stock_list():
    try:
        df = ak.stock_hk_ggt_components_em()
        if df is None or df.empty:
            return {"success": True, "data": [], "count": 0}
        
        stocks = []
        for _, row in df.iterrows():
            code = str(row.get('代码', '')).strip()
            name = str(row.get('名称', '')).strip()
            if code and name:
                stocks.append({"ts_code": f"{code}.HK", "symbol": code, "name": name, "market": "HK"})
        
        return {"success": True, "data": stocks, "count": len(stocks)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": [], "count": 0}


@app.get("/hk/all_stocks")
async def get_all_hk_stocks():
    try:
        df = ak.stock_hk_spot_em()
        if df is None or df.empty:
            return {"success": True, "data": [], "count": 0}
        
        stocks = []
        for _, row in df.iterrows():
            code = str(row.get('代码', '')).strip()
            name = str(row.get('名称', '')).strip()
            if code and name:
                stocks.append({"ts_code": f"{code}.HK", "symbol": code, "name": name, "market": "HK"})
        
        return {"success": True, "data": stocks, "count": len(stocks)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": [], "count": 0}


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("AKShare 港股数据代理服务 v1.3.0")
    print(f"AKShare 版本: {ak.__version__ if hasattr(ak, '__version__') else 'unknown'}")
    print("启动地址: http://0.0.0.0:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
PYTHON_CODE

echo ""
echo "重启服务..."
systemctl restart akshare-proxy

sleep 3

echo ""
echo "验证更新..."
curl -s http://localhost:8000/health
echo ""

echo ""
echo "测试资产负债表 (之前会返回 500 错误)..."
BALANCE_RESULT=$(curl -s 'http://localhost:8000/hk/financial/00700/balance' | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f'success: {d.get(\"success\")}, count: {d.get(\"count\", 0)}')
except Exception as e:
    print(f'Error: {e}')
")
echo "$BALANCE_RESULT"

echo ""
echo "=============================================="
echo "更新完成!"
echo "=============================================="
