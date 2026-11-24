import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, isPreviewSandboxMode, setAuthToken } from '../services/api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isPreviewMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    full_name: string;
    business_name: string;
    password: string;
    currency?: string;
  }) => Promise<void>;
  logout: () => void;
  updateProfile: (payload: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (isPreviewSandboxMode()) {
        // Restore sandbox session or auto-enter demo workspace seamlessly
        const savedUser = sessionStorage.getItem('demandiq_preview_user');
        if (savedUser && active) {
          setUser(JSON.parse(savedUser));
          setToken('preview-jwt-session');
          setAuthToken('preview-jwt-session');
        }
        setLoading(false);
        return;
      }

      const savedToken = sessionStorage.getItem('demandiq_access_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }
      setAuthToken(savedToken);
      try {
        const res = await apiClient.get<User>('/api/auth/me');
        if (active) {
          setUser(res.data);
          setToken(savedToken);
        }
      } catch {
        sessionStorage.removeItem('demandiq_access_token');
        setAuthToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{ access_token: string; user: User }>('/api/auth/login', {
      email,
      password,
    });
    const { access_token, user: loggedUser } = res.data;
    setAuthToken(access_token);
    setToken(access_token);
    setUser(loggedUser);
    if (isPreviewSandboxMode()) {
      sessionStorage.setItem('demandiq_preview_user', JSON.stringify(loggedUser));
    } else {
      sessionStorage.setItem('demandiq_access_token', access_token);
    }
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      full_name: string;
      business_name: string;
      password: string;
      currency?: string;
    }) => {
      const res = await apiClient.post<{ access_token: string; user: User }>('/api/auth/register', payload);
      const { access_token, user: createdUser } = res.data;
      setAuthToken(access_token);
      setToken(access_token);
      setUser(createdUser);
      if (isPreviewSandboxMode()) {
        sessionStorage.setItem('demandiq_preview_user', JSON.stringify(createdUser));
      } else {
        sessionStorage.setItem('demandiq_access_token', access_token);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('demandiq_access_token');
    sessionStorage.removeItem('demandiq_preview_user');
  }, []);

  const updateProfile = useCallback(async (payload: Partial<User>) => {
    const res = await apiClient.put<User>('/api/auth/me', payload);
    setUser(res.data);
    if (isPreviewSandboxMode()) {
      sessionStorage.setItem('demandiq_preview_user', JSON.stringify(res.data));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isPreviewMode: isPreviewSandboxMode(),
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
