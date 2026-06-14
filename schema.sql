CREATE DATABASE IF NOT EXISTS caishenye
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE caishenye;

CREATE TABLE companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_code VARCHAR(32) NOT NULL,
  company_name VARCHAR(128) NOT NULL,
  legal_person VARCHAR(64) NULL,
  tax_no VARCHAR(64) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_companies_code (company_code),
  UNIQUE KEY uk_companies_name (company_name)
) ENGINE=InnoDB;

CREATE TABLE employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_no VARCHAR(64) NOT NULL,
  employee_name VARCHAR(64) NOT NULL,
  id_card_no VARCHAR(32) NULL,
  department VARCHAR(64) NULL,
  position_name VARCHAR(64) NULL,
  hire_date DATE NULL,
  leave_date DATE NULL,
  social_security_city VARCHAR(64) NULL,
  status ENUM('active', 'inactive', 'left') NOT NULL DEFAULT 'active',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_employees_company_no (company_id, employee_no),
  KEY idx_employees_company_status (company_id, status),
  KEY idx_employees_name (employee_name),
  CONSTRAINT fk_employees_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE bank_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  account_name VARCHAR(128) NOT NULL,
  bank_name VARCHAR(128) NULL,
  account_no VARCHAR(64) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  account_type ENUM('bank', 'cash', 'wechat', 'alipay', 'securities', 'other') NOT NULL DEFAULT 'bank',
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bank_accounts_company (company_id),
  CONSTRAINT fk_bank_accounts_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE cash_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  txn_date DATE NOT NULL,
  direction ENUM('in', 'out') NOT NULL,
  category VARCHAR(64) NOT NULL,
  counterparty VARCHAR(128) NULL,
  amount DECIMAL(18,2) NOT NULL,
  description VARCHAR(500) NULL,
  source_doc_no VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cash_txn_company_date (company_id, txn_date),
  KEY idx_cash_txn_account_date (account_id, txn_date),
  KEY idx_cash_txn_category (category),
  CONSTRAINT fk_cash_txn_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_cash_txn_account
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT ck_cash_txn_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE property_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NULL,
  expense_date DATE NOT NULL,
  fee_period_start DATE NULL,
  fee_period_end DATE NULL,
  property_name VARCHAR(128) NOT NULL,
  vendor_name VARCHAR(128) NULL,
  expense_type ENUM('rent', 'property_management', 'utilities', 'parking', 'repair', 'other') NOT NULL DEFAULT 'property_management',
  amount DECIMAL(18,2) NOT NULL,
  description VARCHAR(500) NULL,
  source_doc_no VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_property_company_date (company_id, expense_date),
  KEY idx_property_account_date (account_id, expense_date),
  CONSTRAINT fk_property_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_property_account
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT ck_property_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE capital_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  snapshot_date DATE NOT NULL,
  balance DECIMAL(18,2) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_capital_snapshot_account_date (account_id, snapshot_date),
  KEY idx_capital_snapshot_company_date (company_id, snapshot_date),
  CONSTRAINT fk_capital_snapshot_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_capital_snapshot_account
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE payroll_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  file_name VARCHAR(255) NOT NULL,
  file_hash VARCHAR(128) NULL,
  imported_by VARCHAR(64) NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('draft', 'confirmed', 'voided') NOT NULL DEFAULT 'draft',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payroll_batches_company_period (company_id, period_month),
  KEY idx_payroll_batches_hash (file_hash),
  CONSTRAINT fk_payroll_batches_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE payroll_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  employee_no_raw VARCHAR(64) NULL,
  employee_name_raw VARCHAR(64) NOT NULL,
  gross_salary DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  bonus DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  allowance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  deduction DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  employee_social_security DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  employee_housing_fund DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  individual_income_tax DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  net_salary DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  employer_social_security DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  employer_housing_fund DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_company_cost DECIMAL(18,2) AS (
    gross_salary + employer_social_security + employer_housing_fund
  ) STORED,
  source_row_no INT UNSIGNED NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payroll_records_batch (batch_id),
  KEY idx_payroll_records_company_period (company_id, period_month),
  KEY idx_payroll_records_employee_period (employee_id, period_month),
  CONSTRAINT fk_payroll_records_batch
    FOREIGN KEY (batch_id) REFERENCES payroll_import_batches(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_records_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_records_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT ck_payroll_gross_non_negative CHECK (gross_salary >= 0),
  CONSTRAINT ck_payroll_net_non_negative CHECK (net_salary >= 0)
) ENGINE=InnoDB;

