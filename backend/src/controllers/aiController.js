const { GoogleGenAI, Type } = require('@google/genai');
const db = require('../db');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.processSearch = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: message,
      config: {
        systemInstruction: "You are a product search intent extractor. If the user message is not a recognizable product search (e.g., gibberish, weather, greetings), return productName as null. Otherwise, extract the productName being searched for. Name the budget field clearly as the user's budget, if provided. Return ONLY JSON.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { 
              type: Type.STRING, 
              description: "The name of the product being searched for, or null if unrelated" 
            },
            budget: { 
              type: Type.NUMBER, 
              description: "The numerical budget limit for the product if mentioned, otherwise null" 
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text);
    const { productName, budget } = parsedData;

    if (!productName || String(productName).trim().toLowerCase() === 'null' || String(productName).trim() === '') {
      return res.json({
        topPick: null,
        alternatives: [],
        matchType: 'unclear',
        message: "I couldn't quite understand that as a product search — try something like 'find headphones under ₹5000'."
      });
    }

    db.all('SELECT * FROM products WHERE name LIKE ? AND stock > 0', [`%${String(productName).trim()}%`], (err, rows) => {
      if (err) {
        console.error('DB query error:', err);
        return res.status(500).json({ error: 'Failed to search database' });
      }

      if (rows.length === 0) {
        return res.json({
          topPick: null,
          alternatives: [],
          matchType: 'no_match',
          message: `I couldn't find any products matching "${productName}".`
        });
      }

      let lowestPrice = Infinity;
      const validProducts = [];

      for (const row of rows) {
        const discountedPrice = Math.round(row.price * (1 - row.discount / 100));
        
        if (discountedPrice < lowestPrice) {
          lowestPrice = discountedPrice;
        }

        const hasBudget = budget !== null && budget !== undefined && budget > 0;
        
        if (!hasBudget || discountedPrice <= budget) {
          validProducts.push({ ...row, finalPrice: discountedPrice });
        }
      }

      if (validProducts.length === 0) {
        return res.json({
          topPick: null,
          alternatives: [],
          matchType: 'no_match',
          message: `I found "${productName}", but the lowest price is ₹${lowestPrice}, which is over your budget of ₹${budget}.`
        });
      }

      // Sort by rating descending
      validProducts.sort((a, b) => b.rating - a.rating);

      const topPick = validProducts[0];
      const alternatives = validProducts.slice(1);

      res.json({
        topPick,
        alternatives,
        matchType: 'found',
        message: `I found ${validProducts.length} option(s) for "${productName}". Here is the top pick.`
      });
    });
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};
