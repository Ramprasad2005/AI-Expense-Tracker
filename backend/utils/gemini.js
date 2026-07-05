const { GoogleGenerativeAI } = require('@google/generative-ai');

// High-fidelity local financial advice engine when API key is missing or fails
const getLocalSuggestions = (financialData) => {
  const { totalIncome, totalExpense, savings, categoryBreakdown } = financialData;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : '0';
  const expenseRate = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : '0';
  
  // Calculate highest category
  let highestCategory = 'None';
  let highestAmount = 0;
  categoryBreakdown.forEach(c => {
    if (c.amount > highestAmount) {
      highestAmount = c.amount;
      highestCategory = c.category;
    }
  });

  // Calculate rating score
  let score = 50;
  if (parseFloat(savingsRate) > 30) score += 35;
  else if (parseFloat(savingsRate) > 15) score += 20;
  else if (parseFloat(savingsRate) < 0) score -= 25;

  if (highestCategory === 'Rent' && highestAmount > totalIncome * 0.4) score -= 10;
  if (highestCategory === 'Shopping' && highestAmount > totalIncome * 0.2) score -= 15;
  score = Math.min(100, Math.max(10, score));

  let scoreRating = 'Fair';
  if (score >= 80) scoreRating = 'Excellent';
  else if (score >= 65) scoreRating = 'Good';
  else if (score < 45) scoreRating = 'Critical';

  return `### Financial Health Score
**Score: ${score}/100** (${scoreRating})
*Based on a savings rate of ${savingsRate}% and category spending allocations.*

### Monthly Executive Summary
* Your total monthly inflows are **$${totalIncome.toFixed(2)}** and outflows are **$${totalExpense.toFixed(2)}**.
* You have saved **$${savings.toFixed(2)}** this period, reflecting a **${savingsRate}%** net savings rate.
* Discretionary spending occupies approximately **${expenseRate}%** of your total monthly cash flows.

### Overspending Analysis & Recommendations
${highestAmount > 0 ? `* **High Outflow Category Alert**: Your highest spending area is **${highestCategory}** at **$${highestAmount.toFixed(2)}**.
* Allocate no more than 30% of your earnings to discretionary components like Shopping or Entertainment to maintain balance.` : `* No significant category transactions have been logged for analysis yet.`}

### Actionable Savings Tips & Cooldown Budget
* **Build Emergency Cache**: Aim to maintain a dedicated reserve covering 3-6 months of essential living expenses.
* **Optimize Subscriptions**: Review recurrent utility and membership services. Deactivate underutilized memberships to conserve capital.
* **Follow the 50/30/20 Blueprint**: Allocate 50% of your net receipts to essential needs, 30% to personal wants, and channel 20% directly into savings.`;
};

const generateFinancialSuggestions = async (financialData) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || !apiKey.trim()) {
      console.log('[AI ADVISOR] GEMINI_API_KEY is not configured. Using high-fidelity local suggestions.');
      return getLocalSuggestions(financialData);
    }

    console.log('[AI ADVISOR] Requesting recommendations from Google Gemini...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const { totalIncome, totalExpense, savings, categoryBreakdown } = financialData;
    const activeCategories = categoryBreakdown.filter(c => c.amount > 0);
    const categoryStr = activeCategories.map(c => `${c.category}: $${c.amount.toFixed(2)}`).join(', ');

    const prompt = `
You are an expert personal financial advisor and SaaS wealth assistant.
Analyze this user's monthly ledger snapshot:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpense.toFixed(2)}
- Net Savings: $${savings.toFixed(2)}
- Category Spending: ${categoryStr || 'No transactions logged.'}

Format your response in beautiful, clean Markdown (use bullet points and bold headers). Structure your insights precisely into these headings:
### Financial Health Score
Give a score out of 100 with a brief rating justification.

### Monthly Executive Summary
Brief, professional performance review.

### Overspending Analysis & Recommendations
Flag category anomalies or disproportionate expenditures.

### Actionable Savings Tips & Cooldown Budget
Provide 2-3 specific, realistic cost-cutting optimization goals.
`;

    // Implement a 10s promise timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);

    const text = result.response.text();
    if (!text || !text.trim()) {
      throw new Error('Gemini returned empty advice text');
    }
    return text;
  } catch (error) {
    console.error('[AI ADVISOR ERROR] Gemini failed or timed out. Falling back to local advice.', error.message);
    // Return high-quality local suggestions so the UI never displays warning/error
    return getLocalSuggestions(financialData);
  }
};

module.exports = { generateFinancialSuggestions };
