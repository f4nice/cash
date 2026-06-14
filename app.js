(function () {
  const companyData = {
    tech: {
      name: "示例科技",
      employees: 18,
      netSalary: 58900,
      tax: 3450,
      employeeSocial: 7100,
      employerSocial: 15600,
      employeeFund: 4200,
      employerFund: 4200,
      totalCost: 78450
    },
    trade: {
      name: "示例贸易",
      employees: 14,
      netSalary: 38100,
      tax: 2700,
      employeeSocial: 5200,
      employerSocial: 11900,
      employeeFund: 2800,
      employerFund: 2800,
      totalCost: 54800
    },
    holding: {
      name: "控股主体",
      employees: 10,
      netSalary: 24900,
      tax: 2300,
      employeeSocial: 3100,
      employerSocial: 7200,
      employeeFund: 1800,
      employerFund: 1800,
      totalCost: 43600
    }
  };

  const state = {
    selectedCompany: "tech"
  };

  const money = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  });

  const fieldAliases = {
    name: ["姓名", "员工", "员工姓名", "employee_name", "name"],
    gross: ["应发工资", "应发", "税前工资", "gross_salary", "gross"],
    net: ["实发工资", "实发", "到手工资", "net_salary", "net"],
    tax: ["个税", "个人所得税", "individual_income_tax", "tax"],
    employeeSocial: ["个人社保", "社保个人", "个人承担社保", "employee_social_security"],
    employerSocial: ["公司社保", "单位社保", "公司承担社保", "employer_social_security"],
    employeeFund: ["个人公积金", "公积金个人", "个人承担公积金", "employee_housing_fund"],
    employerFund: ["公司公积金", "单位公积金", "公司承担公积金", "employer_housing_fund"]
  };

  function formatMoney(value) {
    return money.format(Number(value) || 0).replace("CN¥", "¥ ");
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
      const loose = normalizedHeaders.findIndex((header) => header.includes(target) || target.includes(header));
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

  function mapPayrollRows(rows) {
    if (!rows.length) return [];
    const headerRowIndex = rows.findIndex((row) => row.some((cell) => /姓名|员工|name/i.test(String(cell))));
    const headers = rows[headerRowIndex >= 0 ? headerRowIndex : 0] || [];
    const startIndex = (headerRowIndex >= 0 ? headerRowIndex : 0) + 1;
    const columns = Object.fromEntries(
      Object.entries(fieldAliases).map(([key, aliases]) => [key, findColumn(headers, aliases)])
    );

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

  function summarize(rows) {
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

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function updateCompany(companyKey) {
    const company = companyData[companyKey];
    if (!company) return;
    state.selectedCompany = companyKey;

    document.querySelectorAll("[data-company]").forEach((node) => {
      node.classList.toggle("selected", node.dataset.company === companyKey);
    });

    setText("selectedCompanyBadge", company.name);
    setText("uploadCompanyBadge", `当前公司：${company.name}`);
  }

  function renderPreview(rows) {
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function readPayrollFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    setText("uploadFileName", file.name);
    setText("importStatus", "读取中");

    let rows = [];
    if (ext === "csv") {
      rows = rowsFromCsv(await file.text());
    } else {
      if (!window.XLSX) {
        setText("importStatus", "Excel解析库未加载");
        return;
      }
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
    }

    const payrollRows = mapPayrollRows(rows);
    const total = summarize(payrollRows);
    const selectedCompany = companyData[state.selectedCompany];

    setText("importRows", `${total.rows} 人`);
    setText("importCost", formatMoney(total.totalCost));
    setText("importSocialFund", formatMoney(
      total.employeeSocial + total.employerSocial + total.employeeFund + total.employerFund
    ));
    setText("importStatus", `${selectedCompany.name} · 已读取`);
    renderPreview(payrollRows);
  }

  function downloadTemplate() {
    const headers = [
      "员工编号", "姓名", "应发工资", "奖金", "补贴", "扣款",
      "个人社保", "个人公积金", "个税", "实发工资", "公司社保", "公司公积金"
    ];
    const rows = [
      ["E001", "张三", "12000", "1000", "500", "0", "1200", "600", "450", "11250", "2600", "600"],
      ["E002", "李四", "15000", "0", "800", "0", "1500", "750", "700", "12850", "3200", "750"]
    ];
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companyData[state.selectedCompany].name}_工资单模板.csv`;
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

    document.getElementById("payrollFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) readPayrollFile(file);
    });

    document.getElementById("downloadTemplate")?.addEventListener("click", downloadTemplate);

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
