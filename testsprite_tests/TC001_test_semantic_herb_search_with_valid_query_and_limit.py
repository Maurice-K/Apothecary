import requests
import sys
import traceback

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_PATH = "/search"
TIMEOUT = 30  # seconds

def test_semantic_herb_search_with_valid_query_and_limit():
    url = BASE_URL + SEARCH_PATH
    headers = {
        "Content-Type": "application/json"
    }
    # Valid non-empty query and numeric limit between 1 and 50
    payload = {
        "query": "help me sleep",
        "limit": 5
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        traceback.print_exc()
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Expect 200
    if resp.status_code != 200:
        # Try to include JSON error body if present
        body = None
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        raise AssertionError(f"Expected status 200 but got {resp.status_code}. Response body: {body}")

    # Parse JSON
    try:
        data = resp.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    # Validate top-level structure
    assert isinstance(data, dict), "Response JSON must be an object"
    assert "results" in data, "Response JSON must contain 'results' key"
    results = data["results"]
    assert isinstance(results, list), "'results' must be a list"

    # Validate number of results does not exceed the limit
    limit = payload["limit"]
    assert isinstance(limit, int) and 1 <= limit <= 50, "Test limit must be an int between 1 and 50"
    assert len(results) <= limit, f"Number of results {len(results)} exceeds requested limit {limit}"

    # Validate each result and collect similarities
    similarities = []
    required_fields = {
        "id": int,
        "name": str,
        "description": str,
        "how_to_use": str,
        "category": list,
        "tags": list,
        "energetics": list,
        "botanical_name": str,
        "plant_part": str,
        "origin": str,
        "form": str,
        "similarity": (int, float)
    }

    assert len(results) > 0, "Expected at least one result for a typical query"

    for idx, r in enumerate(results):
        assert isinstance(r, dict), f"Result at index {idx} must be an object"
        for field, expected_type in required_fields.items():
            assert field in r, f"Result at index {idx} missing required field '{field}'"
            val = r[field]
            # type check for union types, e.g., similarity can be int or float
            if isinstance(expected_type, tuple):
                assert isinstance(val, expected_type), f"Field '{field}' in result at index {idx} must be one of types {expected_type}, got {type(val)}"
            else:
                assert isinstance(val, expected_type), f"Field '{field}' in result at index {idx} must be {expected_type}, got {type(val)}"
        sim = r["similarity"]
        # Cast to float for comparisons
        try:
            sim_val = float(sim)
        except Exception:
            raise AssertionError(f"Similarity value for result at index {idx} is not numeric: {sim}")
        similarities.append(sim_val)
        assert sim_val >= 0.3, f"Similarity for result at index {idx} is below threshold: {sim_val} < 0.3"

    # Validate sorted by similarity descending
    for i in range(len(similarities) - 1):
        if similarities[i] < similarities[i + 1]:
            raise AssertionError(f"Results not sorted by similarity descending at indices {i} and {i+1}: {similarities[i]} < {similarities[i+1]}")

    print("test_semantic_herb_search_with_valid_query_and_limit: PASSED")

if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_valid_query_and_limit()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as e:
        print("UNEXPECTED ERROR:", e)
        traceback.print_exc()
        sys.exit(2)
    sys.exit(0)