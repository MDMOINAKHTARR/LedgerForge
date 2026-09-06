// This is file of your component
// You can use any dependencies from npm; we import them automatically in package.json

import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Sparkles, Heart, ArrowLeft } from "lucide-react";

export default function Component({
  children,
  onBack,
}: {
  children?: React.ReactNode;
  onBack?: () => void;
}) {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-center items-center overflow-hidden">
      {/* Indigo Blue Radial Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(125% 125% at 50% 10%, #ffffff 40%, #6366f1 100%)",
        }}
      />

      {/* Your Content/Components */}
      {children ? (
        <div className="relative z-10 w-full">{children}</div>
      ) : (
        <div className="relative z-10 max-w-xl mx-auto p-8 text-center bg-white/90 backdrop-blur-md rounded-3xl border border-indigo-100 shadow-2xl m-4">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-6 top-6 p-2 rounded-full hover:bg-indigo-50 text-slate-500 hover:text-slate-800 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Indigo Blue Gradient
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Smooth radial gradient from clean white at 50% 10% blending into a rich indigo blue (#6366f1) backdrop.
          </p>

          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm max-h-48">
            <img
              src="https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80"
              alt="Pink Gradient Modern Art"
              className="w-full h-48 object-cover"
            />
          </div>

          <div className="mt-6 flex items-center justify-center space-x-3">
            <button
              onClick={() => setCount((c) => c + 1)}
              className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Clicks: {count}</span>
            </button>

            {onBack && (
              <button
                onClick={onBack}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs transition-all"
              >
                Back to App
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
