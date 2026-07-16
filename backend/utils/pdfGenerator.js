const crypto = require('crypto');

// ─── Chrome/Chromium Launch Config ────────────────────────────────────────────
// On Vercel serverless we use @sparticuz/chromium; locally we use system Chrome.
const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const getChromePath = () => {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return '/usr/bin/google-chrome';
};

// ─── SVG Chart Generators ─────────────────────────────────────────────────────

/**
 * Generates an SVG donut chart showing expense vs savings ratio
 */
const generateDonutSVG = (expPct, savPct) => {
  const radius = 15.91549;
  const expDash = Math.min(expPct, 99.9);
  const savDash = Math.min(savPct, 99.9);
  const savOffset = 25 - expDash;

  return `
    <svg width="160" height="160" viewBox="0 0 42 42" style="display:block;margin:0 auto;">
      <circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#e2e8f0" stroke-width="4"/>
      ${expDash > 0 ? `<circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#ef4444" stroke-width="4"
        stroke-dasharray="${expDash} ${100 - expDash}" stroke-dashoffset="25" stroke-linecap="round"/>` : ''}
      ${savDash > 0 ? `<circle cx="21" cy="21" r="${radius}" fill="transparent" stroke="#10b981" stroke-width="4"
        stroke-dasharray="${savDash} ${100 - savDash}" stroke-dashoffset="${savOffset}" stroke-linecap="round"/>` : ''}
      <text x="21" y="19.5" text-anchor="middle" font-size="6" font-weight="700" fill="#0f172a" font-family="system-ui, sans-serif">${savPct.toFixed(0)}%</text>
      <text x="21" y="24" text-anchor="middle" font-size="3" fill="#64748b" font-family="system-ui, sans-serif">Saved</text>
    </svg>`;
};

/**
 * Generates an SVG bar chart comparing income, expenses, and savings
 */
const generateBarSVG = (income, expense, savings) => {
  const maxVal = Math.max(income, expense, Math.abs(savings)) || 100;
  const chartH = 140;
  const barMaxH = 100;
  const barW = 44;
  const baseline = 150;
  const gap = 20;

  const incH = Math.max(4, (income / maxVal) * barMaxH);
  const expH = Math.max(4, (expense / maxVal) * barMaxH);
  const savH = Math.max(4, (Math.max(0, savings) / maxVal) * barMaxH);

  const formatNum = (n) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return `
    <svg width="280" height="190" viewBox="0 0 280 190" style="display:block;margin:0 auto;">
      <!-- Grid lines -->
      <line x1="30" y1="30" x2="260" y2="30" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="30" y1="70" x2="260" y2="70" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="30" y1="110" x2="260" y2="110" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="30" y1="${baseline}" x2="260" y2="${baseline}" stroke="#94a3b8" stroke-width="1"/>

      <!-- Income Bar -->
      <rect x="${55}" y="${baseline - incH}" width="${barW}" height="${incH}" fill="#10b981" rx="4"/>
      <text x="${55 + barW/2}" y="${baseline - incH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#10b981" font-family="system-ui">${formatNum(income)}</text>
      <text x="${55 + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="system-ui">Income</text>

      <!-- Expense Bar -->
      <rect x="${55 + barW + gap}" y="${baseline - expH}" width="${barW}" height="${expH}" fill="#ef4444" rx="4"/>
      <text x="${55 + barW + gap + barW/2}" y="${baseline - expH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#ef4444" font-family="system-ui">${formatNum(expense)}</text>
      <text x="${55 + barW + gap + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="system-ui">Expense</text>

      <!-- Savings Bar -->
      <rect x="${55 + 2*(barW + gap)}" y="${baseline - savH}" width="${barW}" height="${savH}" fill="#3b82f6" rx="4"/>
      <text x="${55 + 2*(barW + gap) + barW/2}" y="${baseline - savH - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#3b82f6" font-family="system-ui">${formatNum(Math.max(0, savings))}</text>
      <text x="${55 + 2*(barW + gap) + barW/2}" y="${baseline + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="system-ui">Savings</text>
    </svg>`;
};

/**
 * Generates an SVG pie chart for category breakdown
 */
