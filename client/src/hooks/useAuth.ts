import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'user';
}

interface LoginCredentials {
  username: string;
  password: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        
        if (res.status === 401) {
          return null; // 로그인되지 않음
        }
        
        if (!res.ok) {
          throw new Error('Failed to fetch user');
        }
        
        return await res.json();
      } catch (error) {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Logout failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/';
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password change failed');
      }
      
      return response.json();
    },
  });

  const typedUser = user as User | undefined;

  return {
    user: typedUser,
    isLoading,
    isAuthenticated: !!typedUser,
    isAdmin: typedUser?.role === 'admin',
    isManager: typedUser?.role === 'manager',
    isManagerOrAdmin: typedUser?.role === 'admin' || typedUser?.role === 'manager',
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    loginLoading: loginMutation.isPending,
    logoutLoading: logoutMutation.isPending,
    changePasswordLoading: changePasswordMutation.isPending,
    loginError: loginMutation.error,
    logoutError: logoutMutation.error,
    changePasswordError: changePasswordMutation.error,
  };
}