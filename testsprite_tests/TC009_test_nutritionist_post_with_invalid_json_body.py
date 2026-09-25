import requests
from requests.exceptions import RequestException
import json
import sys

BASE_URL = "http://localhost:54321/functions/v1"

def test_nutritionist_post_with_invalid_json_body():
    url = f"{BASE_URL}/nutritionist"
    headers = {"Content-Type": "application/json"}
    # Deliberately malformed JSON body
    invalid_json = "{ this is : not valid json "

    try:
        resp = requests.post(url, data=invalid_json, headers=headers, timeout=30)
    except RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Expect HTTP 400
    assert resp.status_code == 400, f"Expected status 400, got {resp.status_code}. Response text: {resp.text}"

    # Expect JSON body {"error":"Invalid JSON body"}
    try:
        body = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {resp.text}")

    expected = {"error": "Invalid JSON body"}
    assert body == expected, f"Expected response JSON {expected}, got {body}"

if __name__ == "__main__":
    try:
        test_nutritionist_post_with_invalid_json_body()
    except AssertionError as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
    print("TEST PASSED")