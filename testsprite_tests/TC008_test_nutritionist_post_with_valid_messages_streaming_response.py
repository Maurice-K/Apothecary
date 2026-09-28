import requests
import json
import sys

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_nutritionist_post_with_valid_messages_streaming_response():
    url = f"{BASE_ENDPOINT}/nutritionist"
    headers = {"Content-Type": "application/json"}
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "I'm having trouble sleeping. What herbs might help and how should I use them?"
            }
        ]
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)
    except requests.RequestException as e:
        assert False, f"HTTP request to {url} failed: {e}"

    try:
        # Basic response checks
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}"
        ct = resp.headers.get("Content-Type", "")
        assert ct.startswith("text/event-stream"), f"Expected Content-Type text/event-stream, got {ct}"

        # Parse SSE stream into events
        events = []  # list of (event_name, data_str)
        buffer_lines = []
        # Iterate lines; break when we see a done event
        for raw_line in resp.iter_lines(decode_unicode=True):
            if raw_line is None:
                continue
            line = raw_line.rstrip("\n")
            if line == "":
                if buffer_lines:
                    event_name = None
                    data_lines = []
                    for bl in buffer_lines:
                        bl_stripped = bl.strip()
                        if bl_stripped.startswith("event:"):
                            event_name = bl_stripped[len("event:"):].strip()
                        elif bl_stripped.startswith("data:"):
                            data_lines.append(bl_stripped[len("data:"):].strip())
                    data = "\n".join(data_lines)
                    events.append((event_name, data))
                    buffer_lines = []
                    if event_name == "done":
                        break
                continue
            buffer_lines.append(line)

        # If buffer still has content (no trailing blank line), process it
        if buffer_lines:
            event_name = None
            data_lines = []
            for bl in buffer_lines:
                bl_stripped = bl.strip()
                if bl_stripped.startswith("event:"):
                    event_name = bl_stripped[len("event:"):].strip()
                elif bl_stripped.startswith("data:"):
                    data_lines.append(bl_stripped[len("data:"):].strip())
            data = "\n".join(data_lines)
            events.append((event_name, data))

        # Collect event names
        event_names = [e[0] for e in events if e[0] is not None]

        required_events = {"tool_use", "herb_results", "text_delta", "done"}
        missing = required_events - set(event_names)
        assert not missing, f"Missing required SSE events: {missing}. Received events: {event_names}"

        # Validate payloads for specific events
        # Find first occurrences
        event_data_map = {}
        for name, data_str in events:
            if name not in event_data_map:
                event_data_map[name] = data_str

        # tool_use: expect JSON with at least 'name' and 'input' keys
        tool_use_data_raw = event_data_map.get("tool_use")
        assert tool_use_data_raw is not None, "tool_use event data missing"
        try:
            tool_use_data = json.loads(tool_use_data_raw)
        except Exception as e:
            assert False, f"tool_use event data is not valid JSON: {e}"
        assert isinstance(tool_use_data, dict), "tool_use event data must be a JSON object"
        assert "name" in tool_use_data and "input" in tool_use_data, "tool_use data must include 'name' and 'input'"

        # herb_results: expect JSON with 'herbs' array
        herb_results_raw = event_data_map.get("herb_results")
        assert herb_results_raw is not None, "herb_results event data missing"
        try:
            herb_results = json.loads(herb_results_raw)
        except Exception as e:
            assert False, f"herb_results event data is not valid JSON: {e}"
        assert isinstance(herb_results, dict), "herb_results event data must be a JSON object"
        assert "herbs" in herb_results and isinstance(herb_results["herbs"], list), "herb_results must include a 'herbs' array"

        # text_delta: at least one text_delta event with JSON containing 'delta' (or a string delta)
        text_delta_raw = event_data_map.get("text_delta")
        assert text_delta_raw is not None, "text_delta event data missing"
        # text_delta may appear multiple times; the first occurrence should be JSON
        try:
            text_delta = json.loads(text_delta_raw)
            assert isinstance(text_delta, dict), "text_delta event JSON must be an object"
            assert "delta" in text_delta, "text_delta JSON must include 'delta'"
        except json.JSONDecodeError:
            # Some implementations may send raw string data; accept non-JSON non-empty string
            assert text_delta_raw.strip() != "", "text_delta event data is empty and not JSON"

        # done: expect JSON object (possibly empty) or empty data
        done_raw = event_data_map.get("done")
        assert done_raw is not None, "done event data missing"
        if done_raw.strip() != "":
            try:
                json.loads(done_raw)
            except Exception as e:
                assert False, f"done event data is not valid JSON: {e}"

    finally:
        try:
            resp.close()
        except Exception:
            pass

if __name__ == "__main__":
    try:
        test_nutritionist_post_with_valid_messages_streaming_response()
        print("TC008 passed")
    except AssertionError as ae:
        print(f"TC008 failed: {ae}")
        sys.exit(1)
    except Exception as e:
        print(f"TC008 encountered an unexpected error: {e}")
        sys.exit(2)