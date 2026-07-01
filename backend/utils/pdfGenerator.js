const PdfPrinter = require('pdfmake');

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    bolditalic: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

exports.generateFinancialReportPDF = (reportData, res) => {
  const { user, type, period, totalIncome, totalExpense, savings, categoryBreakdown, recentTransactions } = reportData;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : '0';

  // Category breakdown table body
  const categoryRows = [[{ text: 'Category', style: 'tableHeader' }, { text: 'Amount ($)', style: 'tableHeader' }, { text: 'Percentage (%)', style: 'tableHeader' }]];
  categoryBreakdown.forEach(cat => {
    const percentage = totalExpense > 0 ? ((cat.amount / totalExpense) * 100).toFixed(1) : '0';
    categoryRows.push([cat.category, cat.amount.toFixed(2), `${percentage}%`]);
  });

  // Recent transactions table body
  const transactionRows = [[
    { text: 'Date', style: 'tableHeader' }, 
    { text: 'Type', style: 'tableHeader' }, 
    { text: 'Category/Source', style: 'tableHeader' }, 
    { text: 'Description', style: 'tableHeader' }, 
    { text: 'Amount ($)', style: 'tableHeader' }
  ]];
  
  recentTransactions.forEach(t => {
    const dateStr = new Date(t.date).toLocaleDateString();
    transactionRows.push([
      dateStr,
      t.type,
      t.categoryOrSource,
      t.description || '-',
      t.amount.toFixed(2)
    ]);
  });

  const docDefinition = {
    content: [
      { text: 'AI Expense Tracker - Financial Report', style: 'header', alignment: 'center' },
      { text: `Report Type: ${type.toUpperCase()}`, style: 'subheader' },
      { text: `Period: ${period}`, style: 'subheader' },
      { text: `Generated for: ${user.username} (${user.email})`, style: 'subheader' },
      { text: `Date: ${new Date().toLocaleDateString()}`, style: 'subheader' },
      { text: '', margin: [0, 10] },

      { text: 'Financial Summary', style: 'sectionHeader' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
            ['Total Income', `$${totalIncome.toFixed(2)}`],
            ['Total Expense', `$${totalExpense.toFixed(2)}`],
            ['Net Savings', `$${savings.toFixed(2)}`],
            ['Savings Rate', `${savingsRate}%`]
          ]
        },
        layout: 'lightHorizontalLines'
      },
      { text: '', margin: [0, 15] },

      { text: 'Expense by Category Breakdown', style: 'sectionHeader' },
      {
        table: {
          widths: ['*', '*', '*'],
          body: categoryRows
        },
        layout: 'lightHorizontalLines'
      },
      { text: '', margin: [0, 15] },

      { text: 'Transactions List', style: 'sectionHeader' },
      {
        table: {
          widths: ['auto', 'auto', 'auto', '*', 'auto'],
          body: transactionRows
        },
        layout: 'lightHorizontalLines'
      }
    ],
    defaultStyle: {
      font: 'Helvetica'
    },
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        margin: [0, 0, 0, 10],
        color: '#1a365d'
      },
      subheader: {
        fontSize: 10,
        color: '#555555',
        margin: [0, 2, 0, 2]
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5],
        color: '#2b6cb0'
      },
      tableHeader: {
        bold: true,
        fillColor: '#edf2f7',
        color: '#2d3748'
      }
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  
  // Set headers for download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Report-${period}.pdf`);

  pdfDoc.pipe(res);
  pdfDoc.end();
};
