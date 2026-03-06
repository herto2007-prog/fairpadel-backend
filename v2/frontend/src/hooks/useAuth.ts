import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      
      if (storedToken && !user) {
        try {
          const response = await authService.me();
          setAuth(response.user, storedToken);
        } catch {
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    setAuth,
    logout,
  };
}
