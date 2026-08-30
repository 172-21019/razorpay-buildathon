const { GoogleGenAI, Type } = require('@google/genai');
const { db, logAuditEvent } = require('../db');
const crypto = require('crypto');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.processSearch = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sessionId = crypto.randomUUID();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: message,
      config: {
        systemInstruction: "You are a product search intent extractor. If the user message is not a recognizable product search (e.g., gibberish, weather, greetings), return productName as null. Otherwise, extract the productName being searched for. Name the budget field clearly as the user's budget, if provided. If the user does not mention a budget, explicitly return null for the budget field (do not return 0). Return ONLY JSON.",
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
              description: "The numerical budget limit for the product if mentioned, otherwise null",
              nullable: true
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text);
    const { productName, budget } = parsedData;

    logAuditEvent(sessionId, 'intent_parsed', message, { productName, budget });

    if (!productName || String(productName).trim().toLowerCase() === 'null' || String(productName).trim() === '') {
      const msg = "I couldn't quite understand that as a product search — try something like 'find headphones under ₹5000'.";
      logAuditEvent(sessionId, 'unclear_request', null, msg);
      return res.json({
        topPick: null,
        alternatives: [],
        excludedByBudget: [],
        matchType: 'unclear',
        message: msg
      });
    }

    db.all('SELECT * FROM products WHERE name LIKE ? AND stock > 0', [`%${String(productName).trim()}%`], (err, rows) => {
      logAuditEvent(sessionId, 'catalog_searched', { productName }, rows ? rows.length : 0);
      
      if (err) {
        console.error('DB query error:', err);
        return res.status(500).json({ error: 'Failed to search database' });
      }

      if (rows.length === 0) {
        const msg = `I couldn't find any products matching "${productName}".`;
        logAuditEvent(sessionId, 'no_match_found', null, { message: msg, excludedIds: [] });
        return res.json({
          topPick: null,
          alternatives: [],
          excludedByBudget: [],
          matchType: 'no_match',
          message: msg
        });
      }

      let lowestPrice = Infinity;
      const validProducts = [];
      const excludedProducts = [];

      for (const row of rows) {
        const discountedPrice = Math.round(row.price * (1 - row.discount / 100));
        row.finalPrice = discountedPrice;
        
        if (discountedPrice < lowestPrice) {
          lowestPrice = discountedPrice;
        }

        const hasBudget = budget !== null && budget !== undefined && budget > 0;
        
        if (!hasBudget || discountedPrice <= budget) {
          validProducts.push(row);
        } else {
          excludedProducts.push(row);
        }
      }

      logAuditEvent(sessionId, 'budget_filtered', { budget, candidateCount: rows.length }, { validCount: validProducts.length, excludedCount: rows.length - validProducts.length });

      if (validProducts.length === 0) {
        excludedProducts.sort((a, b) => a.finalPrice - b.finalPrice);
        const msg = `I found "${productName}", but the lowest price is ₹${lowestPrice}, which is over your budget of ₹${budget}.`;
        logAuditEvent(sessionId, 'no_match_found', null, { message: msg, excludedIds: excludedProducts.map(p => p.id) });
        return res.json({
          topPick: null,
          alternatives: [],
          excludedByBudget: excludedProducts,
          matchType: 'no_match',
          message: msg
        });
      }

      // Sort by rating descending
      validProducts.sort((a, b) => b.rating - a.rating);

      const topPick = validProducts[0];
      const alternatives = validProducts.slice(1);

      logAuditEvent(sessionId, 'products_ranked', null, { topPickId: topPick.id, topPickName: topPick.name, alternativeIds: alternatives.map(a => a.id) });

      res.json({
        topPick,
        alternatives,
        excludedByBudget: excludedProducts,
        matchType: 'found',
        message: `I found ${validProducts.length} option(s) for "${productName}". Here is the top pick.`
      });
    });
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};
