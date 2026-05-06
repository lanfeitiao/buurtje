import { cityFromArea, cityFromPostcodeData } from "@/lib/cityFromResult";

describe("cityFromResult", () => {
  describe("cityFromArea", () => {
    test("returns gemeente as-is", () => {
      expect(cityFromArea({ gemeente: "Amsterdam" })).toBe("Amsterdam");
    });

    test("trims whitespace", () => {
      expect(cityFromArea({ gemeente: "  Amsterdam  " })).toBe("Amsterdam");
    });

    test("empty string for empty input", () => {
      expect(cityFromArea({ gemeente: "" })).toBe("");
    });
  });

  describe("cityFromPostcodeData", () => {
    test("takes the first comma-separated token", () => {
      expect(cityFromPostcodeData("Amsterdam, Noord-Holland")).toBe("Amsterdam");
    });

    test("returns the whole string when no comma", () => {
      expect(cityFromPostcodeData("Amsterdam")).toBe("Amsterdam");
    });

    test('treats the scraper sentinel "Unknown" as empty', () => {
      expect(cityFromPostcodeData("Unknown")).toBe("");
    });

    test("empty string for empty input", () => {
      expect(cityFromPostcodeData("")).toBe("");
    });

    test("trims whitespace around the gemeente", () => {
      expect(cityFromPostcodeData("  Amsterdam  ,  Noord-Holland")).toBe("Amsterdam");
    });
  });
});
