/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { loadAppData, saveAppData, STORAGE_KEY } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
  });

  it("loads defaults when storage is empty", () => {
    const data = loadAppData();

    expect(data.version).toBe(1);
    expect(data.creatures.length).toBeGreaterThan(0);
  });

  it("saves and loads app data", () => {
    const data = createDefaultData();
    const changed = { ...data, creatures: [{ ...data.creatures[0], name: "已保存" }] };

    saveAppData(changed);

    expect(loadAppData().creatures[0].name).toBe("已保存");
  });

  it("falls back to defaults for malformed storage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");

    expect(loadAppData().version).toBe(1);
  });
});
