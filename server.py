#!/usr/bin/env python3
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:  # The static pages can still be served while the server is being prepared.
    pymysql = None
    DictCursor = None


APP_DIR = os.path.dirname(os.path.abspath(__file__))
MAX_BODY_BYTES = 25 * 1024 * 1024

SEED_COMPANIES = [
    {
        "code": "A001",
        "name": "示例科技",
        "accounts": [
            ("tech-cmb-basic", "招商银行", "基本户", "bank", 862400),
            ("tech-ccb-general", "建设银行", "一般户", "bank", 332200),
            ("tech-alipay", "支付宝", "企业账户", "alipay", 90000),
        ],
    },
    {
        "code": "A002",
        "name": "示例贸易",
        "accounts": [
            ("trade-icbc-basic", "工商银行", "基本户", "bank", 596400),
            ("trade-wechat", "微信支付", "商户号", "wechat", 87800),
        ],
    },
    {
        "code": "A003",
        "name": "控股主体",
        "accounts": [
            ("holding-boc-general", "中国银行", "一般户", "bank", 1718900),
            ("holding-securities", "证券账户", "资金账户", "securities", 390000),
        ],
    },
]


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def get_db():
    if pymysql is None:
        raise ApiError(503, "服务器缺少 PyMySQL，暂时不能连接 MySQL")
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "caishenye_app"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "caishenye"),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


def parse_amount(value):
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value)).quantize(Decimal("0.01"))
    normalized = re.sub(r"[^\d.\-]", "", str(value).replace(",", ""))
    if normalized in ("", "-", ".", "-."):
        return Decimal("0")
    return Decimal(normalized).quantize(Decimal("0.01"))


def parse_month(value):
    text = str(value or "").strip()
    match = re.search(r"(\d{4})[-/.年](\d{1,2})", text)
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}"
    return date.today().strftime("%Y-%m")


def parse_day(value, fallback=None):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float, Decimal)) and 20000 <= float(value) <= 80000:
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    text = str(value or "").strip()
    if not text:
        return fallback or date.today()
    if re.fullmatch(r"\d+(\.\d+)?", text):
        number = float(text)
        if 20000 <= number <= 80000:
            return (datetime(1899, 12, 30) + timedelta(days=number)).date()
    text = text.replace("年", "-").replace("月", "-").replace("日", "")
    match = re.fullmatch(r"(\d{1,2})-(\d{1,2})", text)
    if match:
        selected_year = (fallback or date.today()).year
        return date(selected_year, int(match.group(1)), int(match.group(2)))
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m", "%Y/%m"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.date()
        except ValueError:
            pass
    return fallback or date.today()


def month_bounds(period):
    month = parse_month(period)
    start = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
    if start.month == 12:
        next_month = date(start.year + 1, 1, 1)
    else:
        next_month = date(start.year, start.month + 1, 1)
    return month, start, next_month - timedelta(days=1)


def account_type_for(bank_name, account_name):
    text = f"{bank_name} {account_name}"
    if "支付宝" in text:
        return "alipay"
    if "微信" in text:
        return "wechat"
    if "证券" in text:
        return "securities"
    if "现金" in text:
        return "cash"
    return "bank"


def property_type(value):
    text = str(value or "")
    if "房租" in text or "租金" in text:
        return "rent"
    if "水" in text or "电" in text:
        return "utilities"
    if "停车" in text:
        return "parking"
    if "维修" in text or "修理" in text:
        return "repair"
    if "物业" in text:
        return "property_management"
    return "other"


def fetch_one(cur, sql, args):
    cur.execute(sql, args)
    return cur.fetchone()


def ensure_company(cur, code, name, update_name=True):
    code = str(code or "").strip()
    name = str(name or code).strip()
    if not code:
        if name:
            row = fetch_one(
                cur,
                "SELECT id, company_code, company_name FROM companies WHERE company_name = %s AND status = 'active' LIMIT 1",
                (name,),
            )
            if row:
                return row
            row = fetch_one(
                cur,
                "SELECT id, company_code, company_name FROM companies WHERE company_name LIKE %s AND status = 'active' ORDER BY id LIMIT 1",
                (f"%{name}%",),
            )
            if row:
                return row
        code = next_company_code(cur)
        name = name or code
    elif code.startswith("AUTO") and name:
        row = fetch_one(
            cur,
            "SELECT id, company_code, company_name FROM companies WHERE company_name = %s AND status = 'active' LIMIT 1",
            (name,),
        )
        if row:
            return row
        row = fetch_one(
            cur,
            "SELECT id, company_code, company_name FROM companies WHERE company_name LIKE %s AND status = 'active' ORDER BY id LIMIT 1",
            (f"%{name}%",),
        )
        if row:
            return row
    if update_name:
        cur.execute(
            """
            INSERT INTO companies (company_code, company_name, remark)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), status = 'active'
            """,
            (code, name, "系统自动创建"),
        )
    else:
        cur.execute(
            """
            INSERT INTO companies (company_code, company_name, remark)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE status = 'active'
            """,
            (code, name, "系统初始化创建"),
        )
    row = fetch_one(cur, "SELECT id, company_code, company_name FROM companies WHERE company_code = %s", (code,))
    if not row:
        raise ApiError(500, f"公司不存在：{code}")
    return row


