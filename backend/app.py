#!/usr/bin/env python3
import hashlib
import json
import os
import secrets
import sqlite3
import socketserver
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DB_PATH = os.path.join(DATA_DIR, "fleet.db")
HOST = os.environ.get("YZ_HOST", "127.0.0.1")
PORT = int(os.environ.get("YZ_PORT", "9001"))
sessions = {}
ROLE_PERMS = {
    "管理员": ["users:write", "vehicles:write", "drivers:write", "dispatch:write", "customers:write", "contracts:write", "settlements:write", "maintenance:write", "safety:write", "energy:write"],
    "调度员": ["dispatch:write", "customers:write", "contracts:write", "settlements:write"],
    "安全员": ["safety:write"],
    "机务员": ["maintenance:write", "vehicles:write", "energy:write"],
}
TABLE_FIELDS = {
    "vehicles": ["plate", "model", "seats", "status", "biz", "annual", "insurance", "task"],
    "drivers": ["name", "license", "years", "score", "shift", "expiry", "mental"],
    "dispatch": ["code", "name", "customer", "project", "contractCode", "priority", "progress", "settlementStatus", "owner", "note"],
    "customers": ["name", "category", "contact", "phone", "creditLevel", "status", "note"],
    "contracts": ["code", "customerName", "projectName", "amount", "startDate", "endDate", "status", "owner", "note"],
    "settlements": ["code", "contractCode", "customerName", "projectName", "receivable", "received", "dueDate", "status", "note"],
    "maintenance": ["code", "plate", "kind", "status", "planDate", "note"],
    "energy": ["plate", "energyType", "volume", "unitPrice", "amount", "date", "note"],
    "safety": ["title", "plate", "level", "status", "date", "detail"],
}
TABLE_PREFIX = {
    "vehicles": "v",
    "drivers": "d",
    "dispatch": "t",
    "customers": "c",
    "contracts": "h",
    "settlements": "r",
    "maintenance": "m",
    "energy": "e",
    "safety": "s",
}
INT_FIELDS = {"seats", "score"}
FLOAT_FIELDS = {"volume", "unitPrice", "amount", "receivable", "received"}
DISPATCH_PROJECT_ALIASES = {
    "枣林湾音乐节返程": "音乐节接驳保障",
    "梅岭中学早晚班": "校车通勤服务",
    "禄口机场接驳": "机场接驳年度项目",
    "市级机关会议用车": "政务会议交通保障",
}


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


def csv_text(headers, rows):
    lines = [",".join(headers)]
    for row in rows:
        cells = []
        for value in row:
            text = str(value if value is not None else "")
            text = text.replace('"', '""')
            if "," in text or "\n" in text or '"' in text:
                text = '"{0}"'.format(text)
            cells.append(text)
        lines.append(",".join(cells))
    return "\n".join(lines) + "\n"


def table_rows(conn, table):
    fields = TABLE_FIELDS[table]
    sql = "select id, {0} from {1} order by created_at desc".format(", ".join(fields), table)
    return dict_rows(conn.execute(sql).fetchall())


def in_date_range(value, start, end):
    if not value:
        return (not start) and (not end)
    if start and value < start:
        return False
    if end and value > end:
        return False
    return True


def in_span_range(start_value, end_value, range_start, range_end):
    start = start_value or end_value or ""
    end = end_value or start_value or ""
    if not range_start and not range_end:
        return True
    if range_start and end and end < range_start:
        return False
    if range_end and start and start > range_end:
        return False
    return True


def dispatch_date(item):
    code = item.get("code") or ""
    if len(code) >= 10 and code.startswith("DY") and code[2:10].isdigit():
        return "{0}-{1}-{2}".format(code[2:6], code[6:8], code[8:10])
    return ""


