"""
Semantic Analysis Engine
Uses Google Gemini for embeddings, theme clustering and sentiment scoring,
and Pinecone for vector search.
Cloud-native, no C++ compilation required.
"""

import os
import re
import json
import hashlib
from pinecone import Pinecone, ServerlessSpec

from engine import gemini
from engine.gemini import parse_json as _parse_json, EMBED_DIM

PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME", "insightflow-rag")
# Answers sent to Gemini per theme-assignment call (keeps prompts well inside the context window)
THEME_BATCH = int(os.getenv("THEME_BATCH_SIZE", "300"))

# Kept for callers that only need to know whether Gemini is configured
configure_gemini = gemini.configure

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
        for text, emb in zip(missing, gemini.embed(missing, task_type)):
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


def score_sentiments(texts: list[str]) -> list[dict]:
    """
    Score sentiment of several open-ended answers on a -1..1 scale in ONE Gemini call
    (handles negation, sarcasm, mixed feedback). Falls back to the lexicon per answer.
    """
    if not texts:
        return []
    if gemini.configure():
        try:
            numbered = '\n'.join(f'{i}: {json.dumps(t)}' for i, t in enumerate(texts))
            prompt = f"""Rate the sentiment of each customer survey response.
Return JSON only: {{"scores": [<one float per response, in order, from -1.0 (very negative) to 1.0 (very positive)>]}}

Responses (id: text):
{numbered}"""
            scores = _parse_json(gemini.generate(prompt, json_mode=True, max_wait=20))['scores']
            if len(scores) == len(texts):
                return [
                    {'sentiment': _label(s), 'sentiment_score': round(s, 2), 'sentiment_source': 'gemini'}
                    for s in (max(-1.0, min(1.0, float(x))) for x in scores)
                ]
            print("Gemini sentiment returned the wrong number of scores, falling back to lexicon.")
        except Exception as e:
            print(f"Gemini sentiment failed: {str(e)[:200]}, falling back to lexicon.")
    return [_lexicon_sentiment(t) for t in texts]


def score_sentiment(text: str) -> dict:
    return score_sentiments([text])[0]


# ─────────────────────────────────────────────
# Theme discovery
# ─────────────────────────────────────────────
def _discover_initial(sample: list[str]) -> list[dict]:
    """Ask Gemini to name 3-5 themes for a batch and assign every answer in it."""
    numbered = '\n'.join(f'{i}: {json.dumps(t)}' for i, t in enumerate(sample))
    prompt = f"""Group the following customer survey responses into 3 to 5 distinct themes.
Return JSON only, in this exact shape:
{{"themes": [{{"label": "<2-3 word theme name>", "response_ids": [<ids of every response in this theme>], "representative_id": <id of the single most typical response in this theme>}}]}}
Every response id must appear in exactly one theme.

Responses (id: text):
{numbered}"""
    return _parse_json(gemini.generate(prompt, json_mode=True, max_wait=45))['themes']


def _assign_batch(batch: list[str], labels: list[str]) -> list[str | None]:
    """Assign each answer in a later batch to one of the already-discovered themes."""
    numbered = '\n'.join(f'{i}: {json.dumps(t)}' for i, t in enumerate(batch))
    prompt = f"""Assign each customer survey response to exactly one of these themes: {json.dumps(labels)}.
Use "Other" if none fits.
Return JSON only: {{"assignments": [<one theme label per response, in order>]}}

Responses (id: text):
{numbered}"""
    labels_out = _parse_json(gemini.generate(prompt, json_mode=True, max_wait=45))['assignments']
    if len(labels_out) != len(batch):
        return [None] * len(batch)
    return [l if l in labels else None for l in labels_out]


def discover_themes(texts: list[str]) -> list[dict]:
    """
    Group ALL open-ended responses into 3-5 themes.
    Gemini names the themes on the first batch and assigns every response; any further
    batches are assigned to those same themes. Counts and percentages are computed
    from those assignments (not estimated by the model) and every representative
    quote is a verbatim response.
    """
    if not texts or len(texts) < 2 or not gemini.configure():
        return []

    cache_key = tuple(texts)
    if cache_key in _THEME_CACHE:
        return _THEME_CACHE[cache_key]

    first = texts[:THEME_BATCH]
    try:
        raw_themes = _discover_initial(first)
    except Exception as e:
        print(f"Gemini clustering failed: {str(e)[:200]}")
        return []

    # theme label -> {ids, rep}; ids index into the full `texts` list
    themes: dict[str, dict] = {}
    seen = set()
    for t in raw_themes:
        ids = []
        for i in t.get('response_ids', []):
            # drop invalid ids and any answer already placed (even within this same theme)
            if isinstance(i, int) and 0 <= i < len(first) and i not in seen:
                seen.add(i)
                ids.append(i)
        label = t.get('label') or 'Other'
        if ids and label not in themes:
            rep = t.get('representative_id')
            themes[label] = {'ids': ids, 'rep': rep if rep in ids else ids[0]}
        elif ids:
            themes[label]['ids'].extend(ids)

    other: list[int] = [i for i in range(len(first)) if i not in seen]
    labels = [l for l in themes if l != 'Other']

    # Remaining answers, batch by batch, into the same themes
    for start in range(THEME_BATCH, len(texts), THEME_BATCH):
        batch = texts[start:start + THEME_BATCH]
        try:
            assigned = _assign_batch(batch, labels)
        except Exception as e:
            print(f"Theme assignment for answers {start}+ failed: {str(e)[:200]}")
            assigned = [None] * len(batch)
        for offset, label in enumerate(assigned):
            (themes[label]['ids'] if label else other).append(start + offset)

    if other:
        if 'Other' in themes:
            themes['Other']['ids'].extend(other)
        else:
            themes['Other'] = {'ids': other, 'rep': other[0]}

    result = []
    for label, t in sorted(themes.items(), key=lambda kv: len(kv[1]['ids']), reverse=True):
        ids = t['ids']
        result.append({
            'id': len(result),
            'label': label,
            'count': len(ids),
            'percentage': round(len(ids) / len(texts) * 100, 1),
            # Representative quote is always a verbatim response from inside the theme
            'representative_quote': texts[t['rep']],
            'response_ids': ids
        })
    _THEME_CACHE[cache_key] = result
    return result


