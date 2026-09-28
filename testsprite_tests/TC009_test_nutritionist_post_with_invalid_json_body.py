import requests
import json
from requests.exceptions import RequestException, Timeout

BASE_URL = "http://localhost:54321/functions/v1"
ENDPOINT = "/nutritionist"
URL = BASE_URL + ENDPOINT
TIMEOUT = 30  # seconds

def test_nutritionist_post_with_invalid_json_body():
    # Malformed JSON body (invalid JSON)
    malformed_json = "{ invalid_json: true unquoted_value }"
    headers = {
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(URL, data=malformed_json, headers=headers, timeout=TIMEOUT)
    except Timeout as e:
        raise AssertionError(f"Request timed out after {TIMEOUT} seconds") from e
    except RequestException as e:
        raise AssertionError(f"HTTP request failed: {e}") from e

    # Expecting 400 Bad Request
    assert resp.status_code == 400, f"Expected status 400, got {resp.status_code}, body: {resp.text!r}"

    # Expecting JSON body {"error":"Invalid JSON body"}
    try:
        body = resp.json()
    except ValueError as e:
        raise AssertionError(f"Response is not valid JSON: {resp.text!r}") from e

    expected = {"error": "Invalid JSON body"}
    assert body == expected, f"Expected JSON {expected}, got {body}"

if __name__ == "__main__":
    test_nutritionist_post_with_invalid_json_body()
    print("TC009 passed.")