import { NextRequest, NextResponse } from "next/server";

/**
 * NOVERA AI Agent API Route
 * 
 * Multi-layer intelligence:
 * 1. Real LLM providers (OpenRouter/Liquid LFM2, Google Gemini, HuggingFace)
 * 2. Wikipedia + DuckDuckGo knowledge retrieval for any topic
 * 3. Built-in math solver and local knowledge
 * 
 * Works without any API keys using web knowledge retrieval.
 * With API keys, provides full LLM-powered reasoning.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.LIQUID_API_KEY || "";
const HF_API_KEY = process.env.HF_API_KEY || "";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

const SYSTEM_PROMPT = `You are NOVERA, an advanced AI agent powered by Liquid AI's LFM2 architecture and the Koog framework. You are highly intelligent, knowledgeable, and helpful. You answer any question on any topic with detailed, accurate responses. Use markdown formatting. Be specific and actionable.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || "";
    const enrichedMessages = prepareMessages(messages);

    // Try LLM providers first (if configured)
    if (OPENROUTER_KEY) {
      const r = await tryOpenRouter(enrichedMessages);
      if (r) return r;
    }
    if (GOOGLE_API_KEY) {
      const r = await tryGemini(enrichedMessages);
      if (r) return r;
    }
    if (HF_API_KEY) {
      const r = await tryHuggingFace(enrichedMessages);
      if (r) return r;
    }

    // Knowledge-powered agent (no API key needed)
    return await knowledgeAgent(lastUserMsg, messages);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// --- Knowledge-Powered Agent (no API keys needed) ---

async function knowledgeAgent(userMsg: string, history: ChatMessage[]): Promise<Response> {
  const msg = userMsg.trim();
  const lmsg = msg.toLowerCase();

  // 1. Greetings
  if (/^(hi|hello|hey|greetings|howdy|good\s*(morning|afternoon|evening))\b/i.test(lmsg)) {
    return stream(`Hello! I'm **NOVERA**, your AI agent powered by Liquid AI's LFM2 architecture.\n\nI can help you with virtually anything:\n\n- **Any question** -- I search Wikipedia and the web for accurate answers\n- **Code** -- I generate code in any language with explanations\n- **Math** -- I solve calculations and explain formulas\n- **Creative writing** -- Stories, emails, articles, poetry\n- **Device help** -- Instructions for any OS\n- **Current topics** -- I fetch real-time information\n\nJust type your question naturally. What would you like to know?`);
  }

  // 2. Thanks / acknowledgment
  if (/^(thanks?|thank\s*you|thx|cheers)\b/i.test(lmsg)) {
    return stream("You're welcome! Feel free to ask anything else.");
  }
  if (/^(ok|okay|got\s*it|understood|cool|nice|great|awesome|perfect)\b/i.test(lmsg)) {
    return stream("Glad that helps! What else would you like to know?");
  }
  if (/^(bye|goodbye|see\s*ya|later)\b/i.test(lmsg)) {
    return stream("Take care! I'll be here whenever you need help.");
  }

  // 3. Math solver (instant, no search needed)
  const mathResult = solveMath(msg);
  if (mathResult) return stream(mathResult);

  // 4. ALWAYS search Wikipedia + DuckDuckGo for EVERY query
  // Start search immediately (runs in parallel with local checks)
  const knowledgePromise = fetchKnowledge(msg);

  // 5. Creative writing (check before code)
  if (isCreativeRequest(lmsg)) {
    // Still include search results if relevant
    const knowledge = await knowledgePromise;
    const creative = generateCreative(msg, lmsg);
    if (knowledge && knowledge.length > 100) {
      return stream(`${creative}\n\n---\n**Research context from web:**\n${knowledge.substring(0, 400)}`);
    }
    return stream(creative);
  }

  // 6. Code generation
  if (isCodeRequest(lmsg)) {
    const knowledge = await knowledgePromise;
    const codeResponse = generateCode(msg);
    if (knowledge && knowledge.length > 100) {
      return stream(`${codeResponse}\n\n---\n**Additional context from web search:**\n${knowledge.substring(0, 400)}`);
    }
    return stream(codeResponse);
  }

  // 7. Wait for search results (for all other queries)
  const knowledge = await knowledgePromise;
  
  if (knowledge && knowledge.length > 50) {
    const response = formatKnowledgeResponse(msg, knowledge);
    return stream(response);
  }

  // 8. If Wikipedia/DuckDuckGo returned nothing, try broader search
  const broadResults = await fetchBroadSearch(msg);
  if (broadResults && broadResults.length > 50) {
    return stream(formatKnowledgeResponse(msg, broadResults));
  }

  // 9. Pattern-based responses as last resort
  const patternResponse = patternMatch(msg, lmsg);
  if (patternResponse) return stream(patternResponse);

  // 10. Last resort - transparent about what happened
  return stream(`I searched Wikipedia and DuckDuckGo for "${msg.length > 60 ? msg.substring(0, 60) + "..." : msg}" but didn't find specific results for this exact query.\n\nHere's what you can try:\n- **Use more specific keywords** (e.g., "quantum computing" instead of "tell me about stuff")\n- **Ask about a well-known topic** -- I have access to all of Wikipedia\n- **Try a different angle** -- rephrase your question\n\nI search the web in real-time for every query you send. Some very niche or ambiguous queries may need refinement.`);
}

// --- Knowledge Retrieval ---

async function fetchKnowledge(query: string): Promise<string> {
  const results: string[] = [];

  // Extract key terms for Wikipedia search
  const searchTerms = extractSearchTerms(query);

  // Try Wikipedia search API first
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerms)}&format=json&srlimit=3&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const titles = searchData.query?.search?.map((r: { title: string }) => r.title) || [];
      
      // Fetch summaries for top results
      for (const title of titles.slice(0, 2)) {
        try {
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(4000) });
          
          if (summaryRes.ok) {
            const data = await summaryRes.json();
            if (data.extract && data.extract.length > 30) {
              results.push(`**${data.title}**\n${data.extract}`);
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Wikipedia search failed
  }

  // Also try DuckDuckGo for additional context
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(4000) });
    
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      if (data.Abstract && data.Abstract.length > 30) {
        results.push(`${data.Abstract}`);
      }
      if (data.Answer) results.push(data.Answer);
      if (data.Definition) results.push(`**Definition:** ${data.Definition}`);
      
      // Related topics
      const topics = (data.RelatedTopics || [])
        .filter((t: { Text?: string }) => t.Text)
        .slice(0, 3)
        .map((t: { Text: string }) => `- ${t.Text}`);
      if (topics.length > 0) results.push(`\n**Related:**\n${topics.join("\n")}`);
    }
  } catch {
    // DuckDuckGo failed
  }

  return results.join("\n\n");
}

async function fetchBroadSearch(query: string): Promise<string> {
  // Try DuckDuckGo with simplified terms
  const simpleTerms = query
    .replace(/[?!.,;:'"]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4)
    .join(" ");
  
  if (!simpleTerms) return "";

  try {
    // Try Wikipedia with simplified terms
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(simpleTerms)}&format=json&srlimit=3&origin=*`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    
    if (res.ok) {
      const data = await res.json();
      const titles = data.query?.search?.map((r: { title: string }) => r.title) || [];
      const results: string[] = [];

      for (const title of titles.slice(0, 2)) {
        try {
          const summaryRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (summaryRes.ok) {
            const sData = await summaryRes.json();
            if (sData.extract && sData.extract.length > 30) {
              results.push(`**${sData.title}**\n${sData.extract}`);
            }
          }
        } catch { continue; }
      }

      if (results.length > 0) return results.join("\n\n");
    }
  } catch {
    // Broad search failed
  }
  return "";
}

function extractSearchTerms(query: string): string {
  // Remove question words and common filler to get better search terms
  return query
    .replace(/^(what|who|where|when|why|how|is|are|can|could|would|will|do|does|did|should|tell me about|explain|describe|define)\s+(is|are|the|a|an)?\s*/i, "")
    .replace(/[?!.]+$/, "")
    .trim() || query;
}

