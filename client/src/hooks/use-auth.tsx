import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RegisterFormData, LoginFormData } from "@shared/schema";
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
  register: (data: RegisterFormData) => Promise<User>;
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
        const res = await fetch("/api/user");
        if (!res.ok) {
          if (res.status === 401) {
            return null;
          }
          throw new Error("Failed to fetch user data");
        }
        return await res.json();
      } catch (error) {
        console.error("Error fetching user:", error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: null, // Initialize with null to avoid undefined
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
      await fetch("/api/logout", { method: "POST" });
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