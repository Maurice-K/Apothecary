import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"

def test_combined_herb_and_recipe_search_with_valid_query_and_limit():
    url = f"{BASE_URL}/recipes-search"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "query": "help me sleep",
        "limit": 5
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"HTTP request to {url} failed: {e}"

    assert resp is not None, "No response received"
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Body: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response is not valid JSON: {resp.text}"

    assert isinstance(body, dict), "Response JSON must be an object"

    assert 'herbs' in body, "'herbs' key missing in response"
    assert 'recipes' in body, "'recipes' key missing in response"

    assert isinstance(body['herbs'], list), "'herbs' must be an array"
    assert isinstance(body['recipes'], list), "'recipes' must be an array"

    # Per PRD, herbs array should be present and for a query like "help me sleep" we expect at least one herb match
    assert len(body['herbs']) >= 1, "Expected at least one herb in 'herbs' array for query 'help me sleep'"

    # Validate structure of first herb
    first_herb = body['herbs'][0]
    assert isinstance(first_herb, dict), "Herb entries must be objects"
    for required_key in ('id', 'name', 'similarity'):
        assert required_key in first_herb, f"Herb object missing required key: {required_key}"
    assert isinstance(first_herb['name'], str) and first_herb['name'].strip() != "", "Herb name must be a non-empty string"
    assert isinstance(first_herb['similarity'], (int, float)), "Herb similarity must be numeric"
    # Similarity threshold expected by herb search semantics
    assert first_herb['similarity'] >= 0.3, f"Herb similarity expected >= 0.3, got {first_herb['similarity']}"

    # Recipes may legitimately be empty; if not empty, validate basic structure
    if len(body['recipes']) > 0:
        first_recipe = body['recipes'][0]
        assert isinstance(first_recipe, dict), "Recipe entries must be objects"
        for rk in ('id', 'name'):
            assert rk in first_recipe, f"Recipe object missing required key: {rk}"

    print("test_combined_herb_and_recipe_search_with_valid_query_and_limit: PASSED")

if __name__ == "__main__":
    try:
        test_combined_herb_and_recipe_search_with_valid_query_and_limit()
    except AssertionError as e:
        print(f"Assertion failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Unexpected error: {exc}", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)