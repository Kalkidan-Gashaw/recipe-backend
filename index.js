const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
console.log("API Key loaded:", process.env.GOOGLE_API_KEY ? "Yes" : "No");
console.log("API Key length:", process.env.GOOGLE_API_KEY?.length);
console.log(
  "First 10 chars:",
  process.env.GOOGLE_API_KEY?.substring(0, 10) + "..."
);
const app = express();
const PORT = 8000;

// Validate API key is present
if (!process.env.GOOGLE_API_KEY) {
  console.error("ERROR: GOOGLE_API_KEY environment variable is not set");
  process.exit(1); // Exit the process if the API key is not set
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(cors());
app.use(express.json());

app.post("/generate-recipe", async (req, res) => {
  const { ingredients, country } = req.body;

  if (!ingredients || ingredients.trim() === "") {
    return res.status(400).json({ error: "Ingredients are required." });
  }
  if (!country || country.trim() === "") {
    return res.status(400).json({ error: "Country is required." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate a ${country} recipe using the following ingredients: ${ingredients}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    res.json({ recipe: text });
  } catch (error) {
    console.error("Gemini API Error:", error);

    let statusCode = 500;
    let errorMessage = "Failed to generate recipe.";

    if (error.message.includes("API key")) {
      statusCode = 401;
      errorMessage = "Invalid API key";
    } else if (error.message.includes("quota")) {
      statusCode = 429;
      errorMessage = "API quota exceeded";
    }

    res.status(statusCode).json({
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
