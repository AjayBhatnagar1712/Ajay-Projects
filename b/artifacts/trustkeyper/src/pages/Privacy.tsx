import React from "react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-white">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy — Coming Soon</h1>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