def ensure_account(cur, company_id, bank_name, account_name, account_key=None, opening_balance=0):
    bank_name = str(bank_name or "默认银行").strip()
    account_name = str(account_name or "默认账户").strip()
    account_key = str(account_key or "").strip() or None
    row = None
    if account_key:
        row = fetch_one(
            cur,
            "SELECT id, bank_name, account_name FROM bank_accounts WHERE company_id = %s AND account_no = %s LIMIT 1",
            (company_id, account_key),
        )
    if not row:
        row = fetch_one(
            cur,
            """
            SELECT id, bank_name, account_name
            FROM bank_accounts
            WHERE company_id = %s AND bank_name = %s AND account_name = %s
            LIMIT 1
            """,
            (company_id, bank_name, account_name),
        )
    if row:
        return row
    cur.execute(
        """
        INSERT INTO bank_accounts
          (company_id, account_name, bank_name, account_no, account_type, opening_balance)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            company_id,
            account_name,
            bank_name,
            account_key,
            account_type_for(bank_name, account_name),
            opening_balance,
        ),
    )
    return {
        "id": cur.lastrowid,
        "bank_name": bank_name,
        "account_name": account_name,
    }


def find_company(cur, code, name):
    code = str(code or "").strip()
    name = str(name or "").strip()
    if code:
        row = fetch_one(
            cur,
            "SELECT id, company_code, company_name FROM companies WHERE company_code = %s AND status = 'active' LIMIT 1",
            (code,),
        )
        if row:
            return row
    if name:
        row = fetch_one(
            cur,
            "SELECT id, company_code, company_name FROM companies WHERE company_name = %s AND status = 'active' LIMIT 1",
            (name,),
        )
        if row:
            return row
        row = fetch_one(
            cur,
            "SELECT id, company_code, company_name FROM companies WHERE company_name LIKE %s AND status = 'active' ORDER BY id LIMIT 1",
            (f"%{name}%",),
        )
        if row:
            return row
    raise ApiError(404, "公司不存在，不能删除资金记录")


def find_bank_account(cur, company_id, account_payload):
    account_key = str(account_payload.get("key") or "").strip()
    bank_name = str(account_payload.get("bank") or "").strip()
    account_name = str(account_payload.get("accountName") or "").strip()
    if account_key:
        row = fetch_one(
            cur,
            "SELECT id, bank_name, account_name FROM bank_accounts WHERE company_id = %s AND account_no = %s AND status = 'active' LIMIT 1",
            (company_id, account_key),
        )
        if row:
            return row
    if bank_name or account_name:
        row = fetch_one(
            cur,
            """
            SELECT id, bank_name, account_name
            FROM bank_accounts
            WHERE company_id = %s
              AND bank_name = %s
              AND account_name = %s
              AND status = 'active'
            LIMIT 1
            """,
            (company_id, bank_name or "默认银行", account_name or "基本户"),
        )
        if row:
            return row
    raise ApiError(404, "银行账户不存在，不能删除资金记录")


def default_account(cur, company):
    row = fetch_one(
        cur,
        """
        SELECT id, bank_name, account_name
        FROM bank_accounts
        WHERE company_id = %s AND status = 'active'
        ORDER BY id
        LIMIT 1
        """,
        (company["id"],),
    )
    if row:
        return row
    return ensure_account(cur, company["id"], "默认银行", "基本户")


def ensure_seed_data():
    if pymysql is None:
        return
    try:
        conn = get_db()
    except Exception as exc:
        print(f"[startup] MySQL unavailable: {exc}")
        return
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM companies WHERE status = 'active'")
            if int((cur.fetchone() or {}).get("total") or 0) > 0:
                return
            for seed in SEED_COMPANIES:
                company = ensure_company(cur, seed["code"], seed["name"], update_name=False)
                for key, bank, account, account_type, balance in seed["accounts"]:
                    account_row = ensure_account(cur, company["id"], bank, account, key, balance)
                    cur.execute(
                        """
                        UPDATE bank_accounts
                        SET bank_name = %s,
                            account_name = %s,
                            account_type = %s,
                            opening_balance = %s,
                            status = 'active'
                        WHERE id = %s
                        """,
                        (bank, account, account_type, balance, account_row["id"]),
                    )
        conn.commit()


def load_overview(period_value=""):
    period, start_day, end_day = month_bounds(period_value or date.today().strftime("%Y-%m"))
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  c.company_code,
                  c.company_name,
                  COALESCE(p.revenue, 0) AS income,
                  COALESCE(p.revenue - p.net_profit, 0) + COALESCE(payroll.total_company_cost, 0) AS expense
                FROM companies c
                LEFT JOIN profit_monthly p
                  ON p.company_id = c.id AND p.period_month = %s
                LEFT JOIN (
                  SELECT
                    r.company_id,
                    SUM(r.total_company_cost) AS total_company_cost
                  FROM payroll_records r
                  JOIN payroll_import_batches b ON b.id = r.batch_id
                  JOIN (
                    SELECT company_id, MAX(id) AS batch_id
                    FROM payroll_import_batches
                    WHERE period_month = %s AND status = 'confirmed'
                    GROUP BY company_id
                  ) latest ON latest.batch_id = b.id
                  WHERE r.period_month = %s
                  GROUP BY r.company_id
                ) payroll ON payroll.company_id = c.id
                WHERE c.status = 'active'
                ORDER BY c.id
                """,
                (period, period, period),
            )
            rows = cur.fetchall()
    companies = []
    total_income = Decimal("0")
    total_expense = Decimal("0")
    profitable = 0
    for row in rows:
        income = row["income"] or Decimal("0")
        expense = row["expense"] or Decimal("0")
        net = income - expense
        total_income += income
        total_expense += expense
        if net > 0:
            profitable += 1
        companies.append(
            {
                "code": row["company_code"],
                "name": row["company_name"],
                "income": income,
                "expense": expense,
                "net": net,
                "status": "盈利" if net > 0 else ("亏损" if net < 0 else "平稳"),
            }
        )
    return {
        "period": period,
        "startDate": start_day.isoformat(),
        "endDate": end_day.isoformat(),
        "income": total_income,
        "expense": total_expense,
        "net": total_income - total_expense,
        "profitableCompanies": profitable,
        "companies": companies,
    }


def load_companies(as_of_value=""):
    as_of = parse_day(as_of_value, None) if as_of_value else None
    with get_db() as conn:
        with conn.cursor() as cur:
            if as_of is None:
                cur.execute(
                    """
                    SELECT MAX(s.snapshot_date) AS latest_date
                    FROM capital_snapshots s
                    JOIN companies c ON c.id = s.company_id AND c.status = 'active'
                    JOIN bank_accounts a ON a.id = s.account_id AND a.status = 'active'
                    """
                )
                as_of = (cur.fetchone() or {}).get("latest_date") or date.today()
            period, start_day, end_day = month_bounds(as_of.strftime("%Y-%m"))
            cur.execute(
                """
                SELECT
                  c.id,
                  c.company_code,
                  c.company_name,
                  COALESCE(balance.total_balance, 0) AS funds
                FROM companies c
                LEFT JOIN (
                  SELECT
                    a.company_id,
                    SUM(COALESCE(snapshot.balance, a.opening_balance + COALESCE(txn.net_amount, 0))) AS total_balance
                  FROM bank_accounts a
                  LEFT JOIN (
                    SELECT
                      account_id,
                      SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) AS net_amount
                    FROM cash_transactions
                    WHERE txn_date <= %s
                    GROUP BY account_id
                  ) txn ON txn.account_id = a.id
                  LEFT JOIN (
                    SELECT s.account_id, s.balance
                    FROM capital_snapshots s
                    JOIN (
                      SELECT account_id, MAX(snapshot_date) AS snapshot_date
                      FROM capital_snapshots
                      WHERE snapshot_date <= %s
                      GROUP BY account_id
                    ) latest
                      ON latest.account_id = s.account_id
                     AND latest.snapshot_date = s.snapshot_date
                  ) snapshot ON snapshot.account_id = a.id
                  WHERE a.status = 'active'
                  GROUP BY a.company_id
                ) balance ON balance.company_id = c.id
                WHERE c.status = 'active'
                ORDER BY c.id
                """
                ,
                (as_of, as_of),
            )
            company_rows = cur.fetchall()
            cur.execute(
                """
                SELECT
                  a.id AS account_id,
                  a.company_id,
                  a.account_no,
                  a.bank_name,
                  a.account_name,
                  COALESCE(snapshot.balance, a.opening_balance + COALESCE(txn.net_amount, 0)) AS balance
                FROM bank_accounts a
                LEFT JOIN (
                  SELECT
                    account_id,
                    SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) AS net_amount
                  FROM cash_transactions
                  WHERE txn_date <= %s
                  GROUP BY account_id
                ) txn ON txn.account_id = a.id
                LEFT JOIN (
                  SELECT s.account_id, s.balance
                  FROM capital_snapshots s
                  JOIN (
                    SELECT account_id, MAX(snapshot_date) AS snapshot_date
                    FROM capital_snapshots
                    WHERE snapshot_date <= %s
                    GROUP BY account_id
                  ) latest
                    ON latest.account_id = s.account_id
                   AND latest.snapshot_date = s.snapshot_date
                ) snapshot ON snapshot.account_id = a.id
                WHERE a.status = 'active'
                ORDER BY a.company_id, a.id
                """
                ,
                (as_of, as_of),
            )
            account_rows = cur.fetchall()
            cur.execute(
                """
                SELECT
                  COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS income,
                  COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS expense
                FROM cash_transactions
                WHERE txn_date BETWEEN %s AND %s
                """,
                (start_day, end_day),
            )
            monthly = cur.fetchone() or {}

    accounts_by_company = {}
    for row in account_rows:
        accounts_by_company.setdefault(row["company_id"], []).append(
            {
                "id": row["account_no"] or f"account-{row['account_id']}",
                "bank": row["bank_name"],
                "accountName": row["account_name"],
                "balance": row["balance"] or Decimal("0"),
            }
        )
    return {
        "asOf": as_of.isoformat(),
        "monthlyIncome": monthly.get("income") or Decimal("0"),
        "monthlyExpense": monthly.get("expense") or Decimal("0"),
        "companies": [
            {
                "code": row["company_code"],
                "name": row["company_name"],
                "funds": row["funds"] or Decimal("0"),
                "bankAccounts": accounts_by_company.get(row["id"], []),
            }
            for row in company_rows
        ]
    }


