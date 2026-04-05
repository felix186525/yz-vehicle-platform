#!/usr/bin/env python3
import hashlib
import json
import os
import secrets
import sqlite3
import socketserver
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DB_PATH = os.path.join(DATA_DIR, "fleet.db")
HOST = os.environ.get("YZ_HOST", "127.0.0.1")
PORT = int(os.environ.get("YZ_PORT", "9001"))
sessions = {}
ROLE_PERMS = {
    "管理员": ["users:write", "vehicles:write", "drivers:write", "dispatch:write", "maintenance:write", "safety:write", "energy:write"],
    "调度员": ["dispatch:write"],
    "安全员": ["safety:write"],
    "机务员": ["maintenance:write", "vehicles:write", "energy:write"],
}
TABLE_FIELDS = {
    "vehicles": ["plate", "model", "seats", "status", "biz", "annual", "insurance", "task"],
    "drivers": ["name", "license", "years", "score", "shift", "expiry", "mental"],
    "dispatch": ["code", "name", "priority", "progress", "owner", "note"],
    "maintenance": ["code", "plate", "kind", "status", "planDate", "note"],
    "energy": ["plate", "energyType", "volume", "unitPrice", "amount", "date", "note"],
    "safety": ["title", "plate", "level", "status", "date", "detail"],
}
TABLE_PREFIX = {
    "vehicles": "v",
    "drivers": "d",
    "dispatch": "t",
    "maintenance": "m",
    "energy": "e",
    "safety": "s",
}
INT_FIELDS = {"seats", "score"}
FLOAT_FIELDS = {"volume", "unitPrice", "amount"}


def now():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def dict_rows(rows):
    return [dict(row) for row in rows]


def public_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"],
        "role": row["role"],
        "permissions": ROLE_PERMS.get(row["role"], []),
    }


def item_from_payload(table, payload, item_id):
    item = {"id": item_id}
    for field in TABLE_FIELDS[table]:
        value = payload.get(field, "")
        if field in INT_FIELDS:
            value = int(value or 0)
        if field in FLOAT_FIELDS:
            value = float(value or 0)
        item[field] = value
    return item


def insert_row(conn, table, item):
    fields = ["id"] + TABLE_FIELDS[table] + ["created_at", "updated_at"]
    values = [item["id"]] + [item[field] for field in TABLE_FIELDS[table]] + [now(), now()]
    sql = "insert into {0} ({1}) values ({2})".format(table, ", ".join(fields), ", ".join(["?"] * len(fields)))
    conn.execute(sql, values)


