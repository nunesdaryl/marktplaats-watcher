import { afterEach, expect, test, vi } from "vitest";
import { streamChat } from "./stream.js";

const failure = "The answer didn't come through. Please try again.";
const encode = (text) => new TextEncoder().encode(text);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("passes normal stream events through unchanged", async () => {
  const events = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encode('{"type":"status","text":"Thinking"}\n{"type":"del'));
        controller.enqueue(encode('ta","text":"Hello"}\n{"type":"done","answer":"Hello"}\n'));
        controller.close();
      },
    }),
  })));

  await streamChat({ token: "token", body: { message: "hi" }, onEvent: (event) => events.push(event) });

  expect(events).toEqual([
    { type: "status", text: "Thinking" },
    { type: "delta", text: "Hello" },
    { type: "done", answer: "Hello" },
  ]);
});

test("skips malformed lines and reports their count when done is missing", async () => {
  const events = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encode('{broken}\n{"type":"delta","text":"partial"}\n{broken again}\n'));
        controller.close();
      },
    }),
  })));

  await streamChat({ token: "token", body: {}, onEvent: (event) => events.push(event) });

  expect(events).toEqual([
    { type: "delta", text: "partial" },
    { type: "error", text: "The answer was cut off. Please try again.", malformedLines: 2 },
  ]);
});

test("aborts and reports an error after 30 seconds without bytes", async () => {
  vi.useFakeTimers();
  const events = [];
  let signal;
  vi.stubGlobal("fetch", vi.fn((_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }));

  const request = streamChat({ token: "token", body: {}, onEvent: (event) => events.push(event) });
  await vi.advanceTimersByTimeAsync(30_000);
  await request;

  expect(signal.aborted).toBe(true);
  expect(events).toEqual([{ type: "error", text: failure }]);
});

test("aborts after 70 seconds even when bytes keep arriving", async () => {
  vi.useFakeTimers();
  const events = [];
  let signal;
  let streamController;
  vi.stubGlobal("fetch", vi.fn(async (_, options) => {
    signal = options.signal;
    return { ok: true, body: new ReadableStream({ start(controller) { streamController = controller; } }) };
  }));

  const request = streamChat({ token: "token", body: {}, onEvent: (event) => events.push(event) });
  for (let i = 0; i < 3; i += 1) {
    await vi.advanceTimersByTimeAsync(20_000);
    streamController.enqueue(encode('{"type":"status","text":"Waiting"}\n'));
  }
  await vi.advanceTimersByTimeAsync(10_000);
  await request;

  expect(signal.aborted).toBe(true);
  expect(events.at(-1)).toEqual({ type: "error", text: failure });
});

test("reports a network error", async () => {
  const events = [];
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

  await streamChat({ token: "token", body: {}, onEvent: (event) => events.push(event) });

  expect(events).toEqual([{ type: "error", text: failure }]);
});

test("reports a network error when the connection drops during the stream", async () => {
  const events = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encode('{"type":"status","text":"Thinking"}\n'));
        controller.error(new Error("connection lost"));
      },
    }),
  })));

  await streamChat({ token: "token", body: {}, onEvent: (event) => events.push(event) });

  expect(events.at(-1)).toEqual({ type: "error", text: failure });
});
