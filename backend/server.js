const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for high-res base64 images

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('🌿 Plant Disease Backend is running! Please open the Frontend Dashboard at http://localhost:5173');
});

// Check if API key is present
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
  console.error("CRITICAL: GEMINI_API_KEY is missing from .env!");
}

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * AI System Prompt specifically tuned for Agricultural Plant Disease Diagnosis
 */
const SYSTEM_INSTRUCTION = `
You are a highly experienced agricultural botanist and plant pathologist. 
Your task is to analyze images of plant leaves and identify any diseases, deficiencies, or pests.
You MUST output your response as a valid JSON object EXACTLY matching this structure:
{
  "disease": "Name of the disease (or 'Healthy' if no issues found)",
  "confidence": "Percentage (e.g. '95%')",
  "symptoms": "A short, 2-sentence description of the visual symptoms you see",
  "treatment": "A concise, actionable recommendation for treatment or care"
}
Do NOT wrap the JSON in markdown code blocks. Just output raw JSON.
`;

app.post('/api/analyze', async (req, res) => {
  const { imageBase64, cropType } = req.body;
  
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    console.log(`[Backend] Received image from frontend. Sending to Gemini AI...`);
    
    // 1. Remove the "data:image/jpeg;base64," prefix if it exists
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    // 2. Prepare the prompt for Gemini
    const cropContext = cropType && cropType !== "Unknown" 
      ? `This is a leaf from a ${cropType} plant.` 
      : "The plant type is unknown.";
      
    const prompt = `${cropContext} Analyze this leaf and provide the JSON diagnosis.`;

    // 3. Call the Gemini API with the image (with automatic retries)
    let geminiResponse;
    let retries = 3;
    
    while (retries > 0) {
        try {
            geminiResponse = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    data: base64Data,
                                    mimeType: 'image/jpeg'
                                }
                            },
                            { text: prompt }
                        ]
                    }
                ],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    temperature: 0.2, // Low temperature for factual, deterministic analysis
                }
            });
            break; // Success
        } catch (apiErr) {
            console.error(`Gemini API Error (Retries left: ${retries - 1}):`, apiErr.message);
            retries--;
            if (retries === 0) throw apiErr;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const aiText = geminiResponse.text;
    console.log("[Backend] Gemini Response:", aiText);

    // 4. Parse the JSON response
    try {
      const result = JSON.parse(aiText.trim());
      res.json(result);
    } catch (parseError) {
      console.error("[Backend] Failed to parse JSON from AI:", aiText);
      // Fallback if AI messes up the format
      res.json({
        disease: "Error Parsing Output",
        confidence: "N/A",
        symptoms: aiText,
        treatment: "The AI failed to format the output as JSON."
      });
    }

  } catch (error) {
    console.error('[Backend] Error during analysis:', error);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

// Follow-up chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, contextDisease, cropType } = req.body;
    
    try {
        const chatPrompt = `
You are an expert plant pathologist. The user's ${cropType || 'plant'} was just diagnosed with ${contextDisease}.
The user is asking a follow-up question: "${message}"
Answer concisely, helpfully, and practically. Do not use more than 3-4 sentences.
        `;
        
        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: chatPrompt
        });
        
        res.json({ reply: geminiResponse.text });
    } catch (error) {
        console.error('[Backend] Chat error:', error);
        res.status(500).json({ error: "Chat failed" });
    }
});

app.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Backend] Ready to bridge ESP32-CAM and Gemini API!`);
});
