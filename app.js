(function () {
  const companyData = {
    tech: {
      code: "A001",
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
      code: "A002",
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
      code: "A003",
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

  function buildCompanyCodeToKey() {
    return Object.fromEntries(
      Object.entries(companyData).map(([key, company]) => [company.code, key])
    );
  }

  let companyCodeToKey = buildCompanyCodeToKey();

  const selectedUploadFiles = {
    capital: null,
    payroll: null,
    property: null
  };

  let pendingPayrollImport = null;
  let payrollPreviewRows = [];
  let selectedPayrollRowIndexes = new Set();

  const uploadUi = {
    capital: {
      fileNameId: "capitalUploadFileName",
      statusId: "capitalImportStatus",
      sheetControlId: "capitalSheetControl",
      sheetSelectId: "capitalSheetSelect"
    },
    payroll: {
      fileNameId: "uploadFileName",
      statusId: null,
      sheetControlId: "payrollSheetControl",
      sheetSelectId: "payrollSheetSelect"
    },
    property: {
      fileNameId: "propertyUploadFileName",
      statusId: "propertyImportStatus",
      sheetControlId: "propertySheetControl",
      sheetSelectId: "propertySheetSelect"
    }
  };

  const payrollFieldAliases = {
    employeeNo: ["员工编号", "工号", "员工号", "employee_no", "employeeNo"],
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

  const propertyFieldAliases = {
    period: ["月份", "期间", "账期", "费用月份", "period", "month"],
    date: ["日期", "费用日期", "付款日期", "date", "expense_date"],
    property: ["物业所属", "物业", "房屋", "地点", "property", "property_name"],
    type: ["费用类型", "类型", "费用项目", "category", "type", "expense_type"],
    vendor: ["收款方", "供应商", "物业公司", "vendor", "vendor_name"],
    amount: ["金额", "费用", "amount"]
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

  function currentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function selectedCompanyPayload() {
    const company = companyData[state.selectedCompany];
    return {
      key: state.selectedCompany,
      code: company.code,
      name: company.name
    };
  }

  function selectedAccountPayload() {
    const account = getSelectedAccount();
    return {
      key: account.id,
      bank: account.bank,
      accountName: account.accountName
    };
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "写入失败");
    }
    return data;
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

  function fileExt(file) {
    return file.name.split(".").pop().toLowerCase();
  }

  function sheetRows(workbook, sheetName) {
    const selectedSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheetName];
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  }

  async function readWorkbook(file, statusId) {
    if (!window.XLSX) {
      setText(statusId, "Excel解析库未加载");
      return null;
    }
    const buffer = await file.arrayBuffer();
    return window.XLSX.read(buffer, { type: "array" });
  }

  async function readSheetRows(file, statusId, sheetName) {
    const ext = fileExt(file);
    if (ext === "csv") return rowsFromCsv(await file.text());

    const workbook = await readWorkbook(file, statusId);
    if (!workbook) return [];
    return sheetRows(workbook, sheetName);
  }

  function hideSheetControl(kind) {
    const ui = uploadUi[kind];
    const control = document.getElementById(ui.sheetControlId);
    if (control) control.hidden = true;
  }

  function showSheetControl(kind, sheetNames) {
    const ui = uploadUi[kind];
    const control = document.getElementById(ui.sheetControlId);
    const select = document.getElementById(ui.sheetSelectId);
    if (!control || !select) return;
    select.innerHTML = sheetNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    control.hidden = false;
  }

  async function prepareUploadFile(kind, file) {
    const ui = uploadUi[kind];
    selectedUploadFiles[kind] = file;
    setText(ui.fileNameId, file.name);
    if (kind === "payroll") {
      pendingPayrollImport = null;
      payrollPreviewRows = [];
      selectedPayrollRowIndexes = new Set();
      renderPayrollPreview([]);
      setPayrollSaveButton(false);
    }

    if (fileExt(file) === "csv") {
      hideSheetControl(kind);
      await importSelectedSheet(kind);
      return;
    }

    setText(ui.statusId, "读取Sheet列表");
    const workbook = await readWorkbook(file, ui.statusId);
    if (!workbook) return;
    showSheetControl(kind, workbook.SheetNames);
    setText(ui.statusId, "请选择Sheet后导入");
  }

  async function importSelectedSheet(kind) {
    const file = selectedUploadFiles[kind];
    const ui = uploadUi[kind];
    if (!file) {
      if (kind === "payroll") {
        pendingPayrollImport = null;
        setPayrollSaveButton(false, "保存");
      }
      setText(ui.statusId, "请先选择Excel文件");
      return;
    }
    const sheetName = document.getElementById(ui.sheetSelectId)?.value || "";
    if (kind === "payroll") await readPayrollFile(file, sheetName);
    if (kind === "capital") await readCapitalFile(file, sheetName);
    if (kind === "property") await readPropertyFile(file, sheetName);
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
        employeeNo: getText("employeeNo"),
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

  function mapPropertyRows(rows) {
    const { columns, startIndex } = mapColumns(rows, propertyFieldAliases, /物业|费用|金额|property|amount/i);
    return rows.slice(startIndex).map((row) => {
      const getText = (key) => (columns[key] >= 0 ? String(row[columns[key]] || "").trim() : "");
      const getMoney = (key) => (columns[key] >= 0 ? parseAmount(row[columns[key]]) : 0);
      const property = getText("property");
      const type = getText("type");
      const vendor = getText("vendor");
      const amount = getMoney("amount");

      return {
        period: getText("period") || document.getElementById("propertyPeriod")?.value || currentPeriod(),
        date: getText("date"),
        property: property || "未填写物业",
        type: type || "物业费",
        vendor: vendor || "-",
        amount
      };
    }).filter((row) => row.amount > 0 || row.property !== "未填写物业" || row.vendor !== "-" || row.type !== "物业费");
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

  function summarizeProperty(rows) {
    return rows.reduce((total, row) => {
      total.rows += 1;
      total.amount += row.amount;
      return total;
    }, { rows: 0, amount: 0 });
  }

  function selectedPayrollRows() {
    return payrollPreviewRows.filter((_, index) => selectedPayrollRowIndexes.has(index));
  }

  function updatePayrollSelectionSummary() {
    const rows = selectedPayrollRows();
    const total = summarizePayroll(rows);
    const selectAll = document.getElementById("selectAllPayrollRows");

    setText("importRows", `${total.rows} 人`);
    setText("importCost", formatMoney(total.totalCost));
    setText("importTax", formatMoney(total.tax));
    setText("importSocialFund", formatMoney(
      total.employeeSocial + total.employerSocial + total.employeeFund + total.employerFund
    ));

    if (selectAll) {
      selectAll.disabled = payrollPreviewRows.length === 0;
      selectAll.checked = payrollPreviewRows.length > 0 && rows.length === payrollPreviewRows.length;
      selectAll.indeterminate = rows.length > 0 && rows.length < payrollPreviewRows.length;
    }

    if (pendingPayrollImport) {
      pendingPayrollImport.rows = rows;
      setPayrollSaveButton(rows.length > 0, rows.length ? "保存" : "无数据");
    }
  }

  function getSelectedAccount() {
    const company = companyData[state.selectedCompany];
    return company.bankAccounts.find((account) => account.id === state.selectedAccount) || company.bankAccounts[0];
  }

  function setText(id, value) {
    if (!id) return;
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setPayrollSaveButton(enabled, label = "保存") {
    const button = document.getElementById("savePayrollImport");
    if (!button) return;
    button.disabled = !enabled;
    button.textContent = label;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function companyEntries() {
    return Object.entries(companyData);
  }

  function normalizeCompany(raw, index) {
    const code = String(raw.code || `C${String(index + 1).padStart(3, "0")}`).trim();
    const previousKey = companyCodeToKey[code];
    const previous = previousKey ? companyData[previousKey] : {};
    const bankAccounts = (raw.bankAccounts || []).map((account, accountIndex) => ({
      id: account.id || `${code}-account-${accountIndex + 1}`,
      bank: account.bank || "默认银行",
      accountName: account.accountName || "基本户",
      balance: Number(account.balance || 0)
    }));

    return {
      code,
      name: raw.name || code,
      funds: Number(raw.funds || 0),
      bankAccounts: bankAccounts.length ? bankAccounts : [{ id: `${code}-default`, bank: "默认银行", accountName: "基本户", balance: 0 }],
      payroll: previous.payroll || {
        employees: 0,
        netSalary: 0,
        tax: 0,
        employeeSocial: 0,
        employerSocial: 0,
        employeeFund: 0,
        employerFund: 0,
        totalCost: 0
      },
      propertyExpenses: previous.propertyExpenses || []
    };
  }

  function replaceCompanyData(companies) {
    const normalized = {};
    companies.forEach((company, index) => {
      const item = normalizeCompany(company, index);
      normalized[item.code] = item;
    });
    if (!Object.keys(normalized).length) return;
    Object.keys(companyData).forEach((key) => delete companyData[key]);
    Object.assign(companyData, normalized);
    companyCodeToKey = buildCompanyCodeToKey();
    if (!companyData[state.selectedCompany]) {
      state.selectedCompany = Object.keys(companyData)[0];
    }
    if (!companyData[state.selectedCompany].bankAccounts.some((account) => account.id === state.selectedAccount)) {
      state.selectedAccount = companyData[state.selectedCompany].bankAccounts[0]?.id;
    }
  }

  function ensureCompanyPanelControls() {
    document.querySelectorAll(".company-panel").forEach((panel) => {
      const title = panel.querySelector("h2");
      if (title && !panel.querySelector(".company-panel-title")) {
        const titleRow = document.createElement("div");
        titleRow.className = "company-panel-title";
        title.replaceWith(titleRow);
        titleRow.appendChild(title);
        const manageButton = document.createElement("button");
        manageButton.className = "company-manage-button";
        manageButton.type = "button";
        manageButton.textContent = "管理";
        manageButton.addEventListener("click", openCompanyManager);
        titleRow.appendChild(manageButton);
      }

      if (!panel.querySelector(".company-list")) {
        const list = document.createElement("div");
        list.className = "company-list";
        Array.from(panel.children).forEach((child) => {
          if (child.classList?.contains("company-row")) list.appendChild(child);
        });
        panel.appendChild(list);
      }
    });
  }

  function renderSidebarCompanies() {
    ensureCompanyPanelControls();
    document.querySelectorAll(".company-list").forEach((list) => {
      list.innerHTML = companyEntries().map(([key, company]) => `
        <button class="company-row${key === state.selectedCompany ? " selected" : ""}" type="button" data-company="${escapeHtml(key)}">
          <span>${escapeHtml(company.name)}</span>
          <strong>${formatMoney(company.funds)}</strong>
        </button>
      `).join("");
      list.querySelectorAll("[data-company]").forEach((button) => {
        button.addEventListener("click", () => updateCompany(button.dataset.company));
      });
    });
  }

  function renderPayrollCompanyOptions() {
    const select = document.getElementById("payrollCompanySelect");
    if (!select) return;
    select.innerHTML = companyEntries().map(([key, company]) => (
      `<option value="${escapeHtml(key)}">${escapeHtml(company.name)}</option>`
    )).join("");
    select.value = state.selectedCompany;
  }

  function renderBaseCompanyCards() {
    const payrollGrid = document.querySelector(".payroll-company-grid");
    if (payrollGrid) {
      payrollGrid.innerHTML = companyEntries().map(([key, company]) => `
        <button class="payroll-company-card${key === state.selectedCompany ? " selected" : ""}" type="button" data-company="${escapeHtml(key)}">
          <span>${escapeHtml(company.name)}</span>
          <strong>${formatMoney(0)}</strong>
          <small>0人 · 社保公积金 ${formatMoney(0)}</small>
        </button>
      `).join("");
    }

    const capitalGrid = document.querySelector(".capital-company-grid");
    if (capitalGrid) {
      capitalGrid.innerHTML = companyEntries().map(([key, company]) => {
        const bankNames = company.bankAccounts.map((account) => account.bank).filter(Boolean).join("、") || "默认银行";
        return `
          <button class="capital-company-card${key === state.selectedCompany ? " selected" : ""}" type="button" data-company="${escapeHtml(key)}">
            <span>${escapeHtml(company.name)}</span>
            <strong>${formatMoney(company.funds)}</strong>
            <small>${escapeHtml(bankNames)}</small>
          </button>
        `;
      }).join("");
    }

    const propertyGrid = document.querySelector(".property-company-grid");
    if (propertyGrid) {
      propertyGrid.innerHTML = companyEntries().map(([key, company]) => {
        const total = sumProperty(company);
        const propertyNames = Array.from(new Set(company.propertyExpenses.map((item) => item.property))).join("、") || "未录入物业";
        return `
          <button class="property-company-card${key === state.selectedCompany ? " selected" : ""}" type="button" data-company="${escapeHtml(key)}">
            <span>${escapeHtml(company.name)}</span>
            <strong>${formatMoney(total)}</strong>
            <small>${escapeHtml(propertyNames)}</small>
          </button>
        `;
      }).join("");
    }

    document.querySelectorAll(".payroll-company-grid [data-company], .capital-company-grid [data-company], .property-company-grid [data-company]").forEach((button) => {
      button.addEventListener("click", () => updateCompany(button.dataset.company));
    });
  }

  function renderCompanySurfaces() {
    renderSidebarCompanies();
    renderPayrollCompanyOptions();
    renderBaseCompanyCards();
  }

  function syncCompanySelection() {
    document.querySelectorAll("[data-company]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.company === state.selectedCompany);
    });
    const payrollCompanySelect = document.getElementById("payrollCompanySelect");
    if (payrollCompanySelect) payrollCompanySelect.value = state.selectedCompany;
  }

  function ensureCompanyManager() {
    if (document.getElementById("companyManager")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="company-manager-backdrop" id="companyManager" hidden>
        <section class="company-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="companyManagerTitle">
          <div class="section-title-row">
            <div><p class="eyebrow">公司档案</p><h3 id="companyManagerTitle">我的公司</h3></div>
            <button class="ghost-button" type="button" id="closeCompanyManager">关闭</button>
          </div>
          <form class="company-manager-form" id="companyManagerForm">
            <input type="hidden" id="companyManagerCode">
            <label><span>公司名称</span><input id="companyManagerName" type="text" placeholder="输入公司名称" required></label>
            <div class="company-manager-actions">
              <button class="ghost-button" type="button" id="newCompanyButton">新增公司</button>
              <button class="primary-button" type="submit">保存</button>
            </div>
          </form>
          <div class="company-manager-list" id="companyManagerList"></div>
        </section>
      </div>
    `);
    document.getElementById("closeCompanyManager")?.addEventListener("click", closeCompanyManager);
    document.getElementById("newCompanyButton")?.addEventListener("click", () => editCompany(""));
    document.getElementById("companyManagerForm")?.addEventListener("submit", saveCompanyForm);
    document.getElementById("companyManager")?.addEventListener("click", (event) => {
      if (event.target.id === "companyManager") closeCompanyManager();
    });
  }

  function renderCompanyManagerList() {
    const list = document.getElementById("companyManagerList");
    if (!list) return;
    list.innerHTML = companyEntries().map(([key, company]) => `
      <button class="company-manager-row${key === state.selectedCompany ? " selected" : ""}" type="button" data-edit-company="${escapeHtml(key)}">
        <span>${escapeHtml(company.name)}</span>
        <small>${escapeHtml(company.code)} · ${formatMoney(company.funds)}</small>
        <strong>编辑</strong>
      </button>
    `).join("");
    list.querySelectorAll("[data-edit-company]").forEach((button) => {
      button.addEventListener("click", () => editCompany(button.dataset.editCompany));
    });
  }

  function editCompany(companyKey) {
    const company = companyData[companyKey];
    const codeInput = document.getElementById("companyManagerCode");
    const nameInput = document.getElementById("companyManagerName");
    if (codeInput) codeInput.value = company?.code || "";
    if (nameInput) {
      nameInput.value = company?.name || "";
      nameInput.focus();
    }
  }

  function openCompanyManager() {
    ensureCompanyManager();
    renderCompanyManagerList();
    editCompany(state.selectedCompany);
    const manager = document.getElementById("companyManager");
    if (manager) manager.hidden = false;
  }

  function closeCompanyManager() {
    const manager = document.getElementById("companyManager");
    if (manager) manager.hidden = true;
  }

  async function saveCompanyForm(event) {
    event.preventDefault();
    const code = document.getElementById("companyManagerCode")?.value || "";
    const name = document.getElementById("companyManagerName")?.value.trim() || "";
    if (!name) return;
    const result = await postJson("/api/companies", { code, name });
    replaceCompanyData(result.companies || []);
    const savedKey = companyCodeToKey[code] || Object.values(companyData).find((company) => company.name === name)?.code || state.selectedCompany;
    if (companyData[savedKey]) state.selectedCompany = savedKey;
    renderCompanySurfaces();
    updateCompany(state.selectedCompany);
    renderCompanyManagerList();
    editCompany(state.selectedCompany);
    await loadPayrollSummary();
    await loadOverview();
  }

  async function loadCompanies() {
    try {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("companies unavailable");
      const data = await response.json();
      replaceCompanyData(data.companies || []);
    } catch (error) {
      companyCodeToKey = buildCompanyCodeToKey();
    }
    renderCompanySurfaces();
    updateCompany(state.selectedCompany);
  }

  function updateCompany(companyKey) {
    const company = companyData[companyKey];
    if (!company) return;
    state.selectedCompany = companyKey;
    state.selectedAccount = company.bankAccounts[0]?.id || "";

    syncCompanySelection();
    if (pendingPayrollImport) {
      pendingPayrollImport = null;
      payrollPreviewRows = [];
      selectedPayrollRowIndexes = new Set();
      renderPayrollPreview([]);
      setPayrollSaveButton(false, "保存");
    }

    setText("selectedCompanyBadge", company.name);
    setText("selectedCapitalCompanyBadge", company.name);
    setText("capitalUploadCompanyBadge", `当前公司：${company.name}`);
    setText("propertyUploadCompanyBadge", `当前公司：${company.name}`);
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
      tbody.innerHTML = '<tr><td colspan="9">暂无导入数据</td></tr>';
      updatePayrollSelectionSummary();
      return;
    }

    tbody.innerHTML = rows.map((row, index) => `
      <tr>
        <td class="select-cell">
          <input class="payroll-row-check" type="checkbox" data-payroll-row="${index}" aria-label="选择${escapeHtml(row.name || `第${index + 1}行`)}" ${selectedPayrollRowIndexes.has(index) ? "checked" : ""}>
        </td>
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
    updatePayrollSelectionSummary();
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

  async function readPayrollFile(file, sheetName = "") {
    setText("uploadFileName", file.name);
    pendingPayrollImport = null;
    payrollPreviewRows = [];
    selectedPayrollRowIndexes = new Set();
    setPayrollSaveButton(false, "读取中");

    const rows = await readSheetRows(file, null, sheetName);
    const payrollRows = mapPayrollRows(rows);
    payrollPreviewRows = payrollRows;
    selectedPayrollRowIndexes = new Set(payrollRows.map((_, index) => index));
    pendingPayrollImport = {
      company: selectedCompanyPayload(),
      period: document.getElementById("payrollPeriod")?.value || currentPeriod(),
      fileName: file.name,
      sheetName,
      rows: selectedPayrollRows()
    };
    renderPayrollPreview(payrollRows);
  }

  async function savePayrollImport() {
    if (!pendingPayrollImport || !pendingPayrollImport.rows.length) return;
    setPayrollSaveButton(false, "保存中");
    try {
      const result = await postJson("/api/import/payroll", pendingPayrollImport);
      pendingPayrollImport = null;
      setPayrollSaveButton(false, `已保存 ${result.rows}人`);
      await loadOverview();
      await loadPayrollSummary();
    } catch (error) {
      setPayrollSaveButton(true, "重试保存");
    }
  }

  async function readCapitalFile(file, sheetName = "") {
    setText("capitalUploadFileName", file.name);
    setText("capitalImportStatus", sheetName ? `读取Sheet：${sheetName}` : "读取中");

    const rows = await readSheetRows(file, "capitalImportStatus", sheetName);
    const capitalRows = mapCapitalRows(rows);
    const total = summarizeCapital(capitalRows);
    const selectedCompany = companyData[state.selectedCompany];

    setText("capitalImportRows", `${total.rows} 笔`);
    setText("capitalImportIn", formatMoney(total.income));
    setText("capitalImportOut", formatMoney(total.expense));
    setText("capitalImportNet", formatMoney(total.net));
    setText("capitalImportStatus", `${selectedCompany.name} · 已汇总${sheetName ? ` ${sheetName}` : ""}`);
    renderCapitalPreview(capitalRows);
    renderCashFlowSummary(capitalRows);

    try {
      const result = await postJson("/api/import/capital", {
        company: selectedCompanyPayload(),
        account: selectedAccountPayload(),
        fileName: file.name,
        sheetName,
        rows: capitalRows
      });
      setText("capitalImportStatus", `${selectedCompany.name} · 已写入MySQL ${result.inserted} 笔`);
      await loadOverview();
    } catch (error) {
      setText("capitalImportStatus", `${selectedCompany.name} · 已本地预览，未连接MySQL`);
    }
  }

  async function readPropertyFile(file, sheetName = "") {
    setText("propertyUploadFileName", file.name);
    setText("propertyImportStatus", sheetName ? `读取Sheet：${sheetName}` : "读取中");

    const rows = await readSheetRows(file, "propertyImportStatus", sheetName);
    const propertyRows = mapPropertyRows(rows);
    const total = summarizeProperty(propertyRows);
    const selectedCompany = companyData[state.selectedCompany];

    if (propertyRows.length) {
      selectedCompany.propertyExpenses = propertyRows;
    }

    setText("propertyImportRows", `${total.rows} 项`);
    setText("propertyImportCost", formatMoney(total.amount));
    setText("propertyImportStatus", `${selectedCompany.name} · 已读取${sheetName ? ` ${sheetName}` : ""}`);
    renderPropertyStats();

    try {
      const result = await postJson("/api/import/property", {
        company: selectedCompanyPayload(),
        period: document.getElementById("propertyPeriod")?.value || currentPeriod(),
        fileName: file.name,
        sheetName,
        rows: propertyRows
      });
      setText("propertyImportStatus", `${selectedCompany.name} · 已写入MySQL ${result.inserted} 项`);
      await loadOverview();
    } catch (error) {
      setText("propertyImportStatus", `${selectedCompany.name} · 已本地预览，未连接MySQL`);
    }
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

  function downloadPropertyTemplate() {
    const headers = ["月份", "物业所属", "费用类型", "收款方", "金额"];
    const rows = [
      [document.getElementById("propertyPeriod")?.value || currentPeriod(), "总部办公室", "房租", "办公楼业主", "12000"],
      [document.getElementById("propertyPeriod")?.value || currentPeriod(), "总部办公室", "物业费", "物业公司", "3500"],
      [document.getElementById("propertyPeriod")?.value || currentPeriod(), "总部办公室", "水电", "供电/供水", "2100"]
    ];
    downloadCsv(`${companyData[state.selectedCompany].name}_物业费用模板.csv`, [headers, ...rows]);
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

  function statusClass(company) {
    if (Number(company.net) > 0) return "good";
    if (Number(company.net) < 0) return "loss";
    return "steady";
  }

  function renderPayrollCompanySummary(companies) {
    const byKey = new Map();
    companies.forEach((company) => {
      const key = companyCodeToKey[company.code];
      if (key) byKey.set(key, company);
    });

    document.querySelectorAll(".payroll-company-card[data-company]").forEach((card) => {
      const key = card.dataset.company;
      const fallback = companyData[key];
      const company = byKey.get(key) || {};
      const name = company.name || fallback?.name || "";
      const employeeCount = Number(company.employeeCount || 0);
      const companyCost = Number(company.companyCost || 0);
      const socialFund = Number(company.social || 0) + Number(company.fund || 0);
      card.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <strong>${formatMoney(companyCost)}</strong>
        <small>${employeeCount}人 · 社保公积金 ${formatMoney(socialFund)}</small>
      `;
    });
  }

  async function loadPayrollSummary() {
    if (!document.getElementById("payrollEmployeeCount")) return;
    const period = document.getElementById("payrollPeriod")?.value || currentPeriod();
    try {
      const response = await fetch(`/api/payroll/summary?period=${encodeURIComponent(period)}`);
      if (!response.ok) return;
      const data = await response.json();
      const socialFund = Number(data.social || 0) + Number(data.fund || 0);
      setText("payrollEmployeeCount", `${Number(data.employeeCount || 0)} 人`);
      setText("payrollNetSalary", formatMoney(data.netSalary));
      setText("payrollTax", formatMoney(data.tax));
      setText("payrollSocialFund", formatMoney(socialFund));
      renderPayrollCompanySummary(data.companies || []);
    } catch (error) {
      // MySQL 未连接时保留页面上的示例数据。
    }
  }

  async function loadOverview() {
    if (!document.getElementById("todayIncomeMetric")) return;
    try {
      const response = await fetch("/api/overview");
      if (!response.ok) return;
      const data = await response.json();
      const companies = data.companies || [];
      setText("todayIncomeMetric", formatMoney(data.income));
      setText("todayExpenseMetric", formatMoney(data.expense));
      setText("todayNetMetric", formatMoney(data.net));
      setText("profitableCompanyMetric", `${data.profitableCompanies || 0} 家`);

      const grid = document.getElementById("companyStatusGrid");
      if (grid && companies.length) {
        grid.innerHTML = companies.map((company) => `
          <article class="status-card ${statusClass(company)}">
            <span>${escapeHtml(company.name)}</span>
            <strong>${escapeHtml(company.status)} ${formatMoney(company.net)}</strong>
            <small>收入 ${formatMoney(company.income)} · 支出 ${formatMoney(company.expense)}</small>
          </article>
        `).join("");
      }

      const tbody = document.getElementById("companyStatusBody");
      if (tbody && companies.length) {
        tbody.innerHTML = companies.map((company) => `
          <tr>
            <td>${escapeHtml(company.name)}</td>
            <td>${formatMoney(company.income)}</td>
            <td>${formatMoney(company.expense)}</td>
            <td class="${Number(company.net) >= 0 ? "positive" : "negative"}">${formatMoney(company.net)}</td>
            <td><span class="status-pill ${statusClass(company)}">${escapeHtml(company.status)}</span></td>
            <td>${Number(company.net) > 0 ? "今日现金流为正" : (Number(company.net) < 0 ? "今日支出高于收入" : "今日收支平稳")}</td>
          </tr>
        `).join("");
      }
    } catch (error) {
      // 本地静态预览没有后端时保留页面上的示例数据。
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-company]").forEach((node) => {
      node.addEventListener("click", () => updateCompany(node.dataset.company));
    });

    document.getElementById("payrollCompanySelect")?.addEventListener("change", (event) => {
      updateCompany(event.target.value);
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

    document.querySelectorAll("[data-open-property-file]").forEach((node) => {
      node.addEventListener("click", () => document.getElementById("propertyFile")?.click());
    });

    document.querySelectorAll(".file-action[for]").forEach((node) => {
      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        document.getElementById(node.getAttribute("for"))?.click();
      });
    });

    document.getElementById("payrollFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("payroll", file);
    });

    document.getElementById("capitalFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("capital", file);
    });

    document.getElementById("propertyFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("property", file);
    });

    document.getElementById("payrollPeriod")?.addEventListener("change", () => {
      pendingPayrollImport = null;
      setPayrollSaveButton(false, "保存");
      loadPayrollSummary();
    });

    document.querySelectorAll("[data-import-selected-sheet]").forEach((node) => {
      node.addEventListener("click", () => importSelectedSheet(node.dataset.importSelectedSheet));
    });

    document.getElementById("selectAllPayrollRows")?.addEventListener("change", (event) => {
      selectedPayrollRowIndexes = event.target.checked
        ? new Set(payrollPreviewRows.map((_, index) => index))
        : new Set();
      document.querySelectorAll(".payroll-row-check").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });
      updatePayrollSelectionSummary();
    });

    document.getElementById("payrollPreviewBody")?.addEventListener("change", (event) => {
      if (!event.target.classList.contains("payroll-row-check")) return;
      const index = Number(event.target.dataset.payrollRow);
      if (!Number.isInteger(index)) return;
      if (event.target.checked) {
        selectedPayrollRowIndexes.add(index);
      } else {
        selectedPayrollRowIndexes.delete(index);
      }
      updatePayrollSelectionSummary();
    });

    document.getElementById("savePayrollImport")?.addEventListener("click", savePayrollImport);

    document.getElementById("downloadTemplate")?.addEventListener("click", downloadPayrollTemplate);
    document.getElementById("downloadCapitalTemplate")?.addEventListener("click", downloadCapitalTemplate);
    document.getElementById("downloadPropertyTemplate")?.addEventListener("click", downloadPropertyTemplate);

    document.querySelectorAll(".nav-item").forEach((node) => {
      node.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
        node.classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll('input[type="month"][data-default-current]').forEach((node) => {
      if (!node.value) node.value = currentPeriod();
    });
    bindEvents();
    await loadCompanies();
    loadPayrollSummary();
    loadOverview();
  });
})();
