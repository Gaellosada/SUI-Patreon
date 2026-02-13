"use client";

export function TrendingSection() {
  return (
    <section
      className="snap-section min-h-[65vh] py-40 md:py-52 px-6"
      style={{
        background:
          "linear-gradient(to bottom, #7e8fa0 0%, #6b7d92 25%, #4a5d72 50%, #2d3d52 75%, #0f172a 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="h-16 md:h-24" aria-hidden />
        <h2
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white text-center tracking-tight"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
        >
          Trending creators
        </h2>
        <div className="h-24 md:h-40" aria-hidden />
      </div>
    </section>
  );
}