def next_company_code(cur):
    cur.execute("SELECT COUNT(*) AS total FROM companies")
    total = int((cur.fetchone() or {}).get("total") or 0) + 1
    while True:
        code = f"C{total:03d}"
        cur.execute("SELECT id FROM companies WHERE company_code = %s", (code,))
        if not cur.fetchone():
            return code
        total += 1


def save_company(payload):
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ApiError(400, "公司名称不能为空")
    code = str(payload.get("code") or "").strip()
    with get_db() as conn:
        with conn.cursor() as cur:
            if not code:
                code = next_company_code(cur)
            ensure_company(cur, code, name)
        conn.commit()
    return load_companies()


def delete_company(payload):
    code = str(payload.get("code") or "").strip()
    if not code:
        raise ApiError(400, "公司编号不能为空")
    with get_db() as conn:
        with conn.cursor() as cur:
            company = fetch_one(
                cur,
                "SELECT id, company_name FROM companies WHERE company_code = %s AND status = 'active' LIMIT 1",
                (code,),
            )
            if not company:
                raise ApiError(404, "公司不存在或已删除")
            cur.execute("SELECT COUNT(*) AS total FROM companies WHERE status = 'active'")
            active_total = int((cur.fetchone() or {}).get("total") or 0)
            if active_total <= 1:
                raise ApiError(400, "至少需要保留一家公司")
            cur.execute("UPDATE companies SET status = 'inactive' WHERE id = %s", (company["id"],))
        conn.commit()
    return load_companies()


def profit_payload_from_row(row):
    revenue = row.get("revenue") or Decimal("0")
    net_profit = row.get("net_profit") or Decimal("0")
    expense = revenue - net_profit
    margin = None
    if revenue:
        margin = (net_profit / revenue * Decimal("100")).quantize(Decimal("0.01"))
    return {
        "code": row["company_code"],
        "name": row["company_name"],
        "revenue": revenue,
        "expense": expense,
        "netProfit": net_profit,
        "margin": margin,
        "remark": row.get("remark") or "",
        "updatedAt": row.get("updated_at"),
    }


def load_profit_summary(period_value):
    period, _, _ = month_bounds(period_value)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  c.company_code,
                  c.company_name,
                  COALESCE(p.revenue, 0) AS revenue,
                  COALESCE(p.net_profit, 0) AS net_profit,
                  p.remark,
                  p.updated_at
                FROM companies c
                LEFT JOIN profit_monthly p
                  ON p.company_id = c.id AND p.period_month = %s
                WHERE c.status = 'active'
                ORDER BY c.id
                """,
                (period,),
            )
            rows = cur.fetchall()
    companies = [profit_payload_from_row(row) for row in rows]
    total_revenue = sum((item["revenue"] for item in companies), Decimal("0"))
    total_net = sum((item["netProfit"] for item in companies), Decimal("0"))
    total_expense = sum((item["expense"] for item in companies), Decimal("0"))
    positive_count = sum(1 for item in companies if item["netProfit"] > 0)
    return {
        "period": period,
        "revenue": total_revenue,
        "expense": total_expense,
        "netProfit": total_net,
        "positiveCompanyCount": positive_count,
        "companies": companies,
    }


def save_profit_monthly(payload):
    company_payload = payload.get("company") or {}
    period, _, _ = month_bounds(payload.get("period"))
    has_revenue = str(payload.get("revenue") or "").strip() != ""
    has_cost = str(payload.get("cost") or "").strip() != ""
    has_net = str(payload.get("netProfit") or "").strip() != ""
    revenue = parse_amount(payload.get("revenue"))
    cost = parse_amount(payload.get("cost"))
    net_profit = parse_amount(payload.get("netProfit"))
    if not has_revenue and not has_cost and has_net:
        if net_profit >= 0:
            revenue = net_profit
            cost = Decimal("0")
        else:
            revenue = Decimal("0")
            cost = abs(net_profit)
    elif has_revenue and not has_cost and has_net:
        cost = revenue - net_profit
    elif not has_revenue and has_cost and has_net:
        revenue = cost + net_profit
    elif not has_revenue and not has_cost and not has_net:
        raise ApiError(400, "请填写本月利润")
    remark = str(payload.get("remark") or "").strip() or None
    with get_db() as conn:
        with conn.cursor() as cur:
            company = find_company(cur, company_payload.get("code"), company_payload.get("name"))
            cur.execute(
                """
                INSERT INTO profit_monthly (
                  company_id, period_month, revenue, cost,
                  selling_expense, admin_expense, finance_expense, tax_expense,
                  other_income, other_expense, remark
                )
                VALUES (%s, %s, %s, %s, 0, 0, 0, 0, 0, 0, %s)
                ON DUPLICATE KEY UPDATE
                  revenue = VALUES(revenue),
                  cost = VALUES(cost),
                  selling_expense = 0,
                  admin_expense = 0,
                  finance_expense = 0,
                  tax_expense = 0,
                  other_income = 0,
                  other_expense = 0,
                  remark = VALUES(remark)
                """,
                (company["id"], period, revenue, cost, remark),
            )
        conn.commit()
    return load_profit_summary(period)


def load_payroll_summary(period_value):
    period, _, _ = month_bounds(period_value)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  c.company_code,
                  c.company_name,
                  COALESCE(p.employee_count, 0) AS employee_count,
                  COALESCE(p.net_salary, 0) AS net_salary,
                  COALESCE(p.individual_income_tax, 0) AS individual_income_tax,
                  COALESCE(p.social_security, 0) AS social_security,
                  COALESCE(p.housing_fund, 0) AS housing_fund,
                  COALESCE(p.total_company_cost, 0) AS total_company_cost
                FROM companies c
                LEFT JOIN (
                  SELECT
                    r.company_id,
                    COUNT(*) AS employee_count,
                    SUM(r.net_salary) AS net_salary,
                    SUM(r.individual_income_tax) AS individual_income_tax,
                    SUM(r.employee_social_security + r.employer_social_security) AS social_security,
                    SUM(r.employee_housing_fund + r.employer_housing_fund) AS housing_fund,
                    SUM(r.total_company_cost) AS total_company_cost
                  FROM payroll_records r
                  JOIN payroll_import_batches b ON b.id = r.batch_id
                  JOIN (
                    SELECT company_id, MAX(id) AS batch_id
                    FROM payroll_import_batches
                    WHERE period_month = %s AND status = 'confirmed'
                    GROUP BY company_id
                  ) latest ON latest.batch_id = b.id
                  WHERE r.period_month = %s
                  GROUP BY r.company_id
                ) p ON p.company_id = c.id
                WHERE c.status = 'active'
                ORDER BY c.id
                """,
                (period, period),
            )
            rows = cur.fetchall()

    totals = {
        "employeeCount": 0,
        "netSalary": Decimal("0"),
        "tax": Decimal("0"),
        "social": Decimal("0"),
        "fund": Decimal("0"),
        "companyCost": Decimal("0"),
    }
    companies = []
    for row in rows:
        employee_count = int(row["employee_count"] or 0)
        net_salary = row["net_salary"] or Decimal("0")
        tax = row["individual_income_tax"] or Decimal("0")
        social = row["social_security"] or Decimal("0")
        fund = row["housing_fund"] or Decimal("0")
        company_cost = row["total_company_cost"] or Decimal("0")
        totals["employeeCount"] += employee_count
        totals["netSalary"] += net_salary
        totals["tax"] += tax
        totals["social"] += social
        totals["fund"] += fund
        totals["companyCost"] += company_cost
        companies.append(
            {
                "code": row["company_code"],
                "name": row["company_name"],
                "employeeCount": employee_count,
                "netSalary": net_salary,
                "tax": tax,
                "social": social,
                "fund": fund,
                "companyCost": company_cost,
            }
        )
    return {"period": period, "companies": companies, **totals}


