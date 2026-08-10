#!/usr/bin/env python3
"""Live end-to-end verification of the 4-gate attendance flow (SRS §5/§6)."""
import json, urllib.request, urllib.error, time, hmac, hashlib, sys

BASE = "https://api.atmyhome.tech"

def call(method, path, body=None, headers=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (attendance-flow-test)")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=20) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload or b"{}"))
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"{}")
        except Exception:
            return e.code, payload.decode(errors="replace")

def hmac_hex(key_hex, msg):
    return hmac.new(bytes.fromhex(key_hex), msg.encode(), hashlib.sha256).hexdigest()

P = "PASS" if len(sys.argv) < 2 else sys.argv[1]  # admin password
results = []
def check(name, cond, extra=""):
    results.append((name, cond, extra))
    print(("  ✅ " if cond else "  ❌ ") + f"{name}" + (f" — {extra}" if extra and not cond else ""))

print("== Admin session ==")
st, login = call("POST", "/api/v1/admin/login", {"email": "admin@atmyhome.tech", "password": P})
check("admin login", st == 200)
ATOK = login.get("access_token", "")
AH = {"Authorization": f"Bearer {ATOK}"}

# find a professor
st, profs = call("GET", "/api/v1/admin/teachers", headers=AH)
prof = next((p for p in profs if not p.get("has_login")), profs[0] if profs else None)
check("teachers list", st == 200 and len(profs) > 0)

# professor password reset + login test
test_pw = "Prof#Test123"
st, _ = call("POST", f"/api/v1/admin/teachers/{prof['id']}/reset-password", {"password": test_pw}, headers=AH)
check("professor password set", st == 200)
st, plogin = call("POST", "/api/v1/auth/login", {"email": prof["email"], "password": test_pw})
check("professor login (bcrypt password_hash)", st == 200 and plogin.get("user", {}).get("role") == "professor", f"st={st}")
st, _ = call("POST", "/api/v1/auth/login", {"email": prof["email"], "password": "wrongpass"})
check("professor bad password rejected", st == 401)

# student provision + session + claim
# ==== cleanup any leftovers from previous runs ====
def admin_students():
    st, lst = call("GET", "/api/v1/admin/students", headers=AH)
    return lst if st == 200 else []
for s in admin_students():
    if str(s.get("roll_no", "")).startswith("88TST") or str(s.get("email", "")).endswith("test.local"):
        call("DELETE", f"/api/v1/admin/students/{s['id']}", headers=AH)
st, sesslist = call("GET", "/api/v1/sessions?")
if st == 200:
    for s in sesslist:
        if s.get("course_code") == "TEST101":
            call("POST", f"/api/v1/sessions/{s['id']}/stop")

import uuid
uniq = int(time.time()) % 1000
roll = f"88TST{uniq:03d}"
email = f"flow{uniq}_{uuid.uuid4().hex[:8]}@test.local"
st, stu = call("POST", "/api/v1/admin/students", {"roll_no": roll, "email": email, "name": "Flow Test"}, headers=AH)
check("admin creates student", st == 201 and "secret_hmac_key" in stu, f"st={st} {stu.get('error','')}")
SID = stu.get("id"); SECRET = stu.get("secret_hmac_key")
DEV = "deadbeef" * 8  # 64 hex chars

st, prov = call("POST", "/api/v1/provision", {"roll_no": roll, "secret_hmac_key": SECRET, "device_id_hash": DEV})
check("provision binds device", st == 201 and prov.get("student_uuid") == SID, f"st={st} {prov.get('error','')}")

st, _ = call("POST", "/api/v1/provision", {"roll_no": roll, "secret_hmac_key": "0"*64, "device_id_hash": DEV})
check("provision wrong secret rejected", st == 401)

st, sess = call("POST", "/api/v1/sessions/start", {"course_code": "TEST101", "prof_uuid": prof["id"]})
check("session started", st == 201, f"st={st} {sess.get('error','')}")
SESS = sess.get("id")
time.sleep(1.5)

# fetch a live token (4-char base62)
token = None
for _ in range(10):
    st, tk = call("GET", f"/api/v1/sessions/{SESS}/tokens")
    if st == 200 and tk.get("tokens"):
        token = tk["tokens"][-1]
        break
    time.sleep(1)
check("metronome mints 4-char token", token is not None and len(token["token_val"]) == 4,
      f"token={token and token['token_val']}")

