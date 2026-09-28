import requests

BASE_URL = "http://localhost:54321/functions/v1"

def test_nutritionist_post_with_invalid_json_body():
    url = f"{BASE_URL}/nutritionist"
    # Intentionally malformed JSON
    invalid_json_body = "{invalidJson: true"  # missing closing brace and unquoted key
    headers = {"Content-Type": "application/json"}

    try:
        resp = requests.post(url, data=invalid_json_body, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert resp.status_code == 400, f"Expected status 400, got {resp.status_code}. Body: {resp.text}"

    try:
        body = resp.json()
    except ValueError:
        assert False, f"Response body is not valid JSON: {resp.text}"

    assert isinstance(body, dict), f"Expected JSON object, got: {body!r}"
    assert body == {"error": "Invalid JSON body"}, f"Unexpected response JSON: {body!r}"

if __name__ == "__main__":
    test_nutritionist_post_with_invalid_json_body()