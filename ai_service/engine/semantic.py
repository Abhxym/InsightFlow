"""
Semantic Analysis Engine
Uses Google Gemini for embeddings, theme clustering and sentiment scoring,
and Pinecone for vector search.
Cloud-native, no C++ compilation required.
"""

import os
import re
import json
import uuid
import google.generativeai as genai
from pinecone import Pinecone, ServerlessSpec

# Model names are configurable because Google retires Gemini versions regularly
# (gemini-1.5-flash and embedding-001 are no longer served). The "-latest" alias
# tracks the current version; flash-lite keeps per-submission sentiment fast (~2s).
CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-flash-lite-latest")
EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "models/gemini-embedding-001")
EMBED_DIM = int(os.getenv("GEMINI_EMBED_DIM", "768"))
PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME", "insightflow-rag")


def configure_gemini() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        return True
    return False


def chat_model(**kwargs):
    return genai.GenerativeModel(CHAT_MODEL, **kwargs)


def _parse_json(text: str):
    """Parse a JSON reply, tolerating markdown code fences."""
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    return json.loads(text)


# Embedding quota is counted per text, so each (task, text) is embedded once per process
_EMBED_CACHE: dict[tuple[str, str], list[float]] = {}
# Theme discovery is the slowest call; Analytics and Ask reuse the result for the same answers
_THEME_CACHE: dict[tuple[str, ...], list[dict]] = {}


def embed_texts(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]]:
    """Generate embeddings using Google Gemini (cached per text)."""
    if not texts:
        return []

    missing = list(dict.fromkeys(t for t in texts if (task_type, t) not in _EMBED_CACHE))
    if missing:
        configure_gemini()
        # The batch embedding endpoint accepts at most 100 texts per call
        for start in range(0, len(missing), 100):
            chunk = missing[start:start + 100]
            result = genai.embed_content(
                model=EMBED_MODEL,
                content=chunk,
                task_type=task_type,
                output_dimensionality=EMBED_DIM
            )
            for text, emb in zip(chunk, result['embedding']):
                _EMBED_CACHE[(task_type, text)] = emb
    return [_EMBED_CACHE[(task_type, t)] for t in texts]


