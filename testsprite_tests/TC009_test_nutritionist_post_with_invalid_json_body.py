import requests
import json

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_nutritionist_post_with_invalid_json_body():
    url = f"{BASE_ENDPOINT}/nutritionist"
    headers = {"Content-Type": "application/json"}
    # Intentionally malformed JSON body
    invalid_json = "this is not valid json"
    try:
        resp = requests.post(url, headers=headers, data=invalid_json, timeout=30)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert resp.status_code == 400, f"Expected status 400, got {resp.status_code}. Response text: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response is not valid JSON: {resp.text}"

    assert body == {"error": "Invalid JSON body"}, f"Unexpected response body: {body}"

if __name__ == "__main__":
    test_nutritionist_post_with_invalid_json_body()