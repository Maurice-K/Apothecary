import requests
import sys
from requests.exceptions import RequestException

BASE_URL = "http://localhost:54321/functions/v1"
ENDPOINT = "/recipes-search"
URL = BASE_URL + ENDPOINT
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30


def test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit():
    test_cases = [
        {
            "name": "missing_query",
            "payload": {},  # missing query
            "expected_error_substr": "query is required and must be a string",
        },
        {
            "name": "empty_query",
            "payload": {"query": ""},  # empty query
            "expected_error_substr": "query is required and must be a string",
        },
        {
            "name": "limit_as_string",
            "payload": {"query": "help me sleep", "limit": "5"},  # limit provided as string
            "expected_error_substr": "limit must be a number between 1 and 50",
        },
        {
            "name": "limit_zero",
            "payload": {"query": "help me sleep", "limit": 0},  # out of range (too low)
            "expected_error_substr": "limit must be a number between 1 and 50",
        },
        {
            "name": "limit_too_high",
            "payload": {"query": "help me sleep", "limit": 51},  # out of range (too high)
            "expected_error_substr": "limit must be a number between 1 and 50",
        },
    ]

    for case in test_cases:
        try:
            resp = requests.post(URL, json=case["payload"], headers=HEADERS, timeout=TIMEOUT)
        except RequestException as e:
            assert False, f"HTTP request failed for case '{case['name']}': {e}"

        assert resp is not None, f"No response received for case '{case['name']}'"
        assert resp.status_code == 400, (
            f"Expected status 400 for case '{case['name']}', got {resp.status_code}. Response text: {resp.text}"
        )

        try:
            body = resp.json()
        except ValueError:
            assert False, f"Response for case '{case['name']}' is not valid JSON. Raw text: {resp.text}"

        assert isinstance(body, dict), f"Response JSON for case '{case['name']}' is not an object: {body}"
        assert "error" in body, f"Response JSON for case '{case['name']}' missing 'error' key: {body}"

        error_text = str(body.get("error", ""))
        assert case["expected_error_substr"] in error_text, (
            f"Expected error containing '{case['expected_error_substr']}' for case '{case['name']}', got '{error_text}'"
        )

    print("All subcases passed for test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit")


if __name__ == "__main__":
    test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit()