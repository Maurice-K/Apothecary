import requests
from requests.exceptions import RequestException

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_cors_preflight_on_search_endpoint():
    url = f"{BASE_ENDPOINT}/search"
    origin = "https://herbary.app"  # allowed origin per PRD
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
    }

    try:
        resp = requests.options(url, headers=headers, timeout=30)
    except RequestException as e:
        assert False, f"OPTIONS request failed: {e}"

    # Status code
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}. Body: {resp.text[:500]}"

    # Access-Control-Allow-Origin should echo the Origin
    allow_origin = resp.headers.get("Access-Control-Allow-Origin")
    assert allow_origin == origin, f"Expected Access-Control-Allow-Origin to echo '{origin}', got '{allow_origin}'"

    # Access-Control-Allow-Methods should include POST
    allow_methods = resp.headers.get("Access-Control-Allow-Methods", "")
    methods_list = [m.strip().upper() for m in allow_methods.split(",") if m.strip()]
    assert "POST" in methods_list, f"Expected 'POST' in Access-Control-Allow-Methods, got '{allow_methods}'"

if __name__ == "__main__":
    test_cors_preflight_on_search_endpoint()
    print("TC004 passed.")