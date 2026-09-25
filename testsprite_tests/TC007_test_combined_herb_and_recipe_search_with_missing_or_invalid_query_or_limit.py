import requests
import json
import sys

BASE_URL = "http://localhost:54321/functions/v1"
ENDPOINT = f"{BASE_URL}/recipes-search"
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30  # seconds

def test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit():
    cases = [
        # missing query
        ( {}, 400, ["query", "required", "string"] ),
        # empty query
        ( {"query": ""}, 400, ["query", "required", "string"] ),
        # limit provided as a string
        ( {"query": "help me sleep", "limit": "5"}, 400, ["limit", "number", "between"] ),
        # limit out of range (too low)
        ( {"query": "help me sleep", "limit": 0}, 400, ["limit", "number", "between"] ),
        # limit out of range (too high)
        ( {"query": "help me sleep", "limit": 100}, 400, ["limit", "number", "between"] ),
    ]

    for payload, expected_status, expected_substrings in cases:
        try:
            resp = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Request failed for payload {payload!r}: {e}")

        if resp.status_code != expected_status:
            # include body for debug
            body = None
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            raise AssertionError(f"Expected status {expected_status} for payload {payload!r}, got {resp.status_code}. Body: {body!r}")

        # try to parse JSON error body
        try:
            body_json = resp.json()
        except ValueError:
            raise AssertionError(f"Response for payload {payload!r} is not valid JSON: {resp.text!r}")

        # Expect an error key with a validation message
        assert isinstance(body_json, dict), f"Expected JSON object in response for payload {payload!r}, got: {body_json!r}"
        assert "error" in body_json, f"Expected 'error' key in response JSON for payload {payload!r}, got: {body_json!r}"
        error_msg = str(body_json.get("error", "")).lower()
        for substr in expected_substrings:
            assert substr in error_msg, f"Expected '{substr}' in error message for payload {payload!r}. Got: {error_msg!r}"

    print("All cases in test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit passed.")

if __name__ == "__main__":
    try:
        test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as e:
        print("UNEXPECTED ERROR:", e)
        sys.exit(2)
    print("TESTS PASSED")