def load_payroll_salary_details(period_value, company_code=""):
    period, _, _ = month_bounds(period_value)
    active_params = [period, period]
    company_filter = ""
    if company_code:
        company_filter = " AND c.company_code = %s"
        active_params.append(company_code)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  c.company_code,
                  c.company_name,
                  b.id AS batch_id,
                  b.period_month,
                  b.file_name,
                  b.file_hash,
                  b.imported_by,
                  b.imported_at,
                  b.created_at,
                  b.updated_at,
                  b.remark,
                  COUNT(r.id) AS employee_count,
                  COALESCE(SUM(r.net_salary), 0) AS net_salary,
                  COALESCE(SUM(r.individual_income_tax), 0) AS individual_income_tax,
                  COALESCE(SUM(r.employee_social_security + r.employer_social_security), 0) AS social_security,
                  COALESCE(SUM(r.employee_housing_fund + r.employer_housing_fund), 0) AS housing_fund,
                  COALESCE(SUM(r.total_company_cost), 0) AS total_company_cost,
                  t.booked_date
                FROM payroll_import_batches b
                JOIN companies c ON c.id = b.company_id
                JOIN (
                  SELECT company_id, MAX(id) AS batch_id
                  FROM payroll_import_batches
                  WHERE period_month = %s AND status = 'confirmed'
                  GROUP BY company_id
                ) latest ON latest.batch_id = b.id
                LEFT JOIN payroll_records r ON r.batch_id = b.id
                LEFT JOIN (
                  SELECT
                    company_id,
                    SUBSTRING_INDEX(source_doc_no, '-', 2) AS import_no,
                    MIN(txn_date) AS booked_date
                  FROM cash_transactions
                  WHERE source_doc_no LIKE 'PAYROLL-%%'
                  GROUP BY company_id, SUBSTRING_INDEX(source_doc_no, '-', 2)
                ) t ON t.company_id = b.company_id AND t.import_no = b.file_hash
                WHERE b.period_month = %s AND b.status = 'confirmed'{company_filter}
                GROUP BY
                  c.company_code, c.company_name, b.id, b.period_month, b.file_name, b.file_hash,
                  b.imported_by, b.imported_at, b.created_at, b.updated_at, b.remark, t.booked_date
                ORDER BY c.id, b.id
                """,
                active_params,
            )
            rows = cur.fetchall()
            history_params = [period]
            if company_code:
                history_params.append(company_code)
            cur.execute(
                f"""
                SELECT
                  c.company_code,
                  c.company_name,
                  b.id AS batch_id,
                  b.period_month,
                  b.file_name,
                  b.file_hash,
                  b.imported_by,
                  b.imported_at,
                  b.created_at,
                  b.updated_at,
                  b.status,
                  b.remark,
                  COUNT(r.id) AS employee_count,
                  COALESCE(SUM(r.net_salary), 0) AS net_salary,
                  COALESCE(SUM(r.individual_income_tax), 0) AS individual_income_tax,
                  COALESCE(SUM(r.employee_social_security + r.employer_social_security), 0) AS social_security,
                  COALESCE(SUM(r.employee_housing_fund + r.employer_housing_fund), 0) AS housing_fund,
                  COALESCE(SUM(r.total_company_cost), 0) AS total_company_cost,
                  t.booked_date
                FROM payroll_import_batches b
                JOIN companies c ON c.id = b.company_id
                LEFT JOIN payroll_records r ON r.batch_id = b.id
                LEFT JOIN (
                  SELECT
                    company_id,
                    SUBSTRING_INDEX(source_doc_no, '-', 2) AS import_no,
                    MIN(txn_date) AS booked_date
                  FROM cash_transactions
                  WHERE source_doc_no LIKE 'PAYROLL-%%'
                  GROUP BY company_id, SUBSTRING_INDEX(source_doc_no, '-', 2)
                ) t ON t.company_id = b.company_id AND t.import_no = b.file_hash
                WHERE b.period_month = %s{company_filter}
                GROUP BY
                  c.company_code, c.company_name, b.id, b.period_month, b.file_name, b.file_hash,
                  b.imported_by, b.imported_at, b.created_at, b.updated_at, b.status, b.remark, t.booked_date
                ORDER BY c.id, b.id DESC
                """,
                history_params,
            )
            history_rows = cur.fetchall()

    totals = {
        "batchCount": 0,
        "employeeCount": 0,
        "netSalary": Decimal("0"),
        "tax": Decimal("0"),
        "social": Decimal("0"),
        "fund": Decimal("0"),
        "companyCost": Decimal("0"),
    }
    batches = []
    active_batch_ids = set()

    def payroll_batch_payload(row, is_active=False):
        employee_count = int(row["employee_count"] or 0)
        employee_social = row.get("social_security") or Decimal("0")
        employee_fund = row.get("housing_fund") or Decimal("0")
        return {
            "companyCode": row["company_code"],
            "companyName": row["company_name"],
            "batchId": row["batch_id"],
            "period": row["period_month"],
            "fileName": row["file_name"],
            "importNo": row["file_hash"],
            "importedBy": row["imported_by"],
            "importedAt": row["imported_at"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "bookedDate": row["booked_date"],
            "status": row.get("status") or "confirmed",
            "isActive": bool(is_active),
            "remark": row["remark"],
            "employeeCount": employee_count,
            "netSalary": row["net_salary"] or Decimal("0"),
            "tax": row["individual_income_tax"] or Decimal("0"),
            "social": employee_social,
            "fund": employee_fund,
            "companyCost": row["total_company_cost"] or Decimal("0"),
        }

    for row in rows:
        active_batch_ids.add(row["batch_id"])
        batch = payroll_batch_payload(row, True)
        employee_count = batch["employeeCount"]
        net_salary = batch["netSalary"]
        tax = batch["tax"]
        social = batch["social"]
        fund = batch["fund"]
        company_cost = batch["companyCost"]
        totals["batchCount"] += 1
        totals["employeeCount"] += employee_count
        totals["netSalary"] += net_salary
        totals["tax"] += tax
        totals["social"] += social
        totals["fund"] += fund
        totals["companyCost"] += company_cost
        batches.append(batch)

    history = []
    company_audit = {}
    for row in history_rows:
        is_active = row["batch_id"] in active_batch_ids
        item = payroll_batch_payload(row, is_active)
        history.append(item)
        audit = company_audit.setdefault(
            item["companyCode"],
            {
                "companyCode": item["companyCode"],
                "companyName": item["companyName"],
                "recordCount": 0,
                "activeCount": 0,
                "confirmedCount": 0,
                "voidedCount": 0,
            },
        )
        audit["recordCount"] += 1
        if item["isActive"]:
            audit["activeCount"] += 1
        if item["status"] == "confirmed":
            audit["confirmedCount"] += 1
        if item["status"] == "voided":
            audit["voidedCount"] += 1

    repeated_companies = sum(1 for item in company_audit.values() if item["recordCount"] > 1)
    duplicate_risk = any(
        item["activeCount"] > 1 or item["confirmedCount"] > item["activeCount"]
        for item in company_audit.values()
    )
    audit = {
        "recordCount": len(history),
        "activeBatchCount": len(batches),
        "voidedBatchCount": sum(1 for item in history if item["status"] == "voided"),
        "repeatedCompanyCount": repeated_companies,
        "duplicateRisk": duplicate_risk,
        "companies": list(company_audit.values()),
    }
    return {"period": period, "batches": batches, "history": history, "audit": audit, **totals}


def load_payroll_employees(period_value, company_code=""):
    period, _, _ = month_bounds(period_value)
    params = [period, period]
    company_filter = ""
    if company_code:
        company_filter = " AND c.company_code = %s"
        params.append(company_code)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  c.company_code,
                  c.company_name,
                  r.employee_no_raw,
                  r.employee_name_raw,
                  r.gross_salary,
                  r.net_salary,
                  r.individual_income_tax,
                  r.employee_social_security,
                  r.employer_social_security,
                  r.employee_housing_fund,
                  r.employer_housing_fund,
                  r.total_company_cost,
                  r.source_row_no
                FROM payroll_records r
                JOIN payroll_import_batches b ON b.id = r.batch_id
                JOIN companies c ON c.id = r.company_id
                JOIN (
                  SELECT company_id, MAX(id) AS batch_id
                  FROM payroll_import_batches
                  WHERE period_month = %s AND status = 'confirmed'
                  GROUP BY company_id
                ) latest ON latest.batch_id = b.id
                WHERE r.period_month = %s{company_filter}
                ORDER BY c.id, r.source_row_no, r.id
                """,
                params,
            )
            rows = cur.fetchall()

    employees = []
    totals = {
        "employeeCount": 0,
        "netSalary": Decimal("0"),
        "tax": Decimal("0"),
        "social": Decimal("0"),
        "fund": Decimal("0"),
        "companyCost": Decimal("0"),
    }
    for row in rows:
        employee_social = row["employee_social_security"] or Decimal("0")
        employer_social = row["employer_social_security"] or Decimal("0")
        employee_fund = row["employee_housing_fund"] or Decimal("0")
        employer_fund = row["employer_housing_fund"] or Decimal("0")
        net_salary = row["net_salary"] or Decimal("0")
        tax = row["individual_income_tax"] or Decimal("0")
        company_cost = row["total_company_cost"] or Decimal("0")
        fund_total = employee_fund + employer_fund
        social_total = employee_social + employer_social
        totals["employeeCount"] += 1
        totals["netSalary"] += net_salary
        totals["tax"] += tax
        totals["social"] += social_total
        totals["fund"] += fund_total
        totals["companyCost"] += company_cost
        employees.append(
            {
                "companyCode": row["company_code"],
                "companyName": row["company_name"],
                "employeeNo": row["employee_no_raw"],
                "employeeName": row["employee_name_raw"],
                "grossSalary": row["gross_salary"] or Decimal("0"),
                "netSalary": net_salary,
                "tax": tax,
                "employeeSocial": employee_social,
                "employerSocial": employer_social,
                "socialTotal": social_total,
                "employeeFund": employee_fund,
                "employerFund": employer_fund,
                "fundTotal": fund_total,
                "companyCost": company_cost,
                "sourceRowNo": row["source_row_no"],
            }
        )
    return {"period": period, "employees": employees, **totals}


