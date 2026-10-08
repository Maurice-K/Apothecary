import requests
import json
from requests.exceptions import RequestException, Timeout

BASE_URL = "http://localhost:54321/functions/v1"

def test_nutritionist_vague_first_message_diagnoses_without_herb_cards():
    url = f"{BASE_URL}/nutritionist"
    headers = {"Content-Type": "application/json"}
    payload = {"messages": [{"role": "user", "content": "I can't sleep"}]}

    try:
        resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=(30, 120))
    except Timeout as e:
        assert False, f"Request timed out: {e}"
    except RequestException as e:
        assert False, f"Request failed: {e}"

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    content_type = resp.headers.get("Content-Type", "")
    assert "text/event-stream" in content_type, f"Expected Content-Type text/event-stream, got {content_type}"

    first_event_checked = False
    seen_herb_results = False
    seen_tool_use = False
    seen_text_delta = False
    seen_done = False
    text_delta_concat = ""

    current_lines = []
    try:
        for raw_line in resp.iter_lines(decode_unicode=True):
            # iter_lines yields '' for blank lines separating events
            if raw_line is None:
                continue
            line = raw_line
            if line == "":
                if not current_lines:
                    continue
                # process event
                event_name = None
                data_lines = []
                for l in current_lines:
                    if l.startswith("event:"):
                        event_name = l.split(":", 1)[1].strip()
                    elif l.startswith("data:"):
                        data_lines.append(l.split(":", 1)[1].lstrip())
                data_text = "\n".join(data_lines)
                # try parse JSON data; fallback to raw text
                try:
                    data_obj = json.loads(data_text) if data_text else None
                except Exception:
                    data_obj = data_text

                if not first_event_checked:
                    assert event_name == "stage", f"First event must be 'stage', got '{event_name}'"
                    assert isinstance(data_obj, dict) and data_obj.get("stage") == "diagnostic", f"First stage data must be {{'stage':'diagnostic'}}, got {data_obj}"
                    first_event_checked = True

                if event_name == "herb_results":
                    seen_herb_results = True
                if event_name == "tool_use":
                    seen_tool_use = True
                if event_name == "text_delta":
                    seen_text_delta = True
                    if isinstance(data_obj, dict):
                        delta = data_obj.get("delta", "")
                    else:
                        delta = data_text
                    text_delta_concat += delta or ""
                if event_name == "done":
                    seen_done = True
                    break

                current_lines = []
            else:
                current_lines.append(line)
        else:
            # If loop completes without encountering a blank-line-terminated event 'done', process any leftover
            if current_lines:
                event_name = None
                data_lines = []
                for l in current_lines:
                    if l.startswith("event:"):
                        event_name = l.split(":", 1)[1].strip()
                    elif l.startswith("data:"):
                        data_lines.append(l.split(":", 1)[1].lstrip())
                data_text = "\n".join(data_lines)
                try:
                    data_obj = json.loads(data_text) if data_text else None
                except Exception:
                    data_obj = data_text
                if not first_event_checked:
                    assert event_name == "stage", f"First event must be 'stage', got '{event_name}'"
                    assert isinstance(data_obj, dict) and data_obj.get("stage") == "diagnostic", f"First stage data must be {{'stage':'diagnostic'}}, got {data_obj}"
                    first_event_checked = True
                if event_name == "herb_results":
                    seen_herb_results = True
                if event_name == "tool_use":
                    seen_tool_use = True
                if event_name == "text_delta":
                    seen_text_delta = True
                    if isinstance(data_obj, dict):
                        delta = data_obj.get("delta", "")
                    else:
                        delta = data_text
                    text_delta_concat += delta or ""
                if event_name == "done":
                    seen_done = True

    except Timeout as e:
        assert False, f"Read timed out: {e}"
    except RequestException as e:
        assert False, f"Stream read failed: {e}"
    finally:
        resp.close()

    assert first_event_checked, "No events received"
    assert seen_text_delta, "Expected at least one text_delta event"
    assert seen_done, "Expected a done event at the end of the stream"
    assert not seen_herb_results, "Stream must NOT contain herb_results events"
    assert not seen_tool_use, "Stream must NOT contain tool_use events"
    assert "?" in text_delta_concat, "Concatenated text_delta content must contain a question mark"

if __name__ == "__main__":
    test_nutritionist_vague_first_message_diagnoses_without_herb_cards()