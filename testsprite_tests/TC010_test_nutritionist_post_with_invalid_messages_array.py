import requests
import json
from requests.exceptions import RequestException

BASE_URL = "http://localhost:54321/functions/v1"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def test_nutritionist_post_with_invalid_messages_array():
    # Case 1: messages array exceeding 50 entries
    url = f"{BASE_URL}/nutritionist"
    messages_exceed = [{"role": "user", "content": f"msg {i}"} for i in range(51)]  # 51 entries
    payload_exceed = {"messages": messages_exceed}

    try:
        resp = requests.post(url, headers=HEADERS, json=payload_exceed, timeout=30)
    except RequestException as e:
        assert False, f"Request failed for exceed-case: {e}"

    assert resp.status_code == 400, f"Expected 400 for messages exceeding 50, got {resp.status_code}: {resp.text}"
    try:
        body = resp.json()
    except ValueError:
        assert False, f"Expected JSON body for 400 response, got: {resp.text}"

    assert "error" in body, f"Expected 'error' key in response body, got: {body}"
    err_msg = str(body.get("error", "")).lower()
    assert err_msg, "Error message should be a non-empty string"
    # Expect message to indicate exceeding limit
    assert ("exceed" in err_msg) or ("50" in err_msg) or ("cannot exceed" in err_msg) or ("cannot be more" in err_msg), \
        f"Unexpected error message for exceed-case: {body.get('error')}"

    # Case 2: last message not from user (last role is 'assistant')
    messages_last_not_user = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Assistant turn"},  # last message is assistant -> invalid
    ]
    payload_last_not_user = {"messages": messages_last_not_user}

    try:
        resp2 = requests.post(url, headers=HEADERS, json=payload_last_not_user, timeout=30)
    except RequestException as e:
        assert False, f"Request failed for last-not-user case: {e}"

    assert resp2.status_code == 400, f"Expected 400 when last message is not user, got {resp2.status_code}: {resp2.text}"
    try:
        body2 = resp2.json()
    except ValueError:
        assert False, f"Expected JSON body for 400 response, got: {resp2.text}"

    assert "error" in body2, f"Expected 'error' key in response body, got: {body2}"
    err_msg2 = str(body2.get("error", "")).lower()
    assert err_msg2, "Error message should be a non-empty string"
    # Expect message to indicate the last message must be from user
    assert ("last" in err_msg2 and "user" in err_msg2) or ("last message must" in err_msg2) or ("must have role 'user'" in err_msg2) or ("must have role \"user\"" in err_msg2), \
        f"Unexpected error message for last-not-user case: {body2.get('error')}"

if __name__ == "__main__":
    test_nutritionist_post_with_invalid_messages_array()
    print("TC010 passed.")