/**
 * POST /api/v1/location-autocomplete
 * POST /api/v1/location-details
 *
 * JWT-scoped proxies to Google Places API (New). API key stays server-side.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  GooglePlacesRequestError,
  GooglePlacesUnavailableError,
  readGooglePlacesApiKey,
} from "./googlePlacesClient.js";
import { json, readJsonBody } from "./http.js";
import {
  LocationAutocompleteRequestSchema,
  LocationDetailsRequestSchema,
} from "./locationSchemas.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { assertJwtUserAuth } from "./syncAuth.js";

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  const auth = await assertJwtUserAuth(requestAuthorization(req));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return false;
  }
  return true;
}

function placesConfig() {
  const apiKey = readGooglePlacesApiKey();
  return { apiKey: apiKey ?? "" };
}

export async function handleLocationAutocompleteRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method?.toUpperCase() !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!(await requireAuth(req, res))) return;

  const body = LocationAutocompleteRequestSchema.safeParse(readJsonBody(req));
  if (!body.success) {
    json(res, 400, { error: body.error.issues });
    return;
  }

  const apiKey = readGooglePlacesApiKey();
  if (!apiKey) {
    json(res, 503, {
      error: "Location search unavailable",
      code: "PLACES_UNAVAILABLE",
    });
    return;
  }

  try {
    const result = await fetchPlaceAutocomplete(
      placesConfig(),
      body.data.input,
      body.data.sessionToken,
    );
    json(res, 200, result);
  } catch (err) {
    if (err instanceof GooglePlacesUnavailableError) {
      json(res, 503, {
        error: "Location search unavailable",
        code: "PLACES_UNAVAILABLE",
      });
      return;
    }
    if (err instanceof GooglePlacesRequestError) {
      console.error(
        "POST /api/v1/location-autocomplete upstream failed",
        sanitizeErrorForLog(err),
      );
      json(res, 502, {
        error: "Location search failed. Try again or enter manually.",
        code: "PLACES_UPSTREAM_ERROR",
      });
      return;
    }
    console.error(
      "POST /api/v1/location-autocomplete failed",
      sanitizeErrorForLog(err),
    );
    json(res, 500, { error: "Internal server error" });
  }
}

export async function handleLocationDetailsRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method?.toUpperCase() !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!(await requireAuth(req, res))) return;

  const body = LocationDetailsRequestSchema.safeParse(readJsonBody(req));
  if (!body.success) {
    json(res, 400, { error: body.error.issues });
    return;
  }

  const apiKey = readGooglePlacesApiKey();
  if (!apiKey) {
    json(res, 503, {
      error: "Location search unavailable",
      code: "PLACES_UNAVAILABLE",
    });
    return;
  }

  try {
    const result = await fetchPlaceDetails(
      placesConfig(),
      body.data.placeId,
      body.data.sessionToken,
    );
    if (!result.region.trim()) {
      json(res, 422, {
        error: "Could not determine a region for that place. Try another result.",
        code: "PLACES_REGION_MISSING",
      });
      return;
    }
    json(res, 200, result);
  } catch (err) {
    if (err instanceof GooglePlacesUnavailableError) {
      json(res, 503, {
        error: "Location search unavailable",
        code: "PLACES_UNAVAILABLE",
      });
      return;
    }
    if (err instanceof GooglePlacesRequestError) {
      console.error(
        "POST /api/v1/location-details upstream failed",
        sanitizeErrorForLog(err),
      );
      json(res, 502, {
        error: "Location details failed. Try again or enter manually.",
        code: "PLACES_UPSTREAM_ERROR",
      });
      return;
    }
    console.error(
      "POST /api/v1/location-details failed",
      sanitizeErrorForLog(err),
    );
    json(res, 500, { error: "Internal server error" });
  }
}
