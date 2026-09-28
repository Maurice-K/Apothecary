import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_PATH = "/search"
TIMEOUT = 30


def test_semantic_herb_search_with_missing_or_empty_query():
    """
    Verify that POST /search with a missing or empty query string returns a 400
    response with an error message indicating that the query is required and must be a string.
    """
    url = BASE_URL.rstrip("/") + SEARCH_PATH
    headers = {"Content-Type": "application/json"}
    test_cases = [
        (None, "missing_query"),      # no body / missing query
        ({"query": ""}, "empty_query")  # query present but empty string
    ]

    expected_status = 400
    expected_error = "query is required and must be a string"

    for payload, name in test_cases:
        try:
            if payload is None:
                # Send empty JSON object to represent missing query key
                resp = requests.post(url, headers=headers, json={}, timeout=TIMEOUT)
            else:
                resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"HTTP request failed for case '{name}': {e}")

        # Verify status code
        assert resp.status_code == expected_status, (
            f"Case '{name}': expected status {expected_status}, got {resp.status_code}. "
            f"Response text: {resp.text}"
        )

        # Verify response is JSON and has expected error message
        try:
            body = resp.json()
        except ValueError:
            raise AssertionError(f"Case '{name}': response is not valid JSON. Text: {resp.text}")

        assert isinstance(body, dict), f"Case '{name}': expected JSON object, got {type(body)}"
        actual_error = body.get("error")
        assert actual_error == expected_error, (
            f"Case '{name}': expected error message '{expected_error}', got '{actual_error}'. Full body: {body}"
        )

    print("test_semantic_herb_search_with_missing_or_empty_query: PASSED")


if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_missing_or_empty_query()
    except AssertionError as e:
        print(f"test_semantic_herb_search_with_missing_or_empty_query: FAILED - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_semantic_herb_search_with_missing_or_empty_query: ERROR - {e}")
        sys.exit(2)
    sys.exit(0)