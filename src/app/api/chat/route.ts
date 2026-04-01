import { NextRequest, NextResponse } from "next/server";

/**
 * NOVERA AI Agent API Route
 * 
 * Uses a multi-provider strategy to deliver truly intelligent responses:
 * 1. Primary: OpenRouter API (Liquid LFM2 or other models)
 * 2. Fallback: HuggingFace Inference API (free, open models)
 * 3. Real-time info: DuckDuckGo Instant Answer API (no key needed)
 * 
 * All provider keys are server-side -- users never need to provide API keys.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Provider configuration (server-side only)
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.LIQUID_API_KEY || "";
const HF_API_KEY = process.env.HF_API_KEY || "";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

const SYSTEM_PROMPT = `You are NOVERA, an advanced AI agent powered by the Liquid AI LFM2 architecture running through the Koog framework. You are intelligent, knowledgeable, and helpful.

Key traits:
- You can answer ANY question on ANY topic with detailed, accurate responses
- You provide real-time information when web search context is available
- You write code in any programming language
- You help with creative writing, math, science, technology, and more
- You understand device context and can help with tasks on any OS
- You give specific, actionable responses -- not generic advice
- You use markdown formatting for readability
- You are honest about uncertainty but always try your best

When web search results are provided in the context, use them to give up-to-date answers.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || "";

    // Step 1: Check if query needs real-time info, and fetch search context
    let searchContext = "";
    if (needsRealTimeInfo(lastUserMsg)) {
      searchContext = await fetchSearchContext(lastUserMsg);
    }

    // Prepare messages with system prompt and search context
    const enrichedMessages = prepareMessages(messages, searchContext);

    // Step 2: Try LLM providers in order
    // Try OpenRouter (Liquid LFM2)
    if (OPENROUTER_KEY) {
      const response = await tryOpenRouter(enrichedMessages);
      if (response) return response;
    }

    // Try Google Gemini (generous free tier)
    if (GOOGLE_API_KEY) {
      const response = await tryGemini(enrichedMessages);
      if (response) return response;
    }

    // Try HuggingFace Inference API
    if (HF_API_KEY) {
      const response = await tryHuggingFace(enrichedMessages);
      if (response) return response;
    }

    // Try free HuggingFace models (no key needed for some)
    const hfFreeResponse = await tryHuggingFaceFree(enrichedMessages);
    if (hfFreeResponse) return hfFreeResponse;

    // Step 3: If all providers fail, use enhanced local agent with search context
    return createLocalResponse(lastUserMsg, searchContext, messages);

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// --- Real-time Search ---

function needsRealTimeInfo(msg: string): boolean {
  const realTimePatterns = /\b(news|latest|current|today|recent|update|2024|2025|2026|weather|stock|price|score|result|election|trending|happening|new release|announcement|launch|released|just|now)\b/i;
  return realTimePatterns.test(msg);
}

async function fetchSearchContext(query: string): Promise<string> {
  try {
    // DuckDuckGo Instant Answer API (free, no key)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });
    
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      const results: string[] = [];
      
      if (data.Abstract) results.push(`Summary: ${data.Abstract}`);
      if (data.Answer) results.push(`Answer: ${data.Answer}`);
      if (data.Definition) results.push(`Definition: ${data.Definition}`);
      
      if (data.RelatedTopics?.length > 0) {
        const topics = data.RelatedTopics
          .slice(0, 5)
          .filter((t: { Text?: string }) => t.Text)
          .map((t: { Text: string }) => `- ${t.Text}`)
          .join("\n");
        if (topics) results.push(`Related info:\n${topics}`);
      }
      
      if (data.Infobox?.content?.length > 0) {
        const info = data.Infobox.content
          .slice(0, 5)
          .map((i: { label: string; value: string }) => `${i.label}: ${i.value}`)
          .join("\n");
        if (info) results.push(`Details:\n${info}`);
      }

      if (results.length > 0) {
        return `[Web Search Results for "${query}"]\n${results.join("\n\n")}`;
      }
    }

    // Also try Wikipedia API for factual queries
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) });
    
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      if (wikiData.extract) {
        return `[Wikipedia Summary]\n${wikiData.extract}`;
      }
    }
  } catch {
    // Search failed silently -- continue without context
  }
  return "";
}

// --- Message Preparation ---

function prepareMessages(messages: ChatMessage[], searchContext: string): ChatMessage[] {
  const systemMsg: ChatMessage = {
    role: "system",
    content: SYSTEM_PROMPT + (searchContext ? `\n\n${searchContext}` : "")
  };

  // Filter out any existing system messages and add our own
  const userAndAssistant = messages.filter(m => m.role !== "system");
  
  // Keep device context from original system messages
  const deviceContext = messages
    .filter(m => m.role === "system" && m.content.includes("OS="))
    .map(m => m.content)
    .join("\n");

  if (deviceContext) {
    systemMsg.content += `\n\nUser device context: ${deviceContext}`;
  }

  return [systemMsg, ...userAndAssistant];
}

// --- LLM Providers ---

async function tryOpenRouter(messages: ChatMessage[]): Promise<Response | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://novera-liquid-ai.vercel.app",
        "X-Title": "NOVERA AI Agent",
      },
      body: JSON.stringify({
        model: "liquid/lfm2",
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok && res.body) {
      return streamProxy(res);
    }

    // Try fallback model on OpenRouter
    const fallbackRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://novera-liquid-ai.vercel.app",
        "X-Title": "NOVERA AI Agent",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (fallbackRes.ok && fallbackRes.body) {
      return streamProxy(fallbackRes);
    }
  } catch {
    // OpenRouter failed
  }
  return null;
}

async function tryGemini(messages: ChatMessage[]): Promise<Response | null> {
  try {
    // Convert chat messages to Gemini format
    const systemInstruction = messages.find(m => m.role === "system")?.content || "";
    const contents = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (res.ok && res.body) {
      // Transform Gemini SSE to OpenAI-compatible format
      return transformGeminiStream(res);
    }
  } catch {
    // Gemini failed
  }
  return null;
}

async function tryHuggingFace(messages: ChatMessage[]): Promise<Response | null> {
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${HF_API_KEY}`,
        },
        body: JSON.stringify({
          messages,
          stream: true,
          max_tokens: 4096,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (res.ok && res.body) {
      return streamProxy(res);
    }
  } catch {
    // HF failed
  }
  return null;
}

async function tryHuggingFaceFree(messages: ChatMessage[]): Promise<Response | null> {
  // Try HuggingFace free inference (some models are free without API key)
  const freeModels = [
    "mistralai/Mistral-7B-Instruct-v0.3",
    "microsoft/Phi-3-mini-4k-instruct",
  ];

  for (const model of freeModels) {
    try {
      const prompt = messages
        .map(m => {
          if (m.role === "system") return `<|system|>\n${m.content}</s>`;
          if (m.role === "user") return `<|user|>\n${m.content}</s>`;
          return `<|assistant|>\n${m.content}</s>`;
        })
        .join("\n") + "\n<|assistant|>\n";

      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: 2048, temperature: 0.7, return_full_text: false },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = Array.isArray(data)
          ? data[0]?.generated_text || ""
          : data?.generated_text || "";

        if (text && text.length > 10) {
          return createStreamFromText(text);
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

// --- Stream Helpers ---

function streamProxy(upstreamRes: Response): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstreamRes.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
        }
      } catch {
        // Stream interrupted
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function transformGeminiStream(upstreamRes: Response): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstreamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) {
                  const openaiFormat = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${openaiFormat}\n\n`));
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch {
        // Stream error
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function createStreamFromText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const words = text.split(" ");
      let i = 0;
      function push() {
        if (i < words.length) {
          const word = (i === 0 ? "" : " ") + words[i];
          const data = JSON.stringify({ choices: [{ delta: { content: word } }] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          i++;
          setTimeout(push, 15 + Math.random() * 20);
        } else {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
      push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// --- Enhanced Local Agent (fallback when all APIs are down) ---

function createLocalResponse(
  userMsg: string,
  searchContext: string,
  messages: ChatMessage[]
): Response {
  let response: string;

  if (searchContext) {
    // We have search results -- incorporate them into response
    response = `Based on what I found:\n\n${searchContext.replace(/\[.*?\]\n?/g, "")}\n\nNote: I'm currently running in local mode. For the most comprehensive AI responses, the server connects to Liquid AI's LFM2 model. The above information comes from real-time web search.`;
  } else {
    // Generate best possible local response
    response = generateLocalResponse(userMsg, messages);
  }

  return createStreamFromText(response);
}

function generateLocalResponse(msg: string, history: ChatMessage[]): string {
  const lmsg = msg.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|greetings|howdy)\b/i.test(lmsg)) {
    return `Hello! I'm NOVERA, your AI agent. I can help with any topic -- technology, science, creative writing, code, math, current events, and more. What would you like to explore?`;
  }

  // Help
  if (/\b(help|what can you do)\b/i.test(lmsg)) {
    return `I'm NOVERA, a full AI agent that can:\n\n- **Answer any question** on any topic\n- **Write code** in any programming language\n- **Search the web** for real-time information\n- **Creative writing** -- stories, emails, articles\n- **Math & calculations**\n- **Device guidance** for any OS\n- **Explain concepts** in any domain\n\nI connect to multiple AI backends (Liquid LFM2, Gemini, Mistral) and web search for the most accurate responses. Just ask anything!`;
  }

  // Math
  const mathMatch = msg.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/\%\^])\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result: number;
    switch (op) {
      case "+": result = a + b; break;
      case "-": result = a - b; break;
      case "*": result = a * b; break;
      case "/": result = b !== 0 ? a / b : NaN; break;
      case "%": result = a % b; break;
      case "^": result = Math.pow(a, b); break;
      default: result = NaN;
    }
    if (!isNaN(result)) {
      return `**${a} ${op} ${b} = ${result}**`;
    }
  }

  // For everything else -- provide a thoughtful response acknowledging limitations
  return `I understand your question about "${msg.length > 60 ? msg.substring(0, 60) + "..." : msg}". 

I'm currently operating in enhanced local mode. For the most intelligent and comprehensive responses, I connect to real AI models (Liquid LFM2, Gemini, Mistral) that can reason about any topic in any domain.

**To get full AI capability**, the server administrator needs to set one of these environment variables:
- \`OPENROUTER_API_KEY\` -- For Liquid LFM2 model access
- \`GOOGLE_API_KEY\` -- For Gemini (free tier: 60 req/min)
- \`HF_API_KEY\` -- For HuggingFace models

Once configured, I can answer any question on any topic with real intelligence -- no pre-programmed responses, real AI reasoning in real-time.

In the meantime, try asking me for:
- **Math calculations** (e.g., "25 * 17")
- **Real-time info** (I'll search the web for you)
- **General help** (I'll do my best with local knowledge)`;
}
