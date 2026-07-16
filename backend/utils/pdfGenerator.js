const crypto = require('crypto');

// ─── pdfmake Setup (pure JavaScript PDF — no Chrome/Puppeteer needed) ─────────
const pdfmake = require('pdfmake/build/pdfmake');
const vfs_fonts = require('pdfmake/build/vfs_fonts');
pdfmake.addVirtualFileSystem(vfs_fonts);

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1e3a8a',
  primaryLight: '#3b82f6',
  success: '#10b981',
  successLight: '#ecfdf5',
  successBorder: '#a7f3d0',
  danger: '#ef4444',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  blue: '#2563eb',
  blueLight: '#eff6ff',
  blueBorder: '#bfdbfe',
  slate: '#64748b',
  slateDark: '#0f172a',
  slateLight: '#94a3b8',
  slateBg: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  coverBg: '#0f172a',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899'
};

const CATEGORY_COLORS = {
  'Food': '#f59e0b',
  'Travel': '#3b82f6',
  'Shopping': '#06b6d4',
  'Rent': '#ef4444',
  'Bills': '#64748b',
  'Medical': '#10b981',
  'Entertainment': '#8b5cf6',
  'Education': '#ec4899',
  'Others': '#94a3b8'
};

// ─── Period Display Helpers ───────────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getDisplayPeriod = (type, period) => {
  if (type === 'monthly' && period) {
    const [year, month] = period.split('-');
    return `${MONTHS[parseInt(month, 10) - 1] || 'Month'} ${year}`;
  }
  if (type === 'yearly' && period) return `Year ${period}`;
  return 'Custom Period';
};

const getPeriodFilename = (type, period) => {
  if (type === 'monthly' && period) {
    const [year, month] = period.split('-');
    return `Financial_Statement_${MONTHS[parseInt(month, 10) - 1] || 'Month'}_${year}`;
  }
  if (type === 'yearly' && period) return `Financial_Statement_Year_${period}`;
  return 'Financial_Statement';
};

const formatCurrency = (val) => `$${(val || 0).toFixed(2)}`;
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── SVG Chart Generators (reused from original) ─────────────────────────────

const generateDonutSVG = (expPct, savPct) => {
  const radius = 15.91549;
  const expDash = Math.min(expPct, 99.9);
  const savDash = Math.min(savPct, 99.9);
  const savOffset = 25 - expDash;

  return `<svg width="160" height="160" viewBox="0 0 42 42">
    <circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#e2e8f0" stroke-width="4"/>
    ${expDash > 0 ? `<circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#ef4444" stroke-width="4"
      stroke-dasharray="${expDash} ${100 - expDash}" stroke-dashoffset="25" stroke-linecap="round"/>` : ''}
    ${savDash > 0 ? `<circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#10b981" stroke-width="4"
      stroke-dasharray="${savDash} ${100 - savDash}" stroke-dashoffset="${savOffset}" stroke-linecap="round"/>` : ''}
    <text x="21" y="19.5" text-anchor="middle" font-size="6" font-weight="700" fill="#0f172a" font-family="Helvetica">${savPct.toFixed(0)}%</text>
    <text x="21" y="24" text-anchor="middle" font-size="3" fill="#64748b" font-family="Helvetica">Saved</text>
  </svg>`;
};

