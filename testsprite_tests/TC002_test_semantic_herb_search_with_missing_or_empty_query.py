import requests
import json

BASE_URL = "http://localhost:54321/functions/v1"

def test_semantic_herb_search_with_missing_or_empty_query():
    url = f"{BASE_URL}/search"
    headers = {"Content-Type": "application/json"}

    # Case 1: missing query (empty JSON body)
    try:
        resp = requests.post(url, headers=headers, json={}, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed for missing query case: {e}"
    assert resp.status_code == 400, f"Expected 400 for missing query, got {resp.status_code}. Body: {resp.text}"
    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response for missing query is not valid JSON: {resp.text}"
    assert "error" in body, f"Expected 'error' key in response for missing query, got: {body}"
    assert body.get("error") == "query is required and must be a string", f"Unexpected error message for missing query: {body.get('error')}"

    # Case 2: empty string query
    try:
        resp2 = requests.post(url, headers=headers, json={"query": ""}, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed for empty query case: {e}"
    assert resp2.status_code == 400, f"Expected 400 for empty query, got {resp2.status_code}. Body: {resp2.text}"
    try:
        body2 = resp2.json()
    except ValueError:
        assert False, f"Response for empty query is not valid JSON: {resp2.text}"
    assert "error" in body2, f"Expected 'error' key in response for empty query, got: {body2}"
    assert body2.get("error") == "query is required and must be a string", f"Unexpected error message for empty query: {body2.get('error')}"

if __name__ == "__main__":
    test_semantic_herb_search_with_missing_or_empty_query()