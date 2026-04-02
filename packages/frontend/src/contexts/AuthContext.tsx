import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  nome: string;
  idade: number;
  celular: string;
  foto_url: string | null;
  role: string;
  tenant_id: string | null;
}

interface TokenPayload {
  user_id: string;
  tenant_id: string | null;
  role: string;
  exp: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  setTokenAndUser: (token: string, user: User) => void;
}

interface RegisterData {
  email: string;
  senha: string;
  nome: string;
  idade: number;
  celular: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeJwt(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Check token expiration on mount and validate with backend
  useEffect(() => {
    if (token) {
      const payload = decodeJwt(token);
      if (!payload || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        return;
      }
      // Validate token is still valid by calling a lightweight endpoint
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {
        // If network error, keep the token (might be offline)
      });
    }
  }, []);

  const setTokenAndUser = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, senha });
    setTokenAndUser(res.token, res.user);

    if (!res.user.tenant_id) {
      navigate('/setup');
    } else {
      navigate('/dashboard');
    }
  }, [navigate, setTokenAndUser]);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post<AuthResponse>('/auth/register', data);
    setTokenAndUser(res.token, res.user);

    if (!res.user.tenant_id) {
      navigate('/setup');
    } else {
      navigate('/dashboard');
    }
  }, [navigate, setTokenAndUser]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, register, logout, setTokenAndUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
