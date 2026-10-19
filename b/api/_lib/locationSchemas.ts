import { z } from "zod";

export const LocationAutocompleteRequestSchema = z.object({
  input: z.string().trim().min(1).max(200),
  sessionToken: z.string().trim().min(8).max(128),
});

export const LocationDetailsRequestSchema = z.object({
  placeId: z.string().trim().min(1).max(256),
  sessionToken: z.string().trim().min(8).max(128),
});

export const LocationSuggestionSchema = z.object({
  placeId: z.string(),
  primaryText: z.string(),
  secondaryText: z.string(),
});

export const LocationAutocompleteResponseSchema = z.object({
  suggestions: z.array(LocationSuggestionSchema),
});

export const LocationDetailsResponseSchema = z.object({
  placeId: z.string(),
  formattedAddress: z.string(),
  region: z.string(),
  pincode: z.string().nullable(),
  missingPincode: z.boolean(),
});

export type LocationAutocompleteRequest = z.infer<
  typeof LocationAutocompleteRequestSchema
>;
export type LocationDetailsRequest = z.infer<typeof LocationDetailsRequestSchema>;
export type LocationSuggestion = z.infer<typeof LocationSuggestionSchema>;
export type LocationAutocompleteResponse = z.infer<
  typeof LocationAutocompleteResponseSchema
>;
export type LocationDetailsResponse = z.infer<typeof LocationDetailsResponseSchema>;
