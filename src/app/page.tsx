"use client";

import { useState } from "react";
import HeroSection from "@/components/HeroSection";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="relative min-h-screen">
      <HeroSection onOpenChat={() => setChatOpen(true)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}
