import requests
import sys

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = 30  # seconds

def test_nutritionist_post_with_invalid_messages_array():
    url = f"{BASE_URL}/nutritionist"
    headers = {"Content-Type": "application/json"}

    # Case 1: messages array exceeding 50 entries
    payload_exceed = {
        "messages": [{"role": "user", "content": f"msg {i}"} for i in range(51)]
    }

    try:
        resp1 = requests.post(url, json=payload_exceed, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed for exceeding-50 test: {e}"

    assert resp1.status_code == 400, f"Expected 400 for messages exceeding 50 entries, got {resp1.status_code}. Response text: {resp1.text}"

    try:
        body1 = resp1.json()
    except ValueError:
        assert False, f"Response for exceeding-50 test is not valid JSON: {resp1.text}"

    assert isinstance(body1, dict) and "error" in body1, f"Expected JSON body with 'error' field for exceeding-50 test, got: {body1}"
    err1 = str(body1.get("error", "")).lower()
    assert ("exceed" in err1) or ("50" in err1) or ("messages" in err1), f"Unexpected error message for exceeding-50 test: {body1.get('error')}"

    # Case 2: last message not from user
    payload_last_not_user = {
        "messages": [
            {"role": "assistant", "content": "I respond first"}
        ]
    }

    try:
        resp2 = requests.post(url, json=payload_last_not_user, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed for last-not-user test: {e}"

    assert resp2.status_code == 400, f"Expected 400 for last-message-not-user test, got {resp2.status_code}. Response text: {resp2.text}"

    try:
        body2 = resp2.json()
    except ValueError:
        assert False, f"Response for last-not-user test is not valid JSON: {resp2.text}"

    assert isinstance(body2, dict) and "error" in body2, f"Expected JSON body with 'error' field for last-not-user test, got: {body2}"
    err2 = str(body2.get("error", "")).lower()
    assert ("last" in err2 and "user" in err2) or ("last message" in err2) or ("must have role" in err2) or ("last message must have role" in err2), f"Unexpected error message for last-not-user test: {body2.get('error')}"

    print("test_nutritionist_post_with_invalid_messages_array: PASSED")


if __name__ == "__main__":
    try:
        test_nutritionist_post_with_invalid_messages_array()
    except AssertionError as e:
        print(f"test_nutritionist_post_with_invalid_messages_array: FAILED - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"test_nutritionist_post_with_invalid_messages_array: ERROR - {e}")
        sys.exit(2)
    sys.exit(0)