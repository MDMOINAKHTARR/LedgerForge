// GradientBackground — "Cotton Bubblegum Lilac", made with the 21st.dev Gradient
// Builder and exported as live CSS (the builder's own Copy-CSS background,
// plus its soften-blur and grain passes). Zero dependencies: one <div> that
// fills its parent. Drop it behind your content:
// <div className="relative h-96"><GradientBackground className="absolute inset-0" /></div>
// Remix the source recipe (colors, mode, finish) in the editor:
// https://21st.dev/community/gradients/editor?from=f8218dec-6d6b-4267-ad3d-9e4319704259
export function GradientBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-0.8cqmin",
          filter: "blur(0.4cqmin)",
          backgroundColor: "#FCE4EC",
          backgroundImage:
            "linear-gradient(90deg, #FCE4EC 0%, #FCE4EC 11.38%, #F7B7D2 13.63%, #F7B7D2 23.88%, #BFD8F2 26.13%, #BFD8F2 36.38%, #E3D5F5 38.63%, #E3D5F5 48.88%, #FCE4EC 51.13%, #FCE4EC 61.38%, #F7B7D2 63.63%, #F7B7D2 73.88%, #BFD8F2 76.13%, #BFD8F2 86.38%, #E3D5F5 88.63%, #E3D5F5 100%)",
        }}
      />
    </div>
  );
}
