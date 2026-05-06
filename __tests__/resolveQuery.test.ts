import { stripCBSPrefix, buildAreaSlug } from "@/lib/resolveQuery";

describe("stripCBSPrefix", () => {
  test("strips 'Wijk NN ' prefix used by CBS for numbered wijken", () => {
    expect(stripCBSPrefix("Wijk 08 Zuidwest")).toBe("Zuidwest");
    expect(stripCBSPrefix("Wijk 10 Vleuten-De Meern")).toBe("Vleuten-De Meern");
    expect(stripCBSPrefix("Wijk 50 Bedrijventerreinen")).toBe("Bedrijventerreinen");
  });

  test("strips 'Buurt NN ' prefix as well", () => {
    expect(stripCBSPrefix("Buurt 03 Centrum")).toBe("Centrum");
  });

  test("leaves names without numbered prefix unchanged", () => {
    expect(stripCBSPrefix("Heldenbuurt")).toBe("Heldenbuurt");
    expect(stripCBSPrefix("Zuidwest")).toBe("Zuidwest");
  });

  test("does not strip when 'Wijk' is part of a real name without a number", () => {
    expect(stripCBSPrefix("Wijk aan Zee")).toBe("Wijk aan Zee");
  });
});

describe("buildAreaSlug", () => {
  test("produces the slug allecijfers.nl uses for Utrecht wijken", () => {
    expect(buildAreaSlug("Wijk 08 Zuidwest", "Utrecht")).toBe("zuidwest-utrecht");
    expect(buildAreaSlug("Wijk 01 West", "Utrecht")).toBe("west-utrecht");
    expect(buildAreaSlug("Wijk 06 Binnenstad", "Utrecht")).toBe("binnenstad-utrecht");
  });

  test("preserves slug for unprefixed names", () => {
    expect(buildAreaSlug("Heldenbuurt", "Amstelveen")).toBe("heldenbuurt-amstelveen");
  });

  test("translates CBS gemeente names to allecijfers.nl URL form", () => {
    expect(buildAreaSlug("Wijk 28 Centrum", "'s-Gravenhage")).toBe("centrum-den-haag");
    expect(buildAreaSlug("Binnenstad", "'s-Hertogenbosch")).toBe("binnenstad-den-bosch");
    expect(buildAreaSlug("Afferden", "Bergen (L)")).toBe("afferden-bergen-limburg");
    expect(buildAreaSlug("Schoorl", "Bergen (NH)")).toBe("schoorl-bergen-noord-holland");
  });
});
