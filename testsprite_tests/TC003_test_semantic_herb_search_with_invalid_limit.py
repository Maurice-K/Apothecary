import requests

BASE_ENDPOINT = "http://localhost:54321/functions/v1"
SEARCH_URL = f"{BASE_ENDPOINT}/search"
HEADERS = {"Content-Type": "application/json"}


def test_semantic_herb_search_with_invalid_limit():
    test_cases = [
        {"query": "help me sleep", "limit": "5"},   # limit as string
        {"query": "help me sleep", "limit": 0},     # below range
        {"query": "help me sleep", "limit": 51},    # above range
    ]

    for payload in test_cases:
        try:
            resp = requests.post(SEARCH_URL, json=payload, headers=HEADERS, timeout=30)
        except requests.RequestException as e:
            assert False, f"HTTP request failed for payload {payload}: {e}"

        assert resp.status_code == 400, f"Expected 400 for payload {payload}, got {resp.status_code}. Body: {resp.text}"

        try:
            body = resp.json()
        except ValueError:
            assert False, f"Response is not valid JSON for payload {payload}: {resp.text}"

        assert isinstance(body, dict), f"Response JSON should be an object for payload {payload}: {body}"
        error_msg = body.get("error")
        assert isinstance(error_msg, str), f"'error' must be a string in response for payload {payload}: {body}"
        assert "limit must be a number between 1 and 50" in error_msg, f"Unexpected error message for payload {payload}: {error_msg}"


if __name__ == "__main__":
    test_semantic_herb_search_with_invalid_limit()