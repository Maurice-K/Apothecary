import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_PATH = "/search"
TIMEOUT = 30


def test_semantic_herb_search_with_valid_query_and_limit():
    url = BASE_URL + SEARCH_PATH
    headers = {"Content-Type": "application/json"}
    payload = {"query": "help me sleep", "limit": 5}

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response is not valid JSON: {resp.text}"

    assert isinstance(body, dict), "Response JSON must be an object"
    assert "results" in body, "Response JSON must contain 'results' key"
    results = body["results"]
    assert isinstance(results, list), "'results' must be a list"

    limit = payload["limit"]
    assert len(results) <= limit, f"Number of results {len(results)} exceeds requested limit {limit}"

    # Validate each result similarity and types, and gather relevance presence
    all_have_numeric_relevance = True
    none_have_relevance = True
    for idx, r in enumerate(results):
        assert isinstance(r, dict), f"Each result must be an object, item {idx} is {type(r)}"
        assert "similarity" in r, f"Result {idx} missing 'similarity'"
        sim = r["similarity"]
        assert isinstance(sim, (int, float)), f"'similarity' must be numeric for result {idx}"
        assert sim >= 0.3, f"Result {idx} has similarity {sim} < 0.3"

        rel = r.get("relevance", None)
        if rel is None:
            all_have_numeric_relevance = False
        else:
            none_have_relevance = False
            if not isinstance(rel, (int, float)):
                all_have_numeric_relevance = False
            else:
                # check relevance is within 0-1
                assert 0.0 <= rel <= 1.0, f"Result {idx} has relevance {rel} outside 0-1"

    # Ordering assertions based on presence of relevance
    if len(results) >= 2:
        if all_have_numeric_relevance and not none_have_relevance:
            # Assert sorted by relevance descending
            for i in range(len(results) - 1):
                r_curr = results[i]["relevance"]
                r_next = results[i + 1]["relevance"]
                assert r_curr >= r_next, (
                    f"Results are not sorted by relevance descending at index {i}: "
                    f"{r_curr} < {r_next}"
                )
        elif none_have_relevance:
            # Assert sorted by similarity descending
            for i in range(len(results) - 1):
                s_curr = results[i]["similarity"]
                s_next = results[i + 1]["similarity"]
                assert s_curr >= s_next, (
                    f"Results are not sorted by similarity descending at index {i}: "
                    f"{s_curr} < {s_next}"
                )
        else:
            # Mixed presence: do not assert global ordering as per instructions
            pass

    print("TC001 passed: test_semantic_herb_search_with_valid_query_and_limit")


if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_valid_query_and_limit()
    except AssertionError as e:
        print(f"Test failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)