import requests
import json
import sys

BASE_ENDPOINT = "http://localhost:54321/functions/v1"

def test_nutritionist_post_with_valid_messages_streaming_response():
    url = BASE_ENDPOINT.rstrip("/") + "/nutritionist"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "I have trouble sleeping. Can you recommend some herbs and how to use them?"
            }
        ]
    }

    try:
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(payload), stream=True, timeout=120)
        except requests.RequestException as e:
            raise AssertionError(f"HTTP request failed: {e}")

        # Basic response validations
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}. Body start: {resp.text[:500]}"
        content_type = resp.headers.get("Content-Type", "")
        assert "text/event-stream" in content_type, f"Expected Content-Type to include 'text/event-stream', got '{content_type}'"

        # Parse SSE stream
        found_tool_use = False
        found_herb_results = False
        found_text_delta = False
        found_done = False
        events = []  # list of (event_name, parsed_data)

        buffer = []
        try:
            for raw_line in resp.iter_lines(decode_unicode=True):
                # iter_lines yields '' between events; skip if None
                if raw_line is None:
                    continue
                line = raw_line.rstrip("\r\n")
                # SSE blank line denotes dispatch
                if line == "":
                    if not buffer:
                        continue
                    event_name = None
                    data_lines = []
                    for l in buffer:
                        if l.startswith("event:"):
                            event_name = l[len("event:"):].strip()
                        elif l.startswith("data:"):
                            data_lines.append(l[len("data:"):].strip())
                    data_text = "\n".join(data_lines).strip()
                    parsed = None
                    if data_text:
                        try:
                            parsed = json.loads(data_text)
                        except Exception:
                            parsed = data_text
                    events.append((event_name, parsed))

                    if event_name == "tool_use":
                        found_tool_use = True
                        # basic shape: { name, input }
                        if isinstance(parsed, dict):
                            assert "name" in parsed and "input" in parsed, f"tool_use event missing fields: {parsed}"
                    elif event_name == "herb_results":
                        found_herb_results = True
                        # expect herbs array
                        if isinstance(parsed, dict):
                            herbs = parsed.get("herbs") or parsed.get("results")
                            assert isinstance(herbs, list), f"herb_results event does not contain a herbs list: {parsed}"
                    elif event_name == "text_delta":
                        found_text_delta = True
                        # data may be partial text or object; ensure non-empty
                        assert parsed is not None and (isinstance(parsed, str) and parsed.strip() != "" or isinstance(parsed, dict)), f"text_delta event has no content: {parsed}"
                    elif event_name == "done":
                        found_done = True
                        # done event typically ends the stream; stop reading further
                        break

                    buffer = []
                else:
                    buffer.append(line)
        finally:
            resp.close()

        assert found_tool_use, f"Did not receive tool_use event. Events seen: {[e[0] for e in events]}"
        assert found_herb_results, f"Did not receive herb_results event. Events seen: {[e[0] for e in events]}"
        assert found_text_delta, f"Did not receive text_delta event. Events seen: {[e[0] for e in events]}"
        assert found_done, f"Did not receive done event. Events seen: {[e[0] for e in events]}"

        # Additional validation: herb_results contains at least one herb with expected fields
        for ev_name, ev_data in events:
            if ev_name == "herb_results" and isinstance(ev_data, dict):
                herbs = ev_data.get("herbs") or ev_data.get("results")
                assert isinstance(herbs, list) and len(herbs) > 0, f"herb_results should include at least one herb, got: {herbs}"
                herb = herbs[0]
                # check for common herb fields
                assert isinstance(herb, dict), f"herb entry is not an object: {herb}"
                required_fields = ["id", "name", "description"]
                for f in required_fields:
                    assert f in herb, f"herb entry missing '{f}': {herb}"
                break

        print("test_nutritionist_post_with_valid_messages_streaming_response: PASSED")

    except AssertionError as ae:
        print(f"test_nutritionist_post_with_valid_messages_streaming_response: FAILED - {ae}", file=sys.stderr)
        raise

if __name__ == "__main__":
    test_nutritionist_post_with_valid_messages_streaming_response()