import os
import sys
import warnings

# Make `engine` and `app` importable, and never call real Gemini/Pinecone from tests
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["PINECONE_API_KEY"] = "test-key"
warnings.filterwarnings("ignore", category=FutureWarning)