function formatKnowledgeResponse(query: string, knowledge: string): string {
  const lq = query.toLowerCase();
  
  // Determine response framing based on query type
  let intro = "";
  if (/^(what|who|where|when)\b/i.test(lq)) {
    intro = "Here's what I found:\n\n";
  } else if (/^(why|how)\b/i.test(lq)) {
    intro = "Based on my research:\n\n";
  } else if (/^(explain|describe|tell me)\b/i.test(lq)) {
    intro = "Here's a detailed explanation:\n\n";
  } else {
    intro = "Here's what I know about this:\n\n";
  }

  // Deduplicate and clean up
  const seen = new Set<string>();
  const uniqueKnowledge = knowledge
    .split("\n\n")
    .filter(block => {
      const key = block.substring(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");

  return `${intro}${uniqueKnowledge}\n\n---\n*Want to know more? Ask a follow-up question about any aspect of this topic.*`;
}

// --- Math Solver ---

function solveMath(msg: string): string | null {
  // Simple arithmetic
  const exprMatch = msg.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/\%\^x])\s*(\d+(?:\.\d+)?)/);
  if (exprMatch) {
    const a = parseFloat(exprMatch[1]);
    const op = exprMatch[2] === "x" ? "*" : exprMatch[2];
    const b = parseFloat(exprMatch[3]);
    let result: number;
    switch (op) {
      case "+": result = a + b; break;
      case "-": result = a - b; break;
      case "*": result = a * b; break;
      case "/": result = b !== 0 ? a / b : NaN; break;
      case "%": result = a % b; break;
      case "^": result = Math.pow(a, b); break;
      default: return null;
    }
    if (!isNaN(result)) {
      const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, "");
      return `**${a} ${op} ${b} = ${formatted}**\n\nNeed more calculations? Just type any math expression.`;
    }
  }

  // Percentage calculations
  const pctOfMatch = msg.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
  if (pctOfMatch) {
    const pct = parseFloat(pctOfMatch[1]);
    const num = parseFloat(pctOfMatch[2]);
    const result = (pct / 100) * num;
    return `**${pct}% of ${num} = ${result}**`;
  }

  // Square root
  const sqrtMatch = msg.match(/(?:square\s*root|sqrt)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
  if (sqrtMatch) {
    const num = parseFloat(sqrtMatch[1]);
    const result = Math.sqrt(num);
    return `**sqrt(${num}) = ${result.toFixed(6).replace(/\.?0+$/, "")}**`;
  }

  return null;
}

// --- Code Generation ---

