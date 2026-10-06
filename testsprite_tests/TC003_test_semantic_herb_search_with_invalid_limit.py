import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_URL = f"{BASE_URL}/search"
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30

def test_semantic_herb_search_with_invalid_limit():
    test_cases = [
        # limit provided as string
        ({"query": "help me sleep", "limit": "5"}, "limit as string"),
        # limit below allowed range
        ({"query": "help me sleep", "limit": 0}, "limit below range (0)"),
        # limit above allowed range
        ({"query": "help me sleep", "limit": 51}, "limit above range (51)"),
    ]

    for payload, desc in test_cases:
        try:
            resp = requests.post(SEARCH_URL, headers=HEADERS, json=payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"HTTP request for case '{desc}' failed: {e}")

        # Expect a 400 validation error
        assert resp.status_code == 400, f"Expected 400 for case '{desc}', got {resp.status_code}: {resp.text}"

        # Validate JSON error body
        try:
            body = resp.json()
        except ValueError:
            raise AssertionError(f"Response for case '{desc}' is not valid JSON: {resp.text}")

        assert isinstance(body, dict), f"Response body for case '{desc}' is not a JSON object: {body}"
        error_msg = body.get("error")
        assert error_msg, f"Response for case '{desc}' missing 'error' field: {body}"

        # Error message should indicate limit must be a number between 1 and 50
        assert "number between 1 and 50" in error_msg.lower() or "limit must be a number between 1 and 50" in error_msg.lower(), (
            f"Unexpected error message for case '{desc}': {error_msg}"
        )

        print(f"Passed invalid limit case: {desc}")

if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_invalid_limit()
        print("All invalid limit tests passed.")
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(2)