def claim(time_ms, device, nonce=None, tok=None, sig=None):
    n = nonce or hmac.new(b"n", str(time.time()).encode(), hashlib.sha256).hexdigest()[:32]
    t = tok or token["token_val"]
    if n.startswith("challenge:"):  # server-issued marker handled below
        pass
    s = sig or hmac_hex(SECRET, f"{SESS}|{SID}|{t}|{time_ms}|{device}|{n}")
    return call("POST", "/api/v1/claim-attendance",
                {"session_uuid": SESS, "student_uuid": SID, "token_val": t,
                 "client_claimed_time": time_ms, "device_id_hash": device,
                 "nonce": n, "hmac_signature": s})

st, chal = call("POST", f"/api/v1/sessions/{SESS}/challenge")
check("challenge issued", st == 200 and len(chal.get("nonce", "")) == 32)
NONCE = chal["nonce"]
T0 = int(token["created_at_epoch"])

st, r = claim(T0 + 5, DEV, nonce=NONCE)
check("honest claim -> PRESENT", st == 200 and r.get("status") == "PRESENT", f"st={st} {r.get('status')} delta={r.get('verification_delta_ms')}")

# duplicate claim (new nonce) -> idempotent 200 already logged
st, _ = call("POST", f"/api/v1/sessions/{SESS}/challenge")
n2 = (await_) if False else None
st, chal2 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
st, r = claim(T0 + 8, DEV, nonce=chal2["nonce"])
check("duplicate claim -> already logged", st == 200 and r.get("status") == "PRESENT" and "already" in r.get("message", ""), f"st={st} {r.get('message')}")

# reused nonce -> 401 forged
st, r = claim(T0 + 10, DEV, nonce=NONCE)
check("nonce replay -> FORGED_RESPONSE", st == 401 and r.get("status") == "FORGED_RESPONSE", f"st={st} {r.get('status')}")

# wrong device -> 403
st, chal3 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
st, r = claim(T0 + 12, "f" * 64, nonce=chal3["nonce"])
check("wrong device -> HARDWARE_MISMATCH 403", st == 403 and r.get("status") == "HARDWARE_MISMATCH", f"st={st} {r.get('status')}")

# latency +500ms (Discord stream) -> 412 STREAM_DETECTED  (fresh token!)
def fresh_token():
    for _ in range(12):
        st, tk = call("GET", f"/api/v1/sessions/{SESS}/tokens")
        if st == 200 and tk.get("tokens"):
            t = tk["tokens"][-1]
            if int(t["created_at_epoch"]) + 5000 > int(time.time() * 1000) + 2000:
                return t
        time.sleep(0.6)
    return None

tokB = fresh_token()
check("fresh token available", tokB is not None)
if tokB:
    Tb = int(tokB["created_at_epoch"])
    st, chal4 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
    st, r = claim(Tb + 500, DEV, nonce=chal4["nonce"], tok=tokB["token_val"])
    check("latency +500ms -> STREAM_DETECTED 412", st == 412 and r.get("status") == "STREAM_DETECTED", f"st={st} {r.get('status')} {r.get('message')}")

    # negative latency (forged clock) -> 412 STREAM_DETECTED (SRS: delta<0 rejected)
    st, chal5 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
    st, r = claim(Tb - 300, DEV, nonce=chal5["nonce"], tok=tokB["token_val"])
    check("negative latency -> STREAM_DETECTED 412", st == 412 and r.get("status") == "STREAM_DETECTED", f"st={st} {r.get('status')} {r.get('message')}")

# bad HMAC -> 401
st, chal6 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
st, r = claim(T0 + 15, DEV, nonce=chal6["nonce"], sig="0" * 64)
check("forged signature -> FORGED_RESPONSE 401", st == 401 and r.get("status") == "FORGED_RESPONSE", f"st={st} {r.get('status')}")

# expired/random token -> 412 EXPIRED
st, chal7 = call("POST", f"/api/v1/sessions/{SESS}/challenge")
st, r = claim(T0 + 20, DEV, nonce=chal7["nonce"], tok="ZZZZ")
check("unknown token -> EXPIRED_TOKEN 412", st == 412 and r.get("status") == "EXPIRED_TOKEN", f"st={st} {r.get('status')}")

# cleanup
call("POST", f"/api/v1/sessions/{SESS}/stop")
call("DELETE", f"/api/v1/admin/students/{SID}", headers=AH)

failed = [n for n, c, _ in results if not c]
print()
print(f"== {len(results) - len(failed)}/{len(results)} checks passed ==")
sys.exit(1 if failed else 0)