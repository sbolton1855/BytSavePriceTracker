import { useState } from "react";
import { Redirect } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, loginSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Redirect if user is already logged in
  if (user && !isLoading) {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Hero Section */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-primary/90 to-primary/50 p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Track Amazon Prices with BytSave</h1>
          <p className="text-lg mb-8">
            Never miss a price drop again. BytSave monitors Amazon products and notifies you when
            prices fall below your target.
          </p>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-white rounded-full p-1 text-primary mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p>Track unlimited Amazon products</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-white rounded-full p-1 text-primary mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p>Get email notifications for price drops</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-white rounded-full p-1 text-primary mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p>View price history and trends</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Forms */}
      <div className="w-full md:w-1/2 p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {activeTab === "login" ? "Welcome Back" : "Create Your Account"}
            </CardTitle>
            <CardDescription className="text-center">
              {activeTab === "login" 
                ? "Log in to manage your price trackers" 
                : "Sign up to start tracking Amazon prices"}
            </CardDescription>
          </CardHeader>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <LoginForm 
                setIsSubmitting={setIsSubmitting} 
                isSubmitting={isSubmitting}
                setActiveTab={setActiveTab} 
              />
            </TabsContent>
            
            <TabsContent value="register">
              <RegisterForm 
                setIsSubmitting={setIsSubmitting} 
                isSubmitting={isSubmitting}
                setActiveTab={setActiveTab}
              />
            </TabsContent>
          </Tabs>
          
          {/* Footer with helpful message and action buttons */}
          <CardFooter className="flex flex-col space-y-4 mt-4 border-t pt-4">
            <div className="text-sm text-center space-y-2">
              {activeTab === "login" 
                ? (
                  <>
                    <p className="text-muted-foreground">Don't have an account?</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setActiveTab("register")}
                      className="mx-auto"
                    >
                      Create Account
                    </Button>
                  </>
                ) 
                : (
                  <>
                    <p className="text-muted-foreground">Already have an account?</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setActiveTab("login")}
                      className="mx-auto"
                    >
                      Sign In
                    </Button>
                  </>
                )
              }
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Login Form
function LoginForm({ 
  isSubmitting, 
  setIsSubmitting,
  setActiveTab
}: { 
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setActiveTab: (tab: "login" | "register") => void;
}) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange", // Validates on change
  });
  
  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsSubmitting(true);
      setUserNotFound(false);
      await login(values);
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Check for specific error messages from backend
      if (error.message?.includes("Account not found") || error.response?.data?.userNotFound) {
        setUserNotFound(true);
        form.setError("email", {
          type: "manual",
          message: "Account not found. Please check your email or register."
        });
      } else if (error.message?.includes("Incorrect password") || error.response?.data?.passwordIncorrect) {
        form.setError("password", {
          type: "manual",
          message: "Incorrect password. Please try again."
        });
      } else {
        form.setError("root", {
          type: "manual",
          message: error.message || "Login failed. Please check your credentials."
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const switchToRegister = () => {
    setActiveTab("register");
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-2">
        {form.formState.errors.root && (
          <div className="text-sm text-destructive mb-2 p-2 border border-destructive/20 bg-destructive/10 rounded">
            {form.formState.errors.root.message}
          </div>
        )}
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...field} 
                  />
                </FormControl>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? 
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> : 
                    <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {userNotFound && (
          <div className="text-sm text-primary p-2 rounded flex flex-col items-center">
            <p className="mb-2">New to BytSave? Create an account to get started.</p>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={switchToRegister}
              className="mt-1"
            >
              Register Now
            </Button>
          </div>
        )}
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </Form>
  );
}

// Register Form
function RegisterForm({ 
  isSubmitting, 
  setIsSubmitting,
  setActiveTab
}: { 
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setActiveTab: (tab: "login" | "register") => void;
}) {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
    },
    mode: "onChange", // Validate fields as they change
  });
  
  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      setIsSubmitting(true);
      setEmailExists(false);
      
      // Perform client-side validation
      if (values.password !== values.passwordConfirm) {
        form.setError("passwordConfirm", {
          type: "manual",
          message: "Passwords do not match"
        });
        setIsSubmitting(false);
        return;
      }
      
      // Only send email and password to server (API only needs these two fields)
      const { email, password } = values;
      await register({ email, password } as any);
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Handle different types of registration errors
      if (error.response?.data?.emailExists || 
          error.message?.includes("email already exists") || 
          error.response?.data?.message?.includes("already exists")) {
        setEmailExists(true);
        form.setError("email", {
          type: "manual",
          message: "This email is already registered. Please login instead."
        });
      } else if (error.response?.data?.errors?.password) {
        // Handle server-side password validation errors
        const passwordErrors = error.response.data.errors.password._errors;
        form.setError("password", {
          type: "manual",
          message: passwordErrors[0] || "Password does not meet requirements."
        });
      } else if (error.message?.includes("password")) {
        form.setError("password", {
          type: "manual",
          message: error.message || "Password does not meet requirements."
        });
      } else {
        form.setError("root", {
          type: "manual",
          message: error.message || "Registration failed. Please try again later."
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const switchToLogin = () => {
    setActiveTab("login");
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-2">
        {form.formState.errors.root && (
          <div className="text-sm text-destructive mb-2 p-2 border border-destructive/20 bg-destructive/10 rounded">
            {form.formState.errors.root.message}
          </div>
        )}
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
              <div className="relative">
                <FormControl>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...field} 
                  />
                </FormControl>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? 
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> : 
                    <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <FormDescription className="text-xs">
                Must have at least 8 characters, 1 uppercase letter and 1 number
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="passwordConfirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password <span className="text-destructive">*</span></FormLabel>
              <div className="relative">
                <FormControl>
                  <Input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...field} 
                  />
                </FormControl>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={toggleConfirmPasswordVisibility}
                >
                  {showConfirmPassword ? 
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> : 
                    <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {emailExists && (
          <div className="text-sm text-primary p-2 rounded flex flex-col items-center">
            <p className="mb-2">This email is already registered. Switch to login instead.</p>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={switchToLogin}
              className="mt-1"
            >
              Sign In
            </Button>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Required fields
        </div>
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>
    </Form>
  );
}