def delete_payroll_batches(payload):
    raw_ids = payload.get("batchIds") or []
    batch_ids = []
    for raw_id in raw_ids:
        try:
            batch_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if batch_id > 0:
            batch_ids.append(batch_id)
    batch_ids = sorted(set(batch_ids))
    if not batch_ids:
        raise ApiError(400, "请选择要删除的工资记录")

    placeholders = ", ".join(["%s"] * len(batch_ids))
    deleted = 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, company_id, period_month, file_hash
                FROM payroll_import_batches
                WHERE id IN ({placeholders})
                """,
                batch_ids,
            )
            rows = cur.fetchall()
            for row in rows:
                import_no = row.get("file_hash")
                if import_no:
                    cur.execute(
                        """
                        DELETE FROM cash_transactions
                        WHERE company_id = %s AND source_doc_no LIKE %s
                        """,
                        (row["company_id"], f"{import_no}-%"),
                    )
                cur.execute(
                    """
                    UPDATE payroll_import_batches
                    SET status = 'voided', remark = %s
                    WHERE id = %s
                    """,
                    (f"{row['period_month']} 页面删除，不再计入汇总", row["id"]),
                )
                deleted += 1
        conn.commit()
    return {"deleted": deleted, "batchIds": batch_ids}


def insert_cash(cur, company_id, account_id, txn_date, direction, category, amount, counterparty="", description="", doc_no=None):
    amount = parse_amount(amount)
    if amount <= 0:
        return 0
    cur.execute(
        """
        INSERT INTO cash_transactions
          (company_id, account_id, txn_date, direction, category, counterparty, amount, description, source_doc_no)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (company_id, account_id, txn_date, direction, category, counterparty or None, amount, description or None, doc_no),
    )
    return 1


