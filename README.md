# 财神爷 MySQL 财务管理库

这套库用于管理多个公司之间的资金、盈利和内部往来。核心思路是：所有公司共用一套表，通过 `company_id` 区分公司，新增公司时只需要往 `companies` 增加一行，不需要新建表。

## 文件

- `schema.sql`：MySQL 初始化脚本，包含表、索引、外键和汇总视图。
- `examples.sql`：常用录入和查询示例。

## 导入方式

```powershell
mysql -u root -p < schema.sql
```

如果已经进入 MySQL：

```sql
SOURCE C:/Users/Administrator/Documents/财神爷/schema.sql;
```

## 主要数据表

- `companies`：公司档案。
- `employees`：员工档案，每个员工归属于一家具体公司。
- `bank_accounts`：每个公司的资金账户，包括银行、现金、微信、支付宝、证券账户等。
- `cash_transactions`：每个账户的收支流水。
- `capital_snapshots`：某一天的实际账户余额快照，适合月末盘点。
- `payroll_import_batches`：工资单上传批次，记录工资所属公司、月份、文件名和状态。
- `payroll_records`：工资单明细，记录员工工资、个税、个人社保、个人公积金、公司社保、公司公积金、公司总人工成本。
- `property_expenses`：物业费、房租、水电、停车、维修等物业相关支出。
- `profit_monthly`：每家公司每个月的盈利情况，自动计算 `net_profit`。
- `intercompany_flows`：公司之间借款、还款、分红、调拨、注资等往来。

## 常用视图

- `v_company_cash_balance`：每家公司每个账户的当前计算余额。
- `v_company_cash_total`：每家公司资金总额。
- `v_company_profit_summary`：每家公司每月收入、成本、费用、净利润、净利率。
- `v_company_payroll_monthly`：每家公司每月工资、个税、社保、公积金和人工总成本。
- `v_company_property_monthly`：每家公司每月物业相关支出。
- `v_company_expense_monthly`：每家公司每月工资、物业和其他支出汇总。
- `v_intercompany_balance`：公司间往来余额。
- `v_company_dashboard`：公司总览，一次看资金余额、当年收入、当年净利润、工资成本、物业费、总支出和内部往来。

## 建议录入顺序

1. 先录入公司：`companies`。
2. 再录入每家公司资金账户：`bank_accounts`。
3. 录入员工：`employees`。
4. 日常录入收支流水：`cash_transactions`。
5. 上传工资单时，先写入 `payroll_import_batches`，再把每个员工的工资明细写入 `payroll_records`。
6. 物业费、房租、水电等写入 `property_expenses`。
7. 月底录入利润表：`profit_monthly`。
8. 有公司间转账、借款、还款、分红时录入：`intercompany_flows`。
9. 月末或需要对账时录入：`capital_snapshots`。

## 工资单上传后的记账规则

上传工资单时要先选择公司和月份，例如“示例科技有限公司 / 2026-06”。系统应该把这一批工资单写入该公司的 `payroll_import_batches` 和 `payroll_records`。

工资单字段建议至少包含：员工编号、姓名、应发工资、奖金、补贴、扣款、个人社保、个人公积金、个税、实发工资、公司社保、公司公积金。公司人工成本按 `应发工资 + 公司社保 + 公司公积金` 计算。

如果工资已经从银行账户付款，还可以在 `cash_transactions` 里同步记录几笔实际资金流水：

- `工资发放`：金额为实发工资合计。
- `个税缴纳`：金额为个税合计。
- `社保缴纳`：金额为个人社保 + 公司社保。
- `公积金缴纳`：金额为个人公积金 + 公司公积金。

物业费、房租、水电等建议同样双记录：`property_expenses` 保存费用明细，`cash_transactions` 保存实际付款流水。这样既能查物业成本，也能正确影响公司账户余额。

## 后续可扩展

后面可以继续加网页后台、导入 Excel、自动生成月报、老板看板、权限管理、发票/合同/应收应付等模块。

## 版本建议

建议使用 MySQL 8.0 或以上版本。脚本里使用了 `CHECK` 约束、生成列和 `CREATE OR REPLACE VIEW`，这些在 MySQL 8.0 中支持更完整。
