import sys
import requests

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = 30


def test_cors_preflight_on_search_endpoint():
    url = f"{BASE_URL}/search"
    origin = "https://herbary.app"
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }

    try:
        resp = requests.options(url, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        print(f"Request to {url} failed: {e}")
        raise

    try:
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Response text: {resp.text!r}"
        allow_origin = resp.headers.get("Access-Control-Allow-Origin")
        assert allow_origin == origin, (
            f"Access-Control-Allow-Origin header mismatch. Expected {origin!r}, got {allow_origin!r}. "
            f"Response headers: {dict(resp.headers)}"
        )
        allow_methods = resp.headers.get("Access-Control-Allow-Methods", "")
        assert "POST" in allow_methods.upper(), (
            f"Access-Control-Allow-Methods does not include POST. Header value: {allow_methods!r}"
        )
    except AssertionError as ae:
        print("Assertion failed:", ae)
        raise

    print("CORS preflight test passed: OPTIONS /search returned 200, echoed Origin, and allowed POST.")


if __name__ == "__main__":
    try:
        test_cors_preflight_on_search_endpoint()
    except Exception as e:
        print("Test failed:", e)
        sys.exit(1)
    sys.exit(0)