import { describe, expect, it } from "vitest";
import {
  selectionIsDuplicate,
  selectionsFromProfile,
  selectionsReadyToSubmit,
  selectionsToProfileFields,
  type WorkLocationSelection,
} from "./workLocationSelections";

const base: WorkLocationSelection = {
  key: "ChIJ1",
  label: "Hyderabad · 500032",
  region: "Hyderabad",
  pincode: "500032",
};

describe("selectionsToProfileFields", () => {
  it("joins unique regions and collects pincodes", () => {
    expect(
      selectionsToProfileFields([
        base,
        {
          key: "ChIJ2",
          label: "Gachibowli · 500032",
          region: "Hyderabad",
          pincode: "500032",
        },
        {
          key: "ChIJ3",
          label: "Mumbai · 400001",
          region: "Mumbai",
          pincode: "400001",
        },
      ]),
    ).toEqual({
      region: "Hyderabad, Mumbai",
      pincodes: ["500032", "400001"],
    });
  });

  it("keeps distinct neighbourhoods in the same city as separate region parts", () => {
    expect(
      selectionsToProfileFields([
        {
          key: "ChIJ_gachibowli",
          label: "Gachibowli",
          region: "Gachibowli",
          pincode: null,
        },
        {
          key: "ChIJ_madhapur",
          label: "Madhapur",
          region: "Madhapur",
          pincode: null,
        },
        {
          key: "ChIJ_fd",
          label: "Financial District",
          region: "Financial District",
          pincode: null,
        },
      ]),
    ).toEqual({
      region: "Gachibowli, Madhapur, Financial District",
      pincodes: [],
    });
  });

  it("allows region-only selections with an empty pincodes list", () => {
    expect(
      selectionsToProfileFields([
        { key: "ChIJ4", label: "Pune", region: "Pune", pincode: null },
      ]),
    ).toEqual({ region: "Pune", pincodes: [] });
  });
});

describe("selectionIsDuplicate", () => {
  it("detects the same placeId", () => {
    expect(selectionIsDuplicate([base], { key: "ChIJ1" })).toBe(true);
  });

  it("allows distinct placeIds even when derived region matches and pincode is null", () => {
    expect(
      selectionIsDuplicate(
        [
          {
            key: "ChIJ_gachibowli",
            label: "Gachibowli, Hyderabad",
            region: "Hyderabad",
            pincode: null,
          },
        ],
        { key: "ChIJ_madhapur" },
      ),
    ).toBe(false);
  });

  it("still blocks adding the exact same place twice", () => {
    expect(
      selectionIsDuplicate(
        [
          {
            key: "ChIJ_gachibowli",
            label: "Gachibowli",
            region: "Hyderabad",
            pincode: null,
          },
        ],
        { key: "ChIJ_gachibowli" },
      ),
    ).toBe(true);
  });
});

describe("selectionsFromProfile", () => {
  it("rebuilds one chip per pincode", () => {
    expect(
      selectionsFromProfile({
        region: "Hyderabad, Mumbai",
        pincodes: ["500032", "400001"],
      }),
    ).toEqual([
      {
        key: "saved:pin:500032",
        label: "Hyderabad · 500032",
        region: "Hyderabad",
        pincode: "500032",
      },
      {
        key: "saved:pin:400001",
        label: "Mumbai · 400001",
        region: "Mumbai",
        pincode: "400001",
      },
    ]);
  });

  it("rebuilds region-only chips when pincodes are empty", () => {
    expect(
      selectionsFromProfile({ region: "Hyderabad, Pune", pincodes: [] }),
    ).toEqual([
      {
        key: "saved:region:0:Hyderabad",
        label: "Hyderabad",
        region: "Hyderabad",
        pincode: null,
      },
      {
        key: "saved:region:1:Pune",
        label: "Pune",
        region: "Pune",
        pincode: null,
      },
    ]);
  });
});

describe("selectionsReadyToSubmit", () => {
  it("requires a region but not a pincode", () => {
    expect(selectionsReadyToSubmit([base])).toBe(true);
    expect(
      selectionsReadyToSubmit([
        { key: "a", label: "Pune", region: "Pune", pincode: null },
      ]),
    ).toBe(true);
    expect(selectionsReadyToSubmit([])).toBe(false);
  });
});
