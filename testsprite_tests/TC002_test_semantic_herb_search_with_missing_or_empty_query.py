import requests
import sys

BASE_ENDPOINT = "http://localhost:54321/functions/v1"
SEARCH_PATH = "/search"
TIMEOUT = 30  # seconds
HEADERS = {"Content-Type": "application/json"}


def test_semantic_herb_search_with_missing_or_empty_query():
    url = BASE_ENDPOINT.rstrip("/") + SEARCH_PATH

    test_cases = [
        ( {}, "missing query field" ),
        ( {"query": ""}, "empty query string" ),
    ]

    for payload, description in test_cases:
        try:
            resp = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Request failed for case '{description}': {e}"

        # Expect 400 Bad Request
        assert resp.status_code == 400, (
            f"Expected status 400 for case '{description}', got {resp.status_code}. "
            f"Response text: {resp.text}"
        )

        # Response body should be valid JSON with an 'error' message indicating query is required
        try:
            body = resp.json()
        except ValueError:
            assert False, f"Response is not valid JSON for case '{description}': {resp.text}"

        assert isinstance(body, dict), f"Expected JSON object in response for case '{description}'"

        error_msg = body.get("error")
        assert error_msg is not None, f"Expected 'error' field in response for case '{description}'"

        # The error should indicate that the query is required and must be a string
        expected_fragment = "query is required and must be a string"
        assert expected_fragment in error_msg, (
            f"Error message for case '{description}' does not indicate missing/invalid query. "
            f"Got: {error_msg}"
        )

    print("test_semantic_herb_search_with_missing_or_empty_query: PASSED")


if __name__ == "__main__":
    try:
        test_semantic_herb_search_with_missing_or_empty_query()
    except AssertionError as e:
        print(f"TEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)