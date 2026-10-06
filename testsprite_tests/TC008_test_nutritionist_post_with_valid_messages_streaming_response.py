import requests
import time
import json
from requests.exceptions import RequestException

BASE_URL = "http://localhost:54321/functions/v1"
PATH = "/nutritionist"
URL = BASE_URL + PATH

def test_nutritionist_post_with_valid_messages_streaming_response():
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "messages": [
            {"role": "user", "content": "I have trouble sleeping. Can you suggest herbs or routines to help me sleep better?"}
        ]
    }

    # Use generous read timeout per PRD: connect timeout 10s, read timeout 120s
    timeout = (10, 120)
    resp = None

    try:
        resp = requests.post(URL, headers=headers, json=payload, stream=True, timeout=timeout)
    except RequestException as e:
        raise AssertionError(f"Request to {URL} failed: {e}")

    try:
        # Basic response assertions
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}"
        content_type = resp.headers.get("Content-Type", "")
        assert "text/event-stream" in content_type, f"Expected Content-Type to include 'text/event-stream', got '{content_type}'"

        # Read SSE stream until we see a 'done' event or hit our timeout
        start = time.time()
        overall_timeout = 120  # seconds, as suggested by PRD
        current_lines = []
        seen_events = []
        # We'll capture at least one text_delta; expect tool_use, herb_results, text_delta, done
        expected_events = {"tool_use", "herb_results", "text_delta", "done"}

        def process_event_block(lines):
            event_name = None
            data_lines = []
            for l in lines:
                if l.startswith("event:"):
                    event_name = l[len("event:"):].strip()
                elif l.startswith("data:"):
                    data_lines.append(l[len("data:"):].lstrip())
            data_str = "\n".join(data_lines).strip()
            parsed = None
            if data_str:
                try:
                    parsed = json.loads(data_str)
                except Exception:
                    parsed = data_str
            return event_name, parsed

        # iterate over response lines
        try:
            for raw_line in resp.iter_lines(decode_unicode=True):
                # Check timeout
                if time.time() - start > overall_timeout:
                    raise AssertionError(f"Did not receive 'done' event within {overall_timeout} seconds")

                # iter_lines can yield None or empty strings; handle accordingly
                if raw_line is None:
                    continue
                line = raw_line.rstrip("\r\n")
                if line == "":
                    # blank line indicates end of event
                    if current_lines:
                        name, data = process_event_block(current_lines)
                        if name:
                            seen_events.append(name)
                        current_lines = []
                        # Stop early if we saw done
                        if name == "done":
                            break
                    continue
                else:
                    current_lines.append(line)

            # If loop ended but there is an unprocessed block, process it
            if current_lines:
                name, data = process_event_block(current_lines)
                if name:
                    seen_events.append(name)
        finally:
            resp.close()

        seen_set = set(seen_events)
        missing = expected_events - seen_set
        assert not missing, f"Missing expected SSE events: {missing}. Seen events sequence: {seen_events}"

        # Ensure ordering: tool_use before herb_results before done
        try:
            idx_tool = seen_events.index("tool_use")
            idx_herbs = seen_events.index("herb_results")
            idx_done = seen_events.index("done")
            assert idx_tool < idx_herbs < idx_done, f"Event ordering incorrect: {seen_events}"
        except ValueError as e:
            raise AssertionError(f"Expected ordering check failed due to missing event: {e}")

        # Ensure at least one text_delta event appears (could be multiple)
        assert "text_delta" in seen_set, "Expected at least one text_delta event in the stream"

    finally:
        if resp is not None:
            try:
                resp.close()
            except Exception:
                pass

if __name__ == "__main__":
    test_nutritionist_post_with_valid_messages_streaming_response()
    print("TC008 passed.")