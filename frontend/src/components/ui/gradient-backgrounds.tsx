import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Sparkles, Layers } from "lucide-react";

interface GradientBackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

export const Component = ({ children, className }: GradientBackgroundProps) => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("min-h-screen w-full relative flex flex-col justify-center items-center overflow-hidden", className)}>
      {/* Indigo Radial Glow Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(125% 125% at 50% 10%, #ffffff 40%, #6366f1 100%)",
        }}
      />

      {children ? (
        <div className="relative z-10 w-full">{children}</div>
      ) : (
        <div className="relative z-10 max-w-xl mx-auto p-8 text-center bg-white/85 backdrop-blur-md rounded-3xl border border-indigo-100 shadow-xl m-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Indigo Radial Background
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            A radial gradient blending from clean white into vibrant indigo (#6366f1) at 50% 10%.
          </p>

          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm max-h-48">
            <img
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
              alt="Indigo Gradient Art"
              className="w-full h-48 object-cover"
            />
          </div>

          <div className="mt-6 flex items-center justify-center space-x-3">
            <button
              onClick={() => setCount((c) => c + 1)}
              className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-2"
            >
              <Layers className="w-4 h-4" />
              <span>Interactive Count: {count}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Component;
