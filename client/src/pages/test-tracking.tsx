import SimpleTrackForm from "@/components/simple-track-form";

export default function TestTrackingPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Test Product Tracking</h1>
        <p className="text-center text-gray-500 mb-8">
          This is a simplified form to test the tracking functionality
        </p>
        
        <SimpleTrackForm />
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="font-medium text-blue-700">Developer Notes</h3>
          <p className="text-sm text-blue-600 mt-2">
            This page directly tests the tracking API without the complexity of the full search interface.
            Check the browser console and server logs to see the request details.
          </p>
        </div>
      </div>
    </div>
  );
}