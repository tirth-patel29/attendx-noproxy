#!/usr/bin/env python3
"""High-concurrency attendance herd test.

Binds N distinct synthetic students, starts one real session, captures the
SHARED metronome token (one projector LCD, many phones — exactly how a class
works), pre-fetches N single-use nonces, then fires N claims FULLY IN PARALLEL
against POST /claim-attendance.

Reports: PRESENT count, per-claim latency (p50/p95/max), and any pool/exhaustion
errors (502/503/5xx). Exercises the real hot path: token cache + atomic nonce +
unique-ledger insert under contention.

Usage:
    API_KEY=ag_... python3 scripts/herd_test.py [N] [students-per-wave? no] "[admin-password]" [base-url]

Examples:
    API_KEY=$(cat .api_key) python3 scripts/herd_test.py 25 "Admin@123"
    API_KEY=$(cat .api_key) python3 scripts/herd_test.py 50 "Admin@123" https://api.atmyhome.tech
"""
import json, urllib.request, urllib.error, time, hmac, hashlib, sys, os
from concurrent.futures import ThreadPoolExecutor

N = int(sys.argv[1]) if len(sys.argv) > 1 else 25
P = sys.argv[2] if len(sys.argv) > 2 else "Admin@123"
BASE = sys.argv[3] if len(sys.argv) > 3 else "https://api.atmyhome.tech"
API_KEY = os.environ.get("API_KEY", "")

def call(method, path, body=None, headers=None, timeout=20):
    hdrs = dict(headers or {})
    if API_KEY:
        hdrs.setdefault("X-Api-Key", API_KEY)
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (attendance-herd-test)")
    for k, v in hdrs.items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, data, timeout=timeout) as r:
            try:
                return r.status, json.loads(r.read() or b"{}"), time.perf_counter() - t0
            except Exception:
                return r.status, {}, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}"), time.perf_counter() - t0
        except Exception:
            return e.code, {}, time.perf_counter() - t0
    except Exception as e:
        return 0, {"error": str(e)}, time.perf_counter() - t0

def hmac_hex(key_hex, msg):
    return hmac.new(bytes.fromhex(key_hex), msg.encode(), hashlib.sha256).hexdigest()

print(f"== Attendance herd test: {N} students, 1 session, parallel claims ==\n")

# 1) Admin + professor auth
st, login, _ = call("POST", "/api/v1/admin/login", {"email": "admin@atmyhome.tech", "password": P})
assert st == 200, f"admin login failed: {st} {login}"
AH = {"Authorization": f"Bearer {login['access_token']}"}
st, profs, _ = call("GET", "/api/v1/admin/teachers", headers=AH)
prof = profs[0]
tpw = "Prof#Test123"
call("POST", f"/api/v1/admin/teachers/{prof['id']}/reset-password", {"password": tpw}, headers=AH)
st, pl, _ = call("POST", "/api/v1/auth/login", {"email": prof["email"], "password": tpw})
assert st == 200, f"professor login failed: {st}"
PH = {"Authorization": f"Bearer {pl['access_token']}"}

# 2) Ensure a CS101 course exists in a division (session start needs a real course)
st, divs, _ = call("GET", "/api/v1/admin/divisions", headers=AH)
if divs:
    DIV = divs[0]["id"]
else:
    _, d, _ = call("POST", "/api/v1/admin/divisions", {"name": f"Div {int(time.time())}"}, headers=AH)
    DIV = d["id"]
st, crs, _ = call("GET", "/api/v1/admin/courses", headers=AH)
co = next((c for c in crs if c["course_code"] == "CS101"), None)
if not co:
    call("POST", "/api/v1/admin/courses", {"course_code": "CS101", "title": "Computer Science 101", "division_id": DIV}, headers=AH)

# 3) Start session + capture the SHARED token
st, sess, _ = call("POST", "/api/v1/sessions/start", {"course_code": "CS101"}, headers=PH)
assert st == 201, f"session start failed: {st} {sess}"
SESS = sess.get("id")
tok = None
for _ in range(12):
    st, tk, _ = call("GET", f"/api/v1/sessions/{SESS}/tokens")
    if st == 200 and tk.get("tokens"):
        tok = tk["tokens"][-1]
        break
    time.sleep(0.8)
assert tok, "no metronome token captured"
TOKEN = tok["token_val"]
T0 = int(tok["created_at_epoch"])
print(f"[setup] session={SESS[:8]}… shared token='{TOKEN}' birth={T0} (valid {tok.get('expires_at_epoch','?')})")