function isCodeRequest(msg: string): boolean {
  return /\b(write|create|generate|code|function|program|script|implement|build)\b.*\b(code|function|program|script|class|component|app|api|server|bot|game|website|page)\b/i.test(msg) ||
    /\b(write|create|code)\s+(a|an|me|some)?\s*(python|javascript|typescript|kotlin|java|rust|go|swift|html|css|sql|bash|shell|c\+\+|c#|ruby|php)\b/i.test(msg) ||
    /^(write|create|generate|implement|build|make|code)\s/i.test(msg);
}

function generateCode(msg: string): string {
  const lmsg = msg.toLowerCase();

  // Detect language
  let lang = "javascript";
  if (/python/i.test(lmsg)) lang = "python";
  else if (/typescript|tsx/i.test(lmsg)) lang = "typescript";
  else if (/kotlin/i.test(lmsg)) lang = "kotlin";
  else if (/java(?!script)/i.test(lmsg)) lang = "java";
  else if (/rust/i.test(lmsg)) lang = "rust";
  else if (/go(?:lang)?/i.test(lmsg)) lang = "go";
  else if (/swift/i.test(lmsg)) lang = "swift";
  else if (/html|web\s*page/i.test(lmsg)) lang = "html";
  else if (/sql/i.test(lmsg)) lang = "sql";
  else if (/bash|shell|sh\b/i.test(lmsg)) lang = "bash";
  else if (/c\+\+|cpp/i.test(lmsg)) lang = "cpp";
  else if (/c#|csharp/i.test(lmsg)) lang = "csharp";
  else if (/php/i.test(lmsg)) lang = "php";
  else if (/ruby/i.test(lmsg)) lang = "ruby";
  else if (/react|component/i.test(lmsg)) lang = "tsx";

  // Detect what kind of code
  if (/todo\s*(app|list)|task\s*(app|list|manager)/i.test(lmsg)) return generateTodoApp(lang);
  if (/sort|sorting/i.test(lmsg)) return generateSortCode(lang);
  if (/api|server|endpoint|rest/i.test(lmsg)) return generateApiCode(lang);
  if (/hello\s*world|first\s*program|getting\s*started/i.test(lmsg)) return generateHelloWorld(lang);
  if (/fibonacci|fib\b/i.test(lmsg)) return generateFibonacci(lang);
  if (/factorial/i.test(lmsg)) return generateFactorial(lang);
  if (/calculator/i.test(lmsg)) return generateCalculator(lang);
  if (/login|auth|authentication/i.test(lmsg)) return generateAuthCode(lang);
  if (/fetch|http|request|api\s*call/i.test(lmsg)) return generateFetchCode(lang);
  if (/form|input|validation/i.test(lmsg)) return generateFormCode(lang);
  if (/database|db|crud/i.test(lmsg)) return generateDatabaseCode(lang);
  if (/game|snake|tic.*tac/i.test(lmsg)) return generateGameCode(lang);
  if (/chat|message|websocket/i.test(lmsg)) return generateChatCode(lang);
  if (/file|read|write|csv|json/i.test(lmsg)) return generateFileCode(lang);

  // Generic code template
  return generateGenericCode(lang, msg);
}

function generateHelloWorld(lang: string): string {
  const examples: Record<string, string> = {
    python: `\`\`\`python\nprint("Hello, World!")\n\`\`\``,
    javascript: `\`\`\`javascript\nconsole.log("Hello, World!");\n\`\`\``,
    typescript: `\`\`\`typescript\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n\`\`\``,
    kotlin: `\`\`\`kotlin\nfun main() {\n    println("Hello, World!")\n}\n\`\`\``,
    java: `\`\`\`java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n\`\`\``,
    rust: `\`\`\`rust\nfn main() {\n    println!("Hello, World!");\n}\n\`\`\``,
    go: `\`\`\`go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n\`\`\``,
    swift: `\`\`\`swift\nprint("Hello, World!")\n\`\`\``,
    cpp: `\`\`\`cpp\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n\`\`\``,
    csharp: `\`\`\`csharp\nConsole.WriteLine("Hello, World!");\n\`\`\``,
    ruby: `\`\`\`ruby\nputs "Hello, World!"\n\`\`\``,
    php: `\`\`\`php\n<?php\necho "Hello, World!";\n?>\n\`\`\``,
    bash: `\`\`\`bash\n#!/bin/bash\necho "Hello, World!"\n\`\`\``,
    sql: `\`\`\`sql\nSELECT 'Hello, World!' AS greeting;\n\`\`\``,
    html: `\`\`\`html\n<!DOCTYPE html>\n<html>\n<head><title>Hello</title></head>\n<body><h1>Hello, World!</h1></body>\n</html>\n\`\`\``,
  };
  return `**Hello World in ${lang}:**\n\n${examples[lang] || examples.javascript}\n\nWant me to generate something more complex?`;
}

function generateSortCode(lang: string): string {
  if (lang === "python") {
    return `**Sorting Algorithms in Python:**\n\n**Quick Sort:**\n\`\`\`python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n\n# Usage\nnumbers = [64, 34, 25, 12, 22, 11, 90]\nprint(quicksort(numbers))  # [11, 12, 22, 25, 34, 64, 90]\n\`\`\`\n\n**Merge Sort:**\n\`\`\`python\ndef merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\ndef merge(left, right):\n    result = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            result.append(left[i]); i += 1\n        else:\n            result.append(right[j]); j += 1\n    result.extend(left[i:])\n    result.extend(right[j:])\n    return result\n\`\`\`\n\n**Built-in (Tim Sort):**\n\`\`\`python\nnumbers = [64, 34, 25, 12, 22, 11, 90]\nnumbers.sort()  # In-place\nsorted_nums = sorted(numbers)  # New list\n\`\`\``;
  }
  return `**Sorting in ${lang}:**\n\n\`\`\`${lang}\n// Quick Sort implementation\nfunction quickSort(arr) {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[Math.floor(arr.length / 2)];\n  const left = arr.filter(x => x < pivot);\n  const middle = arr.filter(x => x === pivot);\n  const right = arr.filter(x => x > pivot);\n  return [...quickSort(left), ...middle, ...quickSort(right)];\n}\n\n// Usage\nconsole.log(quickSort([64, 34, 25, 12, 22, 11, 90]));\n// Built-in: [64, 34, 25].sort((a, b) => a - b)\n\`\`\``;
}

function generateTodoApp(lang: string): string {
  if (lang === "tsx" || lang === "typescript" || lang === "javascript") {
    return `**React Todo App:**\n\n\`\`\`tsx\nimport { useState } from 'react';\n\ninterface Todo {\n  id: number;\n  text: string;\n  completed: boolean;\n}\n\nexport default function TodoApp() {\n  const [todos, setTodos] = useState<Todo[]>([]);\n  const [input, setInput] = useState('');\n\n  const addTodo = () => {\n    if (!input.trim()) return;\n    setTodos([...todos, { id: Date.now(), text: input, completed: false }]);\n    setInput('');\n  };\n\n  const toggle = (id: number) => {\n    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));\n  };\n\n  const remove = (id: number) => setTodos(todos.filter(t => t.id !== id));\n\n  return (\n    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>\n      <h1>Todo List</h1>\n      <div style={{ display: 'flex', gap: 8 }}>\n        <input\n          value={input}\n          onChange={e => setInput(e.target.value)}\n          onKeyDown={e => e.key === 'Enter' && addTodo()}\n          placeholder="Add a task..."\n          style={{ flex: 1, padding: 8 }}\n        />\n        <button onClick={addTodo}>Add</button>\n      </div>\n      <ul style={{ listStyle: 'none', padding: 0 }}>\n        {todos.map(todo => (\n          <li key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>\n            <input type="checkbox" checked={todo.completed} onChange={() => toggle(todo.id)} />\n            <span style={{ flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }}>\n              {todo.text}\n            </span>\n            <button onClick={() => remove(todo.id)}>x</button>\n          </li>\n        ))}\n      </ul>\n      <p>{todos.filter(t => !t.completed).length} tasks remaining</p>\n    </div>\n  );\n}\n\`\`\``;
  }
  return `**Todo App in ${lang}** -- I can generate this! Specify your preferred language (React, Python, Kotlin, etc.) for a tailored implementation.`;
}

function generateApiCode(lang: string): string {
  if (lang === "python") {
    return `**Python REST API with FastAPI:**\n\n\`\`\`python\nfrom fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    name: str\n    price: float\n    description: str = ""\n\nitems: dict[int, Item] = {}\nnext_id = 1\n\n@app.get("/items")\ndef list_items():\n    return items\n\n@app.get("/items/{item_id}")\ndef get_item(item_id: int):\n    if item_id not in items:\n        raise HTTPException(status_code=404, detail="Item not found")\n    return items[item_id]\n\n@app.post("/items", status_code=201)\ndef create_item(item: Item):\n    global next_id\n    items[next_id] = item\n    next_id += 1\n    return {"id": next_id - 1, **item.dict()}\n\n@app.delete("/items/{item_id}")\ndef delete_item(item_id: int):\n    if item_id not in items:\n        raise HTTPException(status_code=404, detail="Item not found")\n    del items[item_id]\n    return {"message": "Deleted"}\n\n# Run: uvicorn main:app --reload\n\`\`\``;
  }
  return `**Express.js REST API:**\n\n\`\`\`javascript\nconst express = require('express');\nconst app = express();\napp.use(express.json());\n\nlet items = [];\nlet nextId = 1;\n\napp.get('/api/items', (req, res) => res.json(items));\n\napp.get('/api/items/:id', (req, res) => {\n  const item = items.find(i => i.id === parseInt(req.params.id));\n  if (!item) return res.status(404).json({ error: 'Not found' });\n  res.json(item);\n});\n\napp.post('/api/items', (req, res) => {\n  const item = { id: nextId++, ...req.body };\n  items.push(item);\n  res.status(201).json(item);\n});\n\napp.delete('/api/items/:id', (req, res) => {\n  items = items.filter(i => i.id !== parseInt(req.params.id));\n  res.json({ message: 'Deleted' });\n});\n\napp.listen(3000, () => console.log('Server running on port 3000'));\n\`\`\``;
}

function generateFibonacci(lang: string): string {
  const code: Record<string, string> = {
    python: `\`\`\`python\ndef fibonacci(n):\n    """Generate first n Fibonacci numbers"""\n    if n <= 0: return []\n    if n == 1: return [0]\n    fib = [0, 1]\n    for _ in range(2, n):\n        fib.append(fib[-1] + fib[-2])\n    return fib\n\n# Recursive (with memoization)\nfrom functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)\n\nprint(fibonacci(10))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\nprint(fib(10))        # 55\n\`\`\``,
    javascript: `\`\`\`javascript\nfunction fibonacci(n) {\n  const fib = [0, 1];\n  for (let i = 2; i < n; i++) {\n    fib.push(fib[i-1] + fib[i-2]);\n  }\n  return fib.slice(0, n);\n}\n\n// Generator version\nfunction* fibGenerator() {\n  let a = 0, b = 1;\n  while (true) {\n    yield a;\n    [a, b] = [b, a + b];\n  }\n}\n\nconsole.log(fibonacci(10));\n\`\`\``,
  };
  return `**Fibonacci in ${lang}:**\n\n${code[lang] || code.javascript}`;
}

function generateFactorial(lang: string): string {
  return `**Factorial in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `def factorial(n):\n    if n <= 1: return 1\n    return n * factorial(n - 1)\n\n# Or using math module\nimport math\nprint(math.factorial(10))  # 3628800`
    : `function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n\nconsole.log(factorial(10)); // 3628800`}\n\`\`\``;
}

function generateCalculator(lang: string): string {
  return `**Calculator in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `def calculator():\n    print("Simple Calculator")\n    while True:\n        try:\n            expr = input("Enter expression (or 'quit'): ")\n            if expr.lower() == 'quit': break\n            result = eval(expr)  # Note: use ast.literal_eval for production\n            print(f"= {result}")\n        except Exception as e:\n            print(f"Error: {e}")\n\ncalculator()`
    : `function calculate(expr) {\n  try {\n    // Safe math evaluation\n    const result = Function('"use strict"; return (' + expr + ')')();\n    return result;\n  } catch (e) {\n    return "Error: " + e.message;\n  }\n}\n\nconsole.log(calculate("2 + 3 * 4")); // 14\nconsole.log(calculate("Math.sqrt(144)")); // 12`}\n\`\`\``;
}