const generateBarSVG = (income, expense, savings) => {
  const maxVal = Math.max(income, expense, Math.abs(savings)) || 100;
  const barMaxH = 100;
  const barW = 44;
  const baseline = 150;
  const gap = 20;

  const incH = Math.max(4, (income / maxVal) * barMaxH);
  const expH = Math.max(4, (expense / maxVal) * barMaxH);
  const savH = Math.max(4, (Math.max(0, savings) / maxVal) * barMaxH);

  const formatNum = (n) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return `<svg width="280" height="190" viewBox="0 0 280 190">
    <line x1="30" y1="30" x2="260" y2="30" stroke="#e2e8f0" stroke-width="0.5"/>
    <line x1="30" y1="70" x2="260" y2="70" stroke="#e2e8f0" stroke-width="0.5"/>
    <line x1="30" y1="110" x2="260" y2="110" stroke="#e2e8f0" stroke-width="0.5"/>
    <line x1="30" y1="${baseline}" x2="260" y2="${baseline}" stroke="#94a3b8" stroke-width="1"/>

    <rect x="${55}" y="${baseline - incH}" width="${barW}" height="${incH}" fill="#10b981" rx="4"/>
    <text x="${55 + barW/2}" y="${baseline - incH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#10b981" font-family="Helvetica">${formatNum(income)}</text>
    <text x="${55 + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Helvetica">Income</text>

    <rect x="${55 + barW + gap}" y="${baseline - expH}" width="${barW}" height="${expH}" fill="#ef4444" rx="4"/>
    <text x="${55 + barW + gap + barW/2}" y="${baseline - expH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#ef4444" font-family="Helvetica">${formatNum(expense)}</text>
    <text x="${55 + barW + gap + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Helvetica">Expense</text>

    <rect x="${55 + 2*(barW + gap)}" y="${baseline - savH}" width="${barW}" height="${savH}" fill="#3b82f6" rx="4"/>
    <text x="${55 + 2*(barW + gap) + barW/2}" y="${baseline - savH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#3b82f6" font-family="Helvetica">${formatNum(Math.max(0, savings))}</text>
    <text x="${55 + 2*(barW + gap) + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Helvetica">Savings</text>
  </svg>`;
};

const generatePieSVG = (categories, totalExpense) => {
  const pieColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
  const cx = 80, cy = 80, r = 65;
  const active = categories.filter(c => c.amount > 0).slice(0, 8);
  const total = active.reduce((s, c) => s + c.amount, 0) || 1;

  let paths = '';
  let startAngle = -Math.PI / 2;

  active.forEach((cat, idx) => {
    const pct = cat.amount / total;
    const sweep = pct * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const color = pieColors[idx % pieColors.length];
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
    startAngle = endAngle;
  });

  return `<svg width="160" height="160" viewBox="0 0 160 160">${paths}</svg>`;
};