# 4) Register + bind N students (each unique device + HMAC signer), in parallel
base = int(time.time()) % 900
fail_reasons = []
def make_student(i):
    roll = f"{77 + (i % 9)}SEL{(base + i) % 1000:03d}"
    st, reg, _ = call("POST", "/api/v1/student/register",
                      {"id": roll, "name": f"Herd Student {i}", "password": "Stud#Pass123"},
                      timeout=60)
    if st not in (201, 200):
        return None, f"register st={st} {reg.get('error','')[:40]}"
    dev = hashlib.sha256(f"herd-{i}-{time.time()}".encode()).hexdigest()
    st, b, _ = call("POST", "/api/v1/student/device/bind", {"device_id_hash": dev},
                    headers={"Authorization": f"Bearer {reg.get('access_token', '' )}"}, timeout=60)
    if st != 200 or len(b.get("secret_hmac_key", "")) != 64:
        return None, f"bind st={st} keylen={len(b.get('secret_hmac_key',''))}"
    return {"sid": reg["student_uuid"], "dev": dev, "secret": b["secret_hmac_key"]}, None

t0s = time.perf_counter()
# Setup (register+bind) is throttled: bcrypt is CPU-bound on this 2-core host and
# registration is NOT the hot path (it happens once per install). The claim herd
# below is what we measure — that path is HMAC-cheap.
with ThreadPoolExecutor(max_workers=min(N, 8)) as ex:
    made = list(ex.map(make_student, range(N)))
students = [r for r, why in made if r is not None]
for r, why in made:
    if r is None:
        fail_reasons.append(why)
setup_s = time.perf_counter() - t0s
bound = len(students)
print(f"[setup] bound {bound}/{N} students (register+bind in {setup_s:.1f}s)")
from collections import Counter
if fail_reasons:
    print(f"[setup] failures by type: {dict(Counter(fail_reasons).most_common(8))}")
if bound < 2:
    call("POST", f"/api/v1/sessions/{SESS}/stop", headers=PH)
    raise SystemExit("not enough students bound — aborting")

# 5) Pre-fetch N single-use nonces for the session
nonces = []
for _ in range(bound):
    st, chal, _ = call("POST", f"/api/v1/sessions/{SESS}/challenge")
    if st == 200:
        nonces.append(chal.get("nonce"))
print(f"[setup] fetched {len(nonces)} nonces")

# Re-capture a FRESH token right before firing — tokens rotate every 3s and
# expire in 5s, and the bind phase above can outlive the first one we saw.
st, tk, _ = call("GET", f"/api/v1/sessions/{SESS}/tokens")
tok = tk.get("tokens", [])[-1] if tk.get("tokens") else tok
TOKEN = tok["token_val"]
T0 = int(tok["created_at_epoch"])
print(f"[setup] fresh shared token='{TOKEN}' birth={T0}")

# 6) FIRE THE HERD — all claims in parallel, same shared token, unique nonce
CLAIM_T = T0 + 30   # within [0,250] -> PRESENT
def submit(i):
    sid, dev, secret, nonce = students[i]["sid"], students[i]["dev"], students[i]["secret"], nonces[i]
    sig = hmac_hex(secret, f"{SESS}|{sid}|{TOKEN}|{CLAIM_T}|{dev}|{nonce}")
    return call("POST", "/api/v1/claim-attendance",
                {"session_uuid": SESS, "student_uuid": sid, "token_val": TOKEN,
                 "client_claimed_time": CLAIM_T, "device_id_hash": dev,
                 "nonce": nonce, "hmac_signature": sig})

t0c = time.perf_counter()
with ThreadPoolExecutor(max_workers=min(bound, 40)) as ex:
    results = list(ex.map(submit, range(bound)))
dur = time.perf_counter() - t0c

codes = [r[0] for r in results]
present = sum(1 for r in results if r[0] == 200 and r[1].get("status") == "PRESENT")
lats = sorted(r[2] for r in results)
def pct(p):
    return lats[min(len(lats)-1, int(len(lats)*p)-1)] * 1000
errs = [f"{c}" for c in codes if c not in (200, 409, 412, 401, 403, 404)]

print(f"\n== HERD RESULT: {bound} concurrent claims in {dur*1000:.0f}ms ==")
print(f"  PRESENT: {present}/{bound}")
print(f"  status codes: { {c: codes.count(c) for c in sorted(set(codes))} }")
if lats:
    print(f"  claim latency ms: p50={pct(0.5):.0f} p95={pct(0.95):.0f} max={max(lats)*1000:.0f}")
    print(f"  throughput: {bound/dur:.0f} claims/sec")
if errs:
    print(f"  ⚠ pool/exhaustion errors: {errs[:10]}")

# 7) Cleanup
try:
    call("POST", f"/api/v1/sessions/{SESS}/stop", headers=PH)
    with ThreadPoolExecutor(max_workers=min(bound, 20)) as ex:
        list(ex.map(lambda s: call("DELETE", f"/api/v1/admin/students/{s['sid']}", headers=AH), students))
    print(f"[cleanup] session stopped, {bound} students deleted")
except Exception as e:
    print(f"[cleanup] warning: {e}")

print(f"\n== done: {present}/{bound} PRESENT under parallel load ==")
sys.exit(0 if present == bound else 1)
