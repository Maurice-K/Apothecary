const NUTRITIONIST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutritionist`;

export async function streamNutritionist(messages, callbacks) {
  const { onTextDelta, onHerbResults, onToolUse, onDone, onError } = callbacks;

  let response;
  try {
    response = await fetch(NUTRITIONIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ messages }),
    });
  } catch (err) {
    onError?.({ type: "network", message: err.message ?? "Network error" });
    return;
  }

  if (!response.ok) {
    let data = {};
    try {
      data = await response.json();
    } catch {}
    if (response.status === 429) {
      const retryAfter =
        data.retry_after_seconds ??
        parseInt(response.headers.get("Retry-After") ?? "60", 10);
      onError?.({ type: "rate_limit", retry_after_seconds: retryAfter });
    } else {
      onError?.({
        type: "http",
        message: data.error ?? `Request failed (${response.status})`,
      });
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        let eventName = null;
        let dataStr = null;
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr = line.slice(6);
        }
        if (!eventName || !dataStr) continue;
        let parsed;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (eventName === "text_delta") onTextDelta?.(parsed.delta);
        else if (eventName === "herb_results") onHerbResults?.(parsed.herbs);
        else if (eventName === "tool_use") onToolUse?.(parsed);
        else if (eventName === "done") onDone?.();
        else if (eventName === "error")
          onError?.({ type: "agent", message: parsed.message });
      }
    }
  } catch (err) {
    onError?.({ type: "stream", message: err.message ?? "Stream read error" });
  } finally {
    reader.releaseLock();
  }
}
