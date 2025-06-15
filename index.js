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

// Endpoint to get available options (for frontend dropdowns)
app.get("/recipe-options", (req, res) => {
  const options = {
    dietaryPreferences: ["None", "Vegan", "Vegetarian"],
    cuisines: [
      "Any",
      "Italian",
      "Indian",
      "Mexican",
      "Chinese",
      "Japanese",
      "French",
      "Thai",
      "Mediterranean",
      "American",
    ],
  };
  res.json(options);
});

app.post("/generate-recipe", async (req, res) => {
  const { ingredients, dietaryPreference, cuisine } = req.body;

  if (!ingredients || ingredients.trim() === "") {
    return res.status(400).json({ error: "Ingredients are required." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = `Generate a recipe using the following ingredients: ${ingredients}.`;

    if (dietaryPreference && dietaryPreference !== "None") {
      prompt += ` The recipe must be ${dietaryPreference}.`;
    }

    if (cuisine && cuisine !== "Any") {
      prompt += ` The recipe should be ${cuisine} cuisine.`;
    }

    prompt +=
      " Provide the recipe in the following structured format: Ingredients: [list of ingredients], Instructions: [list of instructions].";

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    // Parse the response text to extract ingredients and instructions
    const ingredientsStart = text.indexOf("Ingredients:");
    const instructionsStart = text.indexOf("Instructions:");

    let ingredientsList = [];
    let instructionsList = [];

    if (ingredientsStart !== -1 && instructionsStart !== -1) {
      const ingredientsText = text
        .substring(ingredientsStart + "Ingredients:".length, instructionsStart)
        .trim();
      const instructionsText = text
        .substring(instructionsStart + "Instructions:".length)
        .trim();

      ingredientsList = ingredientsText
        .split("\n")
        .filter((line) => line.trim() !== "");
      instructionsList = instructionsText
        .split("\n")
        .filter((line) => line.trim() !== "");
    }

    res.json({
      recipe: {
        ingredients: ingredientsList,
        instructions: instructionsList,
      },
    });
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