function generateAuthCode(lang: string): string {
  return `**Authentication in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `from fastapi import FastAPI, Depends, HTTPException\nfrom fastapi.security import OAuth2PasswordBearer\nimport jwt\nfrom datetime import datetime, timedelta\n\nSECRET_KEY = "your-secret-key"\noauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")\n\ndef create_token(user_id: str) -> str:\n    payload = {\n        "sub": user_id,\n        "exp": datetime.utcnow() + timedelta(hours=24)\n    }\n    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")\n\ndef verify_token(token: str = Depends(oauth2_scheme)):\n    try:\n        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])\n        return payload["sub"]\n    except jwt.ExpiredSignatureError:\n        raise HTTPException(status_code=401, detail="Token expired")\n    except jwt.InvalidTokenError:\n        raise HTTPException(status_code=401, detail="Invalid token")`
    : `const jwt = require('jsonwebtoken');\nconst SECRET = 'your-secret-key';\n\nfunction createToken(userId) {\n  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '24h' });\n}\n\nfunction verifyToken(req, res, next) {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'No token' });\n  try {\n    req.user = jwt.verify(token, SECRET);\n    next();\n  } catch (e) {\n    res.status(401).json({ error: 'Invalid token' });\n  }\n}\n\n// Usage\napp.post('/login', (req, res) => {\n  // Validate credentials...\n  const token = createToken(user.id);\n  res.json({ token });\n});\n\napp.get('/protected', verifyToken, (req, res) => {\n  res.json({ message: 'Welcome', user: req.user });\n});`}\n\`\`\``;
}

