// Reads the chat's newline-delimited JSON events (status, listings, delta, done, error) as they arrive.
export async function streamChat({ token, body, onEvent }) {
  const controller = new AbortController();
  const failure = "The answer didn't come through. Please try again.";
  let idleTimer;
  let totalTimer;
  let rejectTimeout;
  const timedOut = new Promise((_, reject) => { rejectTimeout = reject; });
  const abort = () => {
    controller.abort();
    rejectTimeout(new Error("Chat stream timed out"));
  };
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(abort, 30_000);
  };
  totalTimer = setTimeout(abort, 70_000);
  resetIdleTimer();

  try {
    await Promise.race([timedOut, (async () => {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        onEvent({ type: "error", text: data.answer ?? data.detail ?? "Something went wrong. Please try again." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let malformedLines = 0;
      let sawDone = false;
      let sawError = false;
      const emitLine = (line) => {
        if (!line) return;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          malformedLines += 1;
          return;
        }
        if (event.type === "done") sawDone = true;
        if (event.type === "error") sawError = true;
        onEvent(event);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (controller.signal.aborted) return;
        if (done) break;
        if (value?.byteLength) resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          emitLine(buffer.slice(0, newline).trim());
          buffer = buffer.slice(newline + 1);
        }
      }
      emitLine((buffer + decoder.decode()).trim());
      if (!sawDone && !sawError) {
        onEvent({ type: "error", text: "The answer was cut off. Please try again.", malformedLines });
      }
    })()]);
  } catch {
    onEvent({ type: "error", text: failure });
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  }
}
