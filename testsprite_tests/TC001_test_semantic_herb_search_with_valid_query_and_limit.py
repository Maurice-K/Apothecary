import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = 30

def test_semantic_herb_search_with_valid_query_and_limit():
    url = f"{BASE_URL}/search"
    headers = {"Content-Type": "application/json"}
    payload = {
        "query": "help me sleep",
        "limit": 5
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert resp is not None, "No response received from the server"
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response body is not valid JSON: {resp.text}"

    assert isinstance(body, dict), "Response JSON must be an object"
    assert "results" in body, "Response JSON must contain 'results' key"
    results = body["results"]
    assert isinstance(results, list), "'results' must be a list"

    limit = payload["limit"]
    assert len(results) <= limit, f"Number of results ({len(results)}) exceeds the requested limit ({limit})"
    assert len(results) > 0, "Expected at least one herb result for a relevant query"

    # Validate each result and collect similarities
    similarities = []
    required_keys = {"id", "name", "description", "how_to_use", "category", "tags", "energetics",
                     "botanical_name", "plant_part", "origin", "form", "similarity"}
    for i, r in enumerate(results):
        assert isinstance(r, dict), f"Result at index {i} is not an object"
        # ensure required keys exist (some fields may be empty but keys should be present per schema)
        for key in required_keys:
            assert key in r, f"Result at index {i} missing required key '{key}'"
        sim = r["similarity"]
        assert isinstance(sim, (int, float)), f"Similarity at index {i} must be a number"
        assert sim >= 0.3, f"Similarity at index {i} is below threshold: {sim}"
        similarities.append(float(sim))

    # Ensure descending order (ranked by similarity descending)
    for i in range(len(similarities) - 1):
        assert similarities[i] >= similarities[i+1], (
            f"Results not sorted by similarity descending at index {i}: "
            f"{similarities[i]} < {similarities[i+1]}"
        )

    print("TC001 passed: semantic herb search returned ranked results within constraints.")

if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_valid_query_and_limit()
    except AssertionError as e:
        print(f"TC001 failed: {e}")
        sys.exit(1)
    sys.exit(0)