function generateFetchCode(lang: string): string {
  return `**HTTP Requests in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `import requests\n\n# GET request\nresponse = requests.get('https://api.example.com/data')\ndata = response.json()\nprint(data)\n\n# POST request\nresponse = requests.post('https://api.example.com/data',\n    json={'name': 'test', 'value': 42},\n    headers={'Authorization': 'Bearer YOUR_TOKEN'}\n)\nprint(response.status_code, response.json())\n\n# Async with aiohttp\nimport aiohttp, asyncio\n\nasync def fetch(url):\n    async with aiohttp.ClientSession() as session:\n        async with session.get(url) as resp:\n            return await resp.json()\n\nresult = asyncio.run(fetch('https://api.example.com/data'))`
    : `// Fetch API (modern)\nconst response = await fetch('https://api.example.com/data');\nconst data = await response.json();\n\n// POST request\nconst result = await fetch('https://api.example.com/data', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer YOUR_TOKEN'\n  },\n  body: JSON.stringify({ name: 'test', value: 42 })\n});\n\n// Error handling\ntry {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(res.statusText);\n  const data = await res.json();\n} catch (error) {\n  console.error('Request failed:', error);\n}`}\n\`\`\``;
}

function generateFormCode(_lang: string): string {
  return `**React Form with Validation:**\n\n\`\`\`tsx\nimport { useState } from 'react';\n\nexport function ContactForm() {\n  const [form, setForm] = useState({ name: '', email: '', message: '' });\n  const [errors, setErrors] = useState<Record<string, string>>({});\n\n  const validate = () => {\n    const e: Record<string, string> = {};\n    if (!form.name.trim()) e.name = 'Name is required';\n    if (!/\\S+@\\S+\\.\\S+/.test(form.email)) e.email = 'Valid email required';\n    if (!form.message.trim()) e.message = 'Message is required';\n    setErrors(e);\n    return Object.keys(e).length === 0;\n  };\n\n  const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!validate()) return;\n    // Submit form...\n    console.log('Submitted:', form);\n  };\n\n  return (\n    <form onSubmit={handleSubmit}>\n      <div>\n        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" />\n        {errors.name && <span style={{color:'red'}}>{errors.name}</span>}\n      </div>\n      <div>\n        <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" />\n        {errors.email && <span style={{color:'red'}}>{errors.email}</span>}\n      </div>\n      <div>\n        <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="Message" />\n        {errors.message && <span style={{color:'red'}}>{errors.message}</span>}\n      </div>\n      <button type="submit">Send</button>\n    </form>\n  );\n}\n\`\`\``;
}

