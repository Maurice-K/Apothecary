import requests
import json
from json.decoder import JSONDecodeError

BASE_ENDPOINT = "http://localhost:54321/functions/v1"
NUTRITIONIST_PATH = f"{BASE_ENDPOINT}/nutritionist"
HEADERS = {"Content-Type": "application/json"}


def test_nutritionist_post_with_invalid_messages_array():
    # Case 1: messages array exceeding 50 entries
    messages_too_many = [{"role": "user", "content": "Hello"} for _ in range(51)]
    payload_too_many = {"messages": messages_too_many}
    try:
        resp = requests.post(NUTRITIONIST_PATH, headers=HEADERS, json=payload_too_many, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed for too-many-messages case: {e}"

    assert resp.status_code == 400, f"Expected 400 for too-many-messages, got {resp.status_code}"
    try:
        body = resp.json()
    except JSONDecodeError:
        assert False, "Response for too-many-messages is not valid JSON"
    assert isinstance(body, dict) and "error" in body, f"Expected JSON error body for too-many-messages, got: {body}"
    error_msg = str(body.get("error", "")).lower()
    assert ("exceed" in error_msg) or ("cannot exceed" in error_msg) or ("messages" in error_msg and "50" in error_msg) , \
        f"Unexpected error message for too-many-messages: {body.get('error')}"

    # Case 2: last message not from user
    messages_last_not_user = [
        {"role": "user", "content": "I have a question"},
        {"role": "assistant", "content": "Sure, what's up?"}
    ]
    payload_last_not_user = {"messages": messages_last_not_user}
    try:
        resp2 = requests.post(NUTRITIONIST_PATH, headers=HEADERS, json=payload_last_not_user, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed for last-not-user case: {e}"

    assert resp2.status_code == 400, f"Expected 400 for last-not-user, got {resp2.status_code}"
    try:
        body2 = resp2.json()
    except JSONDecodeError:
        assert False, "Response for last-not-user is not valid JSON"
    assert isinstance(body2, dict) and "error" in body2, f"Expected JSON error body for last-not-user, got: {body2}"
    error_msg2 = str(body2.get("error", "")).lower()
    assert ("last message" in error_msg2 and "user" in error_msg2) or ("last" in error_msg2 and "user" in error_msg2) or ("last message must" in error_msg2), \
        f"Unexpected error message for last-not-user: {body2.get('error')}"


if __name__ == "__main__":
    test_nutritionist_post_with_invalid_messages_array()