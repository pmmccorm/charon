/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest } from "../lib/api";

const ACCESS_TOKEN_KEY = "charon_access_token";
const REFRESH_TOKEN_KEY = "charon_refresh_token";

const AuthContext = createContext(null);

function loadToken(key) {
  return window.localStorage.getItem(key);
}

function saveToken(key, value) {
  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => loadToken(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState(() => loadToken(REFRESH_TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistTokens = useCallback((access, refresh) => {
    saveToken(ACCESS_TOKEN_KEY, access || null);
    saveToken(REFRESH_TOKEN_KEY, refresh || null);
    setAccessToken(access || null);
    setRefreshToken(refresh || null);
  }, []);

  const clearSession = useCallback(() => {
    persistTokens(null, null);
    setUser(null);
  }, [persistTokens]);

  const fetchCurrentUser = useCallback(async (token) => {
    const profile = await apiRequest("/auth/me/", { token });
    setUser(profile);
    return profile;
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) {
      throw new Error("No refresh token available.");
    }
    const payload = await apiRequest("/auth/token/refresh/", {
      method: "POST",
      data: { refresh: refreshToken },
    });
    persistTokens(payload.access, payload.refresh || refreshToken);
    return payload.access;
  }, [persistTokens, refreshToken]);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        await fetchCurrentUser(accessToken);
      } catch (error) {
        if (error.status === 401 && refreshToken) {
          try {
            const refreshedAccessToken = await refreshAccessToken();
            if (!isCancelled) {
              await fetchCurrentUser(refreshedAccessToken);
            }
          } catch {
            if (!isCancelled) {
              clearSession();
            }
          }
        } else if (!isCancelled) {
          clearSession();
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      isCancelled = true;
    };
  }, [
    accessToken,
    clearSession,
    fetchCurrentUser,
    refreshAccessToken,
    refreshToken,
  ]);

  const login = useCallback(
    async ({ username, password }) => {
      const tokens = await apiRequest("/auth/token/", {
        method: "POST",
        data: { username, password },
      });
      persistTokens(tokens.access, tokens.refresh);
      return fetchCurrentUser(tokens.access);
    },
    [fetchCurrentUser, persistTokens],
  );

  const register = useCallback(
    async (payload) => {
      await apiRequest("/auth/register/", { method: "POST", data: payload });
      return login({ username: payload.username, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const authenticatedRequest = useCallback(
    async (path, options = {}) => {
      if (!accessToken) {
        throw new Error("You are not authenticated.");
      }

      try {
        return await apiRequest(path, { ...options, token: accessToken });
      } catch (error) {
        if (error.status !== 401 || !refreshToken) {
          throw error;
        }
        const refreshedAccessToken = await refreshAccessToken();
        return apiRequest(path, { ...options, token: refreshedAccessToken });
      }
    },
    [accessToken, refreshAccessToken, refreshToken],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      accessToken,
      refreshToken,
      login,
      register,
      logout,
      authenticatedRequest,
    }),
    [
      accessToken,
      authenticatedRequest,
      loading,
      login,
      logout,
      refreshToken,
      register,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