// ─── Parse AI Advice to structured blocks ─────────────────────────────────────
const parseAdviceToBlocks = (text) => {
  if (!text) return [{ title: 'No Recommendations', items: ['No advisor recommendations available for this period.'] }];

  const sections = text.split(/(?=###\s+)/);
  const blocks = [];

  sections.forEach(sec => {
    const trimmed = sec.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n');
    let title = 'Financial Insight';
    const items = [];

    lines.forEach(line => {
      const l = line.trim();
      if (!l) return;
      if (l.startsWith('###')) {
        title = l.substring(3).trim();
      } else if (l.startsWith('-') || l.startsWith('*')) {
        items.push(l.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '$1'));
      } else {
        items.push(l.replace(/\*\*(.*?)\*\*/g, '$1'));
      }
    });

    blocks.push({ title, items });
  });

  return blocks.length > 0 ? blocks : [{ title: 'No Recommendations', items: ['No data available.'] }];
};

// ─── Build pdfmake Document Definition ────────────────────────────────────────

const buildDocumentDefinition = (reportData) => {
  const { user, type, period, totalIncome, totalExpense, savings, categoryBreakdown, recentTransactions, aiAdvice } = reportData;

  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : '0';
  const budgetHealth = totalExpense > totalIncome ? 'DEFICIT' : (totalExpense > totalIncome * 0.8 ? 'WARNING' : 'OPTIMAL');
  const financialScore = totalIncome > 0 ? Math.min(100, Math.max(30, Math.round((savings / totalIncome) * 100))) : 30;
  const reportId = crypto.randomBytes(6).toString('hex').toUpperCase();
  const displayPeriod = getDisplayPeriod(type, period);
  const issuedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalInflow = totalIncome || 1;
  const expPct = Math.min(100, (totalExpense / totalInflow) * 100);
  const savPct = Math.max(0, 100 - expPct);

  const activeCats = categoryBreakdown.filter(c => c.amount > 0);

  // SVG charts
  const donutSvg = generateDonutSVG(expPct, savPct);
  const barSvg = generateBarSVG(totalIncome, totalExpense, savings);
  const pieSvg = activeCats.length > 0 ? generatePieSVG(activeCats, totalExpense) : null;

  // Transaction ledger with running balance
  let runningBalance = 0;
  const sortedTx = [...recentTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedTx.forEach(t => {
    runningBalance += t.type === 'Income' ? t.amount : -t.amount;
    t.runningBalance = runningBalance;
  });
  const displayTx = [...sortedTx].reverse();

  // Health colors
  const healthColor = budgetHealth === 'OPTIMAL' ? COLORS.success : (budgetHealth === 'WARNING' ? COLORS.amber : COLORS.danger);
  const scoreColor = financialScore >= 70 ? COLORS.success : (financialScore >= 50 ? COLORS.amber : COLORS.danger);

  // AI advice blocks
  const adviceBlocks = parseAdviceToBlocks(aiAdvice);
  const adviceColors = [COLORS.primary, COLORS.success, COLORS.amber, COLORS.danger, COLORS.purple, COLORS.pink, COLORS.cyan];
  const adviceIcons = ['📈', '⚠️', '💰', '💼', '🛡️', '⚙️', '📅'];

  // ─── PAGE 1: COVER ─────────────────────────────────────────────────────
  const coverPage = {
    stack: [
      { text: '', margin: [0, 80, 0, 0] },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'AI EXPENSE TRACKER', style: 'coverTitle', margin: [0, 0, 0, 4] },
              { text: 'PERSONAL FINANCIAL STATEMENT', style: 'coverSubtitle', margin: [0, 0, 0, 6] },
              { text: `Report Period: ${displayPeriod} (${type.toUpperCase()})`, style: 'coverPeriod', margin: [0, 0, 0, 30] },
              {
                table: {
                  widths: ['*'],
                  body: [[{
                    stack: [
                      { text: 'PREPARED FOR', style: 'infoLabel', margin: [0, 0, 0, 2] },
                      { text: user.username.toUpperCase(), style: 'infoValue', margin: [0, 0, 0, 2] },
                      { text: user.email, style: 'infoEmail', margin: [0, 0, 0, 14] },
                      { text: 'REPORTING PERIOD', style: 'infoLabel', margin: [0, 0, 0, 2] },
                      { text: `${displayPeriod} (${type.toUpperCase()})`, style: 'infoValue', margin: [0, 0, 0, 14] },
                      { text: 'STATEMENT AUDIT', style: 'infoLabel', margin: [0, 0, 0, 2] },
                      { text: `Report ID: #AIFR-${reportId}`, color: '#60a5fa', fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
                      { text: `Issued On: ${issuedDate}`, style: 'infoEmail' }
                    ],
                    margin: [20, 18, 20, 18]
                  }]]
                },
                layout: {
                  hLineWidth: () => 1,
                  vLineWidth: () => 1,
                  hLineColor: () => '#1e3a8a',
                  vLineColor: () => '#1e3a8a',
                  fillColor: () => '#0c1527'
                }
              },
              { text: '', margin: [0, 40, 0, 0] },
              { text: 'CONFIDENTIAL FINANCIAL AUDIT REPORT  |  SYSTEM GENERATED  |  AI EXPENSE TRACKER ENGINE', style: 'coverFooter' }
            ],
            alignment: 'center',
            margin: [0, 0, 0, 0]
          }]]
        },
        layout: 'noBorders'
      }
    ],
    pageBreak: 'after'
  };

  // ─── PAGE 2: EXECUTIVE DASHBOARD ────────────────────────────────────────
  const kpiTable = {
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          { stack: [{ text: 'TOTAL INFLOW', style: 'kpiLabel' }, { text: `+${formatCurrency(totalIncome)}`, style: 'kpiValueGreen' }], fillColor: COLORS.successLight, margin: [12, 10, 12, 10] },
          { stack: [{ text: 'TOTAL OUTFLOW', style: 'kpiLabel' }, { text: `-${formatCurrency(totalExpense)}`, style: 'kpiValueRed' }], fillColor: COLORS.dangerLight, margin: [12, 10, 12, 10] },
          { stack: [{ text: 'NET SAVINGS', style: 'kpiLabel' }, { text: formatCurrency(savings), color: savings >= 0 ? COLORS.success : COLORS.danger, fontSize: 16, bold: true, alignment: 'center' }], fillColor: COLORS.blueLight, margin: [12, 10, 12, 10] }
        ],
        [
          { stack: [{ text: 'SAVINGS RATE', style: 'kpiLabel' }, { text: `${savingsRate}%`, style: 'kpiValueBlue' }], fillColor: COLORS.slateBg, margin: [12, 10, 12, 10] },
          { stack: [{ text: 'BUDGET HEALTH', style: 'kpiLabel' }, { text: budgetHealth, color: healthColor, fontSize: 16, bold: true, alignment: 'center' }], fillColor: COLORS.slateBg, margin: [12, 10, 12, 10] },
          { stack: [{ text: 'FINANCIAL SCORE', style: 'kpiLabel' }, { text: `${financialScore} / 100`, color: scoreColor, fontSize: 16, bold: true, alignment: 'center' }], fillColor: COLORS.slateBg, margin: [12, 10, 12, 10] }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => COLORS.border,
      vLineColor: () => COLORS.border
    },
    margin: [0, 0, 0, 16]
  };

  // Chart SVGs side by side
  const chartRow = {
    columns: [
      {
        width: '50%',
        stack: [
          { text: 'SAVINGS & EXPENSE DIVISION', style: 'chartTitle' },
          { svg: donutSvg, width: 140, alignment: 'center', margin: [0, 6, 0, 6] },
          {
            columns: [
              { text: '● Outflow ' + expPct.toFixed(1) + '%', color: COLORS.danger, fontSize: 8, alignment: 'center' },
              { text: '● Savings ' + savPct.toFixed(1) + '%', color: COLORS.success, fontSize: 8, alignment: 'center' }
            ],
            margin: [0, 4, 0, 0]
          }
        ],
        margin: [0, 0, 6, 0]
      },
      {
        width: '50%',
        stack: [
          { text: 'INCOME / EXPENSE / SAVINGS', style: 'chartTitle' },
          { svg: barSvg, width: 230, alignment: 'center', margin: [0, 6, 0, 0] }
        ],
        margin: [6, 0, 0, 0]
      }
    ],
    margin: [0, 0, 0, 14]
  };

  const chartRow2Items = [];
  if (pieSvg) {
    chartRow2Items.push({
      width: '50%',
      stack: [
        { text: 'EXPENDITURES BY CATEGORY', style: 'chartTitle' },
        { svg: pieSvg, width: 140, alignment: 'center', margin: [0, 6, 0, 6] },
        ...activeCats.slice(0, 6).map(cat => ({
          text: `● ${cat.category} ${(totalExpense > 0 ? ((cat.amount / totalExpense) * 100).toFixed(1) : '0')}%`,
          color: CATEGORY_COLORS[cat.category] || COLORS.slate,
          fontSize: 8,
          margin: [20, 1, 0, 1]
        }))
      ],
      margin: [0, 0, 6, 0]
    });
  }

  const dashboardPage = {
    stack: [
      { text: 'Executive Dashboard & Metrics', style: 'pageTitle' },
      { text: `Financial inflows, outflows, savings rates, and health index for ${displayPeriod}.`, style: 'pageSubtitle', margin: [0, 0, 0, 16] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: COLORS.primary }], margin: [0, 0, 0, 16] },
      kpiTable,
      chartRow,
      ...(chartRow2Items.length > 0 ? [{ columns: chartRow2Items, margin: [0, 0, 0, 0] }] : [])
    ],
    pageBreak: 'after'
  };

  // ─── PAGE 3: TABLES ─────────────────────────────────────────────────────

  // Category expenditure table
  const catTableHeader = [
    { text: 'CATEGORY', style: 'tableHeader' },
    { text: 'TOTAL SPENT', style: 'tableHeader', alignment: 'right' },
    { text: 'PCT (%)', style: 'tableHeader', alignment: 'right' },
    { text: 'TX COUNT', style: 'tableHeader', alignment: 'right' }
  ];

  const catTableBody = activeCats.map((cat, idx) => {
    const pct = totalExpense > 0 ? ((cat.amount / totalExpense) * 100).toFixed(1) : '0';
    const bg = idx % 2 === 0 ? COLORS.white : COLORS.slateBg;
    return [
      { text: cat.category, fontSize: 9, bold: true, color: COLORS.slateDark, fillColor: bg, margin: [6, 6, 6, 6] },
      { text: formatCurrency(cat.amount), fontSize: 9, color: COLORS.danger, bold: true, alignment: 'right', fillColor: bg, margin: [6, 6, 6, 6] },
      { text: `${pct}%`, fontSize: 9, color: COLORS.slate, alignment: 'right', fillColor: bg, margin: [6, 6, 6, 6] },
      { text: `${cat.count || 0}`, fontSize: 9, color: COLORS.slate, alignment: 'right', fillColor: bg, margin: [6, 6, 6, 6] }
    ];
  });

  // Transaction ledger table
  const txTableHeader = [
    { text: 'DATE', style: 'tableHeader' },
    { text: 'TYPE', style: 'tableHeader' },
    { text: 'CATEGORY', style: 'tableHeader' },
    { text: 'DESCRIPTION', style: 'tableHeader' },
    { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' },
    { text: 'BALANCE', style: 'tableHeader', alignment: 'right' }
  ];

  const txTableBody = displayTx.map((t, idx) => {
    const bg = idx % 2 === 0 ? COLORS.white : COLORS.slateBg;
    const isIncome = t.type === 'Income';
    const typeColor = isIncome ? COLORS.success : COLORS.danger;
    const amtPrefix = isIncome ? '+' : '-';

    return [
      { text: formatDate(t.date), fontSize: 8, color: COLORS.slate, fillColor: bg, margin: [4, 5, 4, 5] },
      { text: t.type, fontSize: 8, bold: true, color: typeColor, fillColor: bg, margin: [4, 5, 4, 5] },
      { text: t.categoryOrSource, fontSize: 8, color: COLORS.slateDark, fillColor: bg, margin: [4, 5, 4, 5] },
      { text: (t.description || '—').substring(0, 30), fontSize: 8, color: COLORS.slate, fillColor: bg, margin: [4, 5, 4, 5] },
      { text: `${amtPrefix}${formatCurrency(t.amount)}`, fontSize: 8, bold: true, color: typeColor, alignment: 'right', fillColor: bg, margin: [4, 5, 4, 5] },
      { text: formatCurrency(t.runningBalance), fontSize: 8, bold: true, color: COLORS.slateDark, alignment: 'right', fillColor: bg, margin: [4, 5, 4, 5] }
    ];
  });

  // Totals row
  const txTotalsRow = [
    { text: 'TOTAL STATEMENT LEDGER', colSpan: 4, fontSize: 9, bold: true, color: COLORS.slateDark, fillColor: '#eef2f6', margin: [6, 8, 6, 8] },
    {}, {}, {},
    { text: `+${formatCurrency(totalIncome)} / -${formatCurrency(totalExpense)}`, fontSize: 9, bold: true, color: COLORS.slateDark, alignment: 'right', fillColor: '#eef2f6', margin: [4, 8, 4, 8] },
    { text: formatCurrency(runningBalance), fontSize: 9, bold: true, color: COLORS.slateDark, alignment: 'right', fillColor: '#eef2f6', margin: [4, 8, 4, 8] }
  ];

  const tablesPage = {
    stack: [
      { text: 'Financial Statement & Transaction Ledger', style: 'pageTitle' },
      { text: 'Category allocations, transaction history, and running ledger balances.', style: 'pageSubtitle', margin: [0, 0, 0, 16] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: COLORS.primary }], margin: [0, 0, 0, 16] },

      { text: '1. Category Expenditure Allocations', style: 'sectionTitle', margin: [0, 0, 0, 8] },
      activeCats.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [catTableHeader, ...catTableBody]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i) => i === 0 || i === 1 ? COLORS.primary : COLORS.border,
          vLineColor: () => COLORS.border,
          fillColor: (i) => i === 0 ? COLORS.primary : null
        },
        margin: [0, 0, 0, 20]
      } : { text: 'No category expenditure records found.', italics: true, color: COLORS.slateLight, fontSize: 10, margin: [0, 0, 0, 20] },

      { text: '2. Transaction Ledger', style: 'sectionTitle', margin: [0, 0, 0, 8] },
      displayTx.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto'],
          body: [txTableHeader, ...txTableBody, txTotalsRow]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length || i === node.table.body.length - 1) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i) => i === 0 || i === 1 ? COLORS.primary : COLORS.border,
          vLineColor: () => COLORS.border,
          fillColor: (i) => i === 0 ? COLORS.primary : null
        },
        margin: [0, 0, 0, 0]
      } : { text: 'No transactions recorded.', italics: true, color: COLORS.slateLight, fontSize: 10 }
    ],
    pageBreak: 'after'
  };

  // ─── PAGE 4: AI ADVISOR ─────────────────────────────────────────────────
  const adviceContent = [];
  adviceBlocks.forEach((block, idx) => {
    const color = adviceColors[idx % adviceColors.length];
    const icon = adviceIcons[idx % adviceIcons.length];

    adviceContent.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              columns: [
                { text: `${icon}  ${block.title.toUpperCase()}`, fontSize: 10, bold: true, color: COLORS.slateDark, width: '*' },
                { text: 'RECOMMENDED', fontSize: 7, bold: true, color: color, alignment: 'right', width: 'auto' }
              ],
              margin: [0, 0, 0, 8]
            },
            ...block.items.map(item => ({
              text: `• ${item}`,
              fontSize: 9,
              color: '#334155',
              lineHeight: 1.4,
              margin: [8, 2, 0, 2]
            }))
          ],
          margin: [14, 12, 14, 12]
        }]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i) => i === 0 ? 4 : 0,
        vLineColor: () => color,
        fillColor: () => COLORS.slateBg
      },
      margin: [0, 0, 0, 10]
    });
  });

  const advisorPage = {
    stack: [
      { text: 'AI Advisor Financial Recommendations', style: 'pageTitle' },
      { text: 'Personalized consulting feedback generated for your spending pattern to help optimize financial health.', style: 'pageSubtitle', margin: [0, 0, 0, 16] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: COLORS.primary }], margin: [0, 0, 0, 16] },
      ...adviceContent,
      { text: '', margin: [0, 20, 0, 0] },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'DISCLAIMER', fontSize: 8, bold: true, color: '#0369a1', alignment: 'center', margin: [0, 0, 0, 4] },
              { text: 'This report is auto-generated by AI Expense Tracker\'s financial analysis engine. The AI recommendations are advisory only and do not constitute professional financial advice. Always consult a certified financial advisor for important financial decisions.', fontSize: 8, color: COLORS.slate, alignment: 'center', lineHeight: 1.5 }
            ],
            margin: [16, 12, 16, 12]
          }]]
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#bae6fd',
          vLineColor: () => '#bae6fd',
          fillColor: () => '#f0f9ff'
        }
      }
    ]
  };

  // ─── FULL DOCUMENT ──────────────────────────────────────────────────────
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    info: {
      title: `Financial Report - ${displayPeriod}`,
      author: 'AI Expense Tracker',
      subject: `${type.toUpperCase()} Financial Statement`,
      creator: 'AI Expense Tracker Engine'
    },
    background: function(currentPage) {
      if (currentPage === 1) {
        return {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: COLORS.coverBg },
            { type: 'line', x1: 0, y1: 0, x2: 595.28, y2: 0, lineWidth: 4, lineColor: COLORS.primaryLight },
            { type: 'line', x1: 0, y1: 841.89, x2: 595.28, y2: 841.89, lineWidth: 4, lineColor: COLORS.success }
          ]
        };
      }
      return null;
    },
    footer: function(currentPage, pageCount) {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: `Page ${currentPage} of ${pageCount}  |  CONFIDENTIAL FINANCIAL AUDIT`, fontSize: 7, color: COLORS.slateLight, margin: [40, 0, 0, 0] },
          { text: `Report ID: #AIFR-${reportId}`, fontSize: 7, color: COLORS.slateLight, alignment: 'right', margin: [0, 0, 40, 0] }
        ],
        margin: [0, 10, 0, 0]
      };
    },
    content: [
      coverPage,
      dashboardPage,
      tablesPage,
      advisorPage
    ],
    styles: {
      coverTitle: { fontSize: 28, bold: true, color: COLORS.white, alignment: 'center', letterSpacing: 2 },
      coverSubtitle: { fontSize: 12, bold: true, color: COLORS.slateLight, alignment: 'center', letterSpacing: 3 },
      coverPeriod: { fontSize: 11, italics: true, color: '#60a5fa', alignment: 'center' },
      coverFooter: { fontSize: 7, bold: true, color: '#475569', alignment: 'center', letterSpacing: 1 },
      infoLabel: { fontSize: 8, bold: true, color: COLORS.slateLight, letterSpacing: 1 },
      infoValue: { fontSize: 12, bold: true, color: COLORS.white },
      infoEmail: { fontSize: 9, color: COLORS.slateLight },
      pageTitle: { fontSize: 18, bold: true, color: COLORS.slateDark },
      pageSubtitle: { fontSize: 9, color: COLORS.slate },
      sectionTitle: { fontSize: 12, bold: true, color: COLORS.slateDark, decoration: 'underline', decorationColor: COLORS.border },
      chartTitle: { fontSize: 8, bold: true, color: COLORS.primary, alignment: 'center', letterSpacing: 0.5, margin: [0, 0, 0, 4] },
      tableHeader: { fontSize: 8, bold: true, color: COLORS.white, fillColor: COLORS.primary, margin: [6, 8, 6, 8] },
      kpiLabel: { fontSize: 8, bold: true, color: COLORS.slate, alignment: 'center', letterSpacing: 0.8, margin: [0, 0, 0, 4] },
      kpiValueGreen: { fontSize: 16, bold: true, color: COLORS.success, alignment: 'center' },
      kpiValueRed: { fontSize: 16, bold: true, color: COLORS.danger, alignment: 'center' },
      kpiValueBlue: { fontSize: 16, bold: true, color: COLORS.blue, alignment: 'center' }
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.slateDark
    }
  };
};

// ─── Main PDF Generator (pdfmake — no Chrome/Puppeteer needed) ────────────────

exports.generateFinancialReportPDF = async (reportData, res) => {
  try {
    console.log('[PDF] Starting PDF generation with pdfmake...');

    const docDefinition = buildDocumentDefinition(reportData);
    const filename = `${getPeriodFilename(reportData.type, reportData.period)}.pdf`;

    // Generate PDF buffer using pdfmake
    const pdfDoc = pdfmake.createPdf(docDefinition);

    // pdfmake's getBuffer returns a callback — wrap in a Promise
    const pdfBuffer = await new Promise((resolve, reject) => {
      pdfDoc.getBuffer((buffer) => {
        if (buffer) {
          resolve(buffer);
        } else {
          reject(new Error('pdfmake returned empty buffer'));
        }
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(Buffer.from(pdfBuffer));

    console.log(`[PDF] Professional PDF generated successfully. File: ${filename}, Size: ${pdfBuffer.length} bytes.`);
  } catch (err) {
    console.error('[PDF ERROR] PDF generation failed:', err.message);
    console.error('[PDF ERROR] Stack:', err.stack);
    res.status(500).json({
      success: false,
      message: 'PDF document generation failed.',
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
};
