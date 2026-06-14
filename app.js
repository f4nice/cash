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
    selectedAccount: "tech-cmb-basic",
    capitalAsOfDate: ""
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
  let pendingCapitalImport = null;
  let payrollPreviewRows = [];
  let capitalPreviewRows = [];
  let selectedPayrollRowIndexes = new Set();
  let selectedSalaryBatchIds = new Set();
  let latestPayrollSummary = null;
  let latestProfitSummary = null;

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

  const capitalBankSuffixes = [
    ["建设银行", "建设银行"],
    ["招商银行", "招商银行"],
    ["江苏银行", "江苏银行"],
    ["交通银行", "交通银行"],
    ["兴业银行", "兴业银行"],
    ["工商银行", "工商银行"],
    ["农业银行", "农业银行"],
    ["中国银行", "中国银行"],
    ["建行", "建设银行"],
    ["招行", "招商银行"],
    ["江苏", "江苏银行"],
    ["交行", "交通银行"],
    ["兴业", "兴业银行"],
    ["工行", "工商银行"],
    ["农行", "农业银行"],
    ["中行", "中国银行"],
    ["支付宝", "支付宝"],
    ["微信", "微信支付"],
    ["证券", "证券账户"]
  ];

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

  function formatSignedMoney(value) {
    const amount = Number(value) || 0;
    const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `${prefix}${formatMoney(Math.abs(amount))}`;
  }

  function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(2)}%`;
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

  function selectedPayrollPeriod() {
    return document.getElementById("payrollPeriod")?.value || currentPeriod();
  }

  function shiftPeriod(period, offset) {
    const match = /^(\d{4})-(\d{2})$/.exec(period || currentPeriod());
    const year = match ? Number(match[1]) : new Date().getFullYear();
    const month = match ? Number(match[2]) - 1 : new Date().getMonth();
    const date = new Date(year, month + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function setPayrollPeriod(period) {
    const input = document.getElementById("payrollPeriod");
    if (input) input.value = period;
    handlePayrollPeriodChange();
  }

  function handlePayrollPeriodChange() {
    const period = selectedPayrollPeriod();
    if (pendingPayrollImport) pendingPayrollImport.period = period;
    loadPayrollSummary();
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const text = String(value).replace(" ", "T");
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function selectedCompanyPayload() {
    const company = companyData[state.selectedCompany];
    return {
      key: state.selectedCompany,
      code: company.code,
      name: company.name
    };
  }

  function selectedCompanyCode() {
    return companyData[state.selectedCompany]?.code || "";
  }

  function selectedAccountPayload() {
    const account = getSelectedAccount();
    if (!account) {
      return {
        key: "",
        bank: "",
        accountName: ""
      };
    }
    return {
      key: account.id,
      bank: account.bank,
      accountName: account.accountName
    };
  }

  function selectedCapitalAccountStatus() {
    const company = companyData[state.selectedCompany];
    const account = getSelectedAccount();
    if (!company || !account) return "等待上传";
    return `明细归属：${company.name} / ${account.bank} ${account.accountName}`;
  }

  function toCapitalMonth(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    return match ? `${match[1]}-${match[2]}` : "";
  }

  function capitalMonthToAsOf(value) {
    const month = toCapitalMonth(value);
    if (!month) return "";
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  function selectedCapitalDate() {
    return capitalMonthToAsOf(document.getElementById("capitalAsOfDate")?.value || state.capitalAsOfDate || "");
  }

  function setCapitalDateValue(value) {
    state.capitalAsOfDate = toCapitalMonth(value);
    const input = document.getElementById("capitalAsOfDate");
    if (input && input.value !== state.capitalAsOfDate) input.value = state.capitalAsOfDate;
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
      hidePayrollPreview();
    }
    if (kind === "capital") hideCapitalPreview();

    if (fileExt(file) === "csv") {
      hideSheetControl(kind);
      await importSelectedSheet(kind);
      return;
    }

    setText(ui.statusId, "读取Sheet列表");
    const workbook = await readWorkbook(file, ui.statusId);
    if (!workbook) return;
    showSheetControl(kind, workbook.SheetNames);
    if (kind === "capital" && workbook.SheetNames.length === 1) {
      setText(ui.statusId, "已自动读取唯一Sheet");
      await importSelectedSheet(kind);
      return;
    }
    setText(ui.statusId, "请选择Sheet后导入");
  }

  async function importSelectedSheet(kind) {
    const file = selectedUploadFiles[kind];
    const ui = uploadUi[kind];
    if (!file) {
      if (kind === "payroll") {
        pendingPayrollImport = null;
        hidePayrollPreview();
      }
      if (kind === "capital") hideCapitalPreview("请先选择Excel文件");
      setText(ui.statusId, "请先选择Excel文件");
      return;
    }
    const sheetName = document.getElementById(ui.sheetSelectId)?.value || "";
    if (kind === "payroll") await readPayrollFile(file, sheetName);
    if (kind === "capital") await readCapitalFile(file, sheetName);
    if (kind === "property") await readPropertyFile(file, sheetName);
  }

  function mapColumns(rows, aliasesMap, headerPattern) {
    if (!rows.length) return { columns: {}, startIndex: 0, headers: [], headerRowIndex: -1 };
    const headerRowIndex = rows.findIndex((row) => row.some((cell) => headerPattern.test(String(cell))));
    const headers = rows[headerRowIndex >= 0 ? headerRowIndex : 0] || [];
    const columns = Object.fromEntries(
      Object.entries(aliasesMap).map(([key, aliases]) => [key, findColumn(headers, aliases)])
    );
    return {
      columns,
      startIndex: (headerRowIndex >= 0 ? headerRowIndex : 0) + 1,
      headers,
      headerRowIndex
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

  function mapCapitalRows(rows, columnMap = null) {
    const company = companyData[state.selectedCompany];
    const account = getSelectedAccount();
    const { columns, startIndex } = columnMap || mapColumns(rows, capitalFieldAliases, /日期|交易|金额|余额|date|amount/i);

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

  function capitalColumnCount(rows) {
    return rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  function capitalColumnLabels(headers, columnCount) {
    return Array.from({ length: columnCount }, (_, index) => {
      const header = String(headers[index] || "").trim();
      return header ? `第${index + 1}列：${header}` : `第${index + 1}列`;
    });
  }

  function hasNumericContent(value) {
    return /-?\d/.test(String(value ?? ""));
  }

  function excelSerialDate(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 20000 || number > 80000) return "";
    const date = new Date(Date.UTC(1899, 11, 30) + number * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function capitalDateValue(value) {
    return capitalDateText(value);
  }

  function capitalYearValue(value) {
    const match = /(\d{4})/.exec(String(value || ""));
    return match ? match[1] : "";
  }

  function capitalDateText(value, year = "") {
    const serialDate = excelSerialDate(value);
    if (serialDate) return serialDate;
    const text = String(value || "").trim();
    if (!text) return "";

    let match = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/.exec(text);
    if (match) {
      return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
    }

    match = /^(\d{1,2})月(\d{1,2})日?$/.exec(text);
    if (match) {
      const selectedYear = year || String(new Date().getFullYear());
      return `${selectedYear}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
    }

    match = /^(\d{1,2})[-/.](\d{1,2})$/.exec(text);
    if (match) {
      const selectedYear = year || String(new Date().getFullYear());
      return `${selectedYear}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
    }

    return text;
  }

  function stableHash(text) {
    let hash = 0;
    String(text || "").split("").forEach((char) => {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
    });
    return hash.toString(36).toUpperCase();
  }

  function autoCompanyCode(shortName) {
    return `AUTO${stableHash(shortName).slice(0, 10)}`;
  }

  function companyForShortName(shortName) {
    const normalized = normalizeHeader(shortName);
    const found = companyEntries().find(([, company]) => normalizeHeader(company.name).includes(normalized));
    if (!found) return null;
    return {
      key: found[0],
      code: found[1].code,
      name: found[1].name
    };
  }

  function splitCapitalHeader(header) {
    return String(header || "")
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function parseCapitalMatrixHeader(header, index) {
    const parts = splitCapitalHeader(header);
    const first = parts[0] || `第${index + 1}列`;
    let companyShort = first;
    let bankShort = "";
    let bank = "默认银行";

    for (const [suffix, bankName] of capitalBankSuffixes) {
      if (first.endsWith(suffix) && first.length > suffix.length) {
        companyShort = first.slice(0, -suffix.length).trim();
        bankShort = suffix;
        bank = bankName;
        break;
      }
    }

    const matched = companyForShortName(companyShort);
    return {
      index,
      header: first,
      rawHeader: header,
      companyShort,
      companyCode: matched?.code || autoCompanyCode(companyShort),
      companyName: matched?.name || companyShort,
      bank,
      accountName: bankShort || parts[1] || "基本户",
      accountKey: `CAP${stableHash(`${companyShort}-${first}`).slice(0, 18)}`,
      bankMatched: Boolean(bankShort),
      selected: true
    };
  }

  function isCapitalMatrixHeader(header) {
    const text = String(header || "").trim();
    return text
      && !/^(年份|日期|总资金|合计|备注)$/i.test(text.replace(/\s+/g, ""))
      && !/备注|邮箱|说明/.test(text);
  }

  function detectCapitalMatrixColumns(rows, headers) {
    const columnCount = capitalColumnCount(rows);
    const columns = [];
    for (let index = 2; index < columnCount; index += 1) {
      const header = headers[index] || "";
      if (!isCapitalMatrixHeader(header)) continue;
      const numericCount = rows.slice(1).filter((row) => hasNumericContent(row[index])).length;
      if (!numericCount) continue;
      const parsed = parseCapitalMatrixHeader(header, index);
      if (!parsed.bankMatched) continue;
      columns.push({
        ...parsed,
        numericCount
      });
    }
    return columns;
  }

  function isCapitalMatrixSheet(rows, detected, headers) {
    if (rows.length < 2 || capitalColumnCount(rows) < 5) return false;
    const firstHeaders = headers.slice(0, 3).map((item) => normalizeHeader(item)).join("|");
    const matrixColumns = detectCapitalMatrixColumns(rows, headers);
    return matrixColumns.length >= 3 && (firstHeaders.includes("日期") || detected.columns.date === 1);
  }

  function renderCapitalDialogSummary() {
    const summary = document.getElementById("capitalDialogSummary");
    if (!summary || !pendingCapitalImport) return;
    const rowCount = pendingCapitalImport.rows.length;
    const dataRows = Math.max(rowCount - pendingCapitalImport.startIndex, 0);
    const selectedColumns = (pendingCapitalImport.matrixColumns || []).filter((column) => column.selected).length;
    const scopeLabel = pendingCapitalImport.mode === "matrix" ? "归档方式" : "当前公司";
    const scopeValue = pendingCapitalImport.mode === "matrix" ? "按列归到公司" : pendingCapitalImport.company.name;
    summary.innerHTML = `
      <article><span>表格行数</span><strong>${rowCount} 行</strong></article>
      <article><span>表格列数</span><strong>${pendingCapitalImport.columnCount} 列</strong></article>
      <article><span>${pendingCapitalImport.mode === "matrix" ? "选择资金列" : "数据行"}</span><strong>${pendingCapitalImport.mode === "matrix" ? `${selectedColumns} 列` : `${dataRows} 行`}</strong></article>
      <article><span>${scopeLabel}</span><strong>${escapeHtml(scopeValue)}</strong></article>
    `;
  }

  function renderCapitalRawPreview() {
    const head = document.getElementById("capitalRawPreviewHead");
    const body = document.getElementById("capitalRawPreviewBody");
    if (!head || !body || !pendingCapitalImport) return;
    const labels = pendingCapitalImport.columnLabels || [];
    if (!labels.length) {
      head.innerHTML = '<tr><th>暂无表格</th></tr>';
      body.innerHTML = '<tr><td>没有读取到表格列</td></tr>';
      return;
    }

    head.innerHTML = `<tr><th class="row-index-cell">行</th>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>`;
    const previewStart = pendingCapitalImport.startIndex < pendingCapitalImport.rows.length
      ? pendingCapitalImport.startIndex
      : 0;
    const previewRows = pendingCapitalImport.rows.slice(previewStart, previewStart + 20);
    if (!previewRows.length) {
      body.innerHTML = `<tr><td colspan="${labels.length + 1}">没有读取到可预览数据</td></tr>`;
      return;
    }
    body.innerHTML = previewRows.map((row, offset) => `
      <tr>
        <td class="row-index-cell">${previewStart + offset + 1}</td>
        ${labels.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}
      </tr>
    `).join("");
  }

  function setCapitalMatrixVisible(visible) {
    const panel = document.getElementById("capitalMatrixColumns");
    if (panel) panel.hidden = !visible;
  }

  function renderCapitalMatrixColumns() {
    const list = document.getElementById("capitalMatrixColumnList");
    if (!list || !pendingCapitalImport) return;
    const columns = pendingCapitalImport.matrixColumns || [];
    if (!columns.length) {
      list.innerHTML = '<div class="matrix-column-empty">没有识别到可导入的资金列</div>';
      return;
    }
    list.innerHTML = columns.map((column) => `
      <label class="matrix-column-item">
        <input class="capital-matrix-check" type="checkbox" data-matrix-column="${column.index}" ${column.selected ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(column.header)}</strong>
          <small>${escapeHtml(column.companyName)} · ${escapeHtml(column.bank)} ${escapeHtml(column.accountName)} · ${column.numericCount} 条余额</small>
        </span>
      </label>
    `).join("");
  }

  function selectedCapitalMatrixColumns() {
    return (pendingCapitalImport?.matrixColumns || []).filter((column) => column.selected);
  }

  function updateCapitalMatrixColumnSelection(index, checked) {
    if (!pendingCapitalImport) return;
    const column = (pendingCapitalImport.matrixColumns || []).find((item) => item.index === index);
    if (!column) return;
    column.selected = checked;
    renderCapitalDialogSummary();
    updateCapitalPreviewFromMapping();
  }

  function mapCapitalMatrixRows() {
    if (!pendingCapitalImport) return [];
    const dateColumn = pendingCapitalImport.dateColumn >= 0 ? pendingCapitalImport.dateColumn : 1;
    const rows = [];
    let activeYear = "";
    pendingCapitalImport.rows.slice(pendingCapitalImport.startIndex).forEach((row) => {
      activeYear = capitalYearValue(row[0]) || activeYear;
      const dateValue = capitalDateText(row[dateColumn], activeYear);
      if (!dateValue) return;
      selectedCapitalMatrixColumns().forEach((column) => {
        const rawBalance = row[column.index];
        if (!hasNumericContent(rawBalance)) return;
        rows.push({
          mode: "snapshot",
          date: dateValue,
          company: column.companyName,
          companyCode: column.companyCode,
          bank: column.bank,
          account: column.accountName,
          accountKey: column.accountKey,
          summary: `${column.header} 余额快照`,
          counterparty: column.header,
          income: 0,
          expense: 0,
          balance: parseAmount(rawBalance)
        });
      });
    });
    return rows;
  }

  function openCapitalPreviewDialog() {
    const dialog = document.getElementById("capitalPreviewDialog");
    if (dialog) dialog.hidden = false;
  }

  function closeCapitalPreviewDialog() {
    const dialog = document.getElementById("capitalPreviewDialog");
    if (dialog) dialog.hidden = true;
  }

  function renderCapitalColumnMapping(headers, columns) {
    const panel = document.getElementById("capitalColumnMapping");
    if (!panel) return;
    const options = ['<option value="-1">不导入</option>'].concat(
      headers.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`)
    ).join("");

    panel.querySelectorAll("[data-capital-field]").forEach((select) => {
      const field = select.dataset.capitalField;
      select.innerHTML = options;
      select.value = String(Number.isInteger(columns[field]) ? columns[field] : -1);
    });
    setCapitalMappingVisible(true);
  }

  function selectedCapitalColumns() {
    const columns = {};
    document.querySelectorAll("[data-capital-field]").forEach((select) => {
      columns[select.dataset.capitalField] = Number(select.value);
    });
    return columns;
  }

  function updateCapitalPreviewFromMapping() {
    if (!pendingCapitalImport) return;
    if (pendingCapitalImport.mode === "matrix") {
      capitalPreviewRows = mapCapitalMatrixRows();
      pendingCapitalImport.mappedRows = capitalPreviewRows;
      const dates = Array.from(new Set(capitalPreviewRows.map((row) => row.date))).sort();
      const latestDate = dates[dates.length - 1];
      const latestBalance = capitalPreviewRows
        .filter((row) => row.date === latestDate)
        .reduce((sum, row) => sum + row.balance, 0);
      setCapitalImportSummary(capitalPreviewRows, {
        label: "识别资金列",
        countUnit: "条",
        balance: latestBalance
      });
      renderCapitalPreview(capitalPreviewRows);
      renderCashFlowSummary(capitalPreviewRows);
      setCapitalSaveButton(capitalPreviewRows.length > 0);
      return;
    }

    capitalPreviewRows = mapCapitalRows(pendingCapitalImport.rows, {
      columns: selectedCapitalColumns(),
      startIndex: pendingCapitalImport.startIndex
    });
    pendingCapitalImport.mappedRows = capitalPreviewRows;

    const total = summarizeCapital(capitalPreviewRows);
    setCapitalImportSummary(capitalPreviewRows, {
      label: "读取流水",
      countUnit: "笔",
      income: total.income,
      expense: total.expense
    });
    renderCapitalPreview(capitalPreviewRows);
    renderCashFlowSummary(capitalPreviewRows);
    setCapitalSaveButton(capitalPreviewRows.length > 0);
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
    return company?.bankAccounts.find((account) => account.id === state.selectedAccount) || company?.bankAccounts[0] || null;
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

  function setPayrollPreviewVisible(visible) {
    const panel = document.getElementById("payrollPreviewPanel");
    if (panel) panel.hidden = !visible;
  }

  function hidePayrollPreview(label = "保存") {
    payrollPreviewRows = [];
    selectedPayrollRowIndexes = new Set();
    renderPayrollPreview([]);
    setPayrollSaveButton(false, label);
  }

  function setCapitalSaveButton(enabled, label = "保存导入") {
    const button = document.getElementById("saveCapitalImport");
    if (!button) return;
    button.disabled = !enabled;
    button.textContent = label;
  }

  function setCapitalMappingVisible(visible) {
    const panel = document.getElementById("capitalColumnMapping");
    if (panel) panel.hidden = !visible;
  }

  function setCapitalPreviewButtonVisible(visible) {
    const button = document.getElementById("openCapitalPreviewDialogButton");
    if (button) button.hidden = !visible;
  }

  function setCapitalImportSummary(rows, options = {}) {
    const count = rows.length;
    const countUnit = options.countUnit || "条";
    const label = options.label || "读取记录";
    if (Number.isFinite(options.income) || Number.isFinite(options.expense)) {
      const income = Number(options.income || 0);
      const expense = Number(options.expense || 0);
      setText("capitalImportSummary", `${label} ${count} ${countUnit} · 流入 ${formatMoney(income)} · 流出 ${formatMoney(expense)}`);
      return;
    }

    const balance = Number.isFinite(options.balance)
      ? options.balance
      : rows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    setText("capitalImportSummary", `${label} ${count} ${countUnit} · 余额合计 ${formatMoney(balance)}`);
  }

  function resetCapitalImportSummary() {
    setCapitalImportSummary([], { balance: 0 });
  }

  function hideCapitalPreview(label = "等待上传") {
    pendingCapitalImport = null;
    capitalPreviewRows = [];
    setCapitalMappingVisible(false);
    setCapitalMatrixVisible(false);
    setCapitalPreviewButtonVisible(false);
    closeCapitalPreviewDialog();
    setCapitalSaveButton(false, "保存导入");
    resetCapitalImportSummary();
    renderCapitalPreview([]);
    renderCashFlowSummary([]);
    setText("capitalImportStatus", label);
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
      bankAccounts,
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
      state.selectedAccount = companyData[state.selectedCompany].bankAccounts[0]?.id || "";
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

  function renderProfitCompanyOptions() {
    const select = document.getElementById("profitCompanySelect");
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

    document.querySelectorAll(".payroll-company-grid [data-company], .capital-company-grid [data-company], .property-company-grid [data-company], .profit-company-grid [data-company]").forEach((button) => {
      button.addEventListener("click", () => updateCompany(button.dataset.company));
    });
  }

  function renderCapitalTotals() {
    if (!document.getElementById("capitalTotalFunds")) return;
    const totalFunds = companyEntries().reduce((sum, [, company]) => sum + Number(company.funds || 0), 0);
    const accountCount = companyEntries().reduce((sum, [, company]) => sum + company.bankAccounts.length, 0);
    setText("capitalTotalFunds", formatMoney(totalFunds));
    setText("capitalAccountCount", `${accountCount} 个`);
  }

  function renderCompanySurfaces() {
    renderSidebarCompanies();
    renderPayrollCompanyOptions();
    renderProfitCompanyOptions();
    renderBaseCompanyCards();
    renderCapitalTotals();
  }

  function syncCompanySelection() {
    document.querySelectorAll("[data-company]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.company === state.selectedCompany);
    });
    const payrollCompanySelect = document.getElementById("payrollCompanySelect");
    if (payrollCompanySelect) payrollCompanySelect.value = state.selectedCompany;
    const profitCompanySelect = document.getElementById("profitCompanySelect");
    if (profitCompanySelect) profitCompanySelect.value = state.selectedCompany;
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
      <div class="company-manager-row${key === state.selectedCompany ? " selected" : ""}">
        <div class="company-manager-row-main">
          <span>${escapeHtml(company.name)}</span>
          <small>${escapeHtml(company.code)} · ${formatMoney(company.funds)}</small>
        </div>
        <div class="company-manager-row-actions">
          <button class="ghost-button" type="button" data-edit-company="${escapeHtml(key)}">编辑</button>
          <button class="ghost-button danger-button" type="button" data-delete-company="${escapeHtml(key)}">删除</button>
        </div>
      </div>
    `).join("");
    list.querySelectorAll("[data-edit-company]").forEach((button) => {
      button.addEventListener("click", () => editCompany(button.dataset.editCompany));
    });
    list.querySelectorAll("[data-delete-company]").forEach((button) => {
      button.addEventListener("click", () => deleteCompany(button.dataset.deleteCompany));
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

  async function deleteCompany(companyKey) {
    const company = companyData[companyKey];
    if (!company) return;
    const confirmed = window.confirm(`确认删除公司「${company.name}」吗？删除后页面不再显示，历史数据仍保留在 MySQL。`);
    if (!confirmed) return;

    const buttons = document.querySelectorAll("[data-delete-company]");
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      const result = await postJson("/api/companies/delete", { code: company.code });
      replaceCompanyData(result.companies || []);
      renderCompanySurfaces();
      updateCompany(state.selectedCompany);
      renderCompanyManagerList();
      editCompany(state.selectedCompany);
      await loadPayrollSummary();
      await loadOverview();
    } catch (error) {
      window.alert(error.message || "删除公司失败");
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  async function loadCompanies() {
    try {
      const asOf = selectedCapitalDate();
      const url = asOf ? `/api/companies?asOf=${encodeURIComponent(asOf)}` : "/api/companies";
      const response = await fetch(url);
      if (!response.ok) throw new Error("companies unavailable");
      const data = await response.json();
      if (data.asOf) setCapitalDateValue(data.asOf);
      if (Object.prototype.hasOwnProperty.call(data, "monthlyIncome")) {
        setText("capitalMonthlyIn", formatMoney(data.monthlyIncome));
      }
      if (Object.prototype.hasOwnProperty.call(data, "monthlyExpense")) {
        setText("capitalMonthlyOut", formatMoney(data.monthlyExpense));
      }
      replaceCompanyData(data.companies || []);
    } catch (error) {
      companyCodeToKey = buildCompanyCodeToKey();
    }
    renderCompanySurfaces();
    updateCompany(state.selectedCompany);
  }

  async function handleCapitalDateChange() {
    setCapitalDateValue(selectedCapitalDate());
    if (pendingCapitalImport) hideCapitalPreview(selectedCapitalAccountStatus());
    await loadCompanies();
  }

  async function showLatestCapitalDate() {
    setCapitalDateValue("");
    if (pendingCapitalImport) hideCapitalPreview(selectedCapitalAccountStatus());
    await loadCompanies();
  }

  function updateCompany(companyKey) {
    const company = companyData[companyKey];
    if (!company) return;
    state.selectedCompany = companyKey;
    state.selectedAccount = company.bankAccounts.some((account) => account.id === state.selectedAccount)
      ? state.selectedAccount
      : company.bankAccounts[0]?.id || "";

    syncCompanySelection();
    if (pendingPayrollImport) {
      pendingPayrollImport = null;
      hidePayrollPreview();
    }
    if (pendingCapitalImport) hideCapitalPreview();

    setText("selectedCompanyBadge", company.name);
    setText("selectedCapitalCompanyBadge", company.name);
    setText("capitalUploadCompanyBadge", `普通流水归属：${company.name}`);
    setText("propertyUploadCompanyBadge", `当前公司：${company.name}`);
    renderBankAccounts();
    renderPropertyStats();
    renderSelectedProfitCompany();
    renderSelectedPayrollMetrics();
  }

  function updateBankAccount(accountId) {
    const company = companyData[state.selectedCompany];
    const account = company?.bankAccounts.find((item) => item.id === accountId);
    const deleteButton = document.getElementById("deleteCapitalAccountRecords");
    if (!account) {
      state.selectedAccount = "";
      setText("selectedBankBadge", "暂无银行账户");
      setText("capitalUploadBankBadge", "当前银行：暂无账户");
      setText("capitalAccountActionHint", `${company?.name || "当前公司"} 暂无银行账户，上传资金表后会自动生成`);
      if (deleteButton) deleteButton.disabled = true;
      if (!pendingCapitalImport) setText("capitalImportStatus", "上传资金表后自动按列生成银行账户");
      return;
    }
    if (pendingCapitalImport) hideCapitalPreview();
    state.selectedAccount = accountId;
    if (deleteButton) deleteButton.disabled = false;

    document.querySelectorAll("[data-bank-account]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.bankAccount === accountId);
    });

    const label = `${account.bank} ${account.accountName}`;
    setText("selectedBankBadge", label);
    setText("capitalUploadBankBadge", `当前银行：${label}`);
    setText("capitalAccountActionHint", `当前选中：${company.name} / ${label}，上传明细会归到这里`);
    if (!pendingCapitalImport) {
      setText("capitalImportStatus", `明细归属：${company.name} / ${label}`);
    }
  }

  function ensureCapitalAccountDialog() {
    if (document.getElementById("capitalAccountDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="employee-dialog-backdrop" id="capitalAccountDialog" hidden>
        <section class="employee-dialog capital-account-dialog" role="dialog" aria-modal="true" aria-labelledby="capitalAccountDialogTitle">
          <div class="section-title-row">
            <div><p class="eyebrow">账户资金</p><h3 id="capitalAccountDialogTitle">资金变化</h3></div>
            <button class="ghost-button" type="button" id="closeCapitalAccountDialog">关闭</button>
          </div>
          <div class="employee-dialog-summary" id="capitalAccountDialogSummary"></div>
          <div class="account-change-strip" id="capitalAccountChangeStrip"></div>
          <div class="account-change-scroll">
            <section>
              <div class="account-change-section-title">
                <span>余额快照</span>
                <small>按上传资金表日期计算，每次变化为较上次余额</small>
              </div>
              <div class="table-wrap account-change-table-wrap">
                <table>
                  <thead><tr><th>日期</th><th>余额</th><th>较上次</th><th>保存时间</th><th>备注</th></tr></thead>
                  <tbody id="capitalAccountSnapshotBody"></tbody>
                </table>
              </div>
            </section>
            <section>
              <div class="account-change-section-title">
                <span>流水记录</span>
                <small>仅显示最近 80 条实际收支流水</small>
              </div>
              <div class="table-wrap account-change-table-wrap">
                <table>
                  <thead><tr><th>日期</th><th>方向</th><th>类别</th><th>对方户名</th><th>金额</th><th>来源</th></tr></thead>
                  <tbody id="capitalAccountTransactionBody"></tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    `);
    document.getElementById("closeCapitalAccountDialog")?.addEventListener("click", closeCapitalAccountDialog);
    document.getElementById("capitalAccountDialog")?.addEventListener("click", (event) => {
      if (event.target.id === "capitalAccountDialog") closeCapitalAccountDialog();
    });
  }

  function closeCapitalAccountDialog() {
    const dialog = document.getElementById("capitalAccountDialog");
    if (dialog) dialog.hidden = true;
  }

  function renderCapitalAccountDialog(data) {
    const summary = document.getElementById("capitalAccountDialogSummary");
    const strip = document.getElementById("capitalAccountChangeStrip");
    const snapshotBody = document.getElementById("capitalAccountSnapshotBody");
    const transactionBody = document.getElementById("capitalAccountTransactionBody");
    const snapshots = data.snapshots || [];
    const transactions = data.transactions || [];
    const currentBalance = Number(data.summary?.currentBalance || 0);
    const latestChange = Number(data.summary?.latestChange || 0);

    if (summary) {
      summary.innerHTML = `
        <article><span>当前余额</span><strong>${formatMoney(currentBalance)}</strong></article>
        <article><span>最近变化</span><strong class="${latestChange >= 0 ? "positive" : "negative"}">${formatSignedMoney(latestChange)}</strong></article>
        <article><span>累计流入</span><strong>${formatMoney(data.summary?.income || 0)}</strong></article>
        <article><span>累计流出</span><strong>${formatMoney(data.summary?.expense || 0)}</strong></article>
      `;
    }

    if (strip) {
      const recentSnapshots = snapshots.slice(-10);
      const maxBalance = Math.max(...recentSnapshots.map((row) => Math.abs(Number(row.balance || 0))), 1);
      strip.innerHTML = recentSnapshots.length ? recentSnapshots.map((row) => {
        const balance = Number(row.balance || 0);
        const change = Number(row.change || 0);
        const height = Math.max(12, Math.round((Math.abs(balance) / maxBalance) * 100));
        return `
          <div class="account-change-tile">
            <div class="account-change-bar" style="--height:${height}%"></div>
            <strong>${formatMoney(balance)}</strong>
            <span>${escapeHtml(formatDate(row.date))}</span>
            <small class="${change >= 0 ? "positive" : "negative"}">${formatSignedMoney(change)}</small>
          </div>
        `;
      }).join("") : '<div class="account-change-empty">暂无余额变化</div>';
    }

    if (snapshotBody) {
      snapshotBody.innerHTML = snapshots.length ? snapshots.slice().reverse().map((row) => {
        const change = Number(row.change || 0);
        return `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${formatMoney(row.balance)}</td>
            <td class="${change >= 0 ? "positive" : "negative"}">${row.change === null || row.change === undefined ? "-" : formatSignedMoney(change)}</td>
            <td>${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</td>
            <td>${escapeHtml(row.remark || "-")}</td>
          </tr>
        `;
      }).join("") : '<tr><td colspan="5">暂无余额快照</td></tr>';
    }

    if (transactionBody) {
      transactionBody.innerHTML = transactions.length ? transactions.map((row) => {
        const amount = Number(row.amount || 0);
        const isIn = row.direction === "in";
        return `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td class="${isIn ? "positive" : "negative"}">${isIn ? "流入" : "流出"}</td>
            <td>${escapeHtml(row.category || "-")}</td>
            <td>${escapeHtml(row.counterparty || "-")}</td>
            <td class="${isIn ? "positive" : "negative"}">${isIn ? formatMoney(amount) : `-${formatMoney(amount)}`}</td>
            <td>${escapeHtml(row.sourceDocNo || row.description || "-")}</td>
          </tr>
        `;
      }).join("") : '<tr><td colspan="6">暂无流水记录</td></tr>';
    }
  }

  async function openCapitalAccountDialog(accountId = state.selectedAccount) {
    if (accountId) updateBankAccount(accountId);
    const company = companyData[state.selectedCompany];
    const account = getSelectedAccount();
    if (!company || !account) return;

    ensureCapitalAccountDialog();
    setText("capitalAccountDialogTitle", `${company.name} / ${account.bank} ${account.accountName} 资金变化`);
    const dialog = document.getElementById("capitalAccountDialog");
    const summary = document.getElementById("capitalAccountDialogSummary");
    const strip = document.getElementById("capitalAccountChangeStrip");
    const snapshotBody = document.getElementById("capitalAccountSnapshotBody");
    const transactionBody = document.getElementById("capitalAccountTransactionBody");
    if (summary) summary.innerHTML = '<article><span>正在读取</span><strong>请稍候</strong></article>';
    if (strip) strip.innerHTML = "";
    if (snapshotBody) snapshotBody.innerHTML = '<tr><td colspan="5">正在读取资金变化</td></tr>';
    if (transactionBody) transactionBody.innerHTML = '<tr><td colspan="6">正在读取流水</td></tr>';
    if (dialog) dialog.hidden = false;

    try {
      const params = new URLSearchParams({
        company: company.code,
        account: account.id,
        bank: account.bank,
        accountName: account.accountName
      });
      const response = await fetch(`/api/capital/account-changes?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "资金变化读取失败");
      renderCapitalAccountDialog(data);
    } catch (error) {
      if (summary) summary.innerHTML = `<article><span>读取失败</span><strong>${escapeHtml(error.message || "请稍后重试")}</strong></article>`;
      if (snapshotBody) snapshotBody.innerHTML = '<tr><td colspan="5">暂无可显示数据</td></tr>';
      if (transactionBody) transactionBody.innerHTML = '<tr><td colspan="6">暂无可显示数据</td></tr>';
    }
  }

  function renderBankAccounts() {
    const company = companyData[state.selectedCompany];
    const list = document.getElementById("bankAccountList");
    if (!list) return;
    if (!company.bankAccounts.length) {
      list.innerHTML = '<div class="bank-account-empty">暂无银行账户</div>';
      updateBankAccount("");
      return;
    }

    list.innerHTML = company.bankAccounts.map((account) => `
      <button class="bank-account-button${account.id === state.selectedAccount ? " selected" : ""}" type="button" data-bank-account="${account.id}">
        <span>${escapeHtml(account.bank)}</span>
        <strong>${formatMoney(account.balance)}</strong>
        <small>${escapeHtml(account.accountName)}</small>
      </button>
    `).join("");

    list.querySelectorAll("[data-bank-account]").forEach((button) => {
      button.addEventListener("click", () => openCapitalAccountDialog(button.dataset.bankAccount));
    });

    updateBankAccount(state.selectedAccount);
  }

  async function deleteCurrentCapitalAccountRecords() {
    const company = companyData[state.selectedCompany];
    const account = getSelectedAccount();
    if (!company || !account) return;
    const label = `${company.name} / ${account.bank} ${account.accountName}`;
    const confirmed = window.confirm(`确认删除 ${label} 的资金明细和余额记录吗？账户名称会保留。`);
    if (!confirmed) return;

    const button = document.getElementById("deleteCapitalAccountRecords");
    const originalLabel = button?.textContent || "删除当前账户明细";
    if (button) {
      button.disabled = true;
      button.textContent = "删除中";
    }
    try {
      const result = await postJson("/api/capital/delete-account-records", {
        company: selectedCompanyPayload(),
        account: selectedAccountPayload()
      });
      pendingCapitalImport = null;
      capitalPreviewRows = [];
      setCapitalMappingVisible(false);
      setCapitalMatrixVisible(false);
      setCapitalPreviewButtonVisible(false);
      closeCapitalPreviewDialog();
      setCapitalSaveButton(false, "保存导入");
      resetCapitalImportSummary();
      renderCapitalPreview([]);
      renderCashFlowSummary([]);
      await loadCompanies();
      await loadOverview();
      setText("capitalImportStatus", `${label} · 已删除 ${result.deleted} 条资金记录`);
    } catch (error) {
      setText("capitalImportStatus", `${label} · 删除失败，请检查MySQL连接`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
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

  function selectedProfitPeriod() {
    return document.getElementById("profitPeriod")?.value || currentPeriod();
  }

  function profitCompanyRows() {
    const rows = latestProfitSummary?.companies || [];
    if (rows.length) return rows;
    return companyEntries().map(([, company]) => ({
      code: company.code,
      name: company.name,
      revenue: 0,
      expense: 0,
      netProfit: 0,
      margin: null,
      remark: ""
    }));
  }

  function selectedProfitRow() {
    const company = companyData[state.selectedCompany];
    return profitCompanyRows().find((item) => item.code === company?.code) || null;
  }

  function renderSelectedProfitCompany() {
    const company = companyData[state.selectedCompany];
    if (!company) return;
    setText("selectedProfitCompanyBadge", company.name);
    setText("profitEntryCompanyBadge", `当前公司：${company.name}`);
    const select = document.getElementById("profitCompanySelect");
    if (select) select.value = state.selectedCompany;
    document.querySelectorAll(".profit-company-grid [data-company]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.company === state.selectedCompany);
    });
    const row = selectedProfitRow();
    const revenueInput = document.getElementById("profitRevenue");
    const costInput = document.getElementById("profitCost");
    const netInput = document.getElementById("profitNet");
    const remarkInput = document.getElementById("profitRemark");
    if (row && document.activeElement !== revenueInput && document.activeElement !== costInput && document.activeElement !== netInput) {
      if (revenueInput) revenueInput.value = Number(row.revenue || 0) || "";
      if (costInput) costInput.value = Number(row.expense || 0) || "";
      if (netInput) netInput.value = Number(row.netProfit || 0) || "";
      if (remarkInput) remarkInput.value = row.remark || "";
    }
  }

  function renderProfitSummary(data) {
    latestProfitSummary = data || { companies: [] };
    const companies = profitCompanyRows();
    setText("profitTotalNet", formatMoney(data?.netProfit || 0));
    setText("profitPositiveCount", `${data?.positiveCompanyCount || 0} 家`);
    setText("profitTotalRevenue", formatMoney(data?.revenue || 0));
    setText("profitTotalExpense", formatMoney(data?.expense || 0));

    const grid = document.getElementById("profitCompanyGrid");
    if (grid) {
      grid.innerHTML = companies.map((item) => {
        const key = companyCodeToKey[item.code] || item.code;
        const net = Number(item.netProfit || 0);
        const status = net > 0 ? "盈利" : (net < 0 ? "亏损" : "平稳");
        const statusClassName = net > 0 ? "good" : (net < 0 ? "loss" : "steady");
        return `
          <button class="profit-company-card ${statusClassName}${key === state.selectedCompany ? " selected" : ""}" type="button" data-company="${escapeHtml(key)}">
            <span>${escapeHtml(item.name)}</span>
            <strong>${status} ${formatMoney(net)}</strong>
            <small>收入 ${formatMoney(item.revenue)} · 成本 ${formatMoney(item.expense)}</small>
          </button>
        `;
      }).join("");
      grid.querySelectorAll("[data-company]").forEach((button) => {
        button.addEventListener("click", () => updateCompany(button.dataset.company));
      });
    }

    const tbody = document.getElementById("profitCompanyBody");
    if (tbody) {
      tbody.innerHTML = companies.map((item) => {
        const net = Number(item.netProfit || 0);
        return `
          <tr class="${item.code === companyData[state.selectedCompany]?.code ? "selected-row" : ""}">
            <td>${escapeHtml(item.name)}</td>
            <td>${formatMoney(item.revenue)}</td>
            <td>${formatMoney(item.expense)}</td>
            <td class="${net >= 0 ? "positive" : "negative"}">${formatMoney(net)}</td>
            <td>${formatPercent(item.margin)}</td>
            <td>${escapeHtml(item.remark || "-")}</td>
          </tr>
        `;
      }).join("");
    }
    renderSelectedProfitCompany();
  }

  async function loadProfitSummary() {
    if (!document.getElementById("profit")) return;
    try {
      const response = await fetch(`/api/profit/summary?period=${encodeURIComponent(selectedProfitPeriod())}`);
      if (!response.ok) throw new Error("profit summary unavailable");
      renderProfitSummary(await response.json());
    } catch (error) {
      renderProfitSummary({ companies: [] });
    }
  }

  async function saveProfitMonthly(event) {
    event.preventDefault();
    const company = companyData[state.selectedCompany];
    if (!company) return;
    const revenueValue = document.getElementById("profitRevenue")?.value || "";
    const costValue = document.getElementById("profitCost")?.value || "";
    const netValue = document.getElementById("profitNet")?.value || "";
    if (!revenueValue && !costValue && !netValue) {
      setText("profitEntryStatus", "请至少填写本月利润");
      return;
    }
    const button = document.querySelector("#profitEntryForm button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = "保存中";
    }
    try {
      const result = await postJson("/api/profit/monthly", {
        company: selectedCompanyPayload(),
        period: selectedProfitPeriod(),
        revenue: revenueValue,
        cost: costValue,
        netProfit: netValue,
        remark: document.getElementById("profitRemark")?.value || ""
      });
      setText("profitEntryStatus", `${company.name} · ${selectedProfitPeriod()} 利润已保存`);
      renderProfitSummary(result);
      await loadOverview();
    } catch (error) {
      setText("profitEntryStatus", error.message || "利润保存失败");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "保存利润";
      }
    }
  }

  function setProfitPeriod(period) {
    const input = document.getElementById("profitPeriod");
    if (input) input.value = period;
    loadProfitSummary();
  }

  function selectedPropertyPeriod() {
    return document.getElementById("propertyPeriod")?.value || currentPeriod();
  }

  function propertyPeriodStartDate() {
    return `${selectedPropertyPeriod()}-01`;
  }

  function setPropertyExpenseType(type) {
    const value = type || "房租";
    const input = document.getElementById("propertyExpenseType");
    if (input) input.value = value;
    document.querySelectorAll("[data-property-type]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.propertyType === value);
    });
    setText("propertyImportStatus", `已选择：${value}`);
  }

  function syncPropertyExpenseDefaults() {
    const company = companyData[state.selectedCompany];
    const dateInput = document.getElementById("propertyExpenseDate");
    const propertyInput = document.getElementById("propertyExpenseName");
    if (dateInput && !dateInput.value) dateInput.value = propertyPeriodStartDate();
    if (propertyInput && !propertyInput.value && company?.propertyExpenses?.length) {
      propertyInput.placeholder = `例如：${company.propertyExpenses[0].property}`;
    }
  }

  async function loadPropertySummary() {
    if (!document.getElementById("property")) return;
    try {
      const period = selectedPropertyPeriod();
      const response = await fetch(`/api/property/summary?period=${encodeURIComponent(period)}`);
      if (!response.ok) throw new Error("property summary unavailable");
      const data = await response.json();
      (data.companies || []).forEach((company) => {
        const key = companyCodeToKey[company.code];
        if (!key || !companyData[key]) return;
        companyData[key].propertyExpenses = (company.expenses || []).map((item) => ({
          period: item.period || data.period || period,
          date: item.date || "",
          property: item.property || "未填写物业",
          type: item.type || "物业费",
          vendor: item.vendor || "-",
          amount: Number(item.amount || 0)
        }));
      });
      renderCompanySurfaces();
      updateCompany(state.selectedCompany);
    } catch (error) {
      renderPropertyStats();
    }
  }

  async function savePropertyExpense(event) {
    event.preventDefault();
    const company = companyData[state.selectedCompany];
    if (!company) return;
    const type = document.getElementById("propertyExpenseType")?.value || "房租";
    const amount = parseAmount(document.getElementById("propertyExpenseAmount")?.value);
    if (amount <= 0) {
      setText("propertyImportStatus", "请输入大于 0 的金额");
      return;
    }
    const row = {
      period: selectedPropertyPeriod(),
      date: document.getElementById("propertyExpenseDate")?.value || propertyPeriodStartDate(),
      property: document.getElementById("propertyExpenseName")?.value.trim() || "未填写物业",
      type,
      vendor: document.getElementById("propertyExpenseVendor")?.value.trim() || "-",
      amount
    };
    const button = document.querySelector("#propertyExpenseForm button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = "保存中";
    }
    try {
      const result = await postJson("/api/import/property", {
        company: selectedCompanyPayload(),
        period: row.period,
        rows: [row]
      });
      setText("propertyImportStatus", `${company.name} · 已保存 ${type} ${formatMoney(result.amount || amount)}`);
      const amountInput = document.getElementById("propertyExpenseAmount");
      if (amountInput) amountInput.value = "";
      await loadPropertySummary();
      await loadOverview();
    } catch (error) {
      setText("propertyImportStatus", error.message || "保存失败，请检查 MySQL");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "保存消费项目";
      }
    }
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
    setText("propertyUploadCompanyBadge", `当前公司：${company.name}`);
    setText("propertyMonthlyTotal", formatMoney(allTotal));
    setText("propertyCompanyTotal", formatMoney(companyTotal));
    setText("propertyItemCount", `${companyRows.length} 项`);
    setText("propertyMainType", `${topType[0]} ${formatMoney(topType[1])}`);
    syncPropertyExpenseDefaults();

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
    if (!entries.length) {
      list.innerHTML = '<div class="property-category-empty">暂无费用项目</div>';
      return;
    }
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
    setPayrollPreviewVisible(rows.length > 0);
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
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8">暂无导入预览</td></tr>';
      return;
    }

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
    setPayrollPreviewVisible(false);
    setPayrollSaveButton(false, "读取中");

    const rows = await readSheetRows(file, null, sheetName);
    const payrollRows = mapPayrollRows(rows);
    payrollPreviewRows = payrollRows;
    selectedPayrollRowIndexes = new Set(payrollRows.map((_, index) => index));
    pendingPayrollImport = {
      company: selectedCompanyPayload(),
      period: selectedPayrollPeriod(),
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
      hidePayrollPreview(`已保存 ${result.rows}人`);
      await loadOverview();
      await loadPayrollSummary();
    } catch (error) {
      setPayrollSaveButton(true, "重试保存");
    }
  }

  async function readCapitalFile(file, sheetName = "") {
    setText("capitalUploadFileName", file.name);
    setText("capitalImportStatus", sheetName ? `读取Sheet：${sheetName}` : "读取中");
    pendingCapitalImport = null;
    capitalPreviewRows = [];
    setCapitalSaveButton(false, "读取中");

    const rows = await readSheetRows(file, "capitalImportStatus", sheetName);
    const detected = mapColumns(rows, capitalFieldAliases, /日期|交易|金额|余额|date|amount/i);
    const columnCount = capitalColumnCount(rows);
    const columnLabels = capitalColumnLabels(detected.headers, columnCount);
    const isMatrix = isCapitalMatrixSheet(rows, detected, detected.headers);
    const matrixColumns = isMatrix ? detectCapitalMatrixColumns(rows, detected.headers) : [];
    const selectedCompany = companyData[state.selectedCompany];

    pendingCapitalImport = {
      mode: isMatrix ? "matrix" : "flow",
      company: selectedCompanyPayload(),
      account: selectedAccountPayload(),
      fileName: file.name,
      sheetName,
      rows,
      startIndex: detected.startIndex,
      dateColumn: detected.columns.date >= 0 ? detected.columns.date : 1,
      columnCount,
      columnLabels,
      matrixColumns,
      mappedRows: []
    };
    renderCapitalDialogSummary();
    if (isMatrix) {
      setCapitalMappingVisible(false);
      setCapitalMatrixVisible(true);
      renderCapitalMatrixColumns();
    } else {
      setCapitalMatrixVisible(false);
      renderCapitalColumnMapping(columnLabels, detected.columns);
    }
    renderCapitalRawPreview();
    updateCapitalPreviewFromMapping();
    setCapitalPreviewButtonVisible(true);
    openCapitalPreviewDialog();
    setText("capitalImportStatus", isMatrix
      ? `多公司资金表 · 已识别${matrixColumns.length}列，请确认后保存`
      : `${selectedCompany.name} · 已读取${sheetName ? ` ${sheetName}` : ""}，请确认列后保存`);
  }

  async function saveCapitalImport() {
    if (!pendingCapitalImport || !capitalPreviewRows.length) return;
    const mode = pendingCapitalImport.mode;
    const payload = {
      company: pendingCapitalImport.company,
      account: pendingCapitalImport.account,
      fileName: pendingCapitalImport.fileName,
      sheetName: pendingCapitalImport.sheetName,
      rows: capitalPreviewRows
    };
    setCapitalSaveButton(false, "保存中");
    try {
      const result = await postJson("/api/import/capital", payload);
      pendingCapitalImport = null;
      setCapitalSaveButton(false, "已保存");
      setCapitalPreviewButtonVisible(false);
      closeCapitalPreviewDialog();
      setText("capitalImportStatus", mode === "matrix"
        ? `多公司资金表 · 已写入MySQL ${result.inserted} 条余额`
        : `${payload.company.name} · 已写入MySQL ${result.inserted} 笔`);
      setCapitalDateValue("");
      await loadCompanies();
      await loadOverview();
    } catch (error) {
      setCapitalSaveButton(true, "重试保存");
      setText("capitalImportStatus", `${mode === "matrix" ? "多公司资金表" : payload.company.name} · 保存失败，请检查MySQL连接`);
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

  function selectedPayrollCompanySummary(summary = latestPayrollSummary) {
    const code = selectedCompanyCode();
    const company = (summary?.companies || []).find((item) => item.code === code);
    return company || {
      code,
      employeeCount: 0,
      netSalary: 0,
      tax: 0,
      social: 0,
      fund: 0,
      companyCost: 0
    };
  }

  function renderSelectedPayrollMetrics(summary = latestPayrollSummary) {
    if (!document.getElementById("payrollEmployeeCount")) return;
    const company = selectedPayrollCompanySummary(summary);
    const socialFund = Number(company.social || 0) + Number(company.fund || 0);
    setText("payrollEmployeeCount", `${Number(company.employeeCount || 0)} 人`);
    setText("payrollNetSalary", formatMoney(company.netSalary));
    setText("payrollTax", formatMoney(company.tax));
    setText("payrollSocialFund", formatMoney(socialFund));
  }

  function ensurePayrollEmployeeDialog() {
    if (document.getElementById("payrollEmployeeDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="employee-dialog-backdrop" id="payrollEmployeeDialog" hidden>
        <section class="employee-dialog" role="dialog" aria-modal="true" aria-labelledby="payrollEmployeeDialogTitle">
          <div class="section-title-row">
            <div><p class="eyebrow">员工明细</p><h3 id="payrollEmployeeDialogTitle">本月员工列表</h3></div>
            <button class="ghost-button" type="button" id="closePayrollEmployees">关闭</button>
          </div>
          <div class="employee-dialog-summary" id="payrollEmployeeDialogSummary"></div>
          <div class="table-wrap employee-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>公司</th>
                  <th>员工</th>
                  <th>应发工资</th>
                  <th>实发工资</th>
                  <th>个税</th>
                  <th>个人社保</th>
                  <th>公司社保</th>
                  <th>公积金合计</th>
                  <th>公司人工成本</th>
                </tr>
              </thead>
              <tbody id="payrollEmployeeListBody"><tr><td colspan="9">暂无员工数据</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>
    `);
    document.getElementById("closePayrollEmployees")?.addEventListener("click", closePayrollEmployees);
    document.getElementById("payrollEmployeeDialog")?.addEventListener("click", (event) => {
      if (event.target.id === "payrollEmployeeDialog") closePayrollEmployees();
    });
  }

  function closePayrollEmployees() {
    const dialog = document.getElementById("payrollEmployeeDialog");
    if (dialog) dialog.hidden = true;
  }

  function renderPayrollEmployeeList(data) {
    const summary = document.getElementById("payrollEmployeeDialogSummary");
    const tbody = document.getElementById("payrollEmployeeListBody");
    const employees = data.employees || [];
    if (summary) {
      summary.innerHTML = `
        <article><span>员工</span><strong>${Number(data.employeeCount || 0)} 人</strong></article>
        <article><span>实发工资</span><strong>${formatMoney(data.netSalary)}</strong></article>
        <article><span>个税</span><strong>${formatMoney(data.tax)}</strong></article>
        <article><span>社保公积金</span><strong>${formatMoney(Number(data.social || 0) + Number(data.fund || 0))}</strong></article>
      `;
    }
    if (!tbody) return;
    if (!employees.length) {
      tbody.innerHTML = '<tr><td colspan="9">暂无员工数据</td></tr>';
      return;
    }
    tbody.innerHTML = employees.map((employee) => `
      <tr>
        <td>${escapeHtml(employee.companyName || "-")}</td>
        <td>${escapeHtml(employee.employeeName || "-")}</td>
        <td>${formatMoney(employee.grossSalary)}</td>
        <td>${formatMoney(employee.netSalary)}</td>
        <td>${formatMoney(employee.tax)}</td>
        <td>${formatMoney(employee.employeeSocial)}</td>
        <td>${formatMoney(employee.employerSocial)}</td>
        <td>${formatMoney(employee.fundTotal)}</td>
        <td>${formatMoney(employee.companyCost)}</td>
      </tr>
    `).join("");
  }

  async function openPayrollEmployees() {
    ensurePayrollEmployeeDialog();
    const dialog = document.getElementById("payrollEmployeeDialog");
    const tbody = document.getElementById("payrollEmployeeListBody");
    const period = selectedPayrollPeriod();
    if (dialog) dialog.hidden = false;
    if (tbody) tbody.innerHTML = '<tr><td colspan="9">读取中</td></tr>';
    try {
      const params = new URLSearchParams({ period });
      const companyCode = selectedCompanyCode();
      if (companyCode) params.set("company", companyCode);
      const response = await fetch(`/api/payroll/employees?${params.toString()}`);
      if (!response.ok) throw new Error("employees unavailable");
      const data = await response.json();
      renderPayrollEmployeeList(data);
    } catch (error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="9">员工列表读取失败</td></tr>';
    }
  }

  function ensurePayrollSalaryDialog() {
    if (document.getElementById("payrollSalaryDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="employee-dialog-backdrop" id="payrollSalaryDialog" hidden>
        <section class="employee-dialog salary-dialog" role="dialog" aria-modal="true" aria-labelledby="payrollSalaryDialogTitle">
          <div class="section-title-row">
            <div><p class="eyebrow">实发工资明细</p><h3 id="payrollSalaryDialogTitle">实发工资记账明细</h3></div>
            <div class="salary-dialog-actions">
              <button class="ghost-button danger-button" type="button" id="deletePayrollSalaryBatches" disabled>删除选中</button>
              <button class="ghost-button" type="button" id="closePayrollSalaryDetails">关闭</button>
            </div>
          </div>
          <div class="employee-dialog-summary" id="payrollSalaryDialogSummary"></div>
          <div class="table-wrap employee-table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="select-cell"><input id="selectAllSalaryBatches" type="checkbox" aria-label="全选工资记录"></th>
                  <th>公司</th>
                  <th>所属月份</th>
                  <th>状态</th>
                  <th>实发工资</th>
                  <th>员工</th>
                  <th>记账日期</th>
                  <th>保存时间</th>
                  <th>来源文件</th>
                  <th>批次号</th>
                </tr>
              </thead>
              <tbody id="payrollSalaryDetailBody"><tr><td colspan="10">暂无实发工资明细</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>
    `);
    document.getElementById("closePayrollSalaryDetails")?.addEventListener("click", closePayrollSalaryDetails);
    document.getElementById("deletePayrollSalaryBatches")?.addEventListener("click", deleteSelectedPayrollSalaryBatches);
    document.getElementById("selectAllSalaryBatches")?.addEventListener("change", (event) => {
      const checks = Array.from(document.querySelectorAll(".salary-batch-check"));
      selectedSalaryBatchIds = event.target.checked
        ? new Set(checks.map((check) => Number(check.dataset.batchId)).filter(Boolean))
        : new Set();
      checks.forEach((check) => {
        check.checked = event.target.checked;
      });
      updateSalaryBatchSelection();
    });
    document.getElementById("payrollSalaryDetailBody")?.addEventListener("change", (event) => {
      if (!event.target.classList.contains("salary-batch-check")) return;
      const batchId = Number(event.target.dataset.batchId);
      if (!Number.isInteger(batchId)) return;
      if (event.target.checked) {
        selectedSalaryBatchIds.add(batchId);
      } else {
        selectedSalaryBatchIds.delete(batchId);
      }
      updateSalaryBatchSelection();
    });
    document.getElementById("payrollSalaryDialog")?.addEventListener("click", (event) => {
      if (event.target.id === "payrollSalaryDialog") closePayrollSalaryDetails();
    });
  }

  function closePayrollSalaryDetails() {
    const dialog = document.getElementById("payrollSalaryDialog");
    if (dialog) dialog.hidden = true;
  }

  function updateSalaryBatchSelection() {
    const checks = Array.from(document.querySelectorAll(".salary-batch-check"));
    const selectAll = document.getElementById("selectAllSalaryBatches");
    const deleteButton = document.getElementById("deletePayrollSalaryBatches");
    if (selectAll) {
      selectAll.checked = checks.length > 0 && checks.every((check) => check.checked);
      selectAll.indeterminate = checks.some((check) => check.checked) && !selectAll.checked;
    }
    if (deleteButton) {
      const count = selectedSalaryBatchIds.size;
      deleteButton.disabled = count === 0;
      deleteButton.textContent = count ? `删除选中 ${count}` : "删除选中";
    }
  }

  async function loadPayrollSalaryDetailsIntoDialog() {
    const tbody = document.getElementById("payrollSalaryDetailBody");
    const period = selectedPayrollPeriod();
    if (tbody) tbody.innerHTML = '<tr><td colspan="10">读取中</td></tr>';
    const params = new URLSearchParams({ period });
    const companyCode = selectedCompanyCode();
    if (companyCode) params.set("company", companyCode);
    const response = await fetch(`/api/payroll/salary-details?${params.toString()}`);
    if (!response.ok) throw new Error("salary details unavailable");
    const data = await response.json();
    renderPayrollSalaryDetails(data);
  }

  async function deleteSelectedPayrollSalaryBatches() {
    const batchIds = Array.from(selectedSalaryBatchIds);
    if (!batchIds.length) return;
    if (!window.confirm(`确定删除选中的 ${batchIds.length} 条工资记录？删除后本月汇总会重新计算。`)) return;
    const button = document.getElementById("deletePayrollSalaryBatches");
    if (button) {
      button.disabled = true;
      button.textContent = "删除中";
    }
    try {
      await postJson("/api/payroll/delete-batches", { batchIds });
      selectedSalaryBatchIds = new Set();
      await loadPayrollSummary();
      await loadPayrollSalaryDetailsIntoDialog();
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = `重试删除 ${batchIds.length}`;
      }
    }
  }

  function renderPayrollSalaryDetails(data) {
    const summary = document.getElementById("payrollSalaryDialogSummary");
    const tbody = document.getElementById("payrollSalaryDetailBody");
    const batches = data.batches || [];
    const history = data.history || batches;
    const audit = data.audit || {};
    const recordCount = Number(audit.recordCount ?? history.length);
    const voidedCount = Number(audit.voidedBatchCount || 0);
    const duplicateLabel = audit.duplicateRisk
      ? "需检查"
      : (!batches.length && recordCount > 0 ? "已删除" : (voidedCount > 0 ? "已替换不重复" : "无重复"));
    selectedSalaryBatchIds = new Set();
    if (summary) {
      summary.innerHTML = `
        <article><span>实发工资</span><strong>${formatMoney(data.netSalary)}</strong></article>
        <article><span>计入员工</span><strong>${Number(data.employeeCount || 0)} 人</strong></article>
        <article><span>本月记录</span><strong>${recordCount} 次</strong></article>
        <article><span>重复状态</span><strong>${duplicateLabel}</strong></article>
      `;
    }
    if (!tbody) return;
    if (!history.length) {
      tbody.innerHTML = '<tr><td colspan="10">暂无实发工资明细</td></tr>';
      updateSalaryBatchSelection();
      return;
    }
    tbody.innerHTML = history.map((batch) => {
      const isDeleted = batch.status === "voided" && String(batch.remark || "").includes("删除");
      const statusText = batch.isActive
        ? "计入汇总"
        : (isDeleted ? "已删除" : (batch.status === "voided" ? "已替换" : "未计入"));
      return `
      <tr>
        <td class="select-cell"><input class="salary-batch-check" type="checkbox" data-batch-id="${Number(batch.batchId || 0)}" aria-label="选择工资记录"></td>
        <td>${escapeHtml(batch.companyName || "-")}</td>
        <td>${escapeHtml(batch.period || data.period || "-")}</td>
        <td><span class="status-pill ${batch.isActive ? "good" : (batch.status === "voided" ? "steady" : "loss")}">${statusText}</span></td>
        <td>${formatMoney(batch.netSalary)}</td>
        <td>${Number(batch.employeeCount || 0)} 人</td>
        <td>${escapeHtml(formatDate(batch.bookedDate))}</td>
        <td>${escapeHtml(formatDateTime(batch.importedAt || batch.createdAt))}</td>
        <td>${escapeHtml(batch.fileName || batch.remark || "-")}</td>
        <td>${escapeHtml(batch.importNo || "-")}</td>
      </tr>
    `;
    }).join("");
    updateSalaryBatchSelection();
  }

  async function openPayrollSalaryDetails() {
    ensurePayrollSalaryDialog();
    const dialog = document.getElementById("payrollSalaryDialog");
    const tbody = document.getElementById("payrollSalaryDetailBody");
    if (dialog) dialog.hidden = false;
    try {
      await loadPayrollSalaryDetailsIntoDialog();
    } catch (error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="10">实发工资明细读取失败</td></tr>';
    }
  }

  async function loadPayrollSummary() {
    if (!document.getElementById("payrollEmployeeCount")) return;
    const period = selectedPayrollPeriod();
    try {
      const response = await fetch(`/api/payroll/summary?period=${encodeURIComponent(period)}`);
      if (!response.ok) return;
      const data = await response.json();
      latestPayrollSummary = data;
      renderSelectedPayrollMetrics(data);
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
      if (data.period) {
        const [year, month] = String(data.period).split("-");
        setText("overviewPeriodLabel", `${year}年${Number(month)}月 · 月度经营`);
      }
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
            <td>${Number(company.net) > 0 ? "本月现金流为正" : (Number(company.net) < 0 ? "本月支出高于收入" : "本月收支平稳")}</td>
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

    document.getElementById("profitCompanySelect")?.addEventListener("change", (event) => {
      updateCompany(event.target.value);
    });

    document.getElementById("capitalAsOfDate")?.addEventListener("change", handleCapitalDateChange);
    document.getElementById("capitalLatestDate")?.addEventListener("click", showLatestCapitalDate);

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

    document.querySelectorAll("[data-property-type]").forEach((node) => {
      node.addEventListener("click", () => setPropertyExpenseType(node.dataset.propertyType));
    });

    document.getElementById("propertyExpenseForm")?.addEventListener("submit", savePropertyExpense);

    document.querySelectorAll(".file-action[for]").forEach((node) => {
      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        document.getElementById(node.getAttribute("for"))?.click();
      });
    });

    document.getElementById("payrollFile")?.addEventListener("click", () => {
      pendingPayrollImport = null;
      hidePayrollPreview();
    });

    document.getElementById("payrollFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("payroll", file);
    });

    document.getElementById("capitalFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("capital", file);
    });

    document.getElementById("capitalFile")?.addEventListener("click", () => {
      hideCapitalPreview(selectedCapitalAccountStatus());
    });

    document.getElementById("deleteCapitalAccountRecords")?.addEventListener("click", deleteCurrentCapitalAccountRecords);

    document.getElementById("propertyFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) prepareUploadFile("property", file);
    });

    document.getElementById("propertyPeriod")?.addEventListener("change", () => {
      const dateInput = document.getElementById("propertyExpenseDate");
      if (dateInput) dateInput.value = propertyPeriodStartDate();
      loadPropertySummary();
    });

    document.getElementById("profitPeriod")?.addEventListener("change", loadProfitSummary);
    document.getElementById("profitPrevMonth")?.addEventListener("click", () => {
      setProfitPeriod(shiftPeriod(selectedProfitPeriod(), -1));
    });
    document.getElementById("profitNextMonth")?.addEventListener("click", () => {
      setProfitPeriod(shiftPeriod(selectedProfitPeriod(), 1));
    });
    document.getElementById("profitEntryForm")?.addEventListener("submit", saveProfitMonthly);

    document.getElementById("payrollPeriod")?.addEventListener("change", handlePayrollPeriodChange);
    document.getElementById("payrollPrevMonth")?.addEventListener("click", () => {
      setPayrollPeriod(shiftPeriod(selectedPayrollPeriod(), -1));
    });
    document.getElementById("payrollNextMonth")?.addEventListener("click", () => {
      setPayrollPeriod(shiftPeriod(selectedPayrollPeriod(), 1));
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
    document.getElementById("saveCapitalImport")?.addEventListener("click", saveCapitalImport);
    document.getElementById("openCapitalPreviewDialogButton")?.addEventListener("click", openCapitalPreviewDialog);
    document.getElementById("closeCapitalPreviewDialog")?.addEventListener("click", closeCapitalPreviewDialog);
    document.getElementById("capitalPreviewDialog")?.addEventListener("click", (event) => {
      if (event.target.id === "capitalPreviewDialog") closeCapitalPreviewDialog();
    });

    document.getElementById("capitalColumnMapping")?.addEventListener("change", (event) => {
      if (!event.target.matches("[data-capital-field]")) return;
      updateCapitalPreviewFromMapping();
    });

    document.getElementById("capitalMatrixColumnList")?.addEventListener("change", (event) => {
      if (!event.target.classList.contains("capital-matrix-check")) return;
      updateCapitalMatrixColumnSelection(Number(event.target.dataset.matrixColumn), event.target.checked);
    });

    document.getElementById("downloadTemplate")?.addEventListener("click", downloadPayrollTemplate);
    document.getElementById("downloadCapitalTemplate")?.addEventListener("click", downloadCapitalTemplate);
    document.getElementById("downloadPropertyTemplate")?.addEventListener("click", downloadPropertyTemplate);
    document.getElementById("openPayrollEmployees")?.addEventListener("click", openPayrollEmployees);
    document.getElementById("openPayrollSalaryDetails")?.addEventListener("click", openPayrollSalaryDetails);

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
    setPropertyExpenseType(document.getElementById("propertyExpenseType")?.value || "房租");
    await loadPropertySummary();
    await loadProfitSummary();
    loadPayrollSummary();
    loadOverview();
  });
})();