# ─────────────────────────────────────────────
# Vector search (Pinecone) — one persistent namespace per survey
# ─────────────────────────────────────────────
_pinecone_index = None
# namespace -> vector ids known to be stored, so each answer is embedded and upserted once
_INDEXED: dict[str, set[str]] = {}


def _vector_id(text: str) -> str:
    # Identical answers share one vector, which also keeps cited sources distinct
    return hashlib.sha1(text.strip().lower().encode('utf-8')).hexdigest()[:24]


def _index():
    global _pinecone_index
    if _pinecone_index is None:
        key = os.getenv("PINECONE_API_KEY")
        if not key:
            raise ValueError("PINECONE_API_KEY is required for semantic search")
        pc = Pinecone(api_key=key)
        if PINECONE_INDEX not in pc.list_indexes().names():
            pc.create_index(
                name=PINECONE_INDEX,
                dimension=EMBED_DIM,
                metric="cosine",
                spec=ServerlessSpec(cloud='aws', region='us-east-1')
            )
        _pinecone_index = pc.Index(PINECONE_INDEX)
    return _pinecone_index


def namespace_for(survey_id) -> str:
    return f"survey_{survey_id}"


def sync_survey_index(survey_id, texts: list[str]) -> str:
    """
    Make sure every answer of a survey is in its Pinecone namespace.
    Only answers not stored yet are embedded and upserted, so after the first question
    a survey costs no embedding quota until new answers arrive. Returns the namespace.
    """
    ns = namespace_for(survey_id)
    index = _index()
    by_id = {}
    for t in texts:
        if t.strip():
            by_id.setdefault(_vector_id(t), t)

    known = _INDEXED.setdefault(ns, set())
    unknown = [i for i in by_id if i not in known]
    # After a restart, ask Pinecone which of them it already has
    for start in range(0, len(unknown), 100):
        chunk = unknown[start:start + 100]
        try:
            found = index.fetch(ids=chunk, namespace=ns).vectors
            known.update(found.keys())
        except Exception as e:
            print(f"Pinecone fetch failed: {str(e)[:200]}")

    missing = [i for i in by_id if i not in known]
    if missing:
        embeddings = embed_texts([by_id[i] for i in missing])
        vectors = [{"id": i, "values": e, "metadata": {"text": by_id[i]}} for i, e in zip(missing, embeddings)]
        for start in range(0, len(vectors), 100):
            index.upsert(vectors=vectors[start:start + 100], namespace=ns)
        known.update(missing)
    return ns


def search_similar(query: str, namespace: str, allowed_texts: list[str] | None = None, top_k: int = 5) -> list[dict]:
    """Top-k answers most similar in meaning to the query, from a survey's namespace."""
    query_embedding = embed_texts([query], task_type="retrieval_query")[0]
    allowed = {_vector_id(t) for t in allowed_texts} if allowed_texts is not None else None
    try:
        res = _index().query(vector=query_embedding, top_k=top_k * 2, namespace=namespace, include_metadata=True)
    except Exception as e:
        print(f"Pinecone search failed: {str(e)[:200]}")
        return []
    results = []
    for match in res.get("matches", []):
        # Skip vectors for answers that no longer exist in the survey
        if allowed is not None and match["id"] not in allowed:
            continue
        results.append({'id': match["id"], 'text': match["metadata"]["text"], 'score': round(float(match["score"]), 4)})
        if len(results) == top_k:
            break
    return results


def delete_survey_index(survey_id) -> None:
    ns = namespace_for(survey_id)
    try:
        _index().delete(delete_all=True, namespace=ns)
    except Exception as e:
        # A survey that was never asked about has no namespace yet; that's fine
        if '404' not in str(e):
            print(f"Pinecone namespace delete failed: {str(e)[:200]}")
    _INDEXED.pop(ns, None)
