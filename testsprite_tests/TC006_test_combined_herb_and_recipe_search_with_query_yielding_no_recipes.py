import requests
import sys

BASE_ENDPOINT = "http://localhost:54321/functions/v1"
TIMEOUT = 30  # seconds

def test_combined_herb_and_recipe_search_with_query_yielding_no_recipes():
    url = f"{BASE_ENDPOINT}/recipes-search"
    headers = {"Content-Type": "application/json"}
    payload = {
        "query": "help me sleep",  # query that should match herbs like Valerian Root but likely yield no community recipes
        "limit": 8
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    # Expect a 200 response per PRD when query is valid, even if recipes are empty
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Response text: {resp.text}"

    try:
        data = resp.json()
    except ValueError:
        assert False, f"Response is not valid JSON. Response text: {resp.text}"

    # Response must contain both 'herbs' and 'recipes' keys as arrays
    assert "herbs" in data, f"'herbs' key missing in response JSON: {data}"
    assert "recipes" in data, f"'recipes' key missing in response JSON: {data}"
    herbs = data["herbs"]
    recipes = data["recipes"]
    assert isinstance(herbs, list), f"'herbs' is not a list: {type(herbs)}"
    assert isinstance(recipes, list), f"'recipes' is not a list: {type(recipes)}"

    # For this test, recipes should be an empty array
    assert len(recipes) == 0, f"Expected recipes array to be empty for this query, but got {len(recipes)} recipes: {recipes}"

    # Herbs array should be non-empty when herb matches exist
    assert len(herbs) > 0, f"Expected non-empty herbs array for this query, but got empty list."

    # Validate at least one herb has expected fields and a similarity >= 0.3 per spec
    found_valid_herb = False
    for herb in herbs:
        if not isinstance(herb, dict):
            continue
        has_id = "id" in herb and isinstance(herb["id"], (int, float))
        has_name = "name" in herb and isinstance(herb["name"], str)
        has_similarity = "similarity" in herb and isinstance(herb["similarity"], (int, float))
        if has_id and has_name and has_similarity and herb["similarity"] >= 0.3:
            found_valid_herb = True
            break

    assert found_valid_herb, f"No herb with required fields and similarity >= 0.3 found in herbs: {herbs}"

    # If we reach here, the test passes
    print("TEST PASSED: /recipes-search returned 200, empty recipes array, and non-empty herbs array with valid herb matches.")

if __name__ == "__main__":
    test_combined_herb_and_recipe_search_with_query_yielding_no_recipes()