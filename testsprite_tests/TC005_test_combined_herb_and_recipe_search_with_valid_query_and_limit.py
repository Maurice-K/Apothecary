import requests
import sys
from typing import Any

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = 30  # seconds

def test_combined_herb_and_recipe_search_with_valid_query_and_limit():
    url = f"{BASE_URL}/recipes-search"
    payload = {
        "query": "help me sleep",
        "limit": 5
    }

    try:
        resp = requests.post(url, json=payload, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Validate status code
    if resp.status_code != 200:
        raise AssertionError(f"Expected status 200 but got {resp.status_code}. Response body: {resp.text}")

    try:
        data = resp.json()
    except ValueError:
        raise AssertionError(f"Response was not valid JSON. Raw response: {resp.text}")

    # Validate top-level keys
    assert isinstance(data, dict), f"Expected JSON object, got {type(data).__name__}"
    assert "herbs" in data, "Response JSON missing 'herbs' key"
    assert "recipes" in data, "Response JSON missing 'recipes' key"

    herbs = data["herbs"]
    recipes = data["recipes"]

    # Both should be arrays
    assert isinstance(herbs, list), f"'herbs' should be a list, got {type(herbs).__name__}"
    assert isinstance(recipes, list), f"'recipes' should be a list, got {type(recipes).__name__}"

    # For a valid query we expect herb results to be present (non-empty)
    assert len(herbs) > 0, "Expected at least one herb in 'herbs' array for a valid query"

    # herbs count should not exceed the provided limit
    assert len(herbs) <= payload["limit"], f"Number of herbs ({len(herbs)}) exceeds limit ({payload['limit']})"

    # Validate each herb entry schema minimally and similarity constraints
    prev_similarity = None
    for idx, herb in enumerate(herbs):
        assert isinstance(herb, dict), f"Herb at index {idx} is not an object"
        # Required fields assertions (based on PRD)
        assert "id" in herb, f"Herb at index {idx} missing 'id'"
        assert "name" in herb, f"Herb at index {idx} missing 'name'"
        assert "similarity" in herb, f"Herb at index {idx} missing 'similarity'"

        # Types
        assert isinstance(herb["id"], int), f"Herb.id at index {idx} should be int"
        assert isinstance(herb["name"], str), f"Herb.name at index {idx} should be str"
        sim = herb["similarity"]
        assert isinstance(sim, (int, float)), f"Herb.similarity at index {idx} should be a number"
        # Similarity threshold per PRD for herb matches
        assert sim >= 0.3, f"Herb.similarity at index {idx} is below threshold 0.3: {sim}"

        # Ensure results are sorted by similarity descending
        if prev_similarity is not None:
            assert sim <= prev_similarity + 1e-9, (
                f"Herbs not sorted by similarity descending at index {idx}: prev={prev_similarity}, curr={sim}"
            )
        prev_similarity = sim

    # recipes may be empty but must be an array; validate entries if present
    for idx, recipe in enumerate(recipes):
        assert isinstance(recipe, dict), f"Recipe at index {idx} is not an object"
        assert "id" in recipe or "name" in recipe, f"Recipe at index {idx} has neither 'id' nor 'name'"

    print("TC005 passed: /recipes-search returned valid herbs and recipes arrays as expected.")

if __name__ == "__main__":
    try:
        test_combined_herb_and_recipe_search_with_valid_query_and_limit()
    except AssertionError as e:
        print(f"TC005 FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC005 ERROR: Unexpected exception: {e}")
        sys.exit(2)
    sys.exit(0)