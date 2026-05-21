/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { exportAppData, parseImportedData } from "./importExport";

describe("import export", () => {
  it("exports formatted JSON", () => {
    const json = exportAppData(createDefaultData());

    expect(JSON.parse(json).version).toBe(1);
    expect(json).toContain("\n");
  });

  it("parses valid imported data", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.creatures).toHaveLength(data.creatures.length);
  });

  it("rejects malformed JSON", () => {
    const result = parseImportedData("not json");

    expect(result).toEqual({ ok: false, error: "导入文件不是有效的 JSON。" });
  });

  it("rejects data with missing required fields", () => {
    const result = parseImportedData(JSON.stringify({ version: 1, creatures: [] }));

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });
});
