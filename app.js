(function () {
  const companyData = {
    tech: {
      name: "示例科技",
      funds: 1284600,
      bankAccounts: [
        { id: "tech-cmb-basic", bank: "招商银行", accountName: "基本户", balance: 862400 },
        { id: "tech-ccb-general", bank: "建设银行", accountName: "一般户", balance: 332200 },
        { id: "tech-alipay", bank: "支付宝", accountName: "企业账户", balance: 90000 }
      ],
      payroll: {
        employees: 18,
        netSalary: 58900,
        tax: 3450,
        employeeSocial: 7100,
        employerSocial: 15600,
        employeeFund: 4200,
        employerFund: 4200,
        totalCost: 78450
      },
      propertyExpenses: [
        { property: "总部办公室", type: "房租", vendor: "办公楼业主", amount: 12000, period: "2026-06" },
        { property: "总部办公室", type: "物业费", vendor: "物业公司甲", amount: 3500, period: "2026-06" },
        { property: "总部办公室", type: "水电", vendor: "供电/供水", amount: 2100, period: "2026-06" },
        { property: "总部办公室", type: "停车", vendor: "停车场", amount: 1000, period: "2026-06" }
      ]
    },
    trade: {
      name: "示例贸易",
      funds: 684200,
      bankAccounts: [
        { id: "trade-icbc-basic", bank: "工商银行", accountName: "基本户", balance: 596400 },
        { id: "trade-wechat", bank: "微信支付", accountName: "商户号", balance: 87800 }
      ],
      payroll: {
        employees: 14,
        netSalary: 38100,
        tax: 2700,
        employeeSocial: 5200,
        employerSocial: 11900,
        employeeFund: 2800,
        employerFund: 2800,
        totalCost: 54800
      },
      propertyExpenses: [
        { property: "贸易仓库", type: "房租", vendor: "仓储园区", amount: 5000, period: "2026-06" },
        { property: "贸易仓库", type: "物业费", vendor: "仓储物业", amount: 1200, period: "2026-06" },
        { property: "贸易仓库", type: "水电", vendor: "园区水电", amount: 800, period: "2026-06" },
        { property: "贸易仓库", type: "维修", vendor: "维修服务商", amount: 200, period: "2026-06" }
      ]
    },
    holding: {
      name: "控股主体",
      funds: 2108900,
      bankAccounts: [
        { id: "holding-boc-general", bank: "中国银行", accountName: "一般户", balance: 1718900 },
        { id: "holding-securities", bank: "证券账户", accountName: "资金账户", balance: 390000 }
      ],
      payroll: {
        employees: 10,
        netSalary: 24900,
        tax: 2300,
        employeeSocial: 3100,
        employerSocial: 7200,
        employeeFund: 1800,
        employerFund: 1800,
        totalCost: 43600
      },
      propertyExpenses: [
        { property: "控股办公室", type: "停车", vendor: "停车场", amount: 1200, period: "2026-06" },
        { property: "控股办公室", type: "水电", vendor: "供电/供水", amount: 700, period: "2026-06" },
        { property: "控股办公室", type: "维修", vendor: "维修服务商", amount: 500, period: "2026-06" }
      ]
    }
  };

  const state = {
    selectedCompany: "tech",
    selectedAccount: "tech-cmb-basic"
  };

  const payrollFieldAliases = {
    name: ["姓名", "员工", "员工姓名", "employee_name", "name"],
    gross: ["应发工资", "应发", "税前工资", "gross_salary", "gross"],
    net: ["实发工资", "实发", "到手工资", "net_salary", "net"],
    tax: ["个税", "个人所得税", "individual_income_tax", "tax"],
    employeeSocial: ["个人社保", "社保个人", "个人承担社保", "employee_social_security"],
    employerSocial: ["公司社保", "单位社保", "公司承担社保", "employer_social_security"],
    employeeFund: ["个人公积金", "公积金个人", "个人承担公积金", "employee_housing_fund"],
    employerFund: ["公司公积金", "单位公积金", "公司承担公积金", "employer_housing_fund"]
  };

  const capitalFieldAliases = {
    date: ["日期", "交易日期", "入账日期", "记账日期", "date", "txn_date"],
    bank: ["银行", "开户行", "所属银行", "bank", "bank_name"],
    account: ["账户", "账号", "银行账户", "账户名称", "account", "account_name"],
    summary: ["摘要", "用途", "类别", "分类", "备注", "说明", "description", "remark", "category"],
    counterparty: ["对方户名", "对方账户名", "交易对手", "counterparty"],
    income: ["流入", "收入", "入账金额", "贷方金额", "收款金额", "income", "in"],
    expense: ["流出", "支出", "出账金额", "借方金额", "付款金额", "expense", "out"],
    amount: ["金额", "交易金额", "发生额", "amount"],
    direction: ["方向", "收支方向", "收支", "direction"],
    balance: ["余额", "账户余额", "balance"]
  };

  function formatMoney(value) {
    const amount = Math.round(Number(value) || 0).toLocaleString("zh-CN");
    return `¥ ${amount}`;
  }

  function parseAmount(value) {
    if (typeof value === "number") return value;
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function findColumn(headers, aliases) {
    const normalizedHeaders = headers.map(normalizeHeader);
    for (const alias of aliases) {
      const target = normalizeHeader(alias);
      const exact = normalizedHeaders.indexOf(target);
      if (exact >= 0) return exact;
      const loose = normalizedHeaders.findIndex((header) => header && (header.includes(target) || target.includes(header)));
      if (loose >= 0) return loose;
    }
    return -1;
  }

  function rowsFromCsv(text) {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  }

  async function readSheetRows(file, statusId) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") return rowsFromCsv(await file.text());

    if (!window.XLSX) {
      setText(statusId, "Excel解析库未加载");
      return [];
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
  }

  function mapColumns(rows, aliasesMap, headerPattern) {
    if (!rows.length) return { columns: {}, startIndex: 0 };
    const headerRowIndex = rows.findIndex((row) => row.some((cell) => headerPattern.test(String(cell))));
    const headers = rows[headerRowIndex >= 0 ? headerRowIndex : 0] || [];
    const columns = Object.fromEntries(
      Object.entries(aliasesMap).map(([key, aliases]) => [key, findColumn(headers, aliases)])
    );
    return {
      columns,
      startIndex: (headerRowIndex >= 0 ? headerRowIndex : 0) + 1
    };
  }

  function mapPayrollRows(rows) {
    const { columns, startIndex } = mapColumns(rows, payrollFieldAliases, /姓名|员工|name/i);
    return rows.slice(startIndex).map((row) => {
      const getText = (key) => (columns[key] >= 0 ? String(row[columns[key]] || "").trim() : "");
      const getMoney = (key) => (columns[key] >= 0 ? parseAmount(row[columns[key]]) : 0);
      const employeeFund = getMoney("employeeFund");
      const employerFund = getMoney("employerFund");
      const gross = getMoney("gross");
      const employerSocial = getMoney("employerSocial");

      return {
        name: getText("name"),
        gross,
        net: getMoney("net"),
        tax: getMoney("tax"),
        employeeSocial: getMoney("employeeSocial"),
        employerSocial,
        employeeFund,
        employerFund,
        fundTotal: employeeFund + employerFund,
        totalCost: gross + employerSocial + employerFund
      };
    }).filter((row) => row.name || row.gross || row.net);
  }

  function mapCapitalRows(rows) {
    const company = companyData[state.selectedCompany];
    const account = getSelectedAccount();
    const { columns, startIndex } = mapColumns(rows, capitalFieldAliases, /日期|交易|金额|余额|date|amount/i);

    return rows.slice(startIndex).map((row) => {
      const getText = (key) => (columns[key] >= 0 ? String(row[columns[key]] || "").trim() : "");
      const getMoney = (key) => (columns[key] >= 0 ? parseAmount(row[columns[key]]) : 0);
      let income = getMoney("income");
      let expense = getMoney("expense");
      const amount = getMoney("amount");
      const direction = getText("direction");

      if (!income && !expense && amount) {
        if (amount < 0 || /出|支|付|借|out|debit/i.test(direction)) {
          expense = Math.abs(amount);
        } else {
          income = Math.abs(amount);
        }
      }

      return {
        date: getText("date") || "未填日期",
        company: company.name,
        bank: getText("bank") || account.bank,
        account: getText("account") || account.accountName,
        summary: getText("summary") || "银行流水",
        counterparty: getText("counterparty") || "-",
        income,
        expense,
        balance: getMoney("balance")
      };
    }).filter((row) => row.date !== "未填日期" || row.income || row.expense || row.balance);
  }

  function summarizePayroll(rows) {
    return rows.reduce((total, row) => {
      total.rows += 1;
      total.net += row.net;
      total.tax += row.tax;
      total.employeeSocial += row.employeeSocial;
      total.employerSocial += row.employerSocial;
      total.employeeFund += row.employeeFund;
      total.employerFund += row.employerFund;
      total.totalCost += row.totalCost;
      return total;
    }, {
      rows: 0,
      net: 0,
      tax: 0,
      employeeSocial: 0,
      employerSocial: 0,
      employeeFund: 0,
      employerFund: 0,
      totalCost: 0
    });
  }

  function summarizeCapital(rows) {
    return rows.reduce((total, row) => {
      total.rows += 1;
      total.income += row.income;
      total.expense += row.expense;
      total.net += row.income - row.expense;
      return total;
    }, { rows: 0, income: 0, expense: 0, net: 0 });
  }

  function getSelectedAccount() {
    const company = companyData[state.selectedCompany];
    return company.bankAccounts.find((account) => account.id === state.selectedAccount) || company.bankAccounts[0];
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateCompany(companyKey) {
    const company = companyData[companyKey];
    if (!company) return;
    state.selectedCompany = companyKey;
    state.selectedAccount = company.bankAccounts[0].id;

    document.querySelectorAll("[data-company]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.company === companyKey);
    });

    setText("selectedCompanyBadge", company.name);
    setText("uploadCompanyBadge", `当前公司：${company.name}`);
    setText("selectedCapitalCompanyBadge", company.name);
    setText("capitalUploadCompanyBadge", `当前公司：${company.name}`);
    renderBankAccounts();
    renderPropertyStats();
  }

  function updateBankAccount(accountId) {
    const company = companyData[state.selectedCompany];
    const account = company.bankAccounts.find((item) => item.id === accountId);
    if (!account) return;
    state.selectedAccount = accountId;

    document.querySelectorAll("[data-bank-account]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.bankAccount === accountId);
    });

    const label = `${account.bank} ${account.accountName}`;
    setText("selectedBankBadge", label);
    setText("capitalUploadBankBadge", `当前银行：${label}`);
  }

  function renderBankAccounts() {
    const company = companyData[state.selectedCompany];
    const list = document.getElementById("bankAccountList");
    if (!list) return;

    list.innerHTML = company.bankAccounts.map((account) => `
      <button class="bank-account-button${account.id === state.selectedAccount ? " selected" : ""}" type="button" data-bank-account="${account.id}">
        <span>${escapeHtml(account.bank)}</span>
        <strong>${formatMoney(account.balance)}</strong>
        <small>${escapeHtml(account.accountName)}</small>
      </button>
    `).join("");

    list.querySelectorAll("[data-bank-account]").forEach((button) => {
      button.addEventListener("click", () => updateBankAccount(button.dataset.bankAccount));
    });

    updateBankAccount(state.selectedAccount);
  }

  function sumProperty(company) {
    return company.propertyExpenses.reduce((total, item) => total + item.amount, 0);
  }

  function allPropertyRows() {
    return Object.values(companyData).flatMap((company) => (
      company.propertyExpenses.map((item) => ({ ...item, company: company.name }))
    ));
  }

  function groupPropertyByType(rows) {
    return rows.reduce((groups, item) => {
      groups[item.type] = (groups[item.type] || 0) + item.amount;
      return groups;
    }, {});
  }

  function renderPropertyStats() {
    const company = companyData[state.selectedCompany];
    if (!company) return;

    const companyRows = company.propertyExpenses;
    const allRows = allPropertyRows();
    const allTotal = allRows.reduce((total, item) => total + item.amount, 0);
    const companyTotal = sumProperty(company);
    const typeTotals = groupPropertyByType(companyRows);
    const topType = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0] || ["-", 0];

    setText("selectedPropertyCompanyBadge", company.name);
    setText("propertyMonthlyTotal", formatMoney(allTotal));
    setText("propertyCompanyTotal", formatMoney(companyTotal));
    setText("propertyItemCount", `${companyRows.length} 项`);
    setText("propertyMainType", `${topType[0]} ${formatMoney(topType[1])}`);

    renderPropertyCompanyTable();
    renderPropertyCategoryBreakdown(typeTotals);
    renderPropertyDetailTable(companyRows, company.name);
  }

  function renderPropertyCompanyTable() {
    const tbody = document.getElementById("propertyCompanyBody");
    if (!tbody) return;

    tbody.innerHTML = Object.entries(companyData).map(([key, company]) => {
      const total = sumProperty(company);
      const types = Object.keys(groupPropertyByType(company.propertyExpenses)).join("、");
      const propertyNames = Array.from(new Set(company.propertyExpenses.map((item) => item.property))).join("、");

      return `
        <tr class="${key === state.selectedCompany ? "selected-row" : ""}">
          <td>${escapeHtml(company.name)}</td>
          <td>${escapeHtml(propertyNames)}</td>
          <td>${escapeHtml(types)}</td>
          <td>${company.propertyExpenses.length} 项</td>
          <td class="positive">${formatMoney(total)}</td>
        </tr>
      `;
    }).join("");
  }

  function renderPropertyCategoryBreakdown(typeTotals) {
    const list = document.getElementById("propertyCategoryList");
    if (!list) return;

    const entries = Object.entries(typeTotals).sort((a, b) => b[1] - a[1]);
    list.innerHTML = entries.map(([type, amount]) => `
      <div class="property-category-card">
        <span>${escapeHtml(type)}</span>
        <strong>${formatMoney(amount)}</strong>
      </div>
    `).join("");
  }

  function renderPropertyDetailTable(rows, companyName) {
    const tbody = document.getElementById("propertyDetailBody");
    if (!tbody) return;

    tbody.innerHTML = rows.map((item) => `
      <tr>
        <td>${escapeHtml(item.period)}</td>
        <td>${escapeHtml(companyName)}</td>
        <td>${escapeHtml(item.property)}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.vendor)}</td>
        <td class="positive">${formatMoney(item.amount)}</td>
      </tr>
    `).join("");
  }

  function renderPayrollPreview(rows) {
    const tbody = document.getElementById("payrollPreviewBody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8">暂无导入数据</td></tr>';
      return;
    }

    tbody.innerHTML = rows.slice(0, 12).map((row) => `
      <tr>
        <td>${escapeHtml(row.name || "-")}</td>
        <td>${formatMoney(row.gross)}</td>
        <td>${formatMoney(row.net)}</td>
        <td>${formatMoney(row.tax)}</td>
        <td>${formatMoney(row.employeeSocial)}</td>
        <td>${formatMoney(row.employerSocial)}</td>
        <td>${formatMoney(row.fundTotal)}</td>
        <td>${formatMoney(row.totalCost)}</td>
      </tr>
    `).join("");
  }

  function renderCapitalPreview(rows) {
    const tbody = document.getElementById("capitalPreviewBody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8">暂无导入数据</td></tr>';
      return;
    }

    tbody.innerHTML = rows.slice(0, 12).map((row) => `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.bank)}</td>
        <td>${escapeHtml(row.account)}</td>
        <td>${escapeHtml(row.summary)}</td>
        <td>${escapeHtml(row.counterparty)}</td>
        <td>${formatMoney(row.income)}</td>
        <td>${formatMoney(row.expense)}</td>
        <td>${row.balance ? formatMoney(row.balance) : "-"}</td>
      </tr>
    `).join("");
  }

  function renderCashFlowSummary(rows) {
    const tbody = document.getElementById("cashFlowBody");
    if (!tbody || !rows.length) return;

    const grouped = new Map();
    rows.forEach((row) => {
      const key = `${row.date}|${row.bank}|${row.account}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: row.date,
          company: row.company,
          bankAccount: `${row.bank} ${row.account}`,
          income: 0,
          expense: 0,
          balance: 0
        });
      }
      const item = grouped.get(key);
      item.income += row.income;
      item.expense += row.expense;
      if (row.balance) item.balance = row.balance;
    });

    tbody.innerHTML = Array.from(grouped.values()).slice(0, 12).map((row) => {
      const net = row.income - row.expense;
      return `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.company)}</td>
          <td>${escapeHtml(row.bankAccount)}</td>
          <td>导入汇总</td>
          <td>${formatMoney(row.income)}</td>
          <td>${formatMoney(row.expense)}</td>
          <td class="${net >= 0 ? "positive" : ""}">${formatMoney(net)}</td>
          <td>${row.balance ? formatMoney(row.balance) : "-"}</td>
        </tr>
      `;
    }).join("");
  }

  async function readPayrollFile(file) {
    setText("uploadFileName", file.name);
    setText("importStatus", "读取中");

    const rows = await readSheetRows(file, "importStatus");
    const payrollRows = mapPayrollRows(rows);
    const total = summarizePayroll(payrollRows);
    const selectedCompany = companyData[state.selectedCompany];

    setText("importRows", `${total.rows} 人`);
    setText("importCost", formatMoney(total.totalCost));
    setText("importSocialFund", formatMoney(
      total.employeeSocial + total.employerSocial + total.employeeFund + total.employerFund
    ));
    setText("importStatus", `${selectedCompany.name} · 已读取`);
    renderPayrollPreview(payrollRows);
  }

  async function readCapitalFile(file) {
    setText("capitalUploadFileName", file.name);
    setText("capitalImportStatus", "读取中");

    const rows = await readSheetRows(file, "capitalImportStatus");
    const capitalRows = mapCapitalRows(rows);
    const total = summarizeCapital(capitalRows);
    const selectedCompany = companyData[state.selectedCompany];

    setText("capitalImportRows", `${total.rows} 笔`);
    setText("capitalImportIn", formatMoney(total.income));
    setText("capitalImportOut", formatMoney(total.expense));
    setText("capitalImportNet", formatMoney(total.net));
    setText("capitalImportStatus", `${selectedCompany.name} · 已汇总`);
    renderCapitalPreview(capitalRows);
    renderCashFlowSummary(capitalRows);
  }

  function downloadPayrollTemplate() {
    const headers = [
      "员工编号", "姓名", "应发工资", "奖金", "补贴", "扣款",
      "个人社保", "个人公积金", "个税", "实发工资", "公司社保", "公司公积金"
    ];
    const rows = [
      ["E001", "张三", "12000", "1000", "500", "0", "1200", "600", "450", "11250", "2600", "600"],
      ["E002", "李四", "15000", "0", "800", "0", "1500", "750", "700", "12850", "3200", "750"]
    ];
    downloadCsv(`${companyData[state.selectedCompany].name}_工资单模板.csv`, [headers, ...rows]);
  }

  function downloadCapitalTemplate() {
    const account = getSelectedAccount();
    const headers = ["日期", "银行", "账户", "摘要", "对方户名", "流入", "流出", "余额"];
    const rows = [
      ["2026-06-01", account.bank, account.accountName, "销售回款", "客户甲", "30000", "", "892400"],
      ["2026-06-02", account.bank, account.accountName, "采购付款", "供应商乙", "", "12000", "880400"]
    ];
    downloadCsv(`${companyData[state.selectedCompany].name}_${account.bank}_资金表模板.csv`, [headers, ...rows]);
  }

  function downloadCsv(fileName, rows) {
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    document.querySelectorAll("[data-company]").forEach((node) => {
      node.addEventListener("click", () => updateCompany(node.dataset.company));
    });

    document.querySelectorAll("[data-scroll-target]").forEach((node) => {
      node.addEventListener("click", () => {
        const target = document.getElementById(node.dataset.scrollTarget);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    document.querySelectorAll("[data-open-file]").forEach((node) => {
      node.addEventListener("click", () => document.getElementById("payrollFile")?.click());
    });

    document.querySelectorAll("[data-open-capital-file]").forEach((node) => {
      node.addEventListener("click", () => document.getElementById("capitalFile")?.click());
    });

    document.getElementById("payrollFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) readPayrollFile(file);
    });

    document.getElementById("capitalFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) readCapitalFile(file);
    });

    document.getElementById("downloadTemplate")?.addEventListener("click", downloadPayrollTemplate);
    document.getElementById("downloadCapitalTemplate")?.addEventListener("click", downloadCapitalTemplate);

    document.querySelectorAll(".nav-item").forEach((node) => {
      node.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
        node.classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    updateCompany(state.selectedCompany);
  });
})();
