import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
NUTRITIONIST_PATH = "/nutritionist"
TIMEOUT = 30  # seconds


def test_nutritionist_post_with_invalid_messages_array():
    url = BASE_URL + NUTRITIONIST_PATH
    headers = {"Content-Type": "application/json"}

    # Case A: messages array exceeding 50 entries (51 entries)
    payload_exceed = {
        "messages": [{"role": "user", "content": "Hello"}] * 51
    }

    try:
        resp = requests.post(url, headers=headers, json=payload_exceed, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed for payload_exceed: {e}")

    # Expect a 400 validation error
    assert resp.status_code == 400, f"Expected 400 for messages exceeding 50 entries, got {resp.status_code}. Response body: {resp.text}"
    # Response should be JSON with an error field
    try:
        body = resp.json()
    except ValueError:
        raise AssertionError(f"Expected JSON response for validation error, got: {resp.text}")

    assert isinstance(body, dict) and "error" in body, f"Expected JSON object with 'error' field, got: {body}"
    error_msg = str(body.get("error", "")).lower()
    assert "messages cannot exceed" in error_msg or "exceed" in error_msg or "50" in error_msg, f"Unexpected validation message for exceeding messages: {body.get('error')}"

    # Case B: last message not from user (last role is 'assistant')
    payload_last_not_user = {
        "messages": [
            {"role": "user", "content": "Initial question"},
            {"role": "assistant", "content": "Assistant follow-up"}
        ]
    }

    try:
        resp2 = requests.post(url, headers=headers, json=payload_last_not_user, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed for payload_last_not_user: {e}")

    # Expect a 400 validation error
    assert resp2.status_code == 400, f"Expected 400 for last message not from user, got {resp2.status_code}. Response body: {resp2.text}"
    try:
        body2 = resp2.json()
    except ValueError:
        raise AssertionError(f"Expected JSON response for validation error (last message not user), got: {resp2.text}")

    assert isinstance(body2, dict) and "error" in body2, f"Expected JSON object with 'error' field, got: {body2}"
    error_msg2 = str(body2.get("error", "")).lower()
    assert "last message" in error_msg2 and "user" in error_msg2 or "last" in error_msg2, f"Unexpected validation message for last message role: {body2.get('error')}"

    print("test_nutritionist_post_with_invalid_messages_array: PASSED")


if __name__ == "__main__":
    try:
        test_nutritionist_post_with_invalid_messages_array()
    except AssertionError as e:
        print("test_nutritionist_post_with_invalid_messages_array: FAILED")
        print(e)
        sys.exit(1)
    except Exception as e:
        print("test_nutritionist_post_with_invalid_messages_array: ERROR")
        print(e)
        sys.exit(2)
    sys.exit(0)