# ─────────────────────────────────────────────
# Sentiment
# ─────────────────────────────────────────────
POSITIVE_WORDS = {'good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'happy', 'perfect', 'fast', 'easy', 'helpful', 'friendly'}
NEGATIVE_WORDS = {'bad', 'terrible', 'worst', 'awful', 'hate', 'poor', 'sad', 'angry', 'slow', 'broken', 'late', 'expensive', 'rude', 'confusing'}
NEGATIONS = {'not', 'no', 'never', "isn't", "wasn't", "don't", "didn't", "doesn't", 'hardly'}


def _label(score: float) -> str:
    return 'Positive' if score > 0.2 else 'Negative' if score < -0.2 else 'Neutral'


def _lexicon_sentiment(text: str) -> dict:
    """Offline fallback: whole-word lexicon with simple negation handling."""
    tokens = re.findall(r"[a-z']+", text.lower())
    total = 0
    for i, tok in enumerate(tokens):
        polarity = 1 if tok in POSITIVE_WORDS else -1 if tok in NEGATIVE_WORDS else 0
        if polarity and any(t in NEGATIONS for t in tokens[max(0, i - 3):i]):
            polarity = -polarity
        total += polarity
    score = max(-1.0, min(1.0, total / 3))
    return {'sentiment': _label(score), 'sentiment_score': round(score, 2), 'sentiment_source': 'lexicon'}


def score_sentiment(text: str) -> dict:
    """
    Score sentiment of one open-ended response on a -1..1 scale.
    Uses Gemini (handles negation, sarcasm, mixed feedback); falls back to a lexicon.
    """
    if configure_gemini():
        try:
            prompt = f"""Rate the sentiment of this customer survey response.
Return JSON only: {{"score": <float from -1.0 (very negative) to 1.0 (very positive)>}}

Response: {json.dumps(text)}"""
            reply = chat_model().generate_content(
                prompt, generation_config={"response_mime_type": "application/json", "temperature": 0}
            )
            score = max(-1.0, min(1.0, float(_parse_json(reply.text)['score'])))
            return {'sentiment': _label(score), 'sentiment_score': round(score, 2), 'sentiment_source': 'gemini'}
        except Exception as e:
            print(f"Gemini sentiment failed: {e}, falling back to lexicon.")
    return _lexicon_sentiment(text)


# ─────────────────────────────────────────────
# Theme discovery
# ─────────────────────────────────────────────
def discover_themes(texts: list[str], max_texts: int = 300) -> list[dict]:
    """
    Group open-ended responses into 3-5 themes.
    Gemini names the themes AND assigns every response to one of them, so counts
    and percentages are computed from real assignments (not estimated by the model)
    and every representative quote is a verbatim response.
    """
    if not texts or len(texts) < 2 or not configure_gemini():
        return []

    sample = texts[:max_texts]
    cache_key = tuple(sample)
    if cache_key in _THEME_CACHE:
        return _THEME_CACHE[cache_key]

    numbered = '\n'.join(f'{i}: {json.dumps(t)}' for i, t in enumerate(sample))

    prompt = f"""Group the following customer survey responses into 3 to 5 distinct themes.
Return JSON only, in this exact shape:
{{"themes": [{{"label": "<2-3 word theme name>", "response_ids": [<ids of every response in this theme>], "representative_id": <id of the single most typical response in this theme>}}]}}
Every response id must appear in exactly one theme.

Responses (id: text):
{numbered}"""

    try:
        reply = chat_model().generate_content(
            prompt, generation_config={"response_mime_type": "application/json", "temperature": 0}
        )
        raw_themes = _parse_json(reply.text)['themes']
    except Exception as e:
        print(f"Gemini clustering failed: {e}")
        return []

    seen = set()
    themes = []
    for t in raw_themes:
        ids = [i for i in t.get('response_ids', []) if isinstance(i, int) and 0 <= i < len(sample) and i not in seen]
        seen.update(ids)
        if ids:
            rep = t.get('representative_id')
            themes.append({'label': t.get('label', 'Other'), 'ids': ids, 'rep': rep if rep in ids else ids[0]})

    unassigned = [i for i in range(len(sample)) if i not in seen]
    if unassigned:
        themes.append({'label': 'Other', 'ids': unassigned, 'rep': unassigned[0]})

    if not themes:
        return []

    result = []
    for t in sorted(themes, key=lambda t: len(t['ids']), reverse=True):
        ids = t['ids']
        # Representative quote is always a verbatim response from inside the theme
        quote_id = t['rep']
        result.append({
            'id': len(result),
            'label': t['label'],
            'count': len(ids),
            'percentage': round(len(ids) / len(sample) * 100, 1),
            'representative_quote': sample[quote_id],
            'response_ids': ids
        })
    _THEME_CACHE[cache_key] = result
    return result


# ─────────────────────────────────────────────
# Vector search (Pinecone)
# ─────────────────────────────────────────────
def build_index(texts: list[str]):
    """
    Embed texts with Gemini and upsert them into an ephemeral Pinecone namespace.
    """
    embeddings = embed_texts(texts)

    pinecone_key = os.getenv("PINECONE_API_KEY")
    if not pinecone_key:
        raise ValueError("PINECONE_API_KEY is required for semantic search")

    pc = Pinecone(api_key=pinecone_key)

    if PINECONE_INDEX not in pc.list_indexes().names():
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud='aws', region='us-east-1')
        )

    pinecone_index = pc.Index(PINECONE_INDEX)
    namespace = f"session_{uuid.uuid4().hex[:8]}"

    vectors = [
        {"id": str(i), "values": emb, "metadata": {"text": txt}}
        for i, (emb, txt) in enumerate(zip(embeddings, texts))
    ]
    for start in range(0, len(vectors), 100):
        pinecone_index.upsert(vectors=vectors[start:start + 100], namespace=namespace)

    return {"type": "pinecone", "index": pinecone_index, "namespace": namespace}, embeddings, texts


def search_similar(query: str, index_info, texts: list[str], top_k: int = 5) -> list[dict]:
    """Find top-k most semantically similar responses using Pinecone."""
    query_embedding = embed_texts([query], task_type="retrieval_query")[0]

    k = min(top_k, len(texts))
    pc_index = index_info["index"]
    ns = index_info["namespace"]

    try:
        res = pc_index.query(
            vector=query_embedding,
            top_k=k,
            namespace=ns,
            include_metadata=True
        )
        return [
            {
                'id': int(match["id"]),
                'text': match["metadata"]["text"],
                'score': round(float(match["score"]), 4)
            }
            for match in res.get("matches", [])
        ]
    except Exception as e:
        print(f"Pinecone search failed: {e}")
        return []
    finally:
        # Cleanup ephemeral namespace
        try:
            pc_index.delete(delete_all=True, namespace=ns)
        except Exception:
            pass