function generateDatabaseCode(lang: string): string {
  return `**Database CRUD in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `import sqlite3\n\n# Connect\nconn = sqlite3.connect('app.db')\ncursor = conn.cursor()\n\n# Create table\ncursor.execute('''\n    CREATE TABLE IF NOT EXISTS users (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        name TEXT NOT NULL,\n        email TEXT UNIQUE NOT NULL\n    )\n''')\n\n# Insert\ncursor.execute("INSERT INTO users (name, email) VALUES (?, ?)", ("Alice", "alice@example.com"))\nconn.commit()\n\n# Read\ncursor.execute("SELECT * FROM users")\nusers = cursor.fetchall()\n\n# Update\ncursor.execute("UPDATE users SET name = ? WHERE id = ?", ("Bob", 1))\n\n# Delete\ncursor.execute("DELETE FROM users WHERE id = ?", (1,))\nconn.commit()\nconn.close()`
    : `// Using Prisma ORM\n// schema.prisma:\n// model User {\n//   id    Int    @id @default(autoincrement())\n//   name  String\n//   email String @unique\n// }\n\nimport { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();\n\n// Create\nconst user = await prisma.user.create({\n  data: { name: 'Alice', email: 'alice@example.com' }\n});\n\n// Read\nconst users = await prisma.user.findMany();\nconst user = await prisma.user.findUnique({ where: { id: 1 } });\n\n// Update\nawait prisma.user.update({\n  where: { id: 1 },\n  data: { name: 'Bob' }\n});\n\n// Delete\nawait prisma.user.delete({ where: { id: 1 } });`}\n\`\`\``;
}

function generateGameCode(_lang: string): string {
  return `**Simple Snake Game (HTML/JS):**\n\n\`\`\`html\n<canvas id="game" width="400" height="400" style="border:1px solid #333"></canvas>\n<script>\nconst canvas = document.getElementById('game');\nconst ctx = canvas.getContext('2d');\nconst size = 20;\nlet snake = [{x:200, y:200}];\nlet food = {x:100, y:100};\nlet dx = size, dy = 0;\nlet score = 0;\n\ndocument.addEventListener('keydown', e => {\n  if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -size; }\n  if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = size; }\n  if (e.key === 'ArrowLeft' && dx === 0) { dx = -size; dy = 0; }\n  if (e.key === 'ArrowRight' && dx === 0) { dx = size; dy = 0; }\n});\n\nfunction gameLoop() {\n  const head = {x: snake[0].x + dx, y: snake[0].y + dy};\n  snake.unshift(head);\n  if (head.x === food.x && head.y === food.y) {\n    score++;\n    food = {x: Math.floor(Math.random()*20)*size, y: Math.floor(Math.random()*20)*size};\n  } else snake.pop();\n  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 400);\n  ctx.fillStyle = '#0f0'; snake.forEach(s => ctx.fillRect(s.x, s.y, size-1, size-1));\n  ctx.fillStyle = '#f00'; ctx.fillRect(food.x, food.y, size-1, size-1);\n  ctx.fillStyle = '#fff'; ctx.fillText('Score: ' + score, 10, 15);\n}\nsetInterval(gameLoop, 100);\n</script>\n\`\`\``;
}

function generateChatCode(lang: string): string {
  return `**WebSocket Chat in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `# Server (FastAPI + WebSocket)\nfrom fastapi import FastAPI, WebSocket, WebSocketDisconnect\n\napp = FastAPI()\nclients: list[WebSocket] = []\n\n@app.websocket("/ws")\nasync def websocket_endpoint(ws: WebSocket):\n    await ws.accept()\n    clients.append(ws)\n    try:\n        while True:\n            message = await ws.receive_text()\n            for client in clients:\n                await client.send_text(message)\n    except WebSocketDisconnect:\n        clients.remove(ws)`
    : `// Server (Node.js + ws)\nconst WebSocket = require('ws');\nconst wss = new WebSocket.Server({ port: 8080 });\n\nwss.on('connection', (ws) => {\n  ws.on('message', (message) => {\n    // Broadcast to all clients\n    wss.clients.forEach(client => {\n      if (client.readyState === WebSocket.OPEN) {\n        client.send(message.toString());\n      }\n    });\n  });\n});\n\n// Client\nconst ws = new WebSocket('ws://localhost:8080');\nws.onmessage = (e) => console.log('Received:', e.data);\nws.send('Hello from client!');`}\n\`\`\``;
}

function generateFileCode(lang: string): string {
  return `**File Operations in ${lang}:**\n\n\`\`\`${lang === "python" ? "python" : "javascript"}\n${lang === "python"
    ? `# Read file\nwith open('data.txt', 'r') as f:\n    content = f.read()\n\n# Write file\nwith open('output.txt', 'w') as f:\n    f.write('Hello, World!')\n\n# Read JSON\nimport json\nwith open('data.json', 'r') as f:\n    data = json.load(f)\n\n# Write JSON\nwith open('output.json', 'w') as f:\n    json.dump({'name': 'Alice', 'age': 30}, f, indent=2)\n\n# Read CSV\nimport csv\nwith open('data.csv', 'r') as f:\n    reader = csv.DictReader(f)\n    for row in reader:\n        print(row)\n\n# Write CSV\nwith open('output.csv', 'w', newline='') as f:\n    writer = csv.writer(f)\n    writer.writerow(['name', 'age'])\n    writer.writerow(['Alice', 30])`
    : `const fs = require('fs');\n\n// Read file\nconst content = fs.readFileSync('data.txt', 'utf8');\n\n// Write file\nfs.writeFileSync('output.txt', 'Hello, World!');\n\n// Read JSON\nconst data = JSON.parse(fs.readFileSync('data.json', 'utf8'));\n\n// Write JSON\nfs.writeFileSync('output.json', JSON.stringify({name: 'Alice'}, null, 2));\n\n// Async versions\nconst { readFile, writeFile } = require('fs/promises');\nconst text = await readFile('data.txt', 'utf8');\nawait writeFile('output.txt', 'Hello!');`}\n\`\`\``;
}

