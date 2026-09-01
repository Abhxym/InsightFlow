"""
Semantic Analysis Engine
Uses Sentence Transformers for embeddings + FAISS for vector search + KMeans for clustering.
Runs fully locally — no API key needed.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize
from collections import defaultdict
import re

# Load model once at module level (cached after first load)
_model = None

def get_model():
    global _model
    if _model is None:
        # Lightweight 80MB model — fast and accurate
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    """Generate normalized embeddings for a list of texts."""
    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return normalize(embeddings)  # L2 normalize for cosine similarity via dot product


def discover_themes(texts: list[str], n_clusters: int = None) -> list[dict]:
    """
    Cluster texts into semantic themes automatically using KMeans.
    Returns a list of theme objects with representative quotes and labels.
    """
    if not texts or len(texts) < 2:
        return []

    embeddings = embed_texts(texts)

    # Auto-determine cluster count: sqrt heuristic, min 2, max 8
    if n_clusters is None:
        n_clusters = min(max(2, int(len(texts) ** 0.5)), 8)

    n_clusters = min(n_clusters, len(texts))

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
    labels = kmeans.fit_predict(embeddings)

    # Build FAISS index for finding representative quotes
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings.astype(np.float32))

    themes = []
    for cluster_id in range(n_clusters):
        cluster_indices = [i for i, l in enumerate(labels) if l == cluster_id]
        if not cluster_indices:
            continue

        cluster_texts = [texts[i] for i in cluster_indices]
        cluster_embeddings = embeddings[cluster_indices]

        # Find centroid and closest text as representative quote
        centroid = cluster_embeddings.mean(axis=0, keepdims=True).astype(np.float32)
        centroid = centroid / np.linalg.norm(centroid)

        cluster_index = faiss.IndexFlatIP(embeddings.shape[1])
        cluster_index.add(cluster_embeddings.astype(np.float32))
        _, closest_idx = cluster_index.search(centroid, 1)
        representative_quote = cluster_texts[closest_idx[0][0]]

        # Auto-label theme from top keywords
        all_words = ' '.join(cluster_texts).lower()
        words = re.findall(r'\b[a-z]{4,}\b', all_words)
        stop_words = {'this', 'that', 'with', 'have', 'from', 'they', 'will', 'been',
                      'were', 'your', 'their', 'what', 'when', 'which', 'about', 'could', 'would', 'very'}
        word_freq = defaultdict(int)
        for w in words:
            if w not in stop_words:
                word_freq[w] += 1

        top_words = sorted(word_freq, key=word_freq.get, reverse=True)[:3]
        label = ' + '.join(top_words).title() if top_words else f'Theme {cluster_id + 1}'

        themes.append({
            'id': cluster_id,
            'label': label,
            'count': len(cluster_indices),
            'percentage': round(len(cluster_indices) / len(texts) * 100, 1),
            'representative_quote': representative_quote,
            'sample_quotes': cluster_texts[:3],
        })

    # Sort by size descending
    themes.sort(key=lambda x: x['count'], reverse=True)
    return themes


def build_index(texts: list[str]):
    """Build FAISS index from texts. Returns (index, embeddings, texts)."""
    embeddings = embed_texts(texts)
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings.astype(np.float32))
    return index, embeddings, texts


def search_similar(query: str, index, texts: list[str], top_k: int = 5) -> list[dict]:
    """Find top-k most semantically similar responses to a query string."""
    model = get_model()
    query_embedding = model.encode([query], convert_to_numpy=True)
    query_embedding = normalize(query_embedding).astype(np.float32)

    k = min(top_k, len(texts))
    scores, indices = index.search(query_embedding, k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx >= 0:
            results.append({
                'text': texts[idx],
                'score': round(float(score), 4)
            })
    return results
