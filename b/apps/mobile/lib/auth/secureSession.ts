import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "tk_mobile_access_token";
const REFRESH_TOKEN_KEY = "tk_mobile_refresh_token";
const PHONE_KEY = "tk_mobile_phone";
const ROLE_KEY = "tk_mobile_role";

export type StoredSession = {
  accessToken: string;
  refreshToken: string | null;
  phone: string | null;
  role: string | null;
};

export async function saveSessionTokens(input: {
  accessToken: string;
  refreshToken?: string | null;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, input.accessToken);
  if (input.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, input.refreshToken);
  }
}

export async function saveSessionIdentity(input: {
  phone?: string | null;
  role?: string | null;
}): Promise<void> {
  if (input.phone !== undefined) {
    if (input.phone) {
      await SecureStore.setItemAsync(PHONE_KEY, input.phone);
    } else {
      await SecureStore.deleteItemAsync(PHONE_KEY);
    }
  }
  if (input.role !== undefined) {
    if (input.role) {
      await SecureStore.setItemAsync(ROLE_KEY, input.role);
    } else {
      await SecureStore.deleteItemAsync(ROLE_KEY);
    }
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    return null;
  }
  const [refreshToken, phone, role] = await Promise.all([
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(PHONE_KEY),
    SecureStore.getItemAsync(ROLE_KEY),
  ]);
  return { accessToken, refreshToken, phone, role };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(PHONE_KEY),
    SecureStore.deleteItemAsync(ROLE_KEY),
  ]);
}