def import_capital(payload):
    rows = payload.get("rows") or []
    if not rows:
        raise ApiError(400, "没有读取到资金表数据")
    company_payload = payload.get("company") or {}
    account_payload = payload.get("account") or {}
    import_no = f"CAPITAL-{uuid.uuid4().hex[:12]}"
    inserted = 0
    total_in = Decimal("0")
    total_out = Decimal("0")
    with get_db() as conn:
        with conn.cursor() as cur:
            company_cache = {}
            account_cache = {}

            def row_company(row):
                code = row.get("companyCode") or company_payload.get("code")
                name = row.get("company") or company_payload.get("name")
                cache_key = f"{code or ''}|{name or ''}"
                if cache_key not in company_cache:
                    company_cache[cache_key] = ensure_company(cur, code, name)
                return company_cache[cache_key]

            def row_account(row, company):
                bank = row.get("bank") or account_payload.get("bank")
                account_name = row.get("account") or account_payload.get("accountName")
                account_key = row.get("accountKey") or account_payload.get("key")
                cache_key = f"{company['id']}|{bank or ''}|{account_name or ''}|{account_key or ''}"
                if cache_key not in account_cache:
                    account_cache[cache_key] = ensure_account(cur, company["id"], bank, account_name, account_key)
                return account_cache[cache_key]

            for index, row in enumerate(rows, start=1):
                company = row_company(row)
                account = row_account(row, company)
                txn_date = parse_day(row.get("date"))
                if row.get("mode") == "snapshot":
                    balance_raw = row.get("balance")
                    if balance_raw is None or str(balance_raw).strip() == "":
                        continue
                    balance = parse_amount(balance_raw)
                    cur.execute(
                        """
                        INSERT INTO capital_snapshots (company_id, account_id, snapshot_date, balance, remark)
                        VALUES (%s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE balance = VALUES(balance), remark = VALUES(remark)
                        """,
                        (company["id"], account["id"], txn_date, balance, f"导入：{import_no} {row.get('summary') or ''}".strip()),
                    )
                    inserted += 1
                    continue

                category = str(row.get("summary") or "银行流水").strip()
                counterparty = str(row.get("counterparty") or "").strip()
                description = str(row.get("summary") or "").strip()
                income = parse_amount(row.get("income"))
                expense = parse_amount(row.get("expense"))
                doc_no = f"{import_no}-{index}"
                inserted += insert_cash(cur, company["id"], account["id"], txn_date, "in", category, income, counterparty, description, doc_no)
                inserted += insert_cash(cur, company["id"], account["id"], txn_date, "out", category, expense, counterparty, description, doc_no)
                total_in += income
                total_out += expense
                balance_raw = row.get("balance")
                if balance_raw is not None and str(balance_raw).strip() != "":
                    balance = parse_amount(balance_raw)
                    cur.execute(
                        """
                        INSERT INTO capital_snapshots (company_id, account_id, snapshot_date, balance, remark)
                        VALUES (%s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE balance = VALUES(balance), remark = VALUES(remark)
                        """,
                        (company["id"], account["id"], txn_date, balance, f"导入：{import_no}"),
                    )
        conn.commit()
    return {"importNo": import_no, "inserted": inserted, "income": total_in, "expense": total_out, "net": total_in - total_out}


def delete_capital_account_records(payload):
    company_payload = payload.get("company") or {}
    account_payload = payload.get("account") or {}
    with get_db() as conn:
        with conn.cursor() as cur:
            company = find_company(cur, company_payload.get("code"), company_payload.get("name"))
            account = find_bank_account(cur, company["id"], account_payload)
            cur.execute(
                """
                DELETE FROM cash_transactions
                WHERE company_id = %s
                  AND account_id = %s
                  AND source_doc_no LIKE 'CAPITAL-%%'
                """,
                (company["id"], account["id"]),
            )
            deleted_transactions = cur.rowcount
            cur.execute(
                """
                DELETE FROM capital_snapshots
                WHERE company_id = %s
                  AND account_id = %s
                """,
                (company["id"], account["id"]),
            )
            deleted_snapshots = cur.rowcount
        conn.commit()
    return {
        "deleted": deleted_transactions + deleted_snapshots,
        "transactions": deleted_transactions,
        "snapshots": deleted_snapshots,
    }