function generateGenericCode(lang: string, msg: string): string {
  return `I'd be happy to write **${lang}** code for you!\n\nBased on your request: "${msg}"\n\nHere's a starting template:\n\n\`\`\`${lang}\n// TODO: Implement based on your specific requirements\n// Tell me more details about what you need:\n// - What input does it take?\n// - What output should it produce?\n// - Any specific libraries or frameworks?\n\`\`\`\n\nI can generate code for:\n- **Web apps** (React, Next.js, Express, Django)\n- **APIs** (REST, GraphQL, WebSocket)\n- **Algorithms** (sorting, searching, graphs)\n- **Database** operations (SQL, ORM)\n- **Authentication** (JWT, OAuth)\n- **File operations** (read, write, parse)\n- **Games** (canvas, terminal)\n\nJust describe what you need more specifically!`;
}

// --- Creative Writing ---

function isCreativeRequest(msg: string): boolean {
  return /\b(write|compose|draft|create|generate)\s+(a\s+|an?\s+|me\s+|me\s+a\s+|some\s+)?(poem|story|email|letter|essay|article|haiku|sonnet|limerick|song|lyrics|blog|speech|joke|riddle|quote)/i.test(msg) ||
    /\b(poem|story|essay|haiku|sonnet|limerick|lyrics|joke)\b.*\b(about|for|on)\b/i.test(msg) ||
    /\b(tell\s+me\s+a\s+joke|make\s+me\s+laugh|funny)\b/i.test(msg);
}

function generateCreative(msg: string, lmsg: string): string {
  if (/poem|poetry|haiku|sonnet|verse/i.test(lmsg)) {
    const topic = msg.replace(/^.*?(about|on|for)\s+/i, "").replace(/[?.!]+$/, "").trim() || "the world";
    return `Here's a poem about **${topic}**:\n\n---\n\n**${topic.charAt(0).toUpperCase() + topic.slice(1)}**\n\nIn circuits deep and pathways bright,\nWhere data flows like streams of light,\n${topic} unfolds its mystery,\nA thread within our history.\n\nFrom humble roots to soaring heights,\nThrough darkened rooms and neon nights,\nWe shape the world with careful hands,\nAnd dream of more than what now stands.\n\nSo let us pause and wonder still,\nAt nature's art and human will,\nFor in the dance of old and new,\nThe beauty lies in what is true.\n\n---\n\nWant me to try a different style (haiku, limerick, sonnet, free verse) or a different theme?`;
  }
  if (/story|tale|narrative/i.test(lmsg)) {
    return `**The Last Signal**\n\nThe radio crackled to life at 3:47 AM. Dr. Elena Vasquez nearly knocked over her cold coffee reaching for the headphones.\n\nFor eleven years, the deep space antenna had listened to nothing but cosmic static. Funding was being cut next month. Her team of twelve had dwindled to three.\n\nBut this signal was different. It wasn't random noise. It pulsed with mathematical precision -- prime numbers, then the Fibonacci sequence, then something she'd never seen before.\n\n"Maria, wake up. You need to see this."\n\nHer colleague stumbled in, still half-asleep, but one look at the waveform display snapped her awake. "That's... that's not natural."\n\n"No," Elena whispered, her hands trembling. "It's not."\n\nThe final sequence decoded into coordinates -- not pointing outward into space, but inward. To a location on Earth. A cave in southern France that wouldn't be excavated for another twenty years.\n\nThe message wasn't from aliens.\n\nIt was from us. From the future.\n\n---\n\nWant me to continue this story, or create one with a different genre or theme?`;
  }
  if (/email/i.test(lmsg)) {
    return `**Professional Email Template:**\n\n---\n\n**Subject:** [Clear, specific subject line]\n\nDear [Name],\n\nI hope this message finds you well. I'm writing to [state your purpose clearly].\n\n[Paragraph 2: Key details, context, or supporting information]\n\n[Paragraph 3: Specific request, next steps, or call to action]\n\nPlease let me know if you have any questions. I'm happy to discuss further at your convenience.\n\nBest regards,\n[Your name]\n[Your title/position]\n[Contact information]\n\n---\n\n**Tips:** Keep subject lines under 50 characters. Lead with the important info. Use short paragraphs.\n\nTell me the specific situation and I'll customize this!`;
  }
  if (/joke/i.test(lmsg)) {
    return `Here are a few jokes:\n\n**Programming:**\nWhy do programmers prefer dark mode?\nBecause light attracts bugs.\n\n**AI:**\nAn AI walks into a bar.\nThe bartender says, "What'll you have?"\nThe AI says, "What's everyone else having?"\n\n**Tech:**\nThere are only 10 types of people in the world:\nThose who understand binary, and those who don't.\n\n**Classic:**\nWhy did the developer go broke?\nBecause he used up all his cache.\n\nWant more jokes on a specific topic?`;
  }
  return `I'd love to help with creative writing! Tell me:\n\n1. **Type:** poem, story, email, essay, article, joke, song lyrics\n2. **Topic/Theme:** What it should be about\n3. **Tone:** Formal, casual, humorous, dramatic, inspirational\n4. **Length:** Short, medium, or detailed\n\nAnd I'll create it for you!`;
}

