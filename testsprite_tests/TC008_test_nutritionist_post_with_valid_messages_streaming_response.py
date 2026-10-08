import requests
import json
import time

BASE_URL = "http://localhost:54321/functions/v1"
TIMEOUT = (10, 120)  # connect timeout 10s, read timeout 120s

def test_nutritionist_post_with_valid_messages_streaming_response():
    url = f"{BASE_URL}/nutritionist"
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    messages = [
        {"role": "user", "content": "I can't sleep"},
        {"role": "assistant", "content": "That sounds exhausting. A few questions so I can point you the right way: is it trouble falling asleep or staying asleep? How long has it been going on? And are you taking any medications?"},
        {"role": "user", "content": "Staying asleep, I wake at 3am with racing thoughts. About a month. No meds, not pregnant."}
    ]
    payload = {"messages": messages}

    resp = None
    try:
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(payload), stream=True, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"

        assert resp is not None, "No response received"
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        content_type = resp.headers.get("Content-Type", "")
        assert content_type.startswith("text/event-stream"), f"Expected Content-Type text/event-stream, got {content_type}"

        events = []
        cur_event = {"event": None, "data_lines": []}
        start_time = time.time()

        for raw_line in resp.iter_lines(decode_unicode=True):
            # Safety timeout in case server stalls beyond socket read timeout
            if time.time() - start_time > 125:
                assert False, "Streaming read exceeded allowed time"

            if raw_line is None:
                continue
            line = raw_line.strip()
            if line == "":
                # end of an event
                if cur_event["event"] is not None or cur_event["data_lines"]:
                    data_text = "\n".join(cur_event["data_lines"]).strip()
                    parsed_data = None
                    if data_text != "":
                        try:
                            parsed_data = json.loads(data_text)
                        except Exception:
                            # leave as raw string if not JSON
                            parsed_data = data_text
                    events.append({"event": cur_event["event"] or "message", "data": parsed_data})
                cur_event = {"event": None, "data_lines": []}
                # stop if done event seen
                if any(ev["event"] == "done" for ev in events):
                    break
                continue

            if line.startswith("event:"):
                cur_event["event"] = line[len("event:"):].strip()
            elif line.startswith("data:"):
                cur_event["data_lines"].append(line[len("data:"):].lstrip())
            else:
                # Unexpected line; treat as data
                cur_event["data_lines"].append(line)

        # Finalize any pending event if stream ended without blank line
        if (cur_event["event"] is not None or cur_event["data_lines"]) and not any(ev for ev in events if ev.get("data") == cur_event.get("data_lines")):
            data_text = "\n".join(cur_event["data_lines"]).strip()
            parsed_data = None
            if data_text != "":
                try:
                    parsed_data = json.loads(data_text)
                except Exception:
                    parsed_data = data_text
            events.append({"event": cur_event["event"] or "message", "data": parsed_data})

        # Basic expectations
        assert len(events) > 0, "No SSE events received"

        # First event must be 'stage' with {"stage": "treatment"}
        first = events[0]
        assert first["event"] == "stage", f"First event expected to be 'stage', got '{first['event']}'"
        assert isinstance(first["data"], dict), f"Stage event data should be JSON object, got {type(first['data']).__name__}"
        assert first["data"].get("stage") == "treatment", f"Expected stage 'treatment', got {first['data'].get('stage')}"

        # Ensure presence and order: tool_use before herb_results before done
        indices = {}
        for idx, ev in enumerate(events):
            if ev["event"] not in indices:
                indices[ev["event"]] = idx

        assert "tool_use" in indices, "Missing tool_use event"
        assert "herb_results" in indices, "Missing herb_results event"
        assert "done" in indices, "Missing done event"

        assert indices["tool_use"] < indices["herb_results"], "tool_use should come before herb_results"
        assert indices["herb_results"] < indices["done"], "herb_results should come before done"

        # herb_results must contain non-empty herbs array
        herb_ev = events[indices["herb_results"]]
        assert isinstance(herb_ev["data"], dict), "herb_results data should be JSON object"
        herbs = herb_ev["data"].get("herbs")
        assert isinstance(herbs, list), f"herbs should be a list, got {type(herbs).__name__}"
        assert len(herbs) > 0, "herb_results.herbs should be non-empty"

        # At least one text_delta event must exist
        text_delta_exists = any(ev["event"] == "text_delta" for ev in events)
        assert text_delta_exists, "No text_delta events received"

    finally:
        if resp is not None:
            try:
                resp.close()
            except Exception:
                pass

if __name__ == "__main__":
    test_nutritionist_post_with_valid_messages_streaming_response()