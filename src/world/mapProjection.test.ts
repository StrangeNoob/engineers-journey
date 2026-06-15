import { describe, it, expect } from "vitest";
import { mapBounds, worldToMap, type Bounds, type MapView } from "./mapProjection";

describe("mapBounds", () => {
  it("encloses the far villages and road extents", () => {
    const b = mapBounds();
    expect(b.minX).toBeLessThanOrEqual(-68);  // Shire (west)
    expect(b.maxX).toBeGreaterThanOrEqual(91); // Minas (east)
    expect(b.minZ).toBeLessThanOrEqual(-57);   // Edoras (north)
    expect(b.maxZ).toBeGreaterThanOrEqual(55);  // road start (south)
  });
});

describe("worldToMap", () => {
  const b: Bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 50 };
  const v: MapView = { w: 200, h: 200, pad: 10 };
  it("maps the bounds min corner to the padded, centered top-left", () => {
    const p = worldToMap(0, 0, b, v); // scale=1.8, content 180x90, centered → (10,55)
    expect(p.px).toBeCloseTo(10); expect(p.py).toBeCloseTo(55);
  });
  it("maps the bounds max corner to the far content corner", () => {
    const p = worldToMap(100, 50, b, v);
    expect(p.px).toBeCloseTo(190); expect(p.py).toBeCloseTo(145);
  });
  it("north (smaller z) maps higher on screen than south (larger z)", () => {
    expect(worldToMap(50, 0, b, v).py).toBeLessThan(worldToMap(50, 50, b, v).py);
  });
});
