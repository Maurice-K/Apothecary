import requests

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_semantic_herb_search_with_missing_or_empty_query():
    url = f"{BASE_ENDPOINT}/search"
    headers = {"Content-Type": "application/json"}

    # Case A: missing query (empty JSON body)
    try:
        resp = requests.post(url, headers=headers, json={}, timeout=30)
    except requests.exceptions.RequestException as e:
        assert False, f"HTTP request failed for missing query case: {e}"

    assert resp.status_code == 400, f"Expected 400 for missing query, got {resp.status_code}, body: {resp.text}"
    try:
        payload = resp.json()
    except ValueError:
        assert False, f"Response for missing query is not valid JSON: {resp.text}"
    assert "error" in payload, f"Expected 'error' key in response for missing query, got: {payload}"
    assert payload["error"] == "query is required and must be a string", f"Unexpected error message for missing query: {payload['error']}"

    # Case B: empty query string
    try:
        resp2 = requests.post(url, headers=headers, json={"query": ""}, timeout=30)
    except requests.exceptions.RequestException as e:
        assert False, f"HTTP request failed for empty query case: {e}"

    assert resp2.status_code == 400, f"Expected 400 for empty query, got {resp2.status_code}, body: {resp2.text}"
    try:
        payload2 = resp2.json()
    except ValueError:
        assert False, f"Response for empty query is not valid JSON: {resp2.text}"
    assert "error" in payload2, f"Expected 'error' key in response for empty query, got: {payload2}"
    assert payload2["error"] == "query is required and must be a string", f"Unexpected error message for empty query: {payload2['error']}"

if __name__ == "__main__":
    test_semantic_herb_search_with_missing_or_empty_query()
    print("test_semantic_herb_search_with_missing_or_empty_query: PASSED")