const generatePieSVG = (categories, totalExpense) => {
  const pieColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
  const cx = 80, cy = 80, r = 65;
  const active = categories.filter(c => c.amount > 0).slice(0, 8);
  const total = active.reduce((s, c) => s + c.amount, 0) || 1;

  let paths = '';
  let legends = '';
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

    legends += `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <div style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;"></div>
        <span style="font-size:10px;color:#334155;">${cat.category} <strong style="color:${color}">${(pct * 100).toFixed(1)}%</strong></span>
      </div>`;

    startAngle = endAngle;
  });

  return { svg: `<svg width="160" height="160" viewBox="0 0 160 160" style="display:block;margin:0 auto;">${paths}</svg>`, legends };
};

/**
 * Generates an SVG line chart for daily spending trend
 */
const generateLineSVG = (expenses) => {
  if (!expenses || expenses.length === 0) {
    return '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:40px 0;">No expense data to chart</div>';
  }

  const width = 280, height = 150;
  const padL = 40, padR = 20, padT = 20, padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxAmt = Math.max(...expenses.map(e => e.amount)) || 100;
  const points = expenses.map((e, i) => ({
    x: padL + (expenses.length > 1 ? (i / (expenses.length - 1)) * chartW : chartW / 2),
    y: padT + chartH - (e.amount / maxAmt) * chartH
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${padT + chartH} ${linePath} L${points[points.length - 1].x},${padT + chartH} Z`;

  let dots = '';
  points.forEach(p => {
    dots += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>`;
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;margin:0 auto;">
      <!-- Grid -->
      <line x1="${padL}" y1="${padT}" x2="${padL + chartW}" y2="${padT}" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="${padL}" y1="${padT + chartH * 0.33}" x2="${padL + chartW}" y2="${padT + chartH * 0.33}" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="${padL}" y1="${padT + chartH * 0.66}" x2="${padL + chartW}" y2="${padT + chartH * 0.66}" stroke="#e2e8f0" stroke-width="0.5"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="#94a3b8" stroke-width="1"/>
      <!-- Area fill -->
      <path d="${areaPath}" fill="url(#lineGrad)" opacity="0.3"/>
      <defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>
      <!-- Line -->
      <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
};

// ─── AI Advice Parser ─────────────────────────────────────────────────────────

const parseAdviceToHTML = (text) => {
  if (!text) return '<p style="color:#94a3b8;font-style:italic;">No advisor recommendations available.</p>';

  const cardColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const icons = ['📈', '⚠️', '💰', '💼', '🛡️', '⚙️', '📅'];
  const sections = text.split(/(?=###\s+)/);

  let html = '';
  let idx = 0;

  sections.forEach(sec => {
    const trimmed = sec.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n');
    let title = 'Financial Insight';
    let bodyHTML = '';

    lines.forEach(line => {
      const l = line.trim();
      if (!l) return;
      if (l.startsWith('###')) {
        title = l.substring(3).trim();
      } else if (l.startsWith('-') || l.startsWith('*')) {
        const clean = l.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        bodyHTML += `<li style="margin-bottom:4px;color:#334155;font-size:11px;line-height:1.5;">${clean}</li>`;
      } else {
        const clean = l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        bodyHTML += `<p style="margin:4px 0;color:#334155;font-size:11px;line-height:1.5;">${clean}</p>`;
      }
    });

    const color = cardColors[idx % cardColors.length];
    const icon = icons[idx % icons.length];
    idx++;

    html += `
      <div style="background:#f8fafc;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:700;color:#0f172a;letter-spacing:0.5px;">${icon}  ${title.toUpperCase()}</div>
          <div style="font-size:9px;font-weight:700;color:${color};letter-spacing:0.5px;">RECOMMENDED</div>
        </div>
        ${bodyHTML.includes('<li') ? `<ul style="margin:0;padding-left:18px;">${bodyHTML}</ul>` : bodyHTML}
      </div>`;
  });

  return html;
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

// ─── HTML Report Builder ──────────────────────────────────────────────────────

const buildReportHTML = (reportData) => {
  const { user, type, period, totalIncome, totalExpense, savings, categoryBreakdown, recentTransactions, aiAdvice } = reportData;

  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : '0';
  const budgetHealth = totalExpense > totalIncome ? 'Deficit' : (totalExpense > totalIncome * 0.8 ? 'Warning' : 'Optimal');
  const financialScore = totalIncome > 0 ? Math.min(100, Math.max(30, Math.round((savings / totalIncome) * 100))) : 30;
  const reportId = crypto.randomBytes(6).toString('hex').toUpperCase();
  const displayPeriod = getDisplayPeriod(type, period);
  const issuedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Chart data calculations
  const totalInflow = totalIncome || 1;
  const expPct = Math.min(100, (totalExpense / totalInflow) * 100);
  const savPct = Math.max(0, 100 - expPct);
  const donutSVG = generateDonutSVG(expPct, savPct);
  const barSVG = generateBarSVG(totalIncome, totalExpense, savings);

  const activeCats = categoryBreakdown.filter(c => c.amount > 0);
  const pieData = generatePieSVG(activeCats, totalExpense);

  const expensesOnly = recentTransactions.filter(t => t.type === 'Expense').slice(0, 8).reverse();
  const lineSVG = generateLineSVG(expensesOnly);

  // Transaction ledger with running balance
  let runningBalance = 0;
  const sortedTx = [...recentTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedTx.forEach(t => {
    runningBalance += t.type === 'Income' ? t.amount : -t.amount;
    t.runningBalance = runningBalance;
  });
  const displayTx = [...sortedTx].reverse();

  // Build category table rows
  let catIdx = 0;
  const categoryRowsHTML = activeCats.map(cat => {
    const pct = totalExpense > 0 ? ((cat.amount / totalExpense) * 100).toFixed(1) : '0';
    const barW = Math.round(parseFloat(pct) * 1.8);
    const bg = catIdx++ % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="background:${bg};">
        <td style="padding:10px 14px;font-weight:600;font-size:11px;color:#0f172a;">${cat.category}</td>
        <td style="padding:10px 14px;text-align:right;font-size:11px;color:#ef4444;font-weight:600;">$${cat.amount.toFixed(2)}</td>
        <td style="padding:10px 14px;text-align:right;font-size:11px;color:#64748b;">${pct}%</td>
        <td style="padding:10px 14px;">
          <div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%;position:relative;">
            <div style="background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:4px;height:8px;width:${Math.max(2, barW)}%;"></div>
          </div>
        </td>
        <td style="padding:10px 14px;text-align:right;font-size:11px;color:#64748b;">${cat.count || 0}</td>
      </tr>`;
  }).join('');

  // Build transaction ledger rows
  let txIdx = 0;
  const txRowsHTML = displayTx.map(t => {
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const isIncome = t.type === 'Income';
    const bg = txIdx++ % 2 === 0 ? '#ffffff' : '#f8fafc';
    const typeColor = isIncome ? '#10b981' : '#ef4444';
    const typeBg = isIncome ? '#ecfdf5' : '#fef2f2';
    const amtPrefix = isIncome ? '+' : '-';

    return `
      <tr style="background:${bg};">
        <td style="padding:8px 14px;font-size:11px;color:#64748b;">${dateStr}</td>
        <td style="padding:8px 14px;">
          <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600;color:${typeColor};background:${typeBg};">${t.type}</span>
        </td>
        <td style="padding:8px 14px;font-size:11px;color:#334155;font-weight:500;">${t.categoryOrSource}</td>
        <td style="padding:8px 14px;font-size:11px;color:#64748b;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description || '—'}</td>
        <td style="padding:8px 14px;text-align:right;font-size:11px;font-weight:700;color:${typeColor};">${amtPrefix}$${t.amount.toFixed(2)}</td>
        <td style="padding:8px 14px;text-align:right;font-size:11px;font-weight:600;color:#0f172a;">$${t.runningBalance.toFixed(2)}</td>
      </tr>`;
  }).join('');

  // AI Advice HTML
  const adviceHTML = parseAdviceToHTML(aiAdvice);

  // Budget health styling
  const healthColor = budgetHealth === 'Optimal' ? '#10b981' : (budgetHealth === 'Warning' ? '#f59e0b' : '#ef4444');
  const healthBg = budgetHealth === 'Optimal' ? '#ecfdf5' : (budgetHealth === 'Warning' ? '#fffbeb' : '#fef2f2');

  // Score color
  const scoreColor = financialScore >= 70 ? '#10b981' : (financialScore >= 50 ? '#f59e0b' : '#ef4444');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; }
  .page-break { page-break-after: always; }

  /* ── Cover Page ── */
  .cover { background: linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e1b4b 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 50px; }
  .cover::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(135deg, transparent, transparent 48%, rgba(30,58,138,0.08) 48%, rgba(30,58,138,0.08) 50%, transparent 50%, transparent 100%); background-size: 40px 40px; }
  .cover * { position: relative; z-index: 1; }
  .cover .accent-lines { position: absolute; top: 0; left: 0; right: 0; height: 100%; z-index: 0; }
  .cover .accent-lines .line1 { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #1e3a8a, #3b82f6, #10b981); }
  .cover .accent-lines .line2 { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #10b981, #3b82f6, #1e3a8a); }

  .cover .logo { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #1e3a8a, #3b82f6); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 3px solid rgba(59,130,246,0.4); }
  .cover .logo-inner { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #34d399); }

  .cover h1 { font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: 3px; margin-bottom: 8px; }
  .cover h2 { font-size: 15px; font-weight: 600; color: #94a3b8; letter-spacing: 4px; margin-bottom: 6px; }
  .cover .period-text { font-size: 13px; color: #60a5fa; font-style: italic; margin-bottom: 50px; }

  .cover .info-card { background: rgba(15,23,42,0.8); border: 1px solid #1e3a8a; border-radius: 12px; padding: 28px 32px; width: 100%; max-width: 480px; text-align: left; backdrop-filter: blur(10px); }
  .cover .info-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; margin-bottom: 4px; margin-top: 16px; }
  .cover .info-label:first-child { margin-top: 0; }
  .cover .info-value { font-size: 14px; font-weight: 700; color: #ffffff; }
  .cover .info-email { font-size: 11px; color: #94a3b8; }
  .cover .info-accent { color: #60a5fa; }

  .cover .footer-text { font-size: 8px; color: #475569; font-weight: 600; letter-spacing: 1px; margin-top: 50px; }

  /* ── Content Pages ── */
  .content-page { padding: 36px 44px 60px; background: #ffffff; }
  .page-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1e3a8a; }
  .page-header h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .page-header p { font-size: 11px; color: #64748b; }

  /* ── KPI Cards ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi-card { border-radius: 10px; padding: 16px 18px; text-align: center; border: 1px solid; }
  .kpi-card .kpi-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; display: block; }
  .kpi-card .kpi-value { font-size: 20px; font-weight: 800; display: block; }

  .kpi-income { background: #ecfdf5; border-color: #a7f3d0; }
  .kpi-income .kpi-label { color: #065f46; }
  .kpi-income .kpi-value { color: #059669; }

  .kpi-expense { background: #fef2f2; border-color: #fecaca; }
  .kpi-expense .kpi-label { color: #991b1b; }
  .kpi-expense .kpi-value { color: #dc2626; }

  .kpi-savings { background: #eff6ff; border-color: #bfdbfe; }
  .kpi-savings .kpi-label { color: #1e40af; }
  .kpi-savings .kpi-value { color: #2563eb; }

  .kpi-neutral { background: #f8fafc; border-color: #e2e8f0; }
  .kpi-neutral .kpi-label { color: #475569; }
  .kpi-neutral .kpi-value { color: #0f172a; }

  /* ── Charts Grid ── */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .chart-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .chart-title { font-size: 9px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.8px; text-align: center; margin-bottom: 10px; text-transform: uppercase; }
  .chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
  .chart-legend span { font-size: 10px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
  .chart-legend .dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }

  /* ── Tables ── */
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
  thead th { background: #1e3a8a; color: #ffffff; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; padding: 10px 14px; text-transform: uppercase; }
  .totals-row td { background: #eef2f6; font-weight: 700; font-size: 11px; padding: 10px 14px; border-top: 2px solid #cbd5e1; }

  /* ── Page Footer ── */
  .page-footer { position: absolute; bottom: 20px; left: 44px; right: 44px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>

<!-- ═══════════════════ PAGE 1: COVER ═══════════════════ -->
<div class="page cover page-break">
  <div class="accent-lines">
    <div class="line1"></div>
    <div class="line2"></div>
  </div>

  <div class="logo"><div class="logo-inner"></div></div>
  <h1>AI EXPENSE TRACKER</h1>
  <h2>PERSONAL FINANCIAL STATEMENT</h2>
  <p class="period-text">Report Period: ${displayPeriod} (${type.toUpperCase()})</p>

  <div class="info-card">
    <div class="info-label">PREPARED FOR</div>
    <div class="info-value">${user.username.toUpperCase()}</div>
    <div class="info-email">${user.email}</div>

    <div class="info-label">REPORTING PERIOD</div>
    <div class="info-value">${displayPeriod} <span style="font-size:11px;color:#94a3b8;">(${type.toUpperCase()})</span></div>

    <div class="info-label">STATEMENT AUDIT</div>
    <div class="info-value info-accent">Report ID: #AIFR-${reportId}</div>
    <div class="info-email">Issued On: ${issuedDate}</div>
  </div>

  <p class="footer-text">CONFIDENTIAL FINANCIAL AUDIT REPORT &nbsp;|&nbsp; SYSTEM GENERATED &nbsp;|&nbsp; AI EXPENSE TRACKER ENGINE</p>
</div>

<!-- ═══════════════════ PAGE 2: EXECUTIVE DASHBOARD ═══════════════════ -->
<div class="page content-page page-break">
  <div class="page-header">
    <h2>Executive Dashboard &amp; Metrics</h2>
    <p>Financial inflows, outflows, savings rates, and health index for ${displayPeriod}.</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card kpi-income">
      <span class="kpi-label">TOTAL INFLOW</span>
      <span class="kpi-value">+$${totalIncome.toFixed(2)}</span>
    </div>
    <div class="kpi-card kpi-expense">
      <span class="kpi-label">TOTAL OUTFLOW</span>
      <span class="kpi-value">-$${totalExpense.toFixed(2)}</span>
    </div>
    <div class="kpi-card kpi-savings">
      <span class="kpi-label">NET SAVINGS</span>
      <span class="kpi-value" style="color:${savings >= 0 ? '#059669' : '#dc2626'}">$${savings.toFixed(2)}</span>
    </div>
    <div class="kpi-card kpi-neutral">
      <span class="kpi-label">SAVINGS RATE</span>
      <span class="kpi-value" style="color:#2563eb">${savingsRate}%</span>
    </div>
    <div class="kpi-card kpi-neutral" style="background:${healthBg};border-color:${healthColor}33;">
      <span class="kpi-label">BUDGET HEALTH</span>
      <span class="kpi-value" style="color:${healthColor}">${budgetHealth.toUpperCase()}</span>
    </div>
    <div class="kpi-card kpi-neutral">
      <span class="kpi-label">FINANCIAL SCORE</span>
      <span class="kpi-value" style="color:${scoreColor}">${financialScore} / 100</span>
    </div>
  </div>

  <div class="charts-grid">
    <div class="chart-box">
      <div class="chart-title">Savings &amp; Expense Division</div>
      ${donutSVG}
      <div class="chart-legend">
        <span><span class="dot" style="background:#ef4444;"></span> Outflow ${expPct.toFixed(1)}%</span>
        <span><span class="dot" style="background:#10b981;"></span> Savings ${savPct.toFixed(1)}%</span>
      </div>
    </div>
    <div class="chart-box">
      <div class="chart-title">Income / Expense / Savings</div>
      ${barSVG}
    </div>
    <div class="chart-box">
      <div class="chart-title">Expenditures by Category</div>
      ${pieData.svg}
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;">
        ${pieData.legends}
      </div>
    </div>
    <div class="chart-box">
      <div class="chart-title">Spending Trend</div>
      ${lineSVG}
    </div>
  </div>

  <div class="page-footer">
    <span>Page 2 &nbsp;|&nbsp; CONFIDENTIAL FINANCIAL AUDIT</span>
    <span>Report ID: #AIFR-${reportId}</span>
  </div>
</div>

<!-- ═══════════════════ PAGE 3: TABLES ═══════════════════ -->
<div class="page content-page page-break">
  <div class="page-header">
    <h2>Financial Statement &amp; Transaction Ledger</h2>
    <p>Category allocations, transaction history, and running ledger balances.</p>
  </div>

  <div class="section-title">1. Category Expenditure Allocations</div>
  ${activeCats.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Category</th>
        <th style="text-align:right;">Total Spent</th>
        <th style="text-align:right;">Pct (%)</th>
        <th style="text-align:center;min-width:140px;">Distribution</th>
        <th style="text-align:right;">Tx Count</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRowsHTML}
    </tbody>
  </table>` : '<p style="color:#94a3b8;font-style:italic;font-size:11px;padding:16px 0;">No category expenditure records found.</p>'}

  <div class="section-title" style="margin-top:24px;">2. Transaction Ledger</div>
  ${displayTx.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Date</th>
        <th style="text-align:left;">Type</th>
        <th style="text-align:left;">Category/Source</th>
        <th style="text-align:left;">Description</th>
        <th style="text-align:right;">Amount</th>
        <th style="text-align:right;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${txRowsHTML}
      <tr class="totals-row">
        <td colspan="4" style="text-align:left;">TOTAL STATEMENT LEDGER</td>
        <td style="text-align:right;color:#0f172a;">+$${totalIncome.toFixed(2)} / -$${totalExpense.toFixed(2)}</td>
        <td style="text-align:right;color:#0f172a;">$${runningBalance.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>` : '<p style="color:#94a3b8;font-style:italic;font-size:11px;padding:16px 0;">No transactions recorded.</p>'}

  <div class="page-footer">
    <span>Page 3 &nbsp;|&nbsp; CONFIDENTIAL FINANCIAL AUDIT</span>
    <span>Report ID: #AIFR-${reportId}</span>
  </div>
</div>

<!-- ═══════════════════ PAGE 4: AI ADVISOR ═══════════════════ -->
<div class="page content-page">
  <div class="page-header">
    <h2>AI Advisor Financial Recommendations</h2>
    <p>Personalized consulting feedback generated for your spending pattern to help optimize financial health.</p>
  </div>

  ${adviceHTML}

  <div style="margin-top:30px;padding:20px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;text-align:center;">
    <div style="font-size:10px;font-weight:700;color:#0369a1;letter-spacing:1px;margin-bottom:6px;">DISCLAIMER</div>
    <p style="font-size:10px;color:#64748b;line-height:1.6;">
      This report is auto-generated by AI Expense Tracker's financial analysis engine. The AI recommendations are advisory only and do not constitute professional financial advice. Always consult a certified financial advisor for important financial decisions.
    </p>
  </div>

  <div class="page-footer">
    <span>Page 4 &nbsp;|&nbsp; CONFIDENTIAL FINANCIAL AUDIT</span>
    <span>Report ID: #AIFR-${reportId}</span>
  </div>
</div>

</body>
</html>`;
};

// ─── Main PDF Generator ───────────────────────────────────────────────────────

exports.generateFinancialReportPDF = async (reportData, res) => {
  let browser = null;
  try {
    const { launch } = await import('puppeteer-core');
    const html = buildReportHTML(reportData);

    let launchOptions;

    if (isVercel) {
      // Vercel serverless: use @sparticuz/chromium
      const chromium = require('@sparticuz/chromium');
      launchOptions = {
        headless: chromium.headless,
        executablePath: await chromium.executablePath(),
        args: chromium.args,
        defaultViewport: chromium.defaultViewport
      };
    } else {
      // Local development: use system Chrome
      launchOptions = {
        headless: 'new',
        executablePath: getChromePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      };
    }

    browser = await launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();
    browser = null;

    // Convert Uint8Array to Node.js Buffer for proper binary response
    const pdfBuffer = Buffer.from(pdfUint8);
    const filename = `${getPeriodFilename(reportData.type, reportData.period)}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuffer);

    console.log(`[REPORTS] Professional PDF generated. File: ${filename}, Size: ${pdfBuffer.length} bytes.`);
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    console.error('[PDF ERROR] PDF generation failed:', err.stack);
    res.status(500).json({ success: false, message: 'PDF document generation failed.', error: err.message });
  }
};
