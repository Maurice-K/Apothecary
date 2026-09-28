import requests
from requests.exceptions import RequestException

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_cors_preflight_on_search_endpoint():
    origin = "https://herbary.app"  # allowed Origin from PRD
    url = f"{BASE_ENDPOINT}/search"
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization"
    }

    try:
        resp = requests.options(url, headers=headers, timeout=30)
    except RequestException as e:
        assert False, f"OPTIONS request to {url} failed: {e}"

    # Status code must be 200
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Body: {resp.text}"

    # Access-Control-Allow-Origin must echo the Origin
    acao = resp.headers.get("Access-Control-Allow-Origin")
    assert acao is not None, f"Missing Access-Control-Allow-Origin header. Headers: {resp.headers}"
    assert acao == origin, f"Expected Access-Control-Allow-Origin to be '{origin}', got '{acao}'"

    # Access-Control-Allow-Methods must include POST
    acam = resp.headers.get("Access-Control-Allow-Methods")
    assert acam is not None, f"Missing Access-Control-Allow-Methods header. Headers: {resp.headers}"
    methods = [m.strip().upper() for m in acam.split(",")]
    assert "POST" in methods, f"Access-Control-Allow-Methods does not include POST. Value: {acam}"

    print("PASS: test_cors_preflight_on_search_endpoint")

if __name__ == "__main__":
    test_cors_preflight_on_search_endpoint()