CREATE TABLE profit_monthly (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  revenue DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  selling_expense DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  admin_expense DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  finance_expense DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_expense DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  other_income DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  other_expense DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  net_profit DECIMAL(18,2) AS (
    revenue
    - cost
    - selling_expense
    - admin_expense
    - finance_expense
    - tax_expense
    + other_income
    - other_expense
  ) STORED,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_profit_monthly_company_period (company_id, period_month),
  KEY idx_profit_monthly_period (period_month),
  CONSTRAINT fk_profit_monthly_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE intercompany_flows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow_date DATE NOT NULL,
  from_company_id BIGINT UNSIGNED NOT NULL,
  to_company_id BIGINT UNSIGNED NOT NULL,
  from_account_id BIGINT UNSIGNED NULL,
  to_account_id BIGINT UNSIGNED NULL,
  flow_type ENUM('loan', 'repayment', 'capital_injection', 'dividend', 'transfer', 'other') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  description VARCHAR(500) NULL,
  source_doc_no VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_intercompany_from_date (from_company_id, flow_date),
  KEY idx_intercompany_to_date (to_company_id, flow_date),
  CONSTRAINT fk_intercompany_from_company
    FOREIGN KEY (from_company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_intercompany_to_company
    FOREIGN KEY (to_company_id) REFERENCES companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_intercompany_from_account
    FOREIGN KEY (from_account_id) REFERENCES bank_accounts(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_intercompany_to_account
    FOREIGN KEY (to_account_id) REFERENCES bank_accounts(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT ck_intercompany_amount_positive CHECK (amount > 0),
  CONSTRAINT ck_intercompany_different_company CHECK (from_company_id <> to_company_id)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW v_company_cash_balance AS
SELECT
  c.id AS company_id,
  c.company_code,
  c.company_name,
  a.id AS account_id,
  a.account_name,
  a.bank_name,
  a.currency,
  a.opening_balance
    + COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0) AS calculated_balance
FROM companies c
JOIN bank_accounts a ON a.company_id = c.id
LEFT JOIN cash_transactions t ON t.account_id = a.id
WHERE c.status = 'active'
  AND a.status = 'active'
GROUP BY
  c.id, c.company_code, c.company_name,
  a.id, a.account_name, a.bank_name, a.currency, a.opening_balance;

CREATE OR REPLACE VIEW v_company_cash_total AS
SELECT
  company_id,
  company_code,
  company_name,
  currency,
  SUM(calculated_balance) AS total_cash_balance
FROM v_company_cash_balance
GROUP BY company_id, company_code, company_name, currency;

CREATE OR REPLACE VIEW v_company_profit_summary AS
SELECT
  c.id AS company_id,
  c.company_code,
  c.company_name,
  p.period_month,
  p.revenue,
  p.cost,
  p.selling_expense,
  p.admin_expense,
  p.finance_expense,
  p.tax_expense,
  p.other_income,
  p.other_expense,
  p.net_profit,
  CASE
    WHEN p.revenue = 0 THEN NULL
    ELSE ROUND(p.net_profit / p.revenue * 100, 2)
  END AS net_profit_margin_pct
FROM profit_monthly p
JOIN companies c ON c.id = p.company_id;

CREATE OR REPLACE VIEW v_company_payroll_monthly AS
SELECT
  c.id AS company_id,
  c.company_code,
  c.company_name,
  r.period_month,
  COUNT(*) AS employee_count,
  SUM(r.gross_salary) AS gross_salary,
  SUM(r.employee_social_security) AS employee_social_security,
  SUM(r.employee_housing_fund) AS employee_housing_fund,
  SUM(r.individual_income_tax) AS individual_income_tax,
  SUM(r.net_salary) AS net_salary,
  SUM(r.employer_social_security) AS employer_social_security,
  SUM(r.employer_housing_fund) AS employer_housing_fund,
  SUM(r.total_company_cost) AS total_company_cost
FROM payroll_records r
JOIN companies c ON c.id = r.company_id
JOIN payroll_import_batches b ON b.id = r.batch_id
WHERE b.status <> 'voided'
GROUP BY c.id, c.company_code, c.company_name, r.period_month;

CREATE OR REPLACE VIEW v_company_property_monthly AS
SELECT
  c.id AS company_id,
  c.company_code,
  c.company_name,
  DATE_FORMAT(p.expense_date, '%Y-%m') AS period_month,
  p.expense_type,
  SUM(p.amount) AS property_amount
FROM property_expenses p
JOIN companies c ON c.id = p.company_id
GROUP BY
  c.id,
  c.company_code,
  c.company_name,
  DATE_FORMAT(p.expense_date, '%Y-%m'),
  p.expense_type;

CREATE OR REPLACE VIEW v_company_expense_monthly AS
SELECT
  company_id,
  company_code,
  company_name,
  period_month,
  SUM(payroll_cost) AS payroll_cost,
  SUM(property_cost) AS property_cost,
  SUM(other_cash_expense) AS other_cash_expense,
  SUM(payroll_cost + property_cost + other_cash_expense) AS total_expense
FROM (
  SELECT
    company_id,
    company_code,
    company_name,
    period_month,
    total_company_cost AS payroll_cost,
    0.00 AS property_cost,
    0.00 AS other_cash_expense
  FROM v_company_payroll_monthly

  UNION ALL

  SELECT
    company_id,
    company_code,
    company_name,
    period_month,
    0.00 AS payroll_cost,
    SUM(property_amount) AS property_cost,
    0.00 AS other_cash_expense
  FROM v_company_property_monthly
  GROUP BY company_id, company_code, company_name, period_month

  UNION ALL

  SELECT
    c.id AS company_id,
    c.company_code,
    c.company_name,
    DATE_FORMAT(t.txn_date, '%Y-%m') AS period_month,
    0.00 AS payroll_cost,
    0.00 AS property_cost,
    SUM(t.amount) AS other_cash_expense
  FROM cash_transactions t
  JOIN companies c ON c.id = t.company_id
  WHERE t.direction = 'out'
    AND t.category NOT IN ('工资发放', '个税缴纳', '社保缴纳', '公积金缴纳', '物业费', '房租')
  GROUP BY c.id, c.company_code, c.company_name, DATE_FORMAT(t.txn_date, '%Y-%m')
) x
GROUP BY company_id, company_code, company_name, period_month;

CREATE OR REPLACE VIEW v_intercompany_balance AS
SELECT
  company_id,
  company_code,
  company_name,
  SUM(receivable_amount) AS receivable_amount,
  SUM(payable_amount) AS payable_amount,
  SUM(receivable_amount - payable_amount) AS net_intercompany_amount
FROM (
  SELECT
    c.id AS company_id,
    c.company_code,
    c.company_name,
    f.amount AS receivable_amount,
    0.00 AS payable_amount
  FROM intercompany_flows f
  JOIN companies c ON c.id = f.from_company_id
  WHERE f.flow_type IN ('loan', 'capital_injection', 'transfer', 'other')

  UNION ALL

  SELECT
    c.id AS company_id,
    c.company_code,
    c.company_name,
    0.00 AS receivable_amount,
    f.amount AS payable_amount
  FROM intercompany_flows f
  JOIN companies c ON c.id = f.to_company_id
  WHERE f.flow_type IN ('loan', 'capital_injection', 'transfer', 'other')

  UNION ALL

  SELECT
    c.id AS company_id,
    c.company_code,
    c.company_name,
    0.00 AS receivable_amount,
    f.amount AS payable_amount
  FROM intercompany_flows f
  JOIN companies c ON c.id = f.from_company_id
  WHERE f.flow_type IN ('repayment', 'dividend')

  UNION ALL

  SELECT
    c.id AS company_id,
    c.company_code,
    c.company_name,
    f.amount AS receivable_amount,
    0.00 AS payable_amount
  FROM intercompany_flows f
  JOIN companies c ON c.id = f.to_company_id
  WHERE f.flow_type IN ('repayment', 'dividend')
) x
GROUP BY company_id, company_code, company_name;

CREATE OR REPLACE VIEW v_company_dashboard AS
SELECT
  c.id AS company_id,
  c.company_code,
  c.company_name,
  COALESCE(cash_total.total_cash_balance, 0.00) AS total_cash_balance,
  COALESCE(profit_ytd.revenue_ytd, 0.00) AS revenue_ytd,
  COALESCE(profit_ytd.net_profit_ytd, 0.00) AS net_profit_ytd,
  COALESCE(expense_ytd.payroll_cost_ytd, 0.00) AS payroll_cost_ytd,
  COALESCE(expense_ytd.property_cost_ytd, 0.00) AS property_cost_ytd,
  COALESCE(expense_ytd.total_expense_ytd, 0.00) AS total_expense_ytd,
  COALESCE(intercompany.receivable_amount, 0.00) AS intercompany_receivable,
  COALESCE(intercompany.payable_amount, 0.00) AS intercompany_payable,
  COALESCE(intercompany.net_intercompany_amount, 0.00) AS net_intercompany_amount
FROM companies c
LEFT JOIN (
  SELECT company_id, SUM(total_cash_balance) AS total_cash_balance
  FROM v_company_cash_total
  GROUP BY company_id
) cash_total ON cash_total.company_id = c.id
LEFT JOIN (
  SELECT
    company_id,
    SUM(revenue) AS revenue_ytd,
    SUM(net_profit) AS net_profit_ytd
  FROM profit_monthly
  WHERE LEFT(period_month, 4) = DATE_FORMAT(CURDATE(), '%Y')
  GROUP BY company_id
) profit_ytd ON profit_ytd.company_id = c.id
LEFT JOIN (
  SELECT
    company_id,
    SUM(payroll_cost) AS payroll_cost_ytd,
    SUM(property_cost) AS property_cost_ytd,
    SUM(total_expense) AS total_expense_ytd
  FROM v_company_expense_monthly
  WHERE LEFT(period_month, 4) = DATE_FORMAT(CURDATE(), '%Y')
  GROUP BY company_id
) expense_ytd ON expense_ytd.company_id = c.id
LEFT JOIN v_intercompany_balance intercompany ON intercompany.company_id = c.id
WHERE c.status = 'active';
