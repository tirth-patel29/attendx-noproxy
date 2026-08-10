#!/usr/bin/env python3
"""Live end-to-end verification of the attendance gateway (SRS §5/§6 + student auth).

Usage: python3 scripts/live_flow_test.py "<admin-password>" [base-url]
"""
import json, urllib.request, urllib.error, time, hmac, hashlib, sys, uuid

BASE = sys.argv[2] if len(sys.argv) > 2 else "https://api.atmyhome.tech"
P = sys.argv[1] if len(sys.argv) > 1 else "Admin@123"

def call(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (attendance-flow-test)")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {"error": "non-json"}

def hmac_hex(key_hex, msg):
    return hmac.new(bytes.fromhex(key_hex), msg.encode(), hashlib.sha256).hexdigest()

results = []
def check(name, cond, extra=""):
    results.append((name, cond, extra))
    print(("  ✅ " if cond else "  ❌ ") + name + (f" — {extra}" if extra and not cond else ""))

print("== 1. Admin & professor auth ==")
st, login = call("POST", "/api/v1/admin/login", {"email": "admin@atmyhome.tech", "password": P})
check("admin login", st == 200); ATOK = login.get("access_token", "")
AH = {"Authorization": f"Bearer {ATOK}"}

st, profs = call("GET", "/api/v1/admin/teachers", headers=AH)
check("teachers list", st == 200 and len(profs) >= 2)
profA, profB = profs[0], profs[1]
tpw = "Prof#Test123"
call("POST", f"/api/v1/admin/teachers/{profA['id']}/reset-password", {"password": tpw}, headers=AH)
call("POST", f"/api/v1/admin/teachers/{profB['id']}/reset-password", {"password": tpw}, headers=AH)
st, pl = call("POST", "/api/v1/auth/login", {"email": profA["email"], "password": tpw})
check("professor login (bcrypt)", st == 200 and pl.get("user", {}).get("role") == "professor")
PT = pl.get("access_token", "")
PH = {"Authorization": f"Bearer {PT}"}

print("== 2. SESSION-LOCK (the fundamental fix) ==")
# Spoof profB in the body — the server MUST attribute the session to profA (JWT)
st, sess = call("POST", "/api/v1/sessions/start", {"course_code": "LOCK101", "prof_uuid": profB["id"]}, headers=PH)
check("session start with spoofed prof_uuid", st == 201)
check("session attributed to JWT teacher (not spoofed)", sess.get("professor_id") == profA["id"],
      f"expected {profA['id']} got {sess.get('professor_id')}")
SESS = sess.get("id")
call("POST", f"/api/v1/sessions/{SESS}/stop", headers=PH)

st, _ = call("POST", "/api/v1/sessions/start", {"course_code": "LOCK101"})
check("session start without token rejected (401)", st == 401)
st, mine = call("GET", "/api/v1/sessions", headers=PH)
check("GET /sessions only returns own sessions", st == 200 and all(s["professor_id"] == profA["id"] for s in mine))
st, _ = call("GET", "/api/v1/sessions")
check("GET /sessions without token rejected", st == 401)

print("== 3. Timetable & summary (per teacher) ==")
# ensure a division + course + assignment exists for profA
st, divs = call("GET", "/api/v1/admin/divisions", headers=AH)
if divs:
    div = divs[0]
else:
    st, div = call("POST", "/api/v1/admin/divisions", {"name": f"Div {int(time.time())}"}, headers=AH)
DIV = div["id"]
today_dow = time.localtime().tm_wday
st, crs = call("GET", "/api/v1/admin/courses", headers=AH)
co = next((c for c in crs if c["course_code"] == "CS101"), None)
if not co:
    cp = call("POST", "/api/v1/admin/courses", {"course_code": "CS101", "title": "Computer Science 101", "division_id": DIV}, headers=AH)
    co = cp[1]
st, tt = call("GET", "/api/v1/professor/timetable", headers=PH)
need_assign = not any(a["course_code"] == "CS101" for a in tt.get("week", []))
if need_assign:
    call("POST", "/api/v1/admin/assignments",
         {"prof_uuid": profA["id"], "course_code": "CS101", "division_id": DIV,
          "day_of_week": today_dow, "start_time": "09:00", "end_time": "10:00"}, headers=AH)
st, tt = call("GET", "/api/v1/professor/timetable", headers=PH)
check("timetable returns today's lectures", st == 200 and any(a["day_of_week"] == tt.get("today_dow", today_dow) for a in tt.get("week", [])),
      f"week={len(tt.get('week', []))}")
st, sm = call("GET", "/api/v1/professor/summary", headers=PH)
check("summary per subject", st == 200 and any(s.get("course_code") == "CS101" for s in sm))

print("== 4. Student self-registration + device bind + claim ==")
uniq = int(time.time()) % 1000
roll = f"77SEL{uniq:03d}"
email = f"{roll.lower()}@charusat.edu.in"
st, r = call("POST", "/api/v1/student/status", {"id": roll})
check("status: not exists", st == 200 and r.get("exists") is False)
st, reg = call("POST", "/api/v1/student/register", {"id": roll, "name": "Self Reg Student", "password": "Stud#Pass123"})
check("self-register", st == 201 and reg.get("roll_no") == roll and reg.get("email") == email, f"st={st}")
SID = reg.get("student_uuid")
DEV = "cafebabe" * 8
st, r = call("POST", "/api/v1/student/device/bind", {"device_id_hash": DEV}, headers={"Authorization": f"Bearer {reg['access_token']}"})
check("device bind mints HMAC signer", st == 200 and len(r.get("secret_hmac_key", "")) == 64, f"st={st}")
SECRET = r.get("secret_hmac_key")

st, sess2 = call("POST", "/api/v1/sessions/start", {"course_code": "CS101"}, headers=PH)
SESS2 = sess2.get("id")
time.sleep(1.5)
tok = None
for _ in range(10):
    st, tk = call("GET", f"/api/v1/sessions/{SESS2}/tokens")
    if st == 200 and tk.get("tokens"): tok = tk["tokens"][-1]; break
    time.sleep(0.8)
check("session mints 4-char token", tok and len(tok["token_val"]) == 4)
T0 = int(tok["created_at_epoch"])

def claim(time_ms, device, nonce=None, tokv=None, sig=None):
    n = nonce or hmac.new(b"n", str(time.time()).encode(), hashlib.sha256).hexdigest()[:32]
    t = tokv or tok["token_val"]
    s = sig or hmac_hex(SECRET, f"{SESS2}|{SID}|{t}|{time_ms}|{device}|{n}")
    return call("POST", "/api/v1/claim-attendance",
                {"session_uuid": SESS2, "student_uuid": SID, "token_val": t,
                 "client_claimed_time": time_ms, "device_id_hash": device, "nonce": n, "hmac_signature": s})

st, chal = call("POST", f"/api/v1/sessions/{SESS2}/challenge")
check("challenge issued", st == 200 and len(chal.get("nonce", "")) == 32)
st, r = claim(T0 + 5, DEV, nonce=chal["nonce"])
check("honest claim -> PRESENT", st == 200 and r.get("status") == "PRESENT", f"{st} {r.get('status')}")
st, chal = call("POST", f"/api/v1/sessions/{SESS2}/challenge")
st, r = claim(T0 + 8, DEV, nonce=chal["nonce"])
check("duplicate -> already logged", st == 200 and "already" in r.get("message", ""))
st, chal = call("POST", f"/api/v1/sessions/{SESS2}/challenge")
st, r = claim(T0 + 500, DEV, nonce=chal["nonce"])
check("+500ms -> STREAM_DETECTED 412", st == 412 and r.get("status") == "STREAM_DETECTED")
st, chal = call("POST", f"/api/v1/sessions/{SESS2}/challenge")
st, r = claim(T0 - 300, DEV, nonce=chal["nonce"])
check("negative latency -> STREAM_DETECTED 412", st == 412 and r.get("status") == "STREAM_DETECTED")
st, chal = call("POST", f"/api/v1/sessions/{SESS2}/challenge")
st, r = claim(T0 + 10, DEV, nonce=chal["nonce"], sig="0" * 64)
check("forged HMAC -> 401", st == 401 and r.get("status") == "FORGED_RESPONSE")

print("== 5. Forgot-password lifecycle ==")
st, r = call("POST", f"/api/v1/admin/students/{SID}/forgot-password", headers=AH)
check("admin forgot-password clears hash", st == 200)
st, r = call("POST", "/api/v1/student/status", {"id": roll})
check("app sees no-password state", st == 200 and r.get("exists") is True and r.get("has_password") is False)
st, r = call("POST", "/api/v1/student/password/set", {"id": roll, "new_password": "NewPass#456"})
check("student sets new password (twice in app)", st == 200)
st, r = call("POST", "/api/v1/student/login", {"id": roll, "password": "NewPass#456"})
check("login with new password", st == 200 and r.get("roll_no") == roll)
st, r = call("POST", "/api/v1/student/login", {"id": roll, "password": "Stud#Pass123"})
check("old password rejected", st == 401)

# cleanup
call("POST", f"/api/v1/sessions/{SESS2}/stop", headers=PH)
call("DELETE", f"/api/v1/admin/students/{SID}", headers=AH)

failed = [n for n, c, _ in results if not c]
print()
print(f"== {len(results) - len(failed)}/{len(results)} checks passed ==")
sys.exit(1 if failed else 0)