def build_project_stats(dispatch, contracts, settlements):
    projects = {}
    for item in dispatch:
        key = item.get("project") or item.get("name")
        if key not in projects:
            projects[key] = {
                "project_name": key,
                "customer_name": item.get("customer") or "未绑定客户",
                "order_count": 0,
                "contract_amount": 0.0,
                "receivable": 0.0,
                "received": 0.0,
            }
        projects[key]["order_count"] += 1
    for item in contracts:
        key = item.get("projectName") or item.get("code")
        if key not in projects:
            projects[key] = {
                "project_name": key,
                "customer_name": item.get("customerName") or "未绑定客户",
                "order_count": 0,
                "contract_amount": 0.0,
                "receivable": 0.0,
                "received": 0.0,
            }
        projects[key]["customer_name"] = item.get("customerName") or projects[key]["customer_name"]
        projects[key]["contract_amount"] += float(item.get("amount") or 0)
    for item in settlements:
        key = item.get("projectName") or item.get("code")
        if key not in projects:
            projects[key] = {
                "project_name": key,
                "customer_name": item.get("customerName") or "未绑定客户",
                "order_count": 0,
                "contract_amount": 0.0,
                "receivable": 0.0,
                "received": 0.0,
            }
        projects[key]["customer_name"] = item.get("customerName") or projects[key]["customer_name"]
        projects[key]["receivable"] += float(item.get("receivable") or 0)
        projects[key]["received"] += float(item.get("received") or 0)
    rows = []
    for key in projects:
        item = projects[key]
        item["unreceived"] = item["receivable"] - item["received"]
        rows.append(item)
    rows.sort(key=lambda v: (v["receivable"], v["contract_amount"]), reverse=True)
    return rows


def filter_finance_rows(dispatch, contracts, settlements, start, end):
    filtered_dispatch = [item for item in dispatch if in_date_range(dispatch_date(item), start, end)]
    filtered_contracts = [item for item in contracts if in_span_range(item.get("startDate"), item.get("endDate"), start, end)]
    filtered_settlements = [item for item in settlements if in_date_range(item.get("dueDate"), start, end)]
    return filtered_dispatch, filtered_contracts, filtered_settlements


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


def apply_contract_defaults(item, contracts):
    contract_code = item.get("contractCode")
    if not contract_code:
        return item
    contract = None
    for row in contracts:
        if row.get("code") == contract_code:
            contract = row
            break
    if not contract:
        return item
    if "customerName" in item and not item.get("customerName"):
        item["customerName"] = contract.get("customerName") or ""
    if "projectName" in item and not item.get("projectName"):
        item["projectName"] = contract.get("projectName") or ""
    if "customer" in item and not item.get("customer"):
        item["customer"] = contract.get("customerName") or ""
    if "project" in item and not item.get("project"):
        item["project"] = contract.get("projectName") or ""
    return item


def insert_row(conn, table, item):
    fields = ["id"] + TABLE_FIELDS[table] + ["created_at", "updated_at"]
    values = [item["id"]] + [item[field] for field in TABLE_FIELDS[table]] + [now(), now()]
    sql = "insert into {0} ({1}) values ({2})".format(table, ", ".join(fields), ", ".join(["?"] * len(fields)))
    conn.execute(sql, values)


def ensure_column(conn, table, column, definition):
    columns = [row["name"] for row in conn.execute("pragma table_info({0})".format(table)).fetchall()]
    if column not in columns:
        conn.execute("alter table {0} add column {1} {2}".format(table, column, definition))


def settlement_status(item):
    receivable = float(item.get("receivable") or 0)
    received = float(item.get("received") or 0)
    if receivable > 0 and received >= receivable:
        return "已回款"
    if received > 0:
        return "部分回款"
    if receivable > 0:
        return "待回款"
    return "待建账"


def contract_status(item):
    end_date = item.get("endDate") or ""
    if end_date and end_date < datetime.utcnow().strftime("%Y-%m-%d"):
        return "已到期"
    return item.get("status") or "待启动"


def overdue_level(due_date, status):
    if not due_date or status == "已回款":
        return "ok"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if due_date < today:
        return "danger"
    return "warn"


