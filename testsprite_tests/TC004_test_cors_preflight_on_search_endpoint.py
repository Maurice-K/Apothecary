import requests
import sys

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_cors_preflight_on_search_endpoint():
    url = f"{BASE_ENDPOINT}/search"
    origin = "https://herbary.app"  # allowed origin per PRD
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization"
    }

    try:
        resp = requests.options(url, headers=headers, timeout=30)
    except requests.exceptions.RequestException as e:
        raise AssertionError(f"Request failed: {e}")

    # Status code
    assert resp.status_code == 200, f"Expected status code 200, got {resp.status_code}. Body: {resp.text}"

    # CORS: Access-Control-Allow-Origin should echo the Origin
    allow_origin = resp.headers.get("Access-Control-Allow-Origin")
    assert allow_origin is not None, "Missing Access-Control-Allow-Origin header"
    assert allow_origin == origin, f"Expected Access-Control-Allow-Origin to echo '{origin}', got '{allow_origin}'"

    # CORS: Access-Control-Allow-Methods should include POST
    allow_methods = resp.headers.get("Access-Control-Allow-Methods", "")
    assert "POST" in allow_methods.upper(), f"Access-Control-Allow-Methods does not include POST. Got: '{allow_methods}'"

    # Optionally ensure body is empty or 'ok' per PRD (not strictly required)
    # Many CORS preflight responses have empty bodies; accept either.
    if resp.text:
        assert resp.text.strip().lower() in ("ok", ""), f"Unexpected response body for OPTIONS /search: {resp.text}"

    print("test_cors_preflight_on_search_endpoint: PASSED")

if __name__ == "__main__":
    try:
        test_cors_preflight_on_search_endpoint()
    except AssertionError as e:
        print(f"test_cors_preflight_on_search_endpoint: FAILED - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_cors_preflight_on_search_endpoint: ERROR - {e}")
        sys.exit(2)
    sys.exit(0)