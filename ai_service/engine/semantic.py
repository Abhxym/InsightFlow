"""
Semantic Analysis Engine
Uses Google Gemini for embeddings and clustering, and Pinecone for vector search.
Cloud-native, no C++ compilation required.
"""

import os
import json
import uuid
import google.generativeai as genai
from pinecone import Pinecone, ServerlessSpec

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using Google Gemini."""
    if not texts:
        return []
    
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    result = genai.embed_content(
        model="models/embedding-001",
        content=texts,
        task_type="retrieval_document"
    )
    return result['embedding']


def discover_themes(texts: list[str], n_clusters: int = None) -> list[dict]:
    """
    Cluster texts into semantic themes using Gemini directly.
    Bypasses the need for scikit-learn KMeans.
    """
    if not texts or len(texts) < 2:
        return []

    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Cap at 100 for token limits, Gemini can extrapolate
    sample_texts = texts[:100]
    
    prompt = f"""
Analyze the following customer survey responses and group them into 3 to 5 distinct semantic themes.
Return the result strictly as a valid JSON array of objects, with no markdown formatting.
Each object must have these exact keys:
"label": a short 2-3 word name for the theme
"percentage": estimated integer percentage of responses this theme represents (totaling 100)
"representative_quote": one actual exact quote from the data that best represents this theme

Data:
{json.dumps(sample_texts)}
"""
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
            
        themes = json.loads(text.strip())
        
        # Format for frontend compatibility
        for i, t in enumerate(themes):
            t['id'] = i
            t['count'] = max(1, int((t['percentage'] / 100.0) * len(texts)))
        
        return themes
    except Exception as e:
        print(f"Gemini clustering failed: {e}")
        return []


def build_index(texts: list[str]):
    """
    Build vector index from texts using Pinecone.
    """
    embeddings = embed_texts(texts)
    
    pinecone_key = os.getenv("PINECONE_API_KEY")
    if not pinecone_key:
        raise ValueError("PINECONE_API_KEY is required for semantic search")
        
    pc = Pinecone(api_key=pinecone_key)
    index_name = "insightflow-rag"
    
    if index_name not in pc.list_indexes().names():
        pc.create_index(
            name=index_name,
            dimension=len(embeddings[0]), # Gemini embeddings are 768 dimensions
            metric="cosine",
            spec=ServerlessSpec(cloud='aws', region='us-east-1')
        )
    
    pinecone_index = pc.Index(index_name)
    namespace = f"session_{uuid.uuid4().hex[:8]}"
    
    vectors = [
        {"id": str(i), "values": emb, "metadata": {"text": txt}}
        for i, (emb, txt) in enumerate(zip(embeddings, texts))
    ]
    pinecone_index.upsert(vectors=vectors, namespace=namespace)
    
    return {"type": "pinecone", "index": pinecone_index, "namespace": namespace}, embeddings, texts


def search_similar(query: str, index_info, texts: list[str], top_k: int = 5) -> list[dict]:
    """Find top-k most semantically similar responses using Pinecone."""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    query_result = genai.embed_content(
        model="models/embedding-001",
        content=query,
        task_type="retrieval_query"
    )
    query_embedding = query_result['embedding']
    
    k = min(top_k, len(texts))
    results = []
    
    pc_index = index_info["index"]
    ns = index_info["namespace"]
    
    try:
        res = pc_index.query(
            vector=query_embedding,
            top_k=k,
            namespace=ns,
            include_metadata=True
        )
        for match in res.get("matches", []):
            results.append({
                'text': match["metadata"]["text"],
                'score': round(float(match["score"]), 4)
            })
        # Cleanup ephemeral namespace
        pc_index.delete(delete_all=True, namespace=ns)
        return results
    except Exception as e:
        print(f"Pinecone search failed: {e}")
        return []
