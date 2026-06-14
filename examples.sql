USE caishenye;

-- 1. 新增公司
INSERT INTO companies (company_code, company_name, legal_person, tax_no, remark)
VALUES
  ('A001', '示例科技有限公司', '张三', '913000000000000001', '主营业务公司'),
  ('A002', '示例贸易有限公司', '李四', '913000000000000002', '贸易结算公司');

-- 2. 新增公司资金账户
INSERT INTO bank_accounts (company_id, account_name, bank_name, account_no, account_type, opening_balance)
SELECT id, '基本户', '招商银行', '6222000000000001', 'bank', 100000.00
FROM companies
WHERE company_code = 'A001';

INSERT INTO bank_accounts (company_id, account_name, bank_name, account_no, account_type, opening_balance)
SELECT id, '基本户', '工商银行', '6222000000000002', 'bank', 50000.00
FROM companies
WHERE company_code = 'A002';

-- 3. 新增员工
INSERT INTO employees (company_id, employee_no, employee_name, department, position_name, hire_date)
SELECT id, 'E001', '王五', '运营部', '运营专员', '2026-01-01'
FROM companies
WHERE company_code = 'A001';

INSERT INTO employees (company_id, employee_no, employee_name, department, position_name, hire_date)
SELECT id, 'E002', '赵六', '财务部', '会计', '2026-02-01'
FROM companies
WHERE company_code = 'A001';

-- 4. 录入资金流水
INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description
)
SELECT c.id, a.id, '2026-06-14', 'in', '销售回款', '客户甲', 30000.00, '6月第一笔回款'
FROM companies c
JOIN bank_accounts a ON a.company_id = c.id
WHERE c.company_code = 'A001'
  AND a.account_name = '基本户';

INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description
)
SELECT c.id, a.id, '2026-06-14', 'out', '采购付款', '供应商乙', 12000.00, '采购原材料'
FROM companies c
JOIN bank_accounts a ON a.company_id = c.id
WHERE c.company_code = 'A001'
  AND a.account_name = '基本户';

-- 5. 录入物业费
INSERT INTO property_expenses (
  company_id, account_id, expense_date, fee_period_start, fee_period_end,
  property_name, vendor_name, expense_type, amount, description
)
SELECT c.id, a.id, '2026-06-14', '2026-06-01', '2026-06-30',
       '总部办公室', '物业公司甲', 'property_management', 3500.00, '6月物业管理费'
FROM companies c
JOIN bank_accounts a ON a.company_id = c.id
WHERE c.company_code = 'A001'
  AND a.account_name = '基本户';

INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description
)
SELECT c.id, a.id, '2026-06-14', 'out', '物业费', '物业公司甲', 3500.00, '6月物业管理费'
FROM companies c
JOIN bank_accounts a ON a.company_id = c.id
WHERE c.company_code = 'A001'
  AND a.account_name = '基本户';

-- 6. 模拟上传工资单：先创建上传批次
INSERT INTO payroll_import_batches (company_id, period_month, file_name, imported_by, status, remark)
SELECT id, '2026-06', 'A001_2026-06_工资单.xlsx', 'admin', 'confirmed', '6月工资单'
FROM companies
WHERE company_code = 'A001';

SET @payroll_batch_id = LAST_INSERT_ID();

-- 7. 模拟上传工资单：再写入每个员工工资明细
INSERT INTO payroll_records (
  batch_id, company_id, employee_id, period_month, employee_no_raw, employee_name_raw,
  gross_salary, bonus, allowance, deduction,
  employee_social_security, employee_housing_fund, individual_income_tax, net_salary,
  employer_social_security, employer_housing_fund, source_row_no
)
SELECT @payroll_batch_id, c.id, e.id, '2026-06', e.employee_no, e.employee_name,
       12000.00, 1000.00, 500.00, 0.00,
       1200.00, 600.00, 450.00, 11250.00,
       2600.00, 600.00, 2
FROM companies c
JOIN employees e ON e.company_id = c.id
WHERE c.company_code = 'A001'
  AND e.employee_no = 'E001';

INSERT INTO payroll_records (
  batch_id, company_id, employee_id, period_month, employee_no_raw, employee_name_raw,
  gross_salary, bonus, allowance, deduction,
  employee_social_security, employee_housing_fund, individual_income_tax, net_salary,
  employer_social_security, employer_housing_fund, source_row_no
)
SELECT @payroll_batch_id, c.id, e.id, '2026-06', e.employee_no, e.employee_name,
       15000.00, 0.00, 800.00, 0.00,
       1500.00, 750.00, 700.00, 12850.00,
       3200.00, 750.00, 3
