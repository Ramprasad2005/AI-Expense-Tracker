const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateFinancialSuggestions = async (financialData) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || !apiKey.trim()) {
      return "AI Advisor Warning: GEMINI_API_KEY is not configured in the backend .env file. Please add your Google Gemini API key to receive customized financial reports, saving tips, and category analyses.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for speed and lightweight content generation
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const { totalIncome, totalExpense, savings, categoryBreakdown } = financialData;

    const activeCategories = categoryBreakdown.filter(c => c.amount > 0);
    const categoryStr = activeCategories.map(c => `${c.category}: $${c.amount.toFixed(2)}`).join(', ');

    const prompt = `
You are a professional financial advisor.
Analyze the following financial summary for this month:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpense.toFixed(2)}
- Net Savings: $${savings.toFixed(2)}
- Category-wise Spending: ${categoryStr || 'No expenses logged.'}

Provide a concise, professional financial analysis, saving tips, and personalized advice in less than 150 words.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return `AI Advisor Error: Unable to fetch advice at this moment. Details: ${error.message}`;
  }
};

module.exports = { generateFinancialSuggestions };
