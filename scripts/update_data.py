"""장 마감 후 차트 데이터 갱신 스크립트 (GitHub Actions에서 실행)

config.json 의 폴더에 들어 있는 종목을 yfinance로 받아 data/ 폴더에 저장합니다.
- data/daily/<종목>.json : 일봉 (주식 분할 반영 가격, 기본 10년치를 매번 통째로 다시 받음)
- data/m30/<종목>.json   : 30분봉 (yfinance는 최근 60일만 주므로 기존 파일에 이어 붙여 기간을 늘려 감)
- data/meta.json         : 마지막 갱신 시각, 종목별 마지막 날짜, 실패한 종목
"""
import json, math, sys, time, datetime as dt
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
(DATA / "daily").mkdir(parents=True, exist_ok=True)
(DATA / "m30").mkdir(parents=True, exist_ok=True)

cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
symbols = sorted({s.strip().upper() for f in cfg.get("folders", []) for s in f.get("symbols", []) if s and s.strip()})
DAILY_PERIOD = cfg.get("daily_period", "10y")
WANT_M30 = bool(cfg.get("intraday_30m", True))
MAX_M30 = int(cfg.get("max_30m_bars", 5000))

# 앱에서는 ^ 없이 입력한 지수·금리 코드를 Yahoo 코드로 바꿔서 받습니다. (파일 이름은 입력한 코드 그대로)
YAHOO = {"SPX": "^GSPC", "IXIC": "^IXIC", "DJI": "^DJI", "TNX": "^TNX", "VIX": "^VIX"}

meta_path = DATA / "meta.json"
old_meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
meta = {"updated": None, "market_date": None, "symbols": {}, "errors": {}}


def num(x):
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else round(x, 4)


def to_rows(df, fmt):
    idx = df.index
    if getattr(idx, "tz", None) is not None:
        idx = idx.tz_convert("America/New_York")
    rows = []
    for ts, (_, r) in zip(idx, df.iterrows()):
        o, h, l, c = num(r.get("Open")), num(r.get("High")), num(r.get("Low")), num(r.get("Close"))
        if None in (o, h, l, c) or c <= 0:
            continue
        v = r.get("Volume", 0)
        v = 0 if v is None or (isinstance(v, float) and math.isnan(v)) else int(v)
        rows.append([ts.strftime(fmt), o, max(h, o, c), min(l, o, c), c, v])
    return rows


def history(sym, **kw):
    last = None
    for attempt in range(3):
        try:
            df = yf.Ticker(YAHOO.get(sym, sym)).history(auto_adjust=False, actions=False, **kw)
            return None if df is None or df.empty else df
        except Exception as e:  # 일시적인 차단·네트워크 오류는 잠시 쉬었다 다시
            last = e
            time.sleep(5 * (attempt + 1))
    raise last


def merge_m30(old_rows, new_rows):
    """기존 30분봉에 새 30분봉을 이어 붙임. 겹치는 시간의 가격이 0.5% 넘게 다르면(분할 등) 새 데이터로 교체."""
    old = {r[0]: r for r in old_rows}
    bad = sum(1 for r in new_rows if r[0] in old and abs(old[r[0]][4] - r[4]) / max(1e-9, abs(r[4])) > 0.005)
    if bad:
        return new_rows, True
    old.update({r[0]: r for r in new_rows})
    return [old[k] for k in sorted(old)][-MAX_M30:], False


def write(path, obj):
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


ok = 0
for sym in symbols:
    entry = dict(old_meta.get("symbols", {}).get(sym, {}))
    try:
        d = history(sym, period=DAILY_PERIOD, interval="1d")
        if d is None:
            raise ValueError("데이터가 비어 있습니다 (종목 코드 확인)")
        rows = to_rows(d, "%Y-%m-%d")
        if not rows:
            raise ValueError("읽을 수 있는 가격 행이 없습니다")
        write(DATA / "daily" / f"{sym}.json", {"symbol": sym, "interval": "1d", "rows": rows})
        entry["d"] = rows[-1][0]
        ok += 1
        print(f"{sym}: 일봉 {len(rows)}개 ~ {rows[-1][0]}")
    except Exception as e:
        meta["errors"][sym] = f"일봉: {e}"[:200]
        print(f"{sym}: 일봉 실패 {e}", file=sys.stderr)

    if WANT_M30:
        try:
            m = history(sym, period="60d", interval="30m")
            if m is not None:
                new_rows = to_rows(m, "%Y-%m-%d %H:%M")
                p = DATA / "m30" / f"{sym}.json"
                old_rows = json.loads(p.read_text(encoding="utf-8"))["rows"] if p.exists() else []
                rows, replaced = merge_m30(old_rows, new_rows)
                if rows:
                    write(p, {"symbol": sym, "interval": 30, "rows": rows})
                    entry["m"] = rows[-1][0]
                    print(f"{sym}: 30분봉 {len(rows)}개 ~ {rows[-1][0]}" + (" (가격 기준 변경으로 교체)" if replaced else ""))
        except Exception as e:
            meta["errors"][sym] = (meta["errors"].get(sym, "") + f" 30분봉: {e}")[:300]
            print(f"{sym}: 30분봉 실패 {e}", file=sys.stderr)

    if entry:
        meta["symbols"][sym] = entry
    time.sleep(0.7)

dates = [v["d"] for v in meta["symbols"].values() if v.get("d")]
meta["market_date"] = max(dates) if dates else old_meta.get("market_date")
meta["updated"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
write(meta_path, meta)
print(f"완료: {ok}/{len(symbols)}개 종목 일봉 갱신, 실패 {len(meta['errors'])}개")
if symbols and ok == 0:
    sys.exit("모든 종목이 실패했습니다. Yahoo 연결이 막혔을 수 있습니다. 잠시 뒤 다시 실행하세요.")