def load_capital_account_changes(company_code, account_key, bank_name="", account_name=""):
    with get_db() as conn:
        with conn.cursor() as cur:
            company = find_company(cur, company_code, "")
            account = find_bank_account(
                cur,
                company["id"],
                {
                    "key": account_key,
                    "bank": bank_name,
                    "accountName": account_name,
                },
            )
            cur.execute(
                """
                SELECT id, bank_name, account_name, account_no, opening_balance
                FROM bank_accounts
                WHERE id = %s AND company_id = %s AND status = 'active'
                LIMIT 1
                """,
                (account["id"], company["id"]),
            )
            account_row = cur.fetchone()
            if not account_row:
                raise ApiError(404, "银行账户不存在")

            cur.execute(
                """
                SELECT snapshot_date, balance, remark, created_at, updated_at
                FROM capital_snapshots
                WHERE company_id = %s AND account_id = %s
                ORDER BY snapshot_date ASC, id ASC
                """,
                (company["id"], account["id"]),
            )
            snapshot_rows = cur.fetchall()
            cur.execute(
                """
                SELECT txn_date, direction, category, counterparty, amount, description, source_doc_no, created_at
                FROM cash_transactions
                WHERE company_id = %s AND account_id = %s
                ORDER BY txn_date DESC, id DESC
                LIMIT 80
                """,
                (company["id"], account["id"]),
            )
            transaction_rows = cur.fetchall()
            cur.execute(
                """
                SELECT
                  COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS income,
                  COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS expense
                FROM cash_transactions
                WHERE company_id = %s AND account_id = %s
                """,
                (company["id"], account["id"]),
            )
            totals = cur.fetchone() or {}

    snapshots = []
    previous_balance = None
    for row in snapshot_rows:
        balance = row["balance"] or Decimal("0")
        change = None if previous_balance is None else balance - previous_balance
        snapshots.append(
            {
                "date": row["snapshot_date"],
                "balance": balance,
                "change": change,
                "remark": row["remark"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
        )
        previous_balance = balance

    current_balance = snapshots[-1]["balance"] if snapshots else account_row["opening_balance"] or Decimal("0")
    previous_snapshot_balance = snapshots[-2]["balance"] if len(snapshots) > 1 else None
    latest_change = (current_balance - previous_snapshot_balance) if previous_snapshot_balance is not None else Decimal("0")
    transactions = [
        {
            "date": row["txn_date"],
            "direction": row["direction"],
            "category": row["category"],
            "counterparty": row["counterparty"],
            "amount": row["amount"] or Decimal("0"),
            "description": row["description"],
            "sourceDocNo": row["source_doc_no"],
            "createdAt": row["created_at"],
        }
        for row in transaction_rows
    ]
    return {
        "company": {
            "code": company["company_code"],
            "name": company["company_name"],
        },
        "account": {
            "id": account_row["account_no"] or f"account-{account_row['id']}",
            "bank": account_row["bank_name"],
            "accountName": account_row["account_name"],
            "openingBalance": account_row["opening_balance"] or Decimal("0"),
        },
        "summary": {
            "currentBalance": current_balance,
            "latestChange": latest_change,
            "snapshotCount": len(snapshots),
            "transactionCount": len(transactions),
            "income": totals.get("income") or Decimal("0"),
            "expense": totals.get("expense") or Decimal("0"),
        },
        "snapshots": snapshots,
        "transactions": transactions,
    }


def import_payroll(payload):
    rows = payload.get("rows") or []
    if not rows:
        raise ApiError(400, "没有读取到工资单数据")
    company_payload = payload.get("company") or {}
    period, _, end_day = month_bounds(payload.get("period"))
    file_name = str(payload.get("fileName") or "工资单导入.xlsx")
    sheet_name = str(payload.get("sheetName") or "").strip()
    payroll_remark = f"页面上传入库 · Sheet：{sheet_name}" if sheet_name else "页面上传入库"
    import_no = f"PAYROLL-{uuid.uuid4().hex[:12]}"
    payroll_cash_categories = ["工资发放", "个税缴纳", "社保缴纳", "公积金缴纳"]
    totals = {
        "net": Decimal("0"),
        "tax": Decimal("0"),
        "social": Decimal("0"),
        "fund": Decimal("0"),
        "companyCost": Decimal("0"),
    }
    with get_db() as conn:
        with conn.cursor() as cur:
            company = ensure_company(cur, company_payload.get("code"), company_payload.get("name"))
            account = default_account(cur, company)
            cur.execute(
                """
                SELECT id, file_hash
                FROM payroll_import_batches
                WHERE company_id = %s AND period_month = %s AND status <> 'voided'
                """,
                (company["id"], period),
            )
            old_batches = cur.fetchall()
            for old_batch in old_batches:
                old_import_no = old_batch.get("file_hash")
                if old_import_no:
                    cur.execute(
                        """
                        DELETE FROM cash_transactions
                        WHERE company_id = %s AND txn_date = %s AND source_doc_no LIKE %s
                        """,
                        (company["id"], end_day, f"{old_import_no}-%"),
                    )
            if old_batches:
                placeholders = ", ".join(["%s"] * len(payroll_cash_categories))
                cur.execute(
                    f"""
                    DELETE FROM cash_transactions
                    WHERE company_id = %s
                      AND txn_date = %s
                      AND direction = 'out'
                      AND category IN ({placeholders})
                      AND description LIKE %s
                    """,
                    (company["id"], end_day, *payroll_cash_categories, f"{period} %"),
                )
                cur.execute(
                    """
                    UPDATE payroll_import_batches
                    SET status = 'voided', remark = %s
                    WHERE company_id = %s AND period_month = %s AND status <> 'voided'
                    """,
                    (f"{period} 已由新工资单替换", company["id"], period),
                )
            cur.execute(
                """
                INSERT INTO payroll_import_batches
                  (company_id, period_month, file_name, file_hash, imported_by, status, remark)
                VALUES (%s, %s, %s, %s, %s, 'confirmed', %s)
                """,
                (company["id"], period, file_name, import_no, "web", payroll_remark),
            )
            batch_id = cur.lastrowid
            for index, row in enumerate(rows, start=1):
                employee_no = str(row.get("employeeNo") or "").strip()
                employee_name = str(row.get("name") or "").strip() or f"未命名员工{index}"
                employee_id = None
                if employee_no:
                    cur.execute(
                        """
                        INSERT INTO employees (company_id, employee_no, employee_name, status)
                        VALUES (%s, %s, %s, 'active')
                        ON DUPLICATE KEY UPDATE employee_name = VALUES(employee_name), status = 'active'
                        """,
                        (company["id"], employee_no, employee_name),
                    )
                    employee = fetch_one(
                        cur,
                        "SELECT id FROM employees WHERE company_id = %s AND employee_no = %s",
                        (company["id"], employee_no),
                    )
                    employee_id = employee["id"] if employee else None
                gross = parse_amount(row.get("gross"))
                net = parse_amount(row.get("net"))
                tax = parse_amount(row.get("tax"))
                employee_social = parse_amount(row.get("employeeSocial"))
                employer_social = parse_amount(row.get("employerSocial"))
                employee_fund = parse_amount(row.get("employeeFund"))
                employer_fund = parse_amount(row.get("employerFund"))
                totals["net"] += net
                totals["tax"] += tax
                totals["social"] += employee_social + employer_social
                totals["fund"] += employee_fund + employer_fund
                totals["companyCost"] += gross + employer_social + employer_fund
                cur.execute(
                    """
                    INSERT INTO payroll_records (
                      batch_id, company_id, employee_id, period_month, employee_no_raw, employee_name_raw,
                      gross_salary, employee_social_security, employee_housing_fund, individual_income_tax,
                      net_salary, employer_social_security, employer_housing_fund, source_row_no
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        batch_id,
                        company["id"],
                        employee_id,
                        period,
                        employee_no or None,
                        employee_name,
                        gross,
                        employee_social,
                        employee_fund,
                        tax,
                        net,
                        employer_social,
                        employer_fund,
                        index,
                    ),
                )
            cash_items = [
                (payroll_cash_categories[0], "员工工资", totals["net"]),
                (payroll_cash_categories[1], "税务局", totals["tax"]),
                (payroll_cash_categories[2], "社保机构", totals["social"]),
                (payroll_cash_categories[3], "公积金中心", totals["fund"]),
            ]
            for category, counterparty, amount in cash_items:
                insert_cash(
                    cur,
                    company["id"],
                    account["id"],
                    end_day,
                    "out",
                    category,
                    amount,
                    counterparty,
                    f"{period} {category}",
                    f"{import_no}-{category}",
                )
        conn.commit()
    return {"importNo": import_no, "rows": len(rows), "replacedBatches": len(old_batches), **totals}


def import_property(payload):
    rows = payload.get("rows") or []
    if not rows:
        raise ApiError(400, "没有读取到物业费用数据")
    company_payload = payload.get("company") or {}
    default_period = payload.get("period")
    import_no = f"PROPERTY-{uuid.uuid4().hex[:12]}"
    inserted = 0
    total = Decimal("0")
    with get_db() as conn:
        with conn.cursor() as cur:
            company = ensure_company(cur, company_payload.get("code"), company_payload.get("name"))
            account = default_account(cur, company)
            for index, row in enumerate(rows, start=1):
                period_text = row.get("period") or default_period
                period, start_day, end_day = month_bounds(period_text)
                expense_date = parse_day(row.get("date") or f"{period}-01", start_day)
                amount = parse_amount(row.get("amount"))
                if amount <= 0:
                    continue
                item_type = str(row.get("type") or "物业费").strip()
                vendor = str(row.get("vendor") or "").strip()
                property_name = str(row.get("property") or "未填写物业").strip()
                doc_no = f"{import_no}-{index}"
                cur.execute(
                    """
                    INSERT INTO property_expenses (
                      company_id, account_id, expense_date, fee_period_start, fee_period_end,
                      property_name, vendor_name, expense_type, amount, description, source_doc_no
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company["id"],
                        account["id"],
                        expense_date,
                        start_day,
                        end_day,
                        property_name,
                        vendor or None,
                        property_type(item_type),
                        amount,
                        item_type,
                        doc_no,
                    ),
                )
                inserted += 1
                total += amount
                insert_cash(
                    cur,
                    company["id"],
                    account["id"],
                    expense_date,
                    "out",
                    item_type,
                    amount,
                    vendor,
                    f"{property_name} {item_type}",
                    doc_no,
                )
        conn.commit()
    return {"importNo": import_no, "inserted": inserted, "amount": total}


def property_type_label(value):
    labels = {
        "rent": "房租",
        "property_management": "物业费",
        "utilities": "水电煤",
        "parking": "停车",
        "repair": "维修",
        "other": "其他",
    }
    return labels.get(str(value or ""), "其他")


def load_property_summary(period_value):
    period, start_day, end_day = month_bounds(period_value)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  c.company_code,
                  c.company_name,
                  p.expense_date,
                  p.fee_period_start,
                  p.property_name,
                  p.vendor_name,
                  p.expense_type,
                  p.amount,
                  p.description,
                  p.source_doc_no,
                  p.created_at
                FROM companies c
                LEFT JOIN property_expenses p
                  ON p.company_id = c.id
                 AND p.expense_date BETWEEN %s AND %s
                WHERE c.status = 'active'
                ORDER BY c.id, p.expense_date, p.id
                """,
                (start_day, end_day),
            )
            rows = cur.fetchall()

    companies = []
    by_code = {}
    total = Decimal("0")
    for row in rows:
        code = row["company_code"]
        if code not in by_code:
            by_code[code] = {
                "code": code,
                "name": row["company_name"],
                "total": Decimal("0"),
                "itemCount": 0,
                "expenses": [],
            }
            companies.append(by_code[code])
        if not row.get("expense_date"):
            continue
        amount = row["amount"] or Decimal("0")
        item_type = row.get("description") or property_type_label(row.get("expense_type"))
        expense = {
            "period": period,
            "date": row["expense_date"],
            "property": row["property_name"] or "未填写物业",
            "type": item_type,
            "vendor": row["vendor_name"] or "-",
            "amount": amount,
            "sourceDocNo": row["source_doc_no"],
            "createdAt": row["created_at"],
        }
        by_code[code]["expenses"].append(expense)
        by_code[code]["total"] += amount
        by_code[code]["itemCount"] += 1
        total += amount

    return {"period": period, "total": total, "companies": companies}


class Handler(SimpleHTTPRequestHandler):
    server_version = "CaishenyeHTTP/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY_BYTES:
            raise ApiError(413, "上传数据太大")
        body = self.rfile.read(length)
        if not body:
            return {}
        return json.loads(body.decode("utf-8"))

    def api(self, method, path):
        query = parse_qs(urlparse(self.path).query)
        if method == "GET" and path == "/api/health":
            return {"ok": True, "database": os.getenv("MYSQL_DATABASE", "caishenye")}
        if method == "GET" and path == "/api/overview":
            return load_overview((query.get("period") or [""])[0])
        if method == "GET" and path == "/api/companies":
            return load_companies((query.get("asOf") or [""])[0])
        if method == "GET" and path == "/api/payroll/summary":
            return load_payroll_summary((query.get("period") or [""])[0])
        if method == "GET" and path == "/api/profit/summary":
            return load_profit_summary((query.get("period") or [""])[0])
        if method == "GET" and path == "/api/payroll/salary-details":
            return load_payroll_salary_details((query.get("period") or [""])[0], (query.get("company") or [""])[0])
        if method == "GET" and path == "/api/payroll/employees":
            return load_payroll_employees((query.get("period") or [""])[0], (query.get("company") or [""])[0])
        if method == "GET" and path == "/api/capital/account-changes":
            return load_capital_account_changes(
                (query.get("company") or [""])[0],
                (query.get("account") or [""])[0],
                (query.get("bank") or [""])[0],
                (query.get("accountName") or [""])[0],
            )
        if method == "GET" and path == "/api/property/summary":
            return load_property_summary((query.get("period") or [""])[0])
        if method == "POST" and path == "/api/companies":
            return save_company(self.read_json())
        if method == "POST" and path == "/api/companies/delete":
            return delete_company(self.read_json())
        if method == "POST" and path == "/api/import/capital":
            return import_capital(self.read_json())
        if method == "POST" and path == "/api/capital/delete-account-records":
            return delete_capital_account_records(self.read_json())
        if method == "POST" and path == "/api/import/payroll":
            return import_payroll(self.read_json())
        if method == "POST" and path == "/api/profit/monthly":
            return save_profit_monthly(self.read_json())
        if method == "POST" and path == "/api/payroll/delete-batches":
            return delete_payroll_batches(self.read_json())
        if method == "POST" and path == "/api/import/property":
            return import_property(self.read_json())
        raise ApiError(404, "接口不存在")

    def handle_api(self, method):
        path = urlparse(self.path).path
        try:
            self.send_json(200, self.api(method, path))
        except ApiError as exc:
            self.send_json(exc.status, {"ok": False, "message": exc.message})
        except Exception as exc:
            print(f"[api] {method} {path}: {exc}")
            self.send_json(500, {"ok": False, "message": "服务器处理失败"})

    def do_GET(self):
        if urlparse(self.path).path.startswith("/api/"):
            self.handle_api("GET")
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path.startswith("/api/"):
            self.handle_api("POST")
            return
        self.send_error(404)


def main():
    ensure_seed_data()
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8001"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"财神爷服务已启动：http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
