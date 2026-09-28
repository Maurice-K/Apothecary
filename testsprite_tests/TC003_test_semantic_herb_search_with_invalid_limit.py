import requests
import json
import sys

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_PATH = "/search"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}
TIMEOUT = 30

def test_semantic_herb_search_with_invalid_limit():
    """
    Test POST /search with invalid limit values:
    - limit as a string (e.g., "5")
    - limit outside the allowed range (e.g., 0 and 51)
    Expect a 400 response with an error message indicating the limit must be a number between 1 and 50.
    """

    url = BASE_URL + SEARCH_PATH

    invalid_payloads = [
        {"query": "valerian root", "limit": "5"},   # limit as string
        {"query": "valerian root", "limit": 0},     # below range
        {"query": "valerian root", "limit": 51},    # above range
    ]

    for payload in invalid_payloads:
        try:
            resp = requests.post(url, headers=HEADERS, data=json.dumps(payload), timeout=TIMEOUT)
        except requests.RequestException as e:
            # Network-level failure should fail the test
            assert False, f"Request failed for payload {payload}: {e}"

        # Expect validation error
        assert resp.status_code == 400, f"Expected 400 for payload {payload}, got {resp.status_code}. Body: {resp.text}"

        # Try to parse JSON body
        try:
            body = resp.json()
        except ValueError:
            assert False, f"Response is not valid JSON for payload {payload}. Body: {resp.text}"

        # Ensure error message key exists and contains expected text
        assert isinstance(body, dict), f"Expected JSON object in response for payload {payload}, got: {body}"
        assert "error" in body, f"Expected 'error' key in response for payload {payload}, got: {body}"
        error_msg = str(body["error"])
        assert "limit must be a number between 1 and 50" in error_msg, (
            f"Expected error message to mention 'limit must be a number between 1 and 50' for payload {payload}, "
            f"got: {error_msg}"
        )

if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_invalid_limit()
        print("TEST PASSED: test_semantic_herb_search_with_invalid_limit")
    except AssertionError as ae:
        print("TEST FAILED: test_semantic_herb_search_with_invalid_limit")
        print(ae)
        sys.exit(1)
    except Exception as e:
        print("TEST ERROR: test_semantic_herb_search_with_invalid_limit")
        print(e)
        sys.exit(2)