def init_db():
    if not os.path.isdir(DATA_DIR):
        os.makedirs(DATA_DIR)
    conn = db()
    cur = conn.cursor()
    cur.executescript(
        """
        create table if not exists users (
            id text primary key,
            username text unique not null,
            password_hash text not null,
            name text not null,
            role text not null
        );
        create table if not exists vehicles (
            id text primary key,
            plate text not null,
            model text not null,
            seats integer not null,
            status text not null,
            biz text not null,
            annual text not null,
            insurance text not null,
            task text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists drivers (
            id text primary key,
            name text not null,
            license text not null,
            years text not null,
            score integer not null,
            shift text not null,
            expiry text not null,
            mental text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists dispatch (
            id text primary key,
            code text not null,
            name text not null,
            priority text not null,
            progress text not null,
            owner text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists maintenance (
            id text primary key,
            code text not null,
            plate text not null,
            kind text not null,
            status text not null,
            planDate text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists energy (
            id text primary key,
            plate text not null,
            energyType text not null,
            volume real not null,
            unitPrice real not null,
            amount real not null,
            date text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists safety (
            id text primary key,
            title text not null,
            plate text not null,
            level text not null,
            status text not null,
            date text not null,
            detail text not null,
            created_at text not null,
            updated_at text not null
        );
        """
    )
    users = [
        ("u1", "admin", hash_password("admin123"), "系统管理员", "管理员"),
        ("u2", "dispatch", hash_password("admin123"), "调度员账号", "调度员"),
        ("u3", "safety", hash_password("admin123"), "安全员账号", "安全员"),
        ("u4", "maintenance", hash_password("admin123"), "机务员账号", "机务员"),
    ]
    for user in users:
        cur.execute("insert or ignore into users values (?, ?, ?, ?, ?)", user)

    seed = {
        "vehicles": [
            {"id": "v1", "plate": "苏KA1208", "model": "宇通 ZK6127", "seats": 55, "status": "运营中", "biz": "赛事接驳", "annual": "2026-04-05", "insurance": "2026-07-12", "task": "南京南站专线"},
            {"id": "v2", "plate": "苏KB5102", "model": "金龙 XML6807", "seats": 39, "status": "待命", "biz": "旅游包车", "annual": "2026-06-16", "insurance": "2026-08-20", "task": "无"},
            {"id": "v3", "plate": "苏KC6621", "model": "宇通校车", "seats": 41, "status": "运营中", "biz": "校车", "annual": "2026-05-10", "insurance": "2026-10-18", "task": "梅岭中学早班"},
            {"id": "v4", "plate": "苏KD7781", "model": "比亚迪 B12D", "seats": 49, "status": "维保中", "biz": "机场接驳", "annual": "2026-04-28", "insurance": "2026-09-15", "task": "维保停运"},
            {"id": "v5", "plate": "苏KE3325", "model": "丰田考斯特", "seats": 19, "status": "运营中", "biz": "外事接待", "annual": "2026-08-09", "insurance": "2026-11-23", "task": "市级机关接待"},
        ],
        "drivers": [
            {"id": "d1", "name": "刘海峰", "license": "A1", "years": "12 年", "score": 98, "shift": "南京南站接驳", "expiry": "2026-04-18", "mental": "稳定"},
            {"id": "d2", "name": "王建国", "license": "A1A2", "years": "18 年", "score": 96, "shift": "今日待命", "expiry": "2026-04-07", "mental": "需复测"},
            {"id": "d3", "name": "陈玉梅", "license": "A1", "years": "9 年", "score": 99, "shift": "梅岭中学校车", "expiry": "2026-09-11", "mental": "稳定"},
            {"id": "d4", "name": "周志强", "license": "A3", "years": "7 年", "score": 94, "shift": "仪征候机楼", "expiry": "2026-05-22", "mental": "稳定"},
            {"id": "d5", "name": "赵立新", "license": "A1", "years": "15 年", "score": 97, "shift": "赛事保障后备", "expiry": "2026-06-30", "mental": "稳定"},
        ],
        "dispatch": [
            {"id": "t1", "code": "DY20260402001", "name": "枣林湾音乐节返程", "priority": "高优", "progress": "已派 88/88 台", "owner": "负责人：吴调度", "note": "南京南站、扬州东站、仪征停车场三线并发。"},
            {"id": "t2", "code": "DY20260402008", "name": "梅岭中学早晚班", "priority": "常规", "progress": "已派 12/12 台", "owner": "负责人：张队长", "note": "固定线路、固定司机、跟车老师实名登记。"},
            {"id": "t3", "code": "DY20260402012", "name": "禄口机场接驳", "priority": "常规", "progress": "已派 16/18 台", "owner": "负责人：陈班长", "note": "候机楼班次剩余 2 台待确认。"},
            {"id": "t4", "code": "DY20260402018", "name": "市级机关会议用车", "priority": "高优", "progress": "已派 6/6 台", "owner": "负责人：周主任", "note": "考斯特与商务车组合保障。"},
        ],
        "maintenance": [
            {"id": "m1", "code": "WB2026040203", "plate": "苏KD7781", "kind": "二级保养", "status": "进行中", "planDate": "2026-04-03", "note": "更换滤芯并检查轮胎磨损"},
            {"id": "m2", "code": "WB2026040207", "plate": "苏KB5102", "kind": "故障维修", "status": "待进厂", "planDate": "2026-04-04", "note": "空调系统检修"},
            {"id": "m3", "code": "WB2026040210", "plate": "苏KE3325", "kind": "例检", "status": "已完成", "planDate": "2026-04-01", "note": "季度例检已完成"},
        ],
        "energy": [
            {"id": "e1", "plate": "苏KA1208", "energyType": "燃油", "volume": 180, "unitPrice": 7.45, "amount": 1341, "date": "2026-04-01", "note": "音乐节保障补油"},
            {"id": "e2", "plate": "苏KD7781", "energyType": "充电", "volume": 116, "unitPrice": 1.08, "amount": 125.28, "date": "2026-04-02", "note": "维保后补电"},
            {"id": "e3", "plate": "苏KC6621", "energyType": "燃油", "volume": 95, "unitPrice": 7.32, "amount": 695.4, "date": "2026-04-02", "note": "校车日常运营"},
        ],
        "safety": [
            {"id": "s1", "title": "超速预警", "plate": "苏KA1208", "level": "一般", "status": "整改中", "date": "2026-04-01", "detail": "昨日下午 16:42 触发 1 次超速报警，已安排谈话教育。"},
            {"id": "s2", "title": "轮胎磨损异常", "plate": "苏KD7781", "level": "较高", "status": "待整改", "date": "2026-04-02", "detail": "左后轮磨损超阈值，已联动维保工单。"},
            {"id": "s3", "title": "培训缺考", "plate": "", "level": "一般", "status": "已闭环", "date": "2026-03-30", "detail": "季度安全考试已补考完成。"},
        ],
    }
    for table, items in seed.items():
        if cur.execute("select count(*) from {0}".format(table)).fetchone()[0] == 0:
            for item in items:
                insert_row(conn, table, item)
    conn.commit()
    conn.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def send(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def unauthorized(self):
        self.send(401, {"error": "未登录或登录已失效"})

    def user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth.split(" ", 1)[1]
        return sessions.get(token)

    def require_auth(self):
        user = self.user()
        if not user:
            self.unauthorized()
            return None
        return user

    def require_perm(self, perm):
        user = self.require_auth()
        if not user:
            return None
        if perm not in user.get("permissions", []):
            self.send(403, {"error": "当前账号无此操作权限"})
            return None
        return user

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self.send(200, {"ok": True})
        if path == "/api/me":
            user = self.require_auth()
            if not user:
                return
            return self.send(200, {"user": user})
        if path == "/api/bootstrap":
            user = self.require_auth()
            if not user:
                return
            conn = db()
            payload = {"users": [public_user(row) for row in conn.execute("select * from users order by username").fetchall()]}
            for table, fields in TABLE_FIELDS.items():
                sql = "select id, {0} from {1} order by created_at desc".format(", ".join(fields), table)
                payload[table] = dict_rows(conn.execute(sql).fetchall())
            conn.close()
            return self.send(200, payload)
        self.send(404, {"error": "接口不存在"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            payload = self.body()
            conn = db()
            row = conn.execute("select * from users where username = ?", (payload.get("username", ""),)).fetchone()
            conn.close()
            if (not row) or row["password_hash"] != hash_password(payload.get("password", "")):
                return self.send(401, {"error": "用户名或密码错误"})
            token = secrets.token_hex(24)
            user = public_user(row)
            sessions[token] = user
            return self.send(200, {"token": token, "user": user})
        if path == "/api/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                sessions.pop(auth.split(" ", 1)[1], None)
            return self.send(200, {"ok": True})
        if path == "/api/users":
            if not self.require_perm("users:write"):
                return
            payload = self.body()
            item = {
                "id": "u" + secrets.token_hex(6),
                "username": payload.get("username", ""),
                "name": payload.get("name", ""),
                "role": payload.get("role", "调度员"),
            }
            password = payload.get("password", "") or "admin123"
            conn = db()
            try:
                conn.execute(
                    "insert into users values (?, ?, ?, ?, ?)",
                    (item["id"], item["username"], hash_password(password), item["name"], item["role"]),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self.send(400, {"error": "用户名已存在"})
            conn.close()
            item["permissions"] = ROLE_PERMS.get(item["role"], [])
            return self.send(200, {"item": item})
        parts = [p for p in path.split("/") if p]
        if len(parts) != 2 or parts[1] not in TABLE_FIELDS:
            return self.send(404, {"error": "接口不存在"})
        table = parts[1]
        if not self.require_perm("{0}:write".format(table)):
            return
        payload = self.body()
        item = item_from_payload(table, payload, TABLE_PREFIX[table] + secrets.token_hex(6))
        conn = db()
        insert_row(conn, table, item)
        conn.commit()
        conn.close()
        self.send(200, {"item": item})

    def do_PUT(self):
        path = urlparse(self.path).path
        parts = [p for p in path.split("/") if p]
        if len(parts) != 3:
            return self.send(404, {"error": "接口不存在"})
        if parts[1] == "users":
            if not self.require_perm("users:write"):
                return
            payload = self.body()
            conn = db()
            fields = ["username = ?", "name = ?", "role = ?"]
            values = [payload.get("username", ""), payload.get("name", ""), payload.get("role", "调度员")]
            if payload.get("password"):
                fields.append("password_hash = ?")
                values.append(hash_password(payload.get("password")))
            values.append(parts[2])
            try:
                conn.execute("update users set {0} where id = ?".format(", ".join(fields)), values)
                conn.commit()
                row = conn.execute("select * from users where id = ?", (parts[2],)).fetchone()
            except sqlite3.IntegrityError:
                conn.close()
                return self.send(400, {"error": "用户名已存在"})
            conn.close()
            return self.send(200, {"item": public_user(row)})
        if parts[1] not in TABLE_FIELDS:
            return self.send(404, {"error": "接口不存在"})
        table = parts[1]
        if not self.require_perm("{0}:write".format(table)):
            return
        payload = self.body()
        item = item_from_payload(table, payload, parts[2])
        conn = db()
        values = [item[field] for field in TABLE_FIELDS[table]] + [now(), parts[2]]
        conn.execute(
            "update {0} set {1}, updated_at = ? where id = ?".format(table, ", ".join(["{0} = ?".format(field) for field in TABLE_FIELDS[table]])),
            values,
        )
        conn.commit()
        conn.close()
        self.send(200, {"item": item})

    def do_DELETE(self):
        path = urlparse(self.path).path
        parts = [p for p in path.split("/") if p]
        if len(parts) != 3:
            return self.send(404, {"error": "接口不存在"})
        if parts[1] == "users":
            if not self.require_perm("users:write"):
                return
            conn = db()
            conn.execute("delete from users where id = ? and username != 'admin'", (parts[2],))
            conn.commit()
            conn.close()
            return self.send(200, {"ok": True})
        if parts[1] not in TABLE_FIELDS:
            return self.send(404, {"error": "接口不存在"})
        if not self.require_perm("{0}:write".format(parts[1])):
            return
        conn = db()
        conn.execute("delete from {0} where id = ?".format(parts[1]), (parts[2],))
        conn.commit()
        conn.close()
        self.send(200, {"ok": True})


class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("YZ Fleet API listening on {0}:{1}".format(HOST, PORT))
    server.serve_forever()
