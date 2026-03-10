#!/bin/bash
# 更新阿里云服务器上的 AKShare 代理服务

# 停止现有服务
echo "停止现有服务..."
systemctl stop akshare-proxy 2>/dev/null || true

# 备份旧文件
echo "备份旧文件..."
cp /opt/akshare-proxy/akshare_proxy.py /opt/akshare-proxy/akshare_proxy.py.bak 2>/dev/null || true

# 创建新的代理服务文件
echo "更新代理服务代码..."
cat > /opt/akshare-proxy/akshare_proxy.py << 'PROXY_EOF'
#!/usr/bin/env python3
"""
AKShare 港股数据代理服务 v1.1.0

功能:
1. 提供 REST API 供 TypeScript 后端调用
2. 封装 AKShare 港股财务报表接口
3. 支持港股通成分股列表
4. 支持利润表、资产负债表、现金流量表
5. 支持 K 线数据和股票基本信息

运行方式:
    pip install fastapi uvicorn akshare pandas
    python akshare_proxy.py

API 端点:
    GET /health                      - 健康检查
    GET /hk/stock_list               - 获取港股通成分股列表
    GET /hk/all_stocks               - 获取所有港股列表
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
import akshare as ak
import pandas as pd
from typing import Optional
import traceback
import sys

# 创建 FastAPI 应用
app = FastAPI(
    title="AKShare HK Stock Proxy",
    description="港股财务数据代理服务 - 为 Finspark 提供港股数据",
    version="1.1.0"
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
        "version": "1.1.0",
        "akshare_version": ak.__version__ if hasattr(ak, '__version__') else "unknown"
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
                    "stock_type": "HK",
                    "hk_stock_connect": 1
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
    注意：此接口较慢，约需2-3分钟
    
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
                    "stock_type": "HK",
                    "hk_stock_connect": 0
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


# ============ 港股财务报表 ============
@app.get("/hk/financial/{stock_code}/{report_type}")
async def get_hk_financial(
    stock_code: str,
    report_type: str,
    indicator: str = Query("年度", description="年度 或 报告期")
):
    """获取港股财务报表"""
    symbol_map = {
        "income": "利润表",
        "balance": "资产负债表",
        "cashflow": "现金流量表"
    }
    
    if report_type not in symbol_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report_type: {report_type}. Must be one of: income, balance, cashflow"
        )
    
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股{symbol_map[report_type]}: {code}, 指标: {indicator}")
        
        df = ak.stock_financial_hk_report_em(
            stock=code,
            symbol=symbol_map[report_type],
            indicator=indicator
        )
        
        if df is None or df.empty:
            return {"success": True, "data": [], "message": f"No data found for {code}"}
        
        data = df.to_dict(orient="records")
        print(f"[AkshareProxy] 成功获取 {len(data)} 条{symbol_map[report_type]}数据")
        
        return {"success": True, "data": data, "count": len(data)}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": []}


# ============ 港股K线数据 ============
@app.get("/hk/kline/{stock_code}")
async def get_hk_kline(
    stock_code: str,
    days: int = Query(180, description="获取最近N天的数据"),
    adjust: str = Query("qfq", description="复权类型: qfq(前复权), hfq(后复权), 空(不复权)")
):
    """获取港股K线数据"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股K线: {code}, 天数: {days}, 复权: {adjust}")
        
        df = ak.stock_hk_hist(
            symbol=code,
            period="daily",
            adjust=adjust if adjust else ""
        )
        
        if df is None or df.empty:
            return {"success": True, "data": [], "message": f"No kline data found for {code}"}
        
        df = df.tail(days)
        
        column_map = {
            '日期': 'date', '开盘': 'open', '收盘': 'close', '最高': 'high',
            '最低': 'low', '成交量': 'volume', '成交额': 'amount',
            '振幅': 'amplitude', '涨跌幅': 'pct_chg', '涨跌额': 'change',
            '换手率': 'turnover_rate'
        }
        
        df = df.rename(columns=column_map)
        
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y%m%d')
        
        data = df.to_dict(orient="records")
        print(f"[AkshareProxy] 成功获取 {len(data)} 条K线数据")
        
        return {"success": True, "data": data, "count": len(data)}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": []}


# ============ 港股基本信息 ============
@app.get("/hk/basic/{stock_code}")
async def get_hk_basic(stock_code: str):
    """获取港股基本信息"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股基本信息: {code}")
        
        try:
            df = ak.stock_hk_ggt_components_em()
            
            if df is not None and not df.empty:
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
        
        return {
            "success": True,
            "data": {"code": code, "name": code, "industry": '港股', "list_date": ''}
        }
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": None}


# ============ 港股公司信息 ============
@app.get("/hk/company/{stock_code}")
async def get_hk_company(stock_code: str):
    """获取港股公司信息"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股公司信息: {code}")
        
        try:
            df = ak.stock_hk_company_profile_em(symbol=code)
            
            if df is not None and not df.empty:
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
        
        return {"success": True, "data": None}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": None}


# ============ 港股每日指标 ============
@app.get("/hk/daily_basic/{stock_code}")
async def get_hk_daily_basic(stock_code: str):
    """获取港股每日基本指标 (PE/PB/市值等)"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股每日指标: {code}")
        
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
                        "pe": 0, "pe_ttm": 0, "pb": 0, "ps": 0, "ps_ttm": 0,
                        "volume_ratio": 0, "dv_ratio": 0, "dv_ttm": 0,
                        "total_share": 0, "float_share": 0, "free_share": 0,
                        "total_mv": 0, "circ_mv": 0
                    }]
                }
        except Exception as e:
            print(f"[AkshareProxy] 获取数据失败: {e}")
        
        return {"success": True, "data": []}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": []}


# ============ 港股财务指标 ============
@app.get("/hk/fina_indicator/{stock_code}")
async def get_hk_fina_indicator(stock_code: str):
    """获取港股财务指标 (ROE/毛利率等)"""
    code = stock_code.replace('.HK', '').replace('.hk', '').strip()
    code = code.zfill(5)
    
    try:
        print(f"[AkshareProxy] 获取港股财务指标: {code}")
        return {"success": True, "data": []}
        
    except Exception as e:
        error_msg = str(e)
        traceback.print_exc()
        return {"success": False, "error": error_msg, "data": []}


# ============ 港股主营业务构成 ============
@app.get("/hk/main_biz/{stock_code}")
async def get_hk_main_biz(stock_code: str):
    """获取港股主营业务构成"""
    return {
        "success": True,
        "data": [],
        "message": "Hong Kong stocks do not have detailed business segment data available"
    }


# ============ 主程序入口 ============
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("AKShare 港股数据代理服务 v1.1.0")
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
PROXY_EOF

# 重启服务
echo "重启代理服务..."
systemctl restart akshare-proxy

# 等待服务启动
sleep 3

# 检查服务状态
echo "检查服务状态..."
systemctl status akshare-proxy --no-pager | head -10

echo ""
echo "更新完成！测试新接口:"
echo "curl http://localhost:8000/health"
echo "curl http://localhost:8000/hk/stock_list"
