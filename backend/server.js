const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('🌿 Plant Disease Backend (Groq) is running! Open the Frontend Dashboard at http://localhost:5173');
});

// Check if API key is present
if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
  console.error("⚠️  CRITICAL: GROQ_API_KEY is missing from .env!");
}

// Initialize the Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * AI System Prompt specifically tuned for Agricultural Plant Disease Diagnosis
 */
const SYSTEM_INSTRUCTION = `You are a highly experienced agricultural botanist and plant pathologist. 
Your task is to analyze images of plant leaves and identify any diseases, deficiencies, or pests.
You MUST output your response as a valid JSON object EXACTLY matching this structure:
{
  "disease": "Name of the disease (or 'Healthy' if no issues found)",
  "confidence": "Percentage (e.g. '95%')",
  "symptoms": "A short, 2-sentence description of the visual symptoms you see",
  "treatment": "A concise, actionable recommendation for treatment or care"
}
Do NOT wrap the JSON in markdown code blocks. Do NOT add any text before or after the JSON. Just output raw JSON.`;

app.post('/api/analyze', async (req, res) => {
  const { imageBase64, cropType } = req.body;
  
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    console.log(`[Backend] Received image from frontend. Sending to Groq AI...`);
    
    // Remove the "data:image/jpeg;base64," prefix if it exists
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    const cropContext = cropType && cropType !== "Unknown" 
      ? `This is a leaf from a ${cropType} plant.` 
      : "The plant type is unknown.";
      
    const prompt = `${cropContext} Analyze this leaf and provide the JSON diagnosis.`;

    // Call Groq API with vision model
    const chatCompletion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        {
          role: "system",
          content: SYSTEM_INSTRUCTION
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 512
    });

    const aiText = chatCompletion.choices[0]?.message?.content || "";
    console.log("[Backend] Groq Response:", aiText);

    // Parse the JSON response
    try {
      // Try to extract JSON even if wrapped in code blocks
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : aiText.trim());
      res.json(result);
    } catch (parseError) {
      console.error("[Backend] Failed to parse JSON from AI:", aiText);
      res.json({
        disease: "Error Parsing Output",
        confidence: "N/A",
        symptoms: aiText,
        treatment: "The AI failed to format the output as JSON."
      });
    }

  } catch (error) {
    console.error('[Backend] Error during analysis:', error.message);
    res.status(500).json({ error: "Analysis failed", details: error.message });
  }
});

// Follow-up chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, contextDisease, cropType } = req.body;
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "system",
                    content: `You are an expert plant pathologist. The user's ${cropType || 'plant'} was just diagnosed with ${contextDisease}. Answer concisely, helpfully, and practically in 3-4 sentences.`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.5,
            max_tokens: 256
        });
        
        const reply = chatCompletion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
        res.json({ reply });
    } catch (error) {
        console.error('[Backend] Chat error:', error.message);
        res.status(500).json({ error: "Chat failed" });
    }
});

app.listen(PORT, () => {
  console.log(`[Backend] 🚀 Groq-powered server running on http://localhost:${PORT}`);
  console.log(`[Backend] Ready to bridge ESP32-CAM and Groq AI!`);
});
