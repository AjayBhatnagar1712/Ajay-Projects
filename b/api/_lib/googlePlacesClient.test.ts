import { describe, expect, it, vi } from "vitest";
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  GooglePlacesRequestError,
  readGooglePlacesApiKey,
  type PlacesFetch,
} from "./googlePlacesClient";

describe("readGooglePlacesApiKey", () => {
  it("returns trimmed key when set", () => {
    expect(readGooglePlacesApiKey({ GOOGLE_PLACES_API_KEY: "  abc  " })).toBe(
      "abc",
    );
  });

  it("returns null when missing", () => {
    expect(readGooglePlacesApiKey({})).toBeNull();
  });
});

describe("fetchPlaceAutocomplete", () => {
  it("maps India-biased suggestions and sends session token", async () => {
    const fetchImpl: PlacesFetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        includedRegionCodes?: string[];
        sessionToken?: string;
        input?: string;
      };
      expect(body.includedRegionCodes).toEqual(["IN"]);
      expect(body.sessionToken).toBe("session-1");
      expect(body.input).toBe("Hyder");
      expect(init?.headers?.["X-Goog-Api-Key"]).toBe("test-key");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ1",
                structuredFormat: {
                  mainText: { text: "Hyderabad" },
                  secondaryText: { text: "Telangana, India" },
                },
              },
            },
          ],
        }),
      };
    };

    const result = await fetchPlaceAutocomplete(
      { apiKey: "test-key", fetchImpl },
      "Hyder",
      "session-1",
    );

    expect(result.suggestions).toEqual([
      {
        placeId: "ChIJ1",
        primaryText: "Hyderabad",
        secondaryText: "Telangana, India",
      },
    ]);
  });

  it("throws GooglePlacesRequestError on upstream failure", async () => {
    const fetchImpl: PlacesFetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    await expect(
      fetchPlaceAutocomplete(
        { apiKey: "test-key", fetchImpl },
        "x",
        "session-1",
      ),
    ).rejects.toBeInstanceOf(GooglePlacesRequestError);
  });
});

describe("fetchPlaceDetails", () => {
  it("derives region and pincode and terminates the session", async () => {
    const fetchImpl: PlacesFetch = async (url, init) => {
      expect(String(url)).toContain("sessionToken=session-2");
      expect(init?.headers?.["X-Goog-FieldMask"]).toContain("addressComponents");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "places/ChIJ2",
          formattedAddress: "Gachibowli, Hyderabad, Telangana 500032, India",
          displayName: { text: "Gachibowli" },
          addressComponents: [
            { longText: "500032", types: ["postal_code"] },
            { longText: "Hyderabad", types: ["locality", "political"] },
          ],
        }),
      };
    };

    const result = await fetchPlaceDetails(
      { apiKey: "test-key", fetchImpl },
      "ChIJ2",
      "session-2",
    );

    expect(result).toEqual({
      placeId: "ChIJ2",
      formattedAddress: "Gachibowli, Hyderabad, Telangana 500032, India",
      region: "Gachibowli",
      pincode: "500032",
      missingPincode: false,
    });
  });

  it("prefers displayName over city locality when both are present", async () => {
    const fetchImpl: PlacesFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "places/ChIJ_madhapur",
        formattedAddress: "Madhapur, Hyderabad, Telangana, India",
        displayName: { text: "Madhapur" },
        addressComponents: [
          { longText: "Hyderabad", types: ["locality", "political"] },
          {
            longText: "Telangana",
            types: ["administrative_area_level_1", "political"],
          },
        ],
      }),
    });

    const result = await fetchPlaceDetails(
      { apiKey: "test-key", fetchImpl },
      "ChIJ_madhapur",
      "session-madhapur",
    );

    expect(result.region).toBe("Madhapur");
  });

  it("flags missing pincode without crashing", async () => {
    const fetchImpl: PlacesFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "places/ChIJ3",
        formattedAddress: "Some locality, India",
        addressComponents: [
          { longText: "Pune", types: ["locality", "political"] },
        ],
      }),
    });

    const result = await fetchPlaceDetails(
      { apiKey: "test-key", fetchImpl },
      "places/ChIJ3",
      "session-3",
    );

    expect(result.region).toBe("Pune");
    expect(result.pincode).toBeNull();
    expect(result.missingPincode).toBe(true);
  });
});
