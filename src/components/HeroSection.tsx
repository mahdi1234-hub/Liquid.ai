"use client";

import { useEffect, useRef } from "react";

interface HeroSectionProps {
  onOpenChat: () => void;
}

export default function HeroSection({ onOpenChat }: HeroSectionProps) {
  const headerRef = useRef<HTMLElement>(null);
  const heroWordsRef = useRef<HTMLSpanElement[]>([]);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      if (h1Ref.current) h1Ref.current.style.opacity = "1";
      heroWordsRef.current.forEach((w) => {
        if (w) w.style.transform = "translateY(0)";
      });
      if (searchBarRef.current) {
        searchBarRef.current.style.opacity = "1";
        searchBarRef.current.style.transform = "translateY(0) scale(1)";
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gsapInstance: any = null;

    import("gsap").then(async (mod) => {
      const gsap = mod.gsap;
      gsapInstance = gsap;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Headline reveal
      gsap.to(h1Ref.current, { opacity: 1, duration: 0.2 });
      gsap.to(heroWordsRef.current, {
        y: "0%",
        duration: 1.4,
        ease: "power4.out",
        stagger: 0.06,
        delay: 0.2,
      });

      // Image parallax
      gsap.to(".hero-bg-img", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: {
          trigger: headerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Search bar intro
      gsap.to(searchBarRef.current, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        delay: 0.8,
        ease: "power3.out",
      });
    });

    return () => {
      if (gsapInstance) {
        import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
          ScrollTrigger.getAll().forEach((t: { kill: () => void }) => t.kill());
        });
      }
    };
  }, []);

  const addWordRef = (el: HTMLSpanElement | null) => {
    if (el && !heroWordsRef.current.includes(el)) {
      heroWordsRef.current.push(el);
    }
  };

  const words1 = ["Welcome", "to", "your"];
  const words2 = ["Private", "Assistant."];

  return (
    <header
      ref={headerRef}
      className="relative w-full h-screen min-h-[700px] flex flex-col justify-end pb-24 md:pb-32 px-6 md:px-12 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/46011e44-1f9d-4c5e-b716-300b8ce1381e_3840w.jpg"
          alt="Luxury Interior"
          className="w-full h-full object-cover hero-bg-img"
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto fade-in-up">
        <div className="max-w-4xl">
          <span className="block text-[10px] uppercase tracking-widest text-white/60 font-sans mb-6">
            Liquid AI &middot; LFM2 Agent
          </span>

          <h1
            ref={h1Ref}
            className="text-4xl md:text-6xl lg:text-7xl text-white font-serif tracking-tight leading-[1.1] mb-6 opacity-0"
          >
            <span className="block overflow-hidden">
              {words1.map((word, i) => (
                <span key={i} className="inline-block overflow-hidden align-top">
                  <span
                    ref={addWordRef}
                    className="inline-block hero-word transform translate-y-full"
                  >
                    {word}
                  </span>
                  {i < words1.length - 1 && "\u00A0"}
                </span>
              ))}
            </span>
            <span className="block overflow-hidden">
              {words2.map((word, i) => (
                <span key={i} className="inline-block overflow-hidden align-top">
                  <span
                    ref={addWordRef}
                    className="inline-block hero-word transform translate-y-full"
                  >
                    {word}
                  </span>
                  {i < words2.length - 1 && "\u00A0"}
                </span>
              ))}
            </span>
          </h1>

          <p className="text-white/90 text-sm md:text-base font-sans font-light mb-12 max-w-lg">
            Your on-device AI agent powered by Liquid AI&rsquo;s open-source LFM2
            model. Interact with any device, any OS -- right from your browser.
          </p>

          {/* Search Bar / Action Bar */}
          <div
            ref={searchBarRef}
            className="mt-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2px] px-8 py-6 flex flex-col md:flex-row items-center gap-6 max-w-5xl opacity-0 translate-y-10 scale-95 origin-center"
          >
            <div className="w-full md:flex-1 flex items-center justify-center">
              <span className="text-white/70 text-sm font-light tracking-wider">
                Made With Love By Louati Mahdi
              </span>
            </div>

            <div className="w-full md:w-auto mt-4 md:mt-0">
              <button
                onClick={onOpenChat}
                className="w-full text-[10px] uppercase tracking-widest bg-white text-stone-900 px-6 py-3 rounded-[2px] font-medium hover:bg-stone-900 hover:text-white transition-all duration-400 cursor-pointer"
              >
                Launch Agent
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
