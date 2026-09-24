import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = 30  # seconds

def test_semantic_herb_search_with_valid_query_and_limit():
    url = f"{BASE_URL}/search"
    payload = {
        "query": "help me sleep",
        "limit": 5
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"HTTP request to {url} failed: {e}")

    # Basic status check
    if resp.status_code != 200:
        # try to include the body for debugging if it's JSON or text
        body = None
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        raise AssertionError(f"Expected status 200, got {resp.status_code}. Response body: {body}")

    # Content-Type should be JSON
    ct = resp.headers.get("Content-Type", "")
    assert "application/json" in ct or "json" in ct, f"Expected JSON response, got Content-Type: {ct}"

    try:
        data = resp.json()
    except Exception as e:
        raise AssertionError(f"Response body is not valid JSON: {e}")

    # Response shape validation
    assert isinstance(data, dict), f"Response JSON must be an object, got {type(data)}"
    assert "results" in data, f"Response JSON missing 'results' key. Body: {data}"
    results = data["results"]
    assert isinstance(results, list), f"'results' must be a list, got {type(results)}"

    # Validate count does not exceed limit
    limit = payload["limit"]
    assert len(results) <= limit, f"Number of results {len(results)} exceeds requested limit {limit}"

    # Validate each result has required fields and similarity constraints
    similarities = []
    for idx, item in enumerate(results):
        assert isinstance(item, dict), f"Each result must be an object, item {idx} is {type(item)}"
        # Required fields per PRD: id, name, description, how_to_use, category, tags, energetics, botanical_name, plant_part, origin, form, similarity
        required_fields = ["id", "name", "description", "similarity"]
        for field in required_fields:
            assert field in item, f"Result item missing required field '{field}': {item}"
        # Type checks
        assert isinstance(item["id"], int), f"Result.id must be int, got {type(item['id'])} in item {item}"
        assert isinstance(item["name"], str), f"Result.name must be str, got {type(item['name'])} in item {item}"
        assert isinstance(item["description"], str), f"Result.description must be str, got {type(item['description'])} in item {item}"
        # Similarity numeric and above threshold
        try:
            sim = float(item["similarity"])
        except Exception:
            raise AssertionError(f"Result.similarity must be a number, got {item['similarity']} in item {item}")
        assert sim >= 0.3, f"Result similarity {sim} is below threshold 0.3 in item {item}"
        similarities.append(sim)

    # Validate sorted by similarity descending (non-increasing)
    for i in range(len(similarities) - 1):
        if similarities[i] + 1e-9 < similarities[i + 1]:
            raise AssertionError(f"Results not sorted by similarity descending: {similarities}")

    # If we reach here, test passed
    print("test_semantic_herb_search_with_valid_query_and_limit: PASSED")

if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_valid_query_and_limit()
    except AssertionError as e:
        print(f"test_semantic_herb_search_with_valid_query_and_limit: FAILED -> {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_semantic_herb_search_with_valid_query_and_limit: ERROR -> {e}")
        sys.exit(2)
    sys.exit(0)