FROM companies c
JOIN employees e ON e.company_id = c.id
WHERE c.company_code = 'A001'
  AND e.employee_no = 'E002';

-- 8. 工资单确认后，可以同步生成实际资金流水
INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description, source_doc_no
)
SELECT c.id, a.id, '2026-06-30', 'out', '工资发放', '员工工资', SUM(r.net_salary), '6月实发工资', CONCAT('PAYROLL-', @payroll_batch_id)
FROM payroll_records r
JOIN companies c ON c.id = r.company_id
JOIN bank_accounts a ON a.company_id = c.id
WHERE r.batch_id = @payroll_batch_id
  AND a.account_name = '基本户'
GROUP BY c.id, a.id;

INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description, source_doc_no
)
SELECT c.id, a.id, '2026-06-30', 'out', '个税缴纳', '税务局', SUM(r.individual_income_tax), '6月工资个税', CONCAT('PAYROLL-', @payroll_batch_id)
FROM payroll_records r
JOIN companies c ON c.id = r.company_id
JOIN bank_accounts a ON a.company_id = c.id
WHERE r.batch_id = @payroll_batch_id
  AND a.account_name = '基本户'
GROUP BY c.id, a.id;

INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description, source_doc_no
)
SELECT c.id, a.id, '2026-06-30', 'out', '社保缴纳', '社保局',
       SUM(r.employee_social_security + r.employer_social_security), '6月社保', CONCAT('PAYROLL-', @payroll_batch_id)
FROM payroll_records r
JOIN companies c ON c.id = r.company_id
JOIN bank_accounts a ON a.company_id = c.id
WHERE r.batch_id = @payroll_batch_id
  AND a.account_name = '基本户'
GROUP BY c.id, a.id;

INSERT INTO cash_transactions (
  company_id, account_id, txn_date, direction, category, counterparty, amount, description, source_doc_no
)
SELECT c.id, a.id, '2026-06-30', 'out', '公积金缴纳', '公积金中心',
       SUM(r.employee_housing_fund + r.employer_housing_fund), '6月公积金', CONCAT('PAYROLL-', @payroll_batch_id)
FROM payroll_records r
JOIN companies c ON c.id = r.company_id
JOIN bank_accounts a ON a.company_id = c.id
WHERE r.batch_id = @payroll_batch_id
  AND a.account_name = '基本户'
GROUP BY c.id, a.id;

-- 9. 录入月度盈利情况
INSERT INTO profit_monthly (
  company_id, period_month, revenue, cost, selling_expense, admin_expense,
  finance_expense, tax_expense, other_income, other_expense, remark
)
SELECT id, '2026-06', 300000.00, 180000.00, 12000.00, 25000.00,
       1000.00, 8000.00, 2000.00, 0.00, '6月经营利润'
FROM companies
WHERE company_code = 'A001';

-- 10. 录入公司间往来
INSERT INTO intercompany_flows (
  flow_date, from_company_id, to_company_id, flow_type, amount, description
)
SELECT '2026-06-14', c1.id, c2.id, 'loan', 20000.00, 'A001 借款给 A002'
FROM companies c1
JOIN companies c2 ON c2.company_code = 'A002'
WHERE c1.company_code = 'A001';

-- 11. 查询每家公司资金总额
SELECT *
FROM v_company_cash_total
ORDER BY total_cash_balance DESC;

-- 12. 查询每家公司每个账户资金表
SELECT *
FROM v_company_cash_balance
WHERE company_code = 'A001'
ORDER BY account_id;

-- 13. 查询公司月度工资成本
SELECT *
FROM v_company_payroll_monthly
WHERE period_month = '2026-06'
ORDER BY total_company_cost DESC;

-- 14. 查询公司月度物业费
SELECT *
FROM v_company_property_monthly
WHERE period_month = '2026-06'
ORDER BY property_amount DESC;

-- 15. 查询公司月度总支出
SELECT *
FROM v_company_expense_monthly
WHERE period_month = '2026-06'
ORDER BY total_expense DESC;

-- 16. 查询公司月度盈利情况
SELECT *
FROM v_company_profit_summary
WHERE period_month = '2026-06'
ORDER BY net_profit DESC;

-- 17. 查询公司间往来余额
SELECT *
FROM v_intercompany_balance
ORDER BY net_intercompany_amount DESC;

-- 18. 查询老板总览
SELECT *
FROM v_company_dashboard
ORDER BY net_profit_ytd DESC;
