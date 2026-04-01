"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { detectDeviceAction, executeDeviceAction } from "./DeviceActions";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface DeviceInfo {
  os: string;
  browser: string;
  platform: string;
  screenSize: string;
  touchEnabled: boolean;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      os: "Unknown",
      browser: "Unknown",
      platform: "Unknown",
      screenSize: "Unknown",
      touchEnabled: false,
    };
  }

  const ua = navigator.userAgent;
  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";

  let browser = "Unknown";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edge/i.test(ua)) browser = "Edge";

  const platform = /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";

  return {
    os,
    browser,
    platform,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    touchEnabled: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  };
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const SYSTEM_PROMPT = `You are NOVERA, an AI computer-use agent powered by Liquid AI's LFM2 architecture. You can help users interact with their devices, perform tasks, and provide intelligent assistance across any operating system.

Your capabilities include:
- Reading and understanding screen content
- Providing step-by-step instructions for any OS (Windows, macOS, Linux, iOS, Android)
- Helping with file management, system settings, app usage
- Automating workflows and multi-step tasks
- Troubleshooting system issues
- Writing and debugging code
- Web browsing assistance

Always be specific about which OS/platform you're providing instructions for. Adapt your responses to the user's device context when provided.`;

export default function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDeviceInfo(getDeviceInfo());
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      const info = getDeviceInfo();
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: `Welcome to NOVERA Agent. I'm powered by Liquid AI's LFM2 architecture.\n\nI've detected your environment:\n- **OS:** ${info.os}\n- **Browser:** ${info.browser}\n- **Platform:** ${info.platform}\n- **Screen:** ${info.screenSize}\n- **Touch:** ${info.touchEnabled ? "Yes" : "No"}\n\nI can help you perform tasks on your device, write code, manage files, troubleshoot issues, or automate workflows. What would you like to do?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Check for device actions first (execute on-device)
      const deviceAction = detectDeviceAction(userMessage.content);
      if (deviceAction) {
        const result = await executeDeviceAction(deviceAction, userMessage.content);
        
        if (result.data === "DOWNLOAD_CHAT") {
          // Special case: download chat history
          const chatText = messages.map(m => `[${m.role}] ${m.content}`).join("\n\n");
          const blob = new Blob([chatText], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "novera-chat.txt";
          a.click();
          URL.revokeObjectURL(url);
          setMessages((prev) => [...prev, {
            id: generateId(),
            role: "assistant",
            content: "Chat history downloaded as novera-chat.txt",
            timestamp: new Date(),
          }]);
          setIsLoading(false);
          return;
        }

        const statusIcon = result.success ? "**[Action Executed]**" : "**[Action Failed]**";
        setMessages((prev) => [...prev, {
          id: generateId(),
          role: "assistant",
          content: `${statusIcon}\n\n${result.data}`,
          timestamp: new Date(),
        }]);
        setIsLoading(false);
        return;
      }

      const contextMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...(deviceInfo
          ? [
              {
                role: "system" as const,
                content: `User device context: OS=${deviceInfo.os}, Browser=${deviceInfo.browser}, Platform=${deviceInfo.platform}, Screen=${deviceInfo.screenSize}, Touch=${deviceInfo.touchEnabled}`,
              },
            ]
          : []),
        ...messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage.content },
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE data lines
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token =
                  parsed.choices?.[0]?.delta?.content ||
                  parsed.token ||
                  parsed.content ||
                  "";
                if (token) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + token }
                        : m
                    )
                  );
                }
              } catch {
                // If not JSON, treat as plain text token
                if (data.trim()) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + data }
                        : m
                    )
                  );
                }
              }
            } else if (line.trim() && !line.startsWith(":")) {
              // Plain text streaming
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + line }
                    : m
                )
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content:
            "I encountered a connection issue. The Liquid AI LFM2 endpoint may be temporarily unavailable. Please try again in a moment.\n\nIn the meantime, I can still help with general guidance -- just let me know what you need.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, deviceInfo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: "Device Info", icon: "i", prompt: "Check my device info" },
    { label: "Battery", icon: "B", prompt: "Check battery status" },
    { label: "Network", icon: "N", prompt: "Check network status" },
    { label: "Location", icon: "G", prompt: "What is my location?" },
    { label: "Screen", icon: "S", prompt: "Check screen info" },
    { label: "Time", icon: "T", prompt: "What time is it?" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Chat Panel */}
      <div className="relative w-full max-w-2xl bg-stone-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/80 to-stone-600 flex items-center justify-center animate-pulse-glow">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div>
              <h2 className="text-white text-sm font-medium tracking-wide">
                NOVERA Agent
              </h2>
              <span className="text-white/40 text-[10px] uppercase tracking-widest">
                Liquid AI LFM2 &middot;{" "}
                {deviceInfo?.os || "Detecting..."} &middot;{" "}
                {isLoading ? "Thinking..." : "Ready"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-2 cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="px-6 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setInput(action.prompt);
                  setTimeout(() => sendMessage(), 100);
                }}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-white/60 text-xs hover:text-white hover:border-white/30 transition-all cursor-pointer"
              >
                <span className="text-[10px] font-mono">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === "user"
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-white/90 border border-white/5"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-500/60 to-stone-600 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">N</span>
                    </span>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">
                      Novera
                    </span>
                  </div>
                )}
                <div className="prose-chat text-sm font-light leading-relaxed whitespace-pre-wrap">
                  {message.content}
                  {isLoading &&
                    message.role === "assistant" &&
                    message === messages[messages.length - 1] &&
                    !message.content && (
                      <span className="inline-flex gap-1 ml-1">
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                </div>
                <span className="block text-[9px] text-white/20 mt-2">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/10">
          <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask NOVERA to perform a task..."
              rows={1}
              className="flex-1 bg-transparent text-white text-sm font-light placeholder:text-white/30 outline-none resize-none max-h-32"
              style={{ minHeight: "24px" }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19V5m0 0l-7 7m7-7l7 7"
                />
              </svg>
            </button>
          </div>
          <p className="text-[9px] text-white/20 mt-2 text-center">
            Powered by Liquid AI LFM2 &middot; Open Source &middot; On-Device
            Capable
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
