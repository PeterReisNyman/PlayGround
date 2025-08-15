# pip install openai
import math
import os
from typing import List, Optional

def levenshtein_distance(a: str, b: str) -> int:
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    matrix = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        matrix[i][0] = i
    for j in range(n + 1):
        matrix[0][j] = j
    for i in range(1, m + 1):
        ai = a[i - 1]
        for j in range(1, n + 1):
            cost = 0 if ai == b[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,       # deletion
                matrix[i][j - 1] + 1,       # insertion
                matrix[i - 1][j - 1] + cost # substitution
            )
    return matrix[m][n]

def levenshtein_similarity(a: str, b: str) -> float:
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    dist = levenshtein_distance(a, b)
    return 1.0 - dist / max_len

def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    denom = mag_a * mag_b
    return 0.0 if denom == 0 else dot / denom


def get_openai_client():
    from openai import OpenAI
    _openai_client = OpenAI(api_key="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")
    return _openai_client

def embedding_cosine_similarity(a: str, b: str) -> Optional[float]:
    """
    Returns cosine similarity of OpenAI embeddings for two strings.
    If no API key or an error occurs, returns None.
    """
    client = get_openai_client()
    if client is None:
        return None
    try:
        ea = client.embeddings.create(model="text-embedding-3-small", input=a)
        eb = client.embeddings.create(model="text-embedding-3-small", input=b)
        va = ea.data[0].embedding
        vb = eb.data[0].embedding
        return cosine_similarity(va, vb)
    except Exception as e:
        print("[similarity] embedding error:", e)
        return None

if __name__ == "__main__":
    # Change these to whatever you want to compare
    s1 = "apé"
    s2 = "apartamento"

    lev_sim = levenshtein_similarity(s1, s2)
    emb_sim = embedding_cosine_similarity(s1, s2)

    print(f"Levenshtein similarity({s1!r}, {s2!r}) = {lev_sim:.6f}")
    if emb_sim is None:
        print("Embedding cosine similarity unavailable (no OPENAI_API_KEY or error).")
    else:
        print(f"Embedding cosine similarity({s1!r}, {s2!r}) = {emb_sim:.6f}")
        print(f"Difference (embedding - Levenshtein) = {emb_sim - lev_sim:.6f}")
