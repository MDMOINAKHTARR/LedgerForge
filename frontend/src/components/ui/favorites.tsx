// GradientBackground — "Favorites", made with the 21st.dev Gradient
// Builder and exported as live CSS (the builder's own Copy-CSS background,
// plus its soften-blur and grain passes). Zero dependencies: one <div> that
// fills its parent. Drop it behind your content:
// <div className="relative h-96"><GradientBackground className="absolute inset-0" /></div>
// Remix the source recipe (colors, mode, finish) in the editor:
// https://21st.dev/community/gradients/editor?from=d539f2c3-8194-46d6-91be-03f10a879624
import React from 'react';

export interface GradientBackgroundProps {
  className?: string;
  mirrored?: boolean;
  variant?: 'blue' | 'pink';
}

export function GradientBackground({ 
  className, 
  mirrored = false,
  variant = 'blue'
}: GradientBackgroundProps) {
  const isPink = variant === 'pink';

  // Base background color: balanced warm silver-blush for pink; #E2E2E2 for blue
  const bgColor = isPink ? "#E2DCDE" : "#E2E2E2";

  // Blue variant (original) vs Balanced Pink variant (matching saturation & luminosity of blue)
  const gradients = isPink
    ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.500'/%3E%3C/svg%3E\"), radial-gradient(circle at 67.04% 45.93%, rgba(230, 224, 226, 1) 0%, rgba(230, 224, 226, 0.844) 19.02%, rgba(230, 224, 226, 0.5) 38.05%, rgba(230, 224, 226, 0.156) 57.07%, rgba(230, 224, 226, 0) 76.1%), radial-gradient(circle at 35.47% 65.92%, rgba(244, 90, 140, 1) 0%, rgba(244, 90, 140, 0.844) 12.9%, rgba(244, 90, 140, 0.5) 25.8%, rgba(244, 90, 140, 0.156) 38.7%, rgba(244, 90, 140, 0) 51.6%), radial-gradient(circle at 48.33% 20.11%, rgba(244, 90, 140, 1) 0%, rgba(244, 90, 140, 0.844) 16.75%, rgba(244, 90, 140, 0.5) 33.5%, rgba(244, 90, 140, 0.156) 50.25%, rgba(244, 90, 140, 0) 67%), radial-gradient(circle at 80.81% 88.03%, rgba(251, 146, 185, 1) 0%, rgba(251, 146, 185, 0.844) 10.28%, rgba(251, 146, 185, 0.5) 20.55%, rgba(251, 146, 185, 0.156) 30.83%, rgba(251, 146, 185, 0) 41.1%)"
    : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.500'/%3E%3C/svg%3E\"), radial-gradient(circle at 67.04% 45.93%, rgba(226, 226, 226, 1) 0%, rgba(226, 226, 226, 0.844) 19.02%, rgba(226, 226, 226, 0.5) 38.05%, rgba(226, 226, 226, 0.156) 57.07%, rgba(226, 226, 226, 0) 76.1%), radial-gradient(circle at 35.47% 65.92%, rgba(27, 159, 254, 1) 0%, rgba(27, 159, 254, 0.844) 12.9%, rgba(27, 159, 254, 0.5) 25.8%, rgba(27, 159, 254, 0.156) 38.7%, rgba(27, 159, 254, 0) 51.6%), radial-gradient(circle at 48.33% 20.11%, rgba(27, 159, 254, 1) 0%, rgba(27, 159, 254, 0.844) 16.75%, rgba(27, 159, 254, 0.5) 33.5%, rgba(27, 159, 254, 0.156) 50.25%, rgba(27, 159, 254, 0) 67%), radial-gradient(circle at 80.81% 88.03%, rgba(74, 201, 255, 1) 0%, rgba(74, 201, 255, 0.844) 10.28%, rgba(74, 201, 255, 0.5) 20.55%, rgba(74, 201, 255, 0.156) 30.83%, rgba(74, 201, 255, 0) 41.1%)";

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden w-full h-full pointer-events-none ${className || ''}`}
      style={{
        containerType: "size",
        transform: mirrored ? "scaleX(-1)" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: bgColor,
          backgroundImage: gradients,
          backgroundSize: "120px 120px, auto, auto, auto, auto",
          backgroundBlendMode: "overlay, normal, normal, normal, normal",
        }}
      />
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.500,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      >
        <filter id="grain-d539f2c3">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-d539f2c3)" />
      </svg>
    </div>
  );
}

export function MirroredGradientBackground({ className, variant = 'blue' }: GradientBackgroundProps) {
  return <GradientBackground className={className} mirrored={true} variant={variant} />;
}

export function PinkGradientBackground({ className, mirrored = false }: GradientBackgroundProps) {
  return <GradientBackground className={className} mirrored={mirrored} variant="pink" />;
}
