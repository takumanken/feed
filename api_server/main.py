from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI()

# Basic CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class PromptRequest(BaseModel):
    prompt: str

# Retrieve API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY)

# Read system instruction from file
SYSTEM_INSTRUCTION_FILE = "system_instruction.txt"
with open(SYSTEM_INSTRUCTION_FILE, "r", encoding="utf-8") as f:
    system_instruction = f.read()

@app.post("/process")
async def process_prompt(request_data: PromptRequest):
    try:
        # Generate content with Gemini
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        # Extract text from response
        json_text = response.candidates[0].content.parts[0].text
        return {"response": json_text}
    except Exception as e:
        # Return simple error message for debugging
        return {"error": str(e)}
