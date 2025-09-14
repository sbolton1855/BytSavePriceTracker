import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ApiRegisterFormData, LoginFormData } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  provider?: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  logout: () => void;
  register: (data: ApiRegisterFormData) => Promise<User>;
  login: (data: LoginFormData) => Promise<User>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Get current user data
  const { 
    data: user, 
    isLoading, 
    error 
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        console.log("[CLIENT AUTH] Fetching user data...");
        const res = await fetch("/api/user", {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        console.log("[CLIENT AUTH] Response status:", res.status);
        console.log("[CLIENT AUTH] Response URL:", res.url);
        
        if (!res.ok) {
          if (res.status === 401) {
            console.log("[CLIENT AUTH] User not authenticated");
            return null;
          }
          
          const text = await res.text();
          console.error("[CLIENT AUTH] Error response:", text.substring(0, 500));
          throw new Error(`Failed to fetch user data: ${res.status}`);
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error("[CLIENT AUTH] Expected JSON but got:", contentType);
          console.error("[CLIENT AUTH] Response body:", text.substring(0, 500));
          
          // If we got HTML, it might be a redirect - check if we're on the login page
          if (text.includes('<html') && window.location.pathname !== '/auth') {
            console.log("[CLIENT AUTH] Got HTML response, might need to redirect to auth");
            return null;
          }
          
          throw new Error("Server returned non-JSON response");
        }
        
        const userData = await res.json();
        console.log("[CLIENT AUTH] Successfully fetched user:", userData.email);
        return userData;
      } catch (error) {
        console.error("[CLIENT AUTH] Error fetching user:", error);
        return null;
      }
    },
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      return failureCount < 2 && !error.message.includes('JSON');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: true, // Enable refetch to catch OAuth returns
    refetchOnMount: true,
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: ApiRegisterFormData) => {
      try {
        const res = await apiRequest("POST", "/api/register", data);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Registration failed");
        }
        return await res.json();
      } catch (error: any) {
        console.error("Registration API error:", error);
        if (error.response?.data) {
          // Format error properly
          error.message = error.response.data.message || "Registration failed";
          error.response = error.response.data;
        }
        throw error;
      }
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.email}!`,
      });
    },
    onError: (error: any) => {
      console.error("Auth registration error:", error);
      // Don't show a toast here as the form will handle detailed errors
      // Only show a toast for unexpected errors
      if (!error.response?.data?.errors && !error.response?.data?.emailExists) {
        toast({
          title: "Registration failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
      throw error;
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await apiRequest("POST", "/api/login", data);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.firstName || user.email}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    },
  });

  // Logout function
  const logout = async () => {
    try {
      await fetch("/api/logout", { 
        method: "POST",
        credentials: 'include'
      });
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "An error occurred during logout.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        error: error as Error | null,
        register: registerMutation.mutateAsync,
        login: loginMutation.mutateAsync,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}