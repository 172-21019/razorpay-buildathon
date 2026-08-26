const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.processMessage = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: message,
      config: {
        systemInstruction: "You are a product search intent extractor. Extract the product name and the budget (if specified). Return ONLY a JSON object.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: "The name of the product being searched for"
            },
            budget: {
              type: Type.NUMBER,
              nullable: true,
              description: "The numerical budget limit for the product if mentioned, otherwise null"
            }
          },
          required: ["productName"]
        }
      }
    });

    const parsedData = JSON.parse(response.text);
    res.json(parsedData);
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};
