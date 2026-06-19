import { describe, it, expect, beforeEach } from "vitest";
import { Journal } from "./journal";

// Node 26's experimental localStorage global is unavailable without --localstorage-file,
// and the jsdom env doesn't reliably expose one here — provide a minimal in-memory stub
// so the Journal's persistence (localStorage) is testable independent of the runtime.
const store = new Map<string, string>();
(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

beforeEach(() => localStorage.clear());

describe("Journal", () => {
  it("starts empty", () => { expect(new Journal(["a", "b"]).count).toBe(0); });
  it("records a recall once", () => {
    const j = new Journal(["a", "b"]); j.recall("a"); j.recall("a");
    expect(j.count).toBe(1); expect(j.isVisited("a")).toBe(true);
  });
  it("persists across instances", () => {
    new Journal(["a", "b"]).recall("b");
    expect(new Journal(["a", "b"]).isVisited("b")).toBe(true);
  });
});
