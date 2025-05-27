import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: any, vendorData?: any, partnerData?: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await apiRequest('POST', '/api/auth/login', { username, password });
    const data = await response.json();
    
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    
    // Redirect based on role
    const redirectPath = data.user.role === 'vendor' ? '/vendor' : 
                        data.user.role === 'delivery' ? '/delivery' : 
                        '/customer';
    setLocation(redirectPath);
  };

  const register = async (userData: any, vendorData?: any, partnerData?: any) => {
    const payload = {
      ...userData,
      vendorData,
      partnerData
    };
    
    const response = await apiRequest('POST', '/api/auth/register', payload);
    const data = await response.json();
    
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    
    // Redirect based on role
    const redirectPath = data.user.role === 'vendor' ? '/vendor' : 
                        data.user.role === 'delivery' ? '/delivery' : 
                        '/customer';
    setLocation(redirectPath);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