def enrich_finance_rows(customers, contracts, settlements, dispatch):
    customer_names = set([item.get("name") for item in customers if item.get("name")])
    project_names = set([item.get("project") for item in dispatch if item.get("project")])
    contract_codes = set([item.get("code") for item in contracts if item.get("code")])

    for item in contracts:
        item["status"] = contract_status(item)
        if item.get("customerName"):
            customer_names.add(item.get("customerName"))
        if item.get("projectName"):
            project_names.add(item.get("projectName"))
        if item.get("code"):
            contract_codes.add(item.get("code"))

    for item in settlements:
        item["status"] = settlement_status(item)
        item["unreceived"] = float(item.get("receivable") or 0) - float(item.get("received") or 0)
        item["overdueLevel"] = overdue_level(item.get("dueDate"), item.get("status"))
        if item.get("customerName"):
            customer_names.add(item.get("customerName"))
        if item.get("projectName"):
            project_names.add(item.get("projectName"))
        if item.get("contractCode"):
            contract_codes.add(item.get("contractCode"))

    return {
        "customerCount": len(customer_names),
        "projectCount": len(project_names),
        "contractCount": len(contract_codes),
        "overdueSettlementCount": len([item for item in settlements if item.get("overdueLevel") == "danger"]),
    }


def backfill_dispatch_links(conn):
    contracts = table_rows(conn, "contracts")
    settlements = table_rows(conn, "settlements")
    dispatch_rows = table_rows(conn, "dispatch")
    if not dispatch_rows:
        return

    contract_by_project = {}
    for item in contracts:
        contract_by_project[item.get("projectName")] = item

    settlement_by_contract = {}
    for item in settlements:
        contract_code = item.get("contractCode")
        if contract_code and contract_code not in settlement_by_contract:
            settlement_by_contract[contract_code] = item

    for item in dispatch_rows:
        project_name = item.get("project") or DISPATCH_PROJECT_ALIASES.get(item.get("name"), "")
        contract = contract_by_project.get(project_name) if project_name else None
        customer_name = item.get("customer") or (contract.get("customerName") if contract else "")
        contract_code = item.get("contractCode") or (contract.get("code") if contract else "")
        status = item.get("settlementStatus") or "待建账"
        settlement = settlement_by_contract.get(contract_code) if contract_code else None
        if settlement:
            status = settlement_status(settlement)
        elif status == "待建账" and contract_code:
            status = "待回款"

        should_update = (
            item.get("project") != project_name
            or item.get("customer") != customer_name
            or item.get("contractCode") != contract_code
            or item.get("settlementStatus") != status
        )
        if not should_update:
            continue

        conn.execute(
            "update dispatch set project = ?, customer = ?, contractCode = ?, settlementStatus = ?, updated_at = ? where id = ?",
            (project_name, customer_name, contract_code, status, now(), item["id"]),
        )


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
            customer text not null,
            project text not null,
            contractCode text not null,
            priority text not null,
            progress text not null,
            settlementStatus text not null,
            owner text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists customers (
            id text primary key,
            name text not null,
            category text not null,
            contact text not null,
            phone text not null,
            creditLevel text not null,
            status text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists contracts (
            id text primary key,
            code text not null,
            customerName text not null,
            projectName text not null,
            amount real not null,
            startDate text not null,
            endDate text not null,
            status text not null,
            owner text not null,
            note text not null,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists settlements (
            id text primary key,
            code text not null,
            contractCode text not null,
            customerName text not null,
            projectName text not null,
            receivable real not null,
            received real not null,
            dueDate text not null,
            status text not null,
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
    ensure_column(conn, "dispatch", "customer", "text not null default ''")
    ensure_column(conn, "dispatch", "project", "text not null default ''")
    ensure_column(conn, "dispatch", "contractCode", "text not null default ''")
    ensure_column(conn, "dispatch", "settlementStatus", "text not null default '待建账'")
    users = [
        ("u1", "admin", hash_password("admin123"), "系统管理员", "管理员"),
        ("u2", "dispatch", hash_password("admin123"), "调度员账号", "调度员"),
        ("u3", "safety", hash_password("admin123"), "安全员账号", "安全员"),
        ("u4", "maintenance", hash_password("admin123"), "机务员账号", "机务员"),
        ("u5", "opsdemo", hash_password("demo123"), "经营演示账号", "调度员"),
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
            {"id": "t1", "code": "DY20260402001", "name": "枣林湾音乐节返程", "customer": "仪征文旅集团", "project": "音乐节接驳保障", "contractCode": "HT2026-001", "priority": "高优", "progress": "已派 88/88 台", "settlementStatus": "待回款", "owner": "负责人：吴调度", "note": "南京南站、扬州东站、仪征停车场三线并发。"},
            {"id": "t2", "code": "DY20260402008", "name": "梅岭中学早晚班", "customer": "梅岭中学", "project": "校车通勤服务", "contractCode": "HT2026-002", "priority": "常规", "progress": "已派 12/12 台", "settlementStatus": "部分回款", "owner": "负责人：张队长", "note": "固定线路、固定司机、跟车老师实名登记。"},
            {"id": "t3", "code": "DY20260402012", "name": "禄口机场接驳", "customer": "扬州空港服务公司", "project": "机场接驳年度项目", "contractCode": "HT2026-003", "priority": "常规", "progress": "已派 16/18 台", "settlementStatus": "待回款", "owner": "负责人：陈班长", "note": "候机楼班次剩余 2 台待确认。"},
            {"id": "t4", "code": "DY20260402018", "name": "市级机关会议用车", "customer": "扬州市机关事务管理局", "project": "政务会议交通保障", "contractCode": "HT2026-004", "priority": "高优", "progress": "已派 6/6 台", "settlementStatus": "已回款", "owner": "负责人：周主任", "note": "考斯特与商务车组合保障。"},
        ],
        "customers": [
            {"id": "c1", "name": "仪征文旅集团", "category": "景区/酒店", "contact": "周敏", "phone": "13851001201", "creditLevel": "A", "status": "合作中", "note": "大型活动摆渡核心客户"},
            {"id": "c2", "name": "梅岭中学", "category": "学校", "contact": "刘老师", "phone": "13851001202", "creditLevel": "A", "status": "合作中", "note": "校车年度服务单位"},
            {"id": "c3", "name": "扬州空港服务公司", "category": "企业客户", "contact": "郑经理", "phone": "13851001203", "creditLevel": "B", "status": "合作中", "note": "机场接驳与地面联运"},
            {"id": "c4", "name": "扬州市机关事务管理局", "category": "政府单位", "contact": "顾主任", "phone": "13851001204", "creditLevel": "A", "status": "合作中", "note": "会议与公务接待保障"},
        ],
        "contracts": [
            {"id": "h1", "code": "HT2026-001", "customerName": "仪征文旅集团", "projectName": "音乐节接驳保障", "amount": 480000, "startDate": "2026-03-20", "endDate": "2026-04-30", "status": "执行中", "owner": "商务：蒋雯", "note": "按活动波次结算"},
            {"id": "h2", "code": "HT2026-002", "customerName": "梅岭中学", "projectName": "校车通勤服务", "amount": 920000, "startDate": "2026-02-15", "endDate": "2026-12-31", "status": "执行中", "owner": "商务：王蓉", "note": "按月结算，含跟车管理"},
            {"id": "h3", "code": "HT2026-003", "customerName": "扬州空港服务公司", "projectName": "机场接驳年度项目", "amount": 650000, "startDate": "2026-01-01", "endDate": "2026-12-31", "status": "执行中", "owner": "商务：唐悦", "note": "接驳班次浮动计费"},
            {"id": "h4", "code": "HT2026-004", "customerName": "扬州市机关事务管理局", "projectName": "政务会议交通保障", "amount": 220000, "startDate": "2026-03-01", "endDate": "2026-06-30", "status": "执行中", "owner": "商务：程浩", "note": "专项保障项目"},
        ],
        "settlements": [
            {"id": "r1", "code": "JS2026-001", "contractCode": "HT2026-001", "customerName": "仪征文旅集团", "projectName": "音乐节接驳保障", "receivable": 180000, "received": 60000, "dueDate": "2026-04-10", "status": "待回款", "note": "首期活动结算"},
            {"id": "r2", "code": "JS2026-002", "contractCode": "HT2026-002", "customerName": "梅岭中学", "projectName": "校车通勤服务", "receivable": 160000, "received": 80000, "dueDate": "2026-04-15", "status": "部分回款", "note": "三月校车月结"},
            {"id": "r3", "code": "JS2026-003", "contractCode": "HT2026-003", "customerName": "扬州空港服务公司", "projectName": "机场接驳年度项目", "receivable": 120000, "received": 0, "dueDate": "2026-04-12", "status": "待回款", "note": "季度首单"},
            {"id": "r4", "code": "JS2026-004", "contractCode": "HT2026-004", "customerName": "扬州市机关事务管理局", "projectName": "政务会议交通保障", "receivable": 90000, "received": 90000, "dueDate": "2026-03-28", "status": "已回款", "note": "首批会议服务已结清"},
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
    backfill_dispatch_links(conn)
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

    def send_csv(self, filename, content):
        raw = content.encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="{0}"'.format(filename))
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
            payload["financeMeta"] = enrich_finance_rows(payload["customers"], payload["contracts"], payload["settlements"], payload["dispatch"])
            conn.close()
            return self.send(200, payload)
        if path == "/api/reports/export":
            user = self.require_auth()
            if not user:
                return
            query = parse_qs(urlparse(self.path).query or "")
            kind = (query.get("kind") or ["project"])[0]
            start = (query.get("start") or [""])[0]
            end = (query.get("end") or [""])[0]
            conn = db()
            customers = table_rows(conn, "customers")
            contracts = table_rows(conn, "contracts")
            settlements = table_rows(conn, "settlements")
            dispatch = table_rows(conn, "dispatch")
            conn.close()
            dispatch, contracts, settlements = filter_finance_rows(dispatch, contracts, settlements, start, end)
            date_tag = datetime.utcnow().strftime("%Y%m%d")
            if kind == "project":
                rows = build_project_stats(dispatch, contracts, settlements)
                content = csv_text(
                    ["项目", "客户", "订单数", "合同额", "应收", "已收", "未收"],
                    [[v["project_name"], v["customer_name"], v["order_count"], "{0:.2f}".format(v["contract_amount"]), "{0:.2f}".format(v["receivable"]), "{0:.2f}".format(v["received"]), "{0:.2f}".format(v["unreceived"])] for v in rows],
                )
                return self.send_csv("project-report-{0}.csv".format(date_tag), content)
            if kind == "settlement":
                content = csv_text(
                    ["结算单号", "合同编号", "客户", "项目", "应收", "已收", "未收", "到期日", "状态", "备注"],
                    [[v["code"], v["contractCode"], v["customerName"], v["projectName"], "{0:.2f}".format(float(v["receivable"] or 0)), "{0:.2f}".format(float(v["received"] or 0)), "{0:.2f}".format(float(v["receivable"] or 0) - float(v["received"] or 0)), v["dueDate"], v["status"], v["note"]] for v in settlements],
                )
                return self.send_csv("settlement-report-{0}.csv".format(date_tag), content)
            if kind == "customer":
                customer_names = set([item["customerName"] for item in contracts])
                content = csv_text(
                    ["客户名称", "客户类型", "联系人", "电话", "资信", "合作状态", "备注", "合同数"],
                    [[v["name"], v["category"], v["contact"], v["phone"], v["creditLevel"], v["status"], v["note"], len([item for item in contracts if item["customerName"] == v["name"]])] for v in customers if (not start and not end) or v["name"] in customer_names],
                )
                return self.send_csv("customer-contract-report-{0}.csv".format(date_tag), content)
            return self.send(404, {"error": "报表类型不存在"})
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
        if table in ["dispatch", "settlements"]:
            item = apply_contract_defaults(item, table_rows(conn, "contracts"))
        if table == "settlements":
            item["status"] = settlement_status(item)
        if table == "contracts":
            item["status"] = contract_status(item)
        insert_row(conn, table, item)
        if table in ["contracts", "settlements"]:
            backfill_dispatch_links(conn)
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
        if table in ["dispatch", "settlements"]:
            item = apply_contract_defaults(item, table_rows(conn, "contracts"))
        if table == "settlements":
            item["status"] = settlement_status(item)
        if table == "contracts":
            item["status"] = contract_status(item)
        values = [item[field] for field in TABLE_FIELDS[table]] + [now(), parts[2]]
        conn.execute(
            "update {0} set {1}, updated_at = ? where id = ?".format(table, ", ".join(["{0} = ?".format(field) for field in TABLE_FIELDS[table]])),
            values,
        )
        if table in ["contracts", "settlements"]:
            backfill_dispatch_links(conn)
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
