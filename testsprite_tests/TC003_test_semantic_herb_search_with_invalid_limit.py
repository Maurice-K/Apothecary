import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
SEARCH_URL = f"{BASE_URL}/search"
HEADERS = {"Content-Type": "application/json"}


def test_semantic_herb_search_with_invalid_limit():
    cases = [
        {"payload": {"query": "help me sleep", "limit": "5"}, "desc": "limit as string"},
        {"payload": {"query": "help me sleep", "limit": 0}, "desc": "limit below allowed range (0)"},
        {"payload": {"query": "help me sleep", "limit": 51}, "desc": "limit above allowed range (51)"},
    ]

    for case in cases:
        desc = case["desc"]
        try:
            resp = requests.post(SEARCH_URL, headers=HEADERS, json=case["payload"], timeout=30)
        except requests.RequestException as e:
            assert False, f"HTTP request failed for '{desc}': {e}"

        assert resp.status_code == 400, f"Expected 400 for '{desc}', got {resp.status_code}. Body: {resp.text}"

        content_type = resp.headers.get("Content-Type", "")
        assert "json" in content_type.lower() or "application/json" in content_type.lower(), (
            f"Expected JSON Content-Type for '{desc}', got '{content_type}'. Body: {resp.text}"
        )

        try:
            body = resp.json()
        except ValueError:
            assert False, f"Response body is not valid JSON for '{desc}': {resp.text}"

        assert isinstance(body, dict), f"Expected JSON object in response for '{desc}', got: {body}"
        assert "error" in body, f"Response JSON must contain 'error' key for '{desc}', got: {body}"

        error_msg = body.get("error") or ""
        expected_fragment = "limit must be a number between 1 and 50"
        assert expected_fragment in error_msg, (
            f"Error message should indicate limit range for '{desc}'. Expected fragment '{expected_fragment}' in '{error_msg}'"
        )

    # If all cases pass
    print("test_semantic_herb_search_with_invalid_limit: PASSED")


if __name__ == "__main__":
    test_semantic_herb_search_with_invalid_limit()