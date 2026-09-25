import requests
import json
import sys
from requests.exceptions import RequestException

BASE_URL = "http://localhost:54321/functions/v1"
ENDPOINT = "/recipes-search"
TIMEOUT = 30  # seconds

def test_combined_herb_and_recipe_search_with_query_yielding_no_recipes():
    url = BASE_URL.rstrip("/") + ENDPOINT
    headers = {"Content-Type": "application/json"}
    payload = {
        "query": "help me sleep",  # query expected to match herbs (e.g., Valerian Root) but yield no community recipes
        "limit": 8
    }

    try:
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=TIMEOUT)
    except RequestException as e:
        print(f"Request to {url} failed: {e}", file=sys.stderr)
        raise

    # Assert HTTP 200
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Response body: {resp.text}"

    # Parse JSON
    try:
        data = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response is not valid JSON: {e}. Raw response: {resp.text}")

    # Validate presence and types of keys
    assert isinstance(data, dict), f"Response JSON is not an object: {data}"
    assert "herbs" in data, f"'herbs' key missing in response JSON: {data}"
    assert "recipes" in data, f"'recipes' key missing in response JSON: {data}"
    assert isinstance(data["herbs"], list), f"'herbs' is not a list: {type(data['herbs'])}"
    assert isinstance(data["recipes"], list), f"'recipes' is not a list: {type(data['recipes'])}"

    # recipes should be empty for this query
    assert len(data["recipes"]) == 0, f"Expected recipes array to be empty for query '{payload['query']}', got {len(data['recipes'])} items."

    # herbs should be non-empty if herb matches exist
    assert len(data["herbs"]) > 0, f"Expected non-empty herbs array for query '{payload['query']}', but it was empty."

    # Optionally validate herb object shape minimally
    herb = data["herbs"][0]
    assert isinstance(herb, dict), f"Herb entry is not an object: {herb}"
    assert "id" in herb and ("name" in herb or "description" in herb), f"Herb entry missing expected fields: {herb}"

    print("TC006 passed: /recipes-search returned 200 with empty recipes array and non-empty herbs array.")

if __name__ == "__main__":
    test_combined_herb_and_recipe_search_with_query_yielding_no_recipes()