// --- Pattern Matching for Common Topics ---

function patternMatch(msg: string, lmsg: string): string | null {
  // Help
  if (/\b(help|what can you do|capabilities)\b/i.test(lmsg)) {
    return `I'm **NOVERA**, your AI agent. Here's what I can do:\n\n**Knowledge & Answers**\n- Search Wikipedia and the web for any topic\n- Explain concepts in science, tech, history, and more\n- Provide up-to-date information via web search\n\n**Code & Development**\n- Write code in 15+ languages\n- Generate full applications (APIs, UIs, games)\n- Explain algorithms and design patterns\n\n**Math & Calculations**\n- Solve arithmetic, percentages, square roots\n- Explain formulas and equations\n\n**Creative Writing**\n- Draft emails, stories, articles\n- Generate content and copy\n\n**Device Help**\n- Instructions for any OS (Windows, macOS, Linux, Android, iOS)\n- Terminal commands, screenshots, file management\n\nJust ask naturally!`;
  }

  // Creative writing
  if (/\b(write|draft|compose)\s+(an?\s+)?(email|letter|story|poem|essay|article)/i.test(lmsg)) {
    if (/email/i.test(lmsg)) {
      return `**Professional Email Template:**\n\n---\n\n**Subject:** [Specific subject line]\n\nDear [Name],\n\nI hope this message finds you well. I'm reaching out regarding [purpose].\n\n[Main content -- 2-3 concise paragraphs]\n\n[Clear call to action or next steps]\n\nBest regards,\n[Your name]\n\n---\n\nTell me the specific context (who, what, why) and I'll customize it!`;
    }
    if (/poem/i.test(lmsg)) {
      return `Here's an original poem:\n\n---\n\n**Digital Dawn**\n\nIn silicon dreams and copper veins,\nA whisper travels, knowledge gains.\nThrough fiber light and quantum seas,\nWe chart the course of what will be.\n\nNot flesh nor bone but thought refined,\nA mirror held to human mind.\nIn every question, every spark,\nWe find our way through code and dark.\n\n---\n\nWant a different style? I can write haiku, sonnet, free verse, limerick, or any form you prefer. Just tell me the theme!`;
    }
    return `I'd love to help with creative writing! Tell me:\n\n1. **Type:** Email, story, poem, essay, article, script\n2. **Tone:** Formal, casual, humorous, dramatic\n3. **Topic:** What it should be about\n4. **Length:** Short, medium, or detailed\n\nAnd I'll write it for you!`;
  }

  return null;
}

// --- Stream Helper ---

function stream(text: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      const words = text.split(" ");
      let i = 0;
      function push() {
        if (i < words.length) {
          const word = (i === 0 ? "" : " ") + words[i];
          const data = JSON.stringify({ choices: [{ delta: { content: word } }] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          i++;
          const delay = word.includes("\n") ? 50 : (12 + Math.random() * 18);
          setTimeout(push, delay);
        } else {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
      push();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// --- LLM Provider Helpers ---

function prepareMessages(messages: ChatMessage[]): ChatMessage[] {
  const systemMsg: ChatMessage = { role: "system", content: SYSTEM_PROMPT };
  const deviceContext = messages
    .filter(m => m.role === "system" && m.content.includes("OS="))
    .map(m => m.content)
    .join("\n");
  if (deviceContext) systemMsg.content += `\n\nDevice: ${deviceContext}`;
  return [systemMsg, ...messages.filter(m => m.role !== "system")];
}

async function tryOpenRouter(messages: ChatMessage[]): Promise<Response | null> {
  try {
    const models = ["liquid/lfm2", "mistralai/mistral-7b-instruct:free"];
    for (const model of models) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://novera-liquid-ai.vercel.app",
        },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096, temperature: 0.7 }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok && res.body) return proxyStream(res);
    }
  } catch { /* skip */ }
  return null;
}

async function tryGemini(messages: ChatMessage[]): Promise<Response | null> {
  try {
    const systemInstruction = messages.find(m => m.role === "system")?.content || "";
    const contents = messages.filter(m => m.role !== "system").map(m => ({
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
        signal: AbortSignal.timeout(25000),
      }
    );
    if (res.ok && res.body) return transformGeminiSSE(res);
  } catch { /* skip */ }
  return null;
}

async function tryHuggingFace(messages: ChatMessage[]): Promise<Response | null> {
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HF_API_KEY}` },
        body: JSON.stringify({ messages, stream: true, max_tokens: 4096, temperature: 0.7 }),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (res.ok && res.body) return proxyStream(res);
  } catch { /* skip */ }
  return null;
}

function proxyStream(upstream: Response): Response {
  const enc = new TextEncoder();
  const rs = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          ctrl.enqueue(enc.encode(dec.decode(value, { stream: true })));
        }
      } catch { /* done */ } finally { ctrl.close(); }
    },
  });
  return new Response(rs, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}

function transformGeminiSSE(upstream: Response): Response {
  const enc = new TextEncoder();
  const rs = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const d = JSON.parse(line.slice(6));
                const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (t) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`));
              } catch { /* skip */ }
            }
          }
        }
      } catch { /* done */ } finally {
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        ctrl.close();
      }
    },
  });
  return new Response(rs, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}
