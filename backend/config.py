import os
from pathlib import Path
from dotenv import load_dotenv

# Path to the project root (one folder above backend/)
ROOT = Path(__file__).resolve().parent.parent

# Read the .env file in the root so os.getenv can see your keys
load_dotenv(ROOT / ".env")

# --- Keys (come from .env, never hardcode them) ---
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# --- Models (change these here, nowhere else) ---
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
STT_MODEL = os.getenv("STT_MODEL", "whisper-large-v3-turbo")
TTS_MODEL = os.getenv("TTS_MODEL", "canopylabs/orpheus-v1-english")
TTS_VOICE = os.getenv("TTS_VOICE", "autumn")

# --- Knowledge base ---
DATA_DIR = ROOT / "data"
TOP_K = 4
MIN_SCORE = 0.75   # best chunk must score at least this, or the agent says "I'm not sure"      # below this, the agent says "I'm not sure" (we'll tune it)

# --- Demo accounts ---
DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).resolve().parent / "demo.db")))
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
SESSION_DAYS = 7
STARTING_AIRTIME_NAIRA = 2000   # demo credit every new account starts with
STARTING_DATA_MB = 1000