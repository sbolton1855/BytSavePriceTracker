import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProductsDisplay from "@/components/products-display";
import TrackerForm from "@/components/tracker-form";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const Dashboard: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Try to get email from local storage
    return localStorage.getItem("bytsave_user_email") || "";
  });

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: userEmail,
    },
  });

  // Update form value when userEmail changes
  useEffect(() => {
    form.setValue("email", userEmail);
  }, [userEmail, form]);

  const onSubmit = (data: EmailFormValues) => {
    setUserEmail(data.email);
    localStorage.setItem("bytsave_user_email", data.email);
  };

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Track and manage your Amazon price alerts</p>
        </div>

        {!userEmail ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Enter Your Email</CardTitle>
              <CardDescription>
                Provide your email to view your tracked products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your@email.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">View My Products</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Currently Viewing</CardTitle>
                  <CardDescription>
                    Showing tracked products for {userEmail}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setUserEmail("");
                    localStorage.removeItem("bytsave_user_email");
                  }}
                >
                  Change Email
                </Button>
              </CardHeader>
            </Card>
            <ProductsDisplay email={userEmail} />
          </>
        )}

        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Track a New Product</CardTitle>
              <CardDescription>
                Add another Amazon product to your tracking list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrackerForm 
                onSuccess={() => {
                  // If the user hasn't set an email yet, get it from the form
                  if (!userEmail) {
                    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
                    if (emailInput && emailInput.value) {
                      setUserEmail(emailInput.value);
                      localStorage.setItem("bytsave_user_email", emailInput.value);
                    }
                  }
                }} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
