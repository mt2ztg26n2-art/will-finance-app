import io, re
p = r'C:\Users\AKA-33\WorkBuddy AI\2026-08-05-22-44-28\finance-system\js\views\datacenter.js'
s = io.open(p, encoding='utf-8').read()

new = '''      <div class="kpi-grid">
        <div class="kpi-card" style="--kpi-color:var(--brand)"><div class="kpi-card-label">${I18n.t('总资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalAssets)}</div><div class="kpi-card-sub">${I18n.t('{n} 个账户', { n: assetAccounts.length })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--info)"><div class="kpi-card-label">${I18n.t('净资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.netAssets)}</div><div class="kpi-card-sub">${I18n.t('资产净值')}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--up)"><div class="kpi-card-label">${I18n.t('本月收入')}</div><div class="kpi-card-value">${Util.fmtMoney(monthIncome)}</div><div class="kpi-card-sub">${I18n.t('储蓄率 {a}%', { a: savingsRate.toFixed(0) })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--down)"><div class="kpi-card-label">${I18n.t('本月支出')}</div><div class="kpi-card-value">${Util.fmtMoney(monthExpense)}</div><div class="kpi-card-sub">${I18n.t('负债率 {a}%', { a: leverage.toFixed(0) })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--warn)"><div class="kpi-card-label">${I18n.t('创业累计利润')}</div><div class="kpi-card-value">${Util.fmtMoney(bizProfit)}</div><div class="kpi-card-sub">${I18n.t('利润率 {a}%', { a: bizIncome > 0 ? (bizProfit / bizIncome * 100).toFixed(0) : 0 })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--down)"><div class="kpi-card-label">${I18n.t('总负债')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalLiabilities)}</div><div class="kpi-card-sub">${liabs.length}${I18n.t('笔负债')}</div></div>
      </div>'''

pat = re.compile(r'      <div class="dc-kpi-row">.*?\n      </div>', re.S)
m = pat.search(s)
assert m, 'dc-kpi-row block not found via regex'
s = pat.sub(new, s, count=1)
io.open(p, 'w', encoding='utf-8').write(s)
print('kpi-row replaced OK; matched len=', len(m.group(0)))
