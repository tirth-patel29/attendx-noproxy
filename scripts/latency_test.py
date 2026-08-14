#!/usr/bin/env python3
"""Attendance Gateway — API latency probe.

Measures end-to-end latency of api.atmyhome.tech the way a real phone sees it,
and breaks the number down into network/tunnel vs server/DB.

Endpoints measured:
  - TCP connect        : raw socket connect to :443 (isolates Cloudflare+route)
  - GET /health        : origin only (no DB)
  - GET /time-sync     : origin only (no DB) — the Cristian calibration path
  - GET /latency-ping  : origin + trivial DB round-trip (server-reported db cost)
  - GET /student/status: FULL path (Cloudflare + proxies + tunnel + origin + DB)

Usage:
  python3 scripts/latency_test.py [N] [base-url]
  # N default 25; API key read from .api_key or API_KEY env (needed only for
  # /student/status, which is gated).
"""
import sys, os, json, time, socket, ssl, statistics
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

N = int(sys.argv[1]) if len(sys.argv) > 1 else 25
BASE = (sys.argv[2] if len(sys.argv) > 2 else "https://api.atmyhome.tech").rstrip("/")
API_KEY = os.environ.get("API_KEY", "")
if not API_KEY:
    try:
        API_KEY = Path(__file__).resolve().parent.parent.joinpath(".api_key").read_text().strip()
    except Exception:
        pass
HOST = BASE.split("//")[1].split(":")[0]
PORT = 443

def tcp_connect_ms():
    t0 = time.perf_counter()
    with socket.create_connection((HOST, PORT), timeout=10):
        pass
    return (time.perf_counter() - t0) * 1000

def http_ms(path, key=False, timeout=20):
    req = urllib.request.Request(BASE + path, method="GET")
    if key and API_KEY:
        req.add_header("X-Api-Key", API_KEY)
    req.add_header("User-Agent", "Mozilla/5.0 (attendance-latency-probe)")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return (time.perf_counter() - t0) * 1000, r.read()
    except urllib.error.HTTPError as e:
        return (time.perf_counter() - t0) * 1000, e.read()

def pct(vals, p):
    vals = sorted(vals)
    if not vals: return float("nan")
    return vals[min(len(vals) - 1, int(len(vals) * p) - 1)]

def summary(name, vals, note=""):
    if not vals:
        print(f"{name:<16} no samples"); return None
    mean = statistics.mean(vals)
    sd = statistics.pstdev(vals)
    p50, p95, p99 = pct(vals, .5), pct(vals, .95), pct(vals, .99)
    verdict = "OK<250ms" if p95 < 250 else ("OK<500ms" if p95 < 500 else ("OK<1000ms" if p95 < 1000 else "TOO SLOW"))
    print(f"{name:<16} n={len(vals):<3} mean={mean:7.1f} p50={p50:7.1f} p95={p95:7.1f} p99={p99:7.1f} max={max(vals):7.1f} jitter={sd:6.1f}  [{verdict}]{(' '+note) if note else ''}")
    return {"name": name, "p50": p50, "p95": p95, "p99": p99, "max": max(vals), "mean": mean}

print(f"== Attendance Gateway latency probe ==\n  base={BASE}  n={N} probes/endpoint  ({time.strftime('%H:%M:%S')})\n")

# TCP connect (serial, small N)
tcp = [tcp_connect_ms() for _ in range(min(N, 10))]
summary("TCP connect", tcp, f"(host {HOST}:{PORT})")

def bench(path, key):
    return [http_ms(path, key=key)[0] for _ in range(N)]

results = []
# Small concurrency so we measure steady-state, not self-throttling.
def run(path, key, name, note=""):
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(http_ms, path, key) for _ in range(N)]
        lats = [f.result()[0] for f in futs]
    results.append(summary(name or path, lats, note))

run("/health", False, "/health", "origin, no DB")
run("/api/v1/time-sync", True, "/time-sync", "origin, no DB (+key)")
run("/api/v1/latency-ping", False, "/latency-ping", "origin + DB (see origin_handled_us)")

# Full path with the client API key
if API_KEY:
    run("/api/v1/student/status", True, "/student/status", "FULL path (gated)")
else:
    print("(set API_KEY or add .api_key to probe the gated FULL path /student/status)")

# DB contribution (server-side) from latency-ping samples
db_us, origin_us = [], []
with ThreadPoolExecutor(max_workers=8) as ex:
    for f in as_completed([ex.submit(http_ms, "/api/v1/latency-ping", False) for _ in range(N)]):
        _, body = f.result()
        try:
            d = json.loads(body)
            if d.get("db_echo_us") is not None: db_us.append(d["db_echo_us"] / 1000.0)
            if d.get("origin_handled_us") is not None: origin_us.append(d["origin_handled_us"] / 1000.0)
        except Exception:
            pass

print("\n== server-side breakdown (from /latency-ping) ==")
if origin_us:
    print(f"  origin handled ms: mean={statistics.mean(origin_us):6.2f} max={max(origin_us):6.2f}")
if db_us:
    print(f"  trivial DB SELECT ms: mean={statistics.mean(db_us):6.2f} max={max(db_us):6.2f}   (rest of origin cost = app+middleware)")

print("\n== how to tune the claim gate from these ==")
lat95 = next((r["p95"] for r in results if r and r["name"] == "/student/status"), None)
if lat95 is not None:
    target_claim_ms = max(400, round((lat95 * 2.0) / 1.0, -1))  # 2x p95 headroom, min 400ms
    print(f"  measured p95 full-path = {lat95:.0f} ms  -> set a comfortable claim budget >= ~{int(lat95)}+{400} ms")
    print(f"  recommended min maxAckDelayMs (server freshness window): at least {int(lat95) + 500} ms (default 8000 is safe)")
    print(f"  recommended clockToleranceMs (client clock error absorbed): 400ms default is fine; tighten to ~{max(300, round(lat95/3, -2))}ms if latency drops")
else:
    print("  (probe /student/status with a valid API key to get the full-path number for tuning)")

print("\ndone.")
