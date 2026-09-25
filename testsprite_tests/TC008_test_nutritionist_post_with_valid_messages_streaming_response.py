import requests
import json
import time

BASE_URL = "http://localhost:54321/functions/v1"
ENDPOINT = f"{BASE_URL}/nutritionist"

def test_nutritionist_post_with_valid_messages_streaming_response():
    # Prepare a valid messages array (1 item, last role 'user')
    payload = {
        "messages": [
            {"role": "user", "content": "Can you suggest herbs to help with mild sleep troubles?"}
        ]
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(ENDPOINT, headers=headers, json=payload, stream=True, timeout=120)
    except requests.RequestException as e:
        raise AssertionError(f"Request to {ENDPOINT} failed: {e}")

    try:
        # Expect 200 OK
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}, body: {resp.text[:500]}"

        # Expect Content-Type text/event-stream
        content_type = resp.headers.get("Content-Type", "")
        assert "text/event-stream" in content_type, f"Expected 'text/event-stream' in Content-Type, got '{content_type}'"

        # Parse SSE stream: look for events tool_use, herb_results, text_delta, done
        seen_events = set()
        required_events = {"tool_use", "herb_results", "text_delta", "done"}

        current_event = None
        current_data_lines = []

        # Iterate lines from the stream. Stop after 'done' event is encountered.
        start_time = time.time()
        for raw_line in resp.iter_lines(decode_unicode=True):
            # safety: break if overall read exceeds 120s
            if time.time() - start_time > 120:
                break

            if raw_line is None:
                continue
            line = raw_line.strip()

            # blank line indicates end of an event message
            if line == "":
                if current_event is not None:
                    # finalize this event
                    data_str = "\n".join(current_data_lines).strip()
                    # try to parse data as json for basic validation, but ignore parse failures
                    if data_str:
                        try:
                            json.loads(data_str)
                        except Exception:
                            # it's acceptable for data to be non-JSON in some implementations; ignore parse errors
                            pass
                    seen_events.add(current_event)
                    if current_event == "done":
                        break
                    current_event = None
                    current_data_lines = []
                continue

            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                current_data_lines.append(line[len("data:"):].strip())
            else:
                # other SSE fields (id:, retry:) are ignored for this test
                continue

        # In case stream ended without a trailing blank line, finalize the last event
        if current_event is not None:
            seen_events.add(current_event)
            if current_event == "done":
                pass

        missing = required_events - seen_events
        assert not missing, f"Missing required SSE events: {missing}. Seen events: {seen_events}"

    finally:
        try:
            resp.close()
        except Exception:
            pass

if __name__ == "__main__":
    test_nutritionist_post_with_valid_messages_streaming_response()
    print("TC008 passed.")