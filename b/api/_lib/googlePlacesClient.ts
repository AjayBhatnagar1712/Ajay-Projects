/**
 * Server-side Google Places API (New) client.
 * API key stays on the server — never exposed to mobile/web clients.
 */
import {
  derivePincodeFromAddressComponents,
  deriveRegionFromAddressComponents,
  type PlacesAddressComponent,
} from "./locationDerive.js";
import type {
  LocationAutocompleteResponse,
  LocationDetailsResponse,
  LocationSuggestion,
} from "./locationSchemas.js";

const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_DETAILS_BASE = "https://places.googleapis.com/v1/places/";

const PLACES_TIMEOUT_MS = 8_000;

/** Minimal fetch shape — avoids Vercel/Node `Response` type clashes during function compile. */
export type PlacesFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type PlacesFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<PlacesFetchResponse>;

export type GooglePlacesConfig = {
  apiKey: string;
  fetchImpl?: PlacesFetch;
};

export class GooglePlacesUnavailableError extends Error {
  readonly code = "PLACES_UNAVAILABLE" as const;

  constructor(message = "Location search is not configured") {
    super(message);
    this.name = "GooglePlacesUnavailableError";
  }
}

export class GooglePlacesRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GooglePlacesRequestError";
    this.status = status;
  }
}

export function readGooglePlacesApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const key = env.GOOGLE_PLACES_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

type AutocompletePrediction = {
  placeId?: string;
  place?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type AutocompleteApiResponse = {
  suggestions?: Array<{ placePrediction?: AutocompletePrediction }>;
};

type PlaceDetailsApiResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  addressComponents?: PlacesAddressComponent[];
};

function requireApiKey(config: GooglePlacesConfig): string {
  const key = config.apiKey.trim();
  if (!key) {
    throw new GooglePlacesUnavailableError();
  }
  return key;
}

async function defaultPlacesFetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<PlacesFetchResponse> {
  // Vercel's function TypeScript compile does not treat global fetch's Response
  // as the Fetch API Response (no ok/status/json). Narrow at runtime instead.
  const raw: unknown = await fetch(input, init);
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("ok" in raw) ||
    !("status" in raw) ||
    !("json" in raw)
  ) {
    throw new GooglePlacesRequestError(500, "Unexpected fetch response shape");
  }
  const okValue = Reflect.get(raw, "ok");
  const statusValue = Reflect.get(raw, "status");
  const jsonValue = Reflect.get(raw, "json");
  if (
    typeof okValue !== "boolean" ||
    typeof statusValue !== "number" ||
    typeof jsonValue !== "function"
  ) {
    throw new GooglePlacesRequestError(500, "Unexpected fetch response shape");
  }
  return {
    ok: okValue,
    status: statusValue,
    json: async () => {
      const maybePromise: unknown = Reflect.apply(jsonValue, raw, []);
      return await Promise.resolve(maybePromise);
    },
  };
}

function placeIdFromPrediction(prediction: AutocompletePrediction): string {
  if (prediction.placeId && prediction.placeId.length > 0) {
    return prediction.placeId;
  }
  const place = prediction.place?.trim() ?? "";
  if (place.startsWith("places/")) {
    return place.slice("places/".length);
  }
  return place;
}

function mapSuggestion(prediction: AutocompletePrediction): LocationSuggestion | null {
  const placeId = placeIdFromPrediction(prediction);
  if (!placeId) return null;
  const primaryText =
    prediction.structuredFormat?.mainText?.text?.trim() ||
    prediction.text?.text?.trim() ||
    "";
  if (!primaryText) return null;
  const secondaryText =
    prediction.structuredFormat?.secondaryText?.text?.trim() || "";
  return { placeId, primaryText, secondaryText };
}

export async function fetchPlaceAutocomplete(
  config: GooglePlacesConfig,
  input: string,
  sessionToken: string,
): Promise<LocationAutocompleteResponse> {
  const apiKey = requireApiKey(config);
  const fetchImpl = config.fetchImpl ?? defaultPlacesFetch;

  const response = await fetchImpl(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["IN"],
      sessionToken,
    }),
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new GooglePlacesRequestError(
      response.status,
      `Places autocomplete failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as AutocompleteApiResponse;
  const suggestions: LocationSuggestion[] = [];
  for (const item of payload.suggestions ?? []) {
    const mapped = item.placePrediction
      ? mapSuggestion(item.placePrediction)
      : null;
    if (mapped) suggestions.push(mapped);
  }
  return { suggestions };
}

export async function fetchPlaceDetails(
  config: GooglePlacesConfig,
  placeId: string,
  sessionToken: string,
): Promise<LocationDetailsResponse> {
  const apiKey = requireApiKey(config);
  const fetchImpl = config.fetchImpl ?? defaultPlacesFetch;

  const normalizedId = placeId.startsWith("places/")
    ? placeId.slice("places/".length)
    : placeId;
  const url = new URL(
    `${PLACES_DETAILS_BASE}${encodeURIComponent(normalizedId)}`,
  );
  url.searchParams.set("sessionToken", sessionToken);

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,formattedAddress,addressComponents,displayName",
    },
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new GooglePlacesRequestError(
      response.status,
      `Place details failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as PlaceDetailsApiResponse;
  const components = payload.addressComponents ?? [];
  // displayName is the place the broker picked (e.g. "Gachibowli"). Address
  // components often only expose city locality ("Hyderabad") — prefer the
  // specific name so region storage matches onboarding chips / profile.
  const region =
    payload.displayName?.text?.trim() ||
    deriveRegionFromAddressComponents(components) ||
    "";
  const pincode = derivePincodeFromAddressComponents(components);
  const formattedAddress =
    payload.formattedAddress?.trim() ||
    payload.displayName?.text?.trim() ||
    region;

  return {
    placeId: normalizedId,
    formattedAddress,
    region,
    pincode,
    missingPincode: pincode === null,
  };
}
