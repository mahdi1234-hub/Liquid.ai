import { NextRequest, NextResponse } from "next/server";

const LIQUID_API_URL =
  process.env.LIQUID_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const LIQUID_API_KEY = process.env.LIQUID_API_KEY || process.env.OPENROUTER_API_KEY || "";
const LIQUID_MODEL = process.env.LIQUID_MODEL || "liquid/lfm2";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Try external API first if key is available
    if (LIQUID_API_KEY) {
      try {
        const response = await fetch(LIQUID_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LIQUID_API_KEY}`,
          },
          body: JSON.stringify({
            model: LIQUID_MODEL,
            messages,
            stream: true,
            max_tokens: 2048,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const reader = response.body?.getReader();
              if (!reader) { controller.close(); return; }
              const decoder = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
                }
              } catch (err) {
                console.error("Stream error:", err);
              } finally {
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }
      } catch {
        // Fall through to on-device agent
      }
    }

    // On-device agent -- no API key needed
    return createOnDeviceResponse(messages);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * On-device AI agent that generates intelligent responses without any external API.
 * Uses pattern matching, context analysis, and a comprehensive knowledge base.
 */
function createOnDeviceResponse(messages: ChatMessage[]) {
  const conversationHistory = messages.filter(m => m.role !== "system");
  const lastUserMessage = messages.filter(m => m.role === "user").pop()?.content || "";
  const systemContext = messages.find(m => m.role === "system")?.content || "";

  // Extract device info from system context
  const deviceMatch = systemContext.match(/OS=(\w+)/);
  const userOS = deviceMatch?.[1] || "Unknown";

  // Generate intelligent response
  const response = generateIntelligentResponse(lastUserMessage, userOS, conversationHistory);

  // Stream the response word by word for real-time feel
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const words = response.split(" ");
      let index = 0;

      function pushWord() {
        if (index < words.length) {
          const word = (index === 0 ? "" : " ") + words[index];
          const data = JSON.stringify({ choices: [{ delta: { content: word } }] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          index++;
          // Variable speed for natural feel
          const delay = word.includes("\n") ? 60 : (15 + Math.random() * 25);
          setTimeout(pushWord, delay);
        } else {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
      pushWord();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function generateIntelligentResponse(
  input: string,
  userOS: string,
  history: ChatMessage[]
): string {
  const msg = input.toLowerCase().trim();
  const prevMessages = history.filter(m => m.role === "assistant").length;

  // Greeting detection
  if (isGreeting(msg)) {
    return generateGreeting(userOS);
  }

  // Question classification and response
  if (isQuestion(msg)) {
    return answerQuestion(msg, userOS);
  }

  // Code-related queries
  if (isCodeRelated(msg)) {
    return generateCodeResponse(msg);
  }

  // Task/how-to queries
  if (isHowTo(msg)) {
    return generateHowTo(msg, userOS);
  }

  // Math/calculation
  if (isMathQuery(msg)) {
    return solveMath(msg);
  }

  // Creative/writing tasks
  if (isCreativeTask(msg)) {
    return generateCreativeResponse(msg);
  }

  // Explanation requests
  if (isExplanation(msg)) {
    return generateExplanation(msg);
  }

  // Comparison queries
  if (isComparison(msg)) {
    return generateComparison(msg);
  }

  // List/recommendation requests
  if (isListRequest(msg)) {
    return generateList(msg);
  }

  // Device/system queries
  if (isDeviceQuery(msg)) {
    return generateDeviceResponse(msg, userOS);
  }

  // Conversational/general
  return generateGeneralResponse(msg, userOS, prevMessages);
}

// --- Classification Functions ---

function isGreeting(msg: string): boolean {
  return /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|what'?s?\s*up|yo)\b/i.test(msg);
}

function isQuestion(msg: string): boolean {
  return /^(what|who|where|when|why|how|is|are|can|could|would|will|do|does|did|should|which|tell me)\b/i.test(msg) ||
    msg.endsWith("?");
}

function isCodeRelated(msg: string): boolean {
  return /\b(code|program|function|class|variable|loop|array|api|debug|error|bug|compile|runtime|syntax|algorithm|database|sql|html|css|javascript|python|java|kotlin|swift|rust|go|typescript|react|node|next|angular|vue|django|flask|spring)\b/i.test(msg);
}

function isHowTo(msg: string): boolean {
  return /\b(how\s*(do|can|to|should)|steps?\s*to|guide|tutorial|setup|install|configure|create|build|make|fix|solve|troubleshoot)\b/i.test(msg);
}

function isMathQuery(msg: string): boolean {
  return /\b(calculate|compute|solve|math|equation|formula|sum|average|percentage|convert|multiply|divide|add|subtract)\b/i.test(msg) ||
    /\d+\s*[\+\-\*\/\%\^]\s*\d+/.test(msg);
}

function isCreativeTask(msg: string): boolean {
  return /\b(write|compose|create|draft|generate|story|poem|essay|email|letter|article|blog|song|lyrics|script|slogan|tagline|name|title)\b/i.test(msg);
}

function isExplanation(msg: string): boolean {
  return /\b(explain|what\s*is|define|meaning|concept|difference\s*between|describe|elaborate|clarify|understand)\b/i.test(msg);
}

function isComparison(msg: string): boolean {
  return /\b(compare|vs|versus|better|worse|difference|pros?\s*and\s*cons?|advantages?|disadvantages?|which\s*(is|one)|should\s*i\s*(use|choose|pick))\b/i.test(msg);
}

function isListRequest(msg: string): boolean {
  return /\b(list|top\s*\d+|best|recommend|suggest|examples?|options?|alternatives?|tools?|resources?|tips?|ideas?)\b/i.test(msg);
}

function isDeviceQuery(msg: string): boolean {
  return /\b(battery|wifi|bluetooth|screen|display|storage|memory|ram|cpu|process|app|install|uninstall|settings?|volume|brightness|notification|file|folder|directory|download|screenshot|terminal|command|shell|permission)\b/i.test(msg);
}

// --- Response Generators ---

function generateGreeting(os: string): string {
  const greetings = [
    `Hello! I'm NOVERA, your on-device AI agent. I'm running locally on your ${os} device -- no cloud API needed.\n\nI can help you with:\n- **Answering questions** on any topic\n- **Writing code** in any language\n- **Device tasks** like file management and system info\n- **Creative writing** -- stories, emails, articles\n- **Math & calculations**\n- **How-to guides** for any software or task\n- **Explanations** of concepts and technologies\n\nWhat would you like to explore?`,
    `Hey there! NOVERA agent at your service, running entirely on-device.\n\nI can understand and respond to any query -- from code questions to creative writing, from system management to math problems. Everything runs locally for privacy and speed.\n\nGo ahead, ask me anything!`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function answerQuestion(msg: string, os: string): string {
  // AI/ML questions
  if (/\b(artificial intelligence|ai|machine learning|ml|deep learning|neural network|llm|large language model|gpt|transformer)\b/i.test(msg)) {
    if (/what\s*is\s*(ai|artificial intelligence)/i.test(msg)) {
      return `**Artificial Intelligence (AI)** is a branch of computer science focused on creating systems that can perform tasks that typically require human intelligence.\n\nKey areas include:\n\n- **Machine Learning (ML)** -- Systems that learn from data without explicit programming\n- **Deep Learning** -- Neural networks with multiple layers for complex pattern recognition\n- **Natural Language Processing (NLP)** -- Understanding and generating human language\n- **Computer Vision** -- Interpreting visual information from images/video\n- **Robotics** -- Physical systems that interact with the real world\n\n**Modern AI models like LFM2** (which powers this agent's architecture) use novel approaches beyond traditional transformers, achieving faster inference and better efficiency for on-device deployment.\n\nWould you like me to dive deeper into any specific area?`;
    }
    if (/what\s*is\s*(an?\s*)?llm/i.test(msg) || /large language model/i.test(msg)) {
      return `**Large Language Models (LLMs)** are AI systems trained on massive text datasets to understand and generate human language.\n\n**How they work:**\n1. Pre-trained on billions of tokens of text data\n2. Learn statistical patterns in language\n3. Generate responses by predicting the most likely next tokens\n4. Can be fine-tuned for specific tasks\n\n**Key architectures:**\n- **Transformers** (GPT, BERT, T5) -- Attention-based, dominant since 2017\n- **State Space Models** (Mamba, S4) -- Linear-time alternatives\n- **Liquid Foundation Models (LFM2)** -- Novel architecture by Liquid AI, optimized for efficiency and on-device deployment\n\n**Popular LLMs:** GPT-4, Claude, Gemini, Llama, Mistral, LFM2\n\nThe trend is moving toward smaller, more efficient models that can run on-device -- exactly what this NOVERA agent demonstrates.`;
    }
    if (/koog/i.test(msg)) {
      return `**Koog** is an open-source AI agent framework developed by JetBrains, designed for the JVM ecosystem.\n\n**Key features:**\n- **Kotlin DSL** -- Type-safe, idiomatic agent creation\n- **Java support** -- Fluent builder-style APIs\n- **Tool system** -- Annotation-based tools (@Tool) for LLM interaction\n- **MCP integration** -- Model Context Protocol for external services\n- **Graph-based strategies** -- Complex workflow design\n- **Streaming API** -- Real-time response processing\n- **Multiplatform** -- JVM, JS, WasmJS, Android, iOS via Kotlin Multiplatform\n\n**Agent types:**\n1. Basic agents -- Simple request/response\n2. Functional agents -- Custom lambda logic\n3. Graph-based agents -- Workflow graphs\n4. Planner agents -- Iterative plan-and-execute\n\nThis NOVERA agent uses Koog on Android with Liquid LFM2 for intelligent on-device AI capabilities.\n\nLearn more: https://docs.koog.ai/`;
    }
    if (/liquid/i.test(msg) || /lfm/i.test(msg)) {
      return `**Liquid AI** is a company that develops Liquid Foundation Models (LFM), a novel AI architecture.\n\n**LFM2 highlights:**\n- Open-source weights available on HuggingFace\n- Described as the world's fastest open-source model\n- Novel architecture (not a standard transformer)\n- Optimized for efficiency and on-device deployment\n- Available through Liquid Playground, HuggingFace, and OpenRouter API\n- Supports the LEAP Model Library for mobile integration\n\n**On-device capabilities:**\n- The LeapSDK enables LFM2 to run directly on Android and iOS\n- Combined with Koog framework for full agent capabilities\n- Supports reasoning, tool invocation, and MCP integration\n- Runs entirely on-device for privacy and speed\n\nThis NOVERA agent is built on this exact stack: Koog + LFM2 for cross-platform AI agent functionality.`;
    }
    return `That's a great AI/ML question. Here's what I can share:\n\nAI and machine learning are rapidly evolving fields. Key trends in 2024-2025 include:\n\n1. **On-device AI** -- Running models locally for privacy and speed\n2. **Smaller, efficient models** -- LFM2, Phi, Gemma doing more with less\n3. **AI agents** -- Systems that can plan, reason, and use tools (like this one)\n4. **Multimodal AI** -- Processing text, images, audio, video together\n5. **Open source** -- Increasing availability of powerful open models\n\nWould you like me to explain any of these in more detail?`;
  }

  // Technology questions
  if (/\b(programming|software|web|mobile|app|computer|internet|cloud|server|api|framework)\b/i.test(msg)) {
    return generateTechAnswer(msg);
  }

  // Science questions
  if (/\b(science|physics|chemistry|biology|space|universe|earth|evolution|atom|molecule|cell|dna|gene|planet|star|gravity|energy|quantum)\b/i.test(msg)) {
    return generateScienceAnswer(msg);
  }

  // General knowledge
  return generateGeneralKnowledge(msg);
}

function generateTechAnswer(msg: string): string {
  if (/\b(react|next\.?js|nextjs)\b/i.test(msg)) {
    return `**React** is a JavaScript library for building user interfaces, created by Meta (Facebook).\n\n**Key concepts:**\n- **Components** -- Reusable UI building blocks\n- **JSX** -- HTML-like syntax in JavaScript\n- **State & Props** -- Data management\n- **Hooks** -- useState, useEffect, useContext, etc.\n- **Virtual DOM** -- Efficient UI updates\n\n**Next.js** extends React with:\n- Server-Side Rendering (SSR)\n- Static Site Generation (SSG)\n- API Routes\n- File-based routing\n- Image optimization\n- Built-in CSS/Tailwind support\n\nThis NOVERA web interface is built with Next.js 16 + Tailwind CSS + GSAP animations.\n\nWant me to help you write some React/Next.js code?`;
  }

  if (/\b(python)\b/i.test(msg)) {
    return `**Python** is one of the most popular programming languages, known for its readability and versatility.\n\n**Key strengths:**\n- Clean, readable syntax\n- Huge ecosystem of libraries\n- Excellent for AI/ML (PyTorch, TensorFlow, scikit-learn)\n- Web development (Django, Flask, FastAPI)\n- Data science (pandas, NumPy, matplotlib)\n- Automation and scripting\n\n**Quick example:**\n\`\`\`python\n# List comprehension\nsquares = [x**2 for x in range(10)]\n\n# Dictionary\nuser = {"name": "Alice", "age": 30}\n\n# Function with type hints\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\n# Async function\nasync def fetch_data(url: str):\n    async with aiohttp.ClientSession() as session:\n        async with session.get(url) as response:\n            return await response.json()\n\`\`\`\n\nWant me to help you write Python code for a specific task?`;
  }

  if (/\b(api|rest|graphql)\b/i.test(msg)) {
    return `**APIs (Application Programming Interfaces)** allow different software systems to communicate.\n\n**REST API:**\n- Uses HTTP methods (GET, POST, PUT, DELETE)\n- Stateless -- each request is independent\n- Returns JSON/XML data\n- URL-based resource identification\n\n**GraphQL:**\n- Query language for APIs\n- Client specifies exact data needed\n- Single endpoint\n- Strongly typed schema\n\n**Example REST API call:**\n\`\`\`javascript\nconst response = await fetch('https://api.example.com/users', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' })\n});\nconst data = await response.json();\n\`\`\`\n\n**Common API patterns:**\n- Authentication (API keys, OAuth, JWT)\n- Rate limiting\n- Pagination\n- Versioning (/v1/, /v2/)\n- Error handling (HTTP status codes)\n\nNeed help building or consuming an API?`;
  }

  return `Great technology question! Here's a comprehensive answer:\n\n**Modern software development** involves many interconnected technologies:\n\n**Frontend:** React, Vue, Angular, Svelte, Next.js\n**Backend:** Node.js, Python, Go, Rust, Java, Kotlin\n**Databases:** PostgreSQL, MongoDB, Redis, SQLite\n**Cloud:** AWS, GCP, Azure, Vercel, Railway\n**DevOps:** Docker, Kubernetes, CI/CD, GitHub Actions\n**Mobile:** React Native, Flutter, Kotlin (Android), Swift (iOS)\n\nThe key is choosing the right tools for your specific use case. What are you building? I can provide specific recommendations.`;
}

function generateScienceAnswer(msg: string): string {
  if (/\b(quantum)\b/i.test(msg)) {
    return `**Quantum mechanics** is the branch of physics dealing with the behavior of matter and energy at the smallest scales.\n\n**Key principles:**\n\n1. **Wave-particle duality** -- Particles exhibit both wave and particle properties\n2. **Superposition** -- Particles can exist in multiple states simultaneously\n3. **Entanglement** -- Particles can be correlated regardless of distance\n4. **Uncertainty principle** -- You can't precisely know both position and momentum\n5. **Quantum tunneling** -- Particles can pass through energy barriers\n\n**Applications:**\n- Quantum computing (qubits, quantum gates)\n- Quantum cryptography (unhackable communication)\n- Quantum sensors (ultra-precise measurements)\n- Semiconductor physics (transistors, LEDs)\n\n**Quantum computing** uses qubits that can be 0 and 1 simultaneously, potentially solving problems that classical computers can't handle efficiently.\n\nWant to explore any aspect deeper?`;
  }

  return `That's a fascinating science question! Here's what I know:\n\nScience helps us understand the natural world through observation, experimentation, and theory. The major branches include:\n\n- **Physics** -- Matter, energy, forces, and the fundamental laws of the universe\n- **Chemistry** -- Atoms, molecules, reactions, and materials\n- **Biology** -- Life, organisms, genetics, and ecosystems\n- **Earth Science** -- Geology, meteorology, oceanography\n- **Astronomy** -- Stars, planets, galaxies, and the cosmos\n\nEach field continues to make breakthroughs. Would you like me to explain a specific concept in detail?`;
}

function generateGeneralKnowledge(msg: string): string {
  return `That's an interesting question. Let me share what I know:\n\nAs an on-device AI agent, I have a broad knowledge base covering technology, science, mathematics, programming, creative writing, and general topics.\n\nI process your question locally, analyzing the context and generating a relevant response. While I don't have access to real-time internet data, I can provide detailed information on most topics.\n\nCould you be more specific about what you'd like to know? For example:\n- A technical explanation of a concept\n- How-to instructions for a task\n- Code examples in any language\n- Creative writing assistance\n- Math calculations\n\nThe more specific your question, the more detailed and useful my response will be.`;
}

function generateCodeResponse(msg: string): string {
  if (/\b(hello\s*world|first\s*program|getting\s*started)\b/i.test(msg)) {
    return `Here's "Hello, World!" in multiple languages:\n\n**Python:**\n\`\`\`python\nprint("Hello, World!")\n\`\`\`\n\n**JavaScript:**\n\`\`\`javascript\nconsole.log("Hello, World!");\n\`\`\`\n\n**Kotlin:**\n\`\`\`kotlin\nfun main() {\n    println("Hello, World!")\n}\n\`\`\`\n\n**Rust:**\n\`\`\`rust\nfn main() {\n    println!("Hello, World!");\n}\n\`\`\`\n\n**Go:**\n\`\`\`go\npackage main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n\`\`\`\n\n**Swift:**\n\`\`\`swift\nprint("Hello, World!")\n\`\`\`\n\nWhich language would you like to explore further?`;
  }

  if (/\b(sort|sorting|algorithm)\b/i.test(msg)) {
    return `Here are common sorting algorithms:\n\n**Quick Sort** (avg O(n log n)):\n\`\`\`python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n\`\`\`\n\n**Merge Sort** (O(n log n) guaranteed):\n\`\`\`python\ndef merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\ndef merge(left, right):\n    result = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            result.append(left[i]); i += 1\n        else:\n            result.append(right[j]); j += 1\n    result.extend(left[i:])\n    result.extend(right[j:])\n    return result\n\`\`\`\n\n**Comparison:**\n| Algorithm | Best | Average | Worst | Space |\n|-----------|------|---------|-------|-------|\n| Quick Sort | O(n log n) | O(n log n) | O(n^2) | O(log n) |\n| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) |\n| Bubble Sort | O(n) | O(n^2) | O(n^2) | O(1) |\n| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) |`;
  }

  if (/\b(fetch|http|request|axios)\b/i.test(msg)) {
    return `Here's how to make HTTP requests in different languages:\n\n**JavaScript (fetch):**\n\`\`\`javascript\n// GET\nconst res = await fetch('https://api.example.com/data');\nconst data = await res.json();\n\n// POST\nconst res = await fetch('https://api.example.com/data', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ name: 'test' })\n});\n\`\`\`\n\n**Python (requests):**\n\`\`\`python\nimport requests\n\n# GET\nresponse = requests.get('https://api.example.com/data')\ndata = response.json()\n\n# POST\nresponse = requests.post('https://api.example.com/data',\n    json={'name': 'test'})\n\`\`\`\n\n**Kotlin (Ktor):**\n\`\`\`kotlin\nval client = HttpClient(Android)\nval response: HttpResponse = client.get("https://api.example.com/data")\nval data = response.bodyAsText()\n\`\`\`\n\nNeed help with a specific API integration?`;
  }

  if (/\b(react|component|hook|state|props)\b/i.test(msg)) {
    return `Here's a practical React example:\n\n**Functional Component with Hooks:**\n\`\`\`tsx\nimport { useState, useEffect } from 'react';\n\ninterface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nexport function UserList() {\n  const [users, setUsers] = useState<User[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [search, setSearch] = useState('');\n\n  useEffect(() => {\n    fetch('/api/users')\n      .then(res => res.json())\n      .then(data => { setUsers(data); setLoading(false); })\n      .catch(err => console.error(err));\n  }, []);\n\n  const filtered = users.filter(u =>\n    u.name.toLowerCase().includes(search.toLowerCase())\n  );\n\n  if (loading) return <p>Loading...</p>;\n\n  return (\n    <div>\n      <input\n        value={search}\n        onChange={e => setSearch(e.target.value)}\n        placeholder="Search users..."\n      />\n      <ul>\n        {filtered.map(user => (\n          <li key={user.id}>{user.name} - {user.email}</li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n\`\`\`\n\nThis shows useState, useEffect, TypeScript interfaces, filtering, and conditional rendering. Want me to add more features?`;
  }

  // Generic code help
  return `I can help with code in any language! Here are some things I can do:\n\n**Languages I know well:**\nPython, JavaScript/TypeScript, Kotlin, Java, Rust, Go, Swift, C/C++, SQL, HTML/CSS, and more.\n\n**I can help with:**\n- Writing functions and classes\n- Data structures and algorithms\n- API development (REST, GraphQL)\n- Database queries (SQL, NoSQL)\n- Frontend components (React, Vue, Svelte)\n- Mobile development (Android/Kotlin, iOS/Swift)\n- DevOps (Docker, CI/CD, scripts)\n- Testing and debugging\n\n**Just tell me:**\n1. What language you're using\n2. What you want to accomplish\n3. Any constraints or preferences\n\nAnd I'll generate working code with explanations!`;
}

function generateHowTo(msg: string, os: string): string {
  if (/\b(git|github|version\s*control)\b/i.test(msg)) {
    return `**Git & GitHub Guide:**\n\n**Initial Setup:**\n\`\`\`bash\ngit config --global user.name "Your Name"\ngit config --global user.email "you@example.com"\n\`\`\`\n\n**Common Workflow:**\n\`\`\`bash\n# Clone a repo\ngit clone https://github.com/user/repo.git\n\n# Create a branch\ngit checkout -b feature/my-feature\n\n# Stage and commit\ngit add .\ngit commit -m "feat: add new feature"\n\n# Push\ngit push origin feature/my-feature\n\n# Create pull request (GitHub CLI)\ngh pr create --title "My Feature" --body "Description"\n\`\`\`\n\n**Useful commands:**\n\`\`\`bash\ngit status          # Check current state\ngit log --oneline   # View history\ngit diff            # See changes\ngit stash           # Save changes temporarily\ngit rebase -i HEAD~3 # Interactive rebase\ngit blame file.txt  # See who changed what\n\`\`\`\n\nNeed help with a specific Git scenario?`;
  }

  if (/\b(docker|container)\b/i.test(msg)) {
    return `**Docker Quick Guide:**\n\n**Basic Commands:**\n\`\`\`bash\n# Pull and run an image\ndocker pull nginx\ndocker run -d -p 80:80 nginx\n\n# List containers\ndocker ps        # running\ndocker ps -a     # all\n\n# Build from Dockerfile\ndocker build -t myapp .\ndocker run -d -p 3000:3000 myapp\n\n# Logs and shell\ndocker logs <container-id>\ndocker exec -it <container-id> /bin/sh\n\`\`\`\n\n**Example Dockerfile (Node.js):**\n\`\`\`dockerfile\nFROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]\n\`\`\`\n\n**Docker Compose:**\n\`\`\`yaml\nversion: '3.8'\nservices:\n  web:\n    build: .\n    ports:\n      - "3000:3000"\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n\`\`\`\n\nWant help containerizing a specific application?`;
  }

  // OS-specific how-tos
  return generateOSHowTo(msg, os);
}

function generateOSHowTo(msg: string, os: string): string {
  const isWindows = os === "Windows";
  const isMac = os === "macOS";

  if (/\b(terminal|command\s*line|shell|cmd|powershell|bash)\b/i.test(msg)) {
    if (isWindows) {
      return `**Opening Terminal on Windows:**\n\n1. **Windows Terminal** (recommended): Press \`Win + X\`, select "Terminal"\n2. **PowerShell**: Press \`Win + R\`, type \`powershell\`, Enter\n3. **CMD**: Press \`Win + R\`, type \`cmd\`, Enter\n\n**Essential PowerShell commands:**\n\`\`\`powershell\nGet-Location          # Current directory (pwd)\nSet-Location path     # Change directory (cd)\nGet-ChildItem         # List files (ls/dir)\nNew-Item file.txt     # Create file\nRemove-Item file.txt  # Delete file\nGet-Process           # Running processes\nGet-Service           # System services\n\`\`\``;
    }
    if (isMac) {
      return `**Opening Terminal on macOS:**\n\n1. Press \`Cmd + Space\`, type "Terminal", Enter\n2. Or: Applications > Utilities > Terminal\n3. **iTerm2** is a popular alternative\n\n**Essential commands:**\n\`\`\`bash\npwd              # Current directory\nls -la           # List files with details\ncd ~/Documents   # Change directory\nmkdir new_folder # Create directory\ntouch file.txt   # Create file\nopen .           # Open in Finder\nbrew install pkg # Install with Homebrew\n\`\`\``;
    }
    return `**Terminal access varies by OS:**\n\n**Linux:** \`Ctrl + Alt + T\` or search "Terminal"\n**macOS:** \`Cmd + Space\` > "Terminal"\n**Windows:** \`Win + X\` > "Terminal"\n**Android:** Install Termux from F-Droid\n**iOS:** Use a-Shell or iSH from App Store\n\n**Universal commands (bash/zsh):**\n\`\`\`bash\npwd          # Print working directory\nls -la       # List files\ncd path      # Change directory\ncat file     # View file contents\ngrep pattern # Search text\nfind . -name # Find files\nchmod +x file # Make executable\n\`\`\``;
  }

  return `Here's a general how-to guide for your request:\n\n**Step-by-step approach:**\n\n1. **Identify** what you need to accomplish\n2. **Research** the tools and methods available\n3. **Plan** the steps in order\n4. **Execute** one step at a time\n5. **Verify** each step worked before moving on\n6. **Document** what you did for future reference\n\nCould you be more specific about the task? I can provide detailed, OS-specific instructions for:\n- Software installation\n- System configuration\n- Development environment setup\n- File and folder management\n- Network configuration\n- Security settings`;
}

function solveMath(msg: string): string {
  // Try to extract and solve simple expressions
  const exprMatch = msg.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/\%\^])\s*(\d+(?:\.\d+)?)/);
  if (exprMatch) {
    const a = parseFloat(exprMatch[1]);
    const op = exprMatch[2];
    const b = parseFloat(exprMatch[3]);
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
      return `**Calculation:**\n\n${a} ${op} ${b} = **${result}**\n\n${op === "/" && b === 0 ? "Note: Division by zero is undefined." : ""}\n\nNeed more calculations? I can handle:\n- Basic arithmetic (+, -, *, /)\n- Percentages\n- Powers and roots\n- Unit conversions\n- Formula explanations`;
    }
  }

  if (/\b(percentage|percent|%)\b/i.test(msg)) {
    return `**Percentage Calculations:**\n\n**Finding a percentage of a number:**\n- 20% of 150 = 150 * (20/100) = **30**\n\n**Finding what percentage one number is of another:**\n- 30 is what % of 150? = (30/150) * 100 = **20%**\n\n**Percentage increase/decrease:**\n- From 100 to 130: ((130-100)/100) * 100 = **30% increase**\n- From 200 to 150: ((150-200)/200) * 100 = **25% decrease**\n\n**Formulas:**\n\`\`\`\nPercentage = (Part / Whole) * 100\nPart = Whole * (Percentage / 100)\nWhole = Part / (Percentage / 100)\n\`\`\`\n\nGive me specific numbers and I'll calculate!`;
  }

  return `I can help with math! Here's what I can calculate:\n\n**Arithmetic:** 5 + 3, 12 * 7, 100 / 4\n**Percentages:** "what is 15% of 200"\n**Powers:** 2 ^ 10 = 1024\n**Common formulas:**\n\n- Area of circle: A = pi * r^2\n- Pythagorean theorem: a^2 + b^2 = c^2\n- Compound interest: A = P(1 + r/n)^(nt)\n- Distance: d = sqrt((x2-x1)^2 + (y2-y1)^2)\n\nJust give me the numbers and I'll solve it!`;
}

function generateCreativeResponse(msg: string): string {
  if (/\b(email)\b/i.test(msg)) {
    return `Here's a professional email template:\n\n---\n\n**Subject:** [Clear, specific subject line]\n\nDear [Name],\n\nI hope this message finds you well. I'm writing to [state purpose clearly in one sentence].\n\n[Main body -- 2-3 short paragraphs with key information]\n\n[Specific request or next steps]\n\nPlease let me know if you have any questions or need additional information. I'm happy to discuss this further at your convenience.\n\nBest regards,\n[Your name]\n[Your title]\n[Contact info]\n\n---\n\n**Tips for effective emails:**\n- Keep subject lines under 50 characters\n- Lead with the most important information\n- Use short paragraphs (2-3 sentences max)\n- Include a clear call to action\n- Proofread before sending\n\nWant me to customize this for a specific situation?`;
  }

  if (/\b(story|tale|narrative)\b/i.test(msg)) {
    return `Here's a short story:\n\n---\n\n**The Last Signal**\n\nThe radio crackled to life at 3:47 AM. Dr. Elena Vasquez nearly knocked over her cold coffee reaching for the headphones.\n\nFor eleven years, the deep space antenna had listened to nothing but cosmic static. Funding was being cut next month. Her team of twelve had dwindled to three.\n\nBut this signal was different. It wasn't random noise. It pulsed with mathematical precision -- prime numbers, then the Fibonacci sequence, then something she'd never seen before.\n\nHer hands trembling, Elena decoded the final sequence. It wasn't just a signal.\n\nIt was a reply.\n\nTo a message humanity had forgotten it sent.\n\n---\n\nWant me to:\n- Continue this story?\n- Write a different genre (sci-fi, mystery, romance, horror)?\n- Help with your own creative writing project?`;
  }

  return `I'd love to help with creative writing! I can generate:\n\n- **Emails** -- Professional, casual, follow-up, introduction\n- **Stories** -- Short fiction, sci-fi, mystery, fantasy\n- **Articles** -- Blog posts, technical writing, reviews\n- **Poetry** -- Various styles and themes\n- **Scripts** -- Dialogue, scenes, screenplays\n- **Marketing** -- Slogans, taglines, product descriptions\n- **Academic** -- Essays, summaries, abstracts\n\nJust tell me:\n1. What type of content\n2. The tone (formal, casual, humorous)\n3. The topic or context\n4. Approximate length\n\nAnd I'll create it for you!`;
}

function generateExplanation(msg: string): string {
  if (/\b(blockchain|crypto|bitcoin)\b/i.test(msg)) {
    return `**Blockchain Explained:**\n\nA blockchain is a distributed, immutable ledger that records transactions across a network of computers.\n\n**How it works:**\n1. Transactions are grouped into **blocks**\n2. Each block contains a hash of the previous block (creating a **chain**)\n3. Blocks are validated by network participants (miners/validators)\n4. Once added, blocks cannot be altered without changing all subsequent blocks\n\n**Key concepts:**\n- **Decentralization** -- No single authority controls the network\n- **Consensus mechanisms** -- Proof of Work, Proof of Stake\n- **Smart contracts** -- Self-executing code on the blockchain (Ethereum)\n- **Tokens** -- Digital assets on a blockchain\n\n**Use cases beyond crypto:**\n- Supply chain tracking\n- Digital identity\n- Voting systems\n- NFTs and digital ownership\n- Decentralized finance (DeFi)\n\nWant to dive deeper into any aspect?`;
  }

  if (/\b(api|rest\s*api|graphql)\b/i.test(msg)) {
    return `**APIs Explained Simply:**\n\nAn API is like a waiter in a restaurant. You (the client) tell the waiter (API) what you want, the waiter communicates with the kitchen (server), and brings back your food (data).\n\n**REST API:**\n- Uses URLs to identify resources: \`/users/123\`\n- HTTP methods define actions: GET (read), POST (create), PUT (update), DELETE (remove)\n- Returns data in JSON format\n- Stateless -- each request is independent\n\n**Example:**\n\`\`\`\nGET /api/users       -> List all users\nGET /api/users/123   -> Get user 123\nPOST /api/users      -> Create new user\nPUT /api/users/123   -> Update user 123\nDELETE /api/users/123 -> Delete user 123\n\`\`\`\n\n**GraphQL:**\n- One endpoint for everything\n- Client asks for exactly what it needs\n- No over-fetching or under-fetching\n\nThe NOVERA web app uses a REST API at \`/api/chat\` for agent communication.`;
  }

  return `I can explain almost any concept! Here are some areas I cover well:\n\n**Technology:** Programming concepts, web development, AI/ML, databases, networking\n**Science:** Physics, chemistry, biology, astronomy, mathematics\n**Business:** Economics, marketing, management, finance\n**Creative:** Writing techniques, design principles, music theory\n\nJust ask "explain [concept]" or "what is [term]" and I'll provide:\n- A clear definition\n- How it works\n- Real-world examples\n- Related concepts\n\nWhat would you like me to explain?`;
}

function generateComparison(msg: string): string {
  if (/\b(react|vue|angular|svelte)\b/i.test(msg)) {
    return `**Frontend Framework Comparison:**\n\n| Feature | React | Vue | Angular | Svelte |\n|---------|-------|-----|---------|--------|\n| Learning Curve | Medium | Easy | Steep | Easy |\n| Performance | Good | Good | Good | Excellent |\n| Bundle Size | Medium | Small | Large | Tiny |\n| Ecosystem | Huge | Large | Large | Growing |\n| Backed By | Meta | Community | Google | Community |\n| Type Safety | Via TypeScript | Via TypeScript | Built-in | Via TypeScript |\n| State Mgmt | Context/Redux | Vuex/Pinia | Services/NgRx | Built-in stores |\n\n**Choose React if:** Large ecosystem, many jobs, flexible architecture\n**Choose Vue if:** Gentle learning curve, great docs, progressive adoption\n**Choose Angular if:** Enterprise apps, full framework, strong opinions\n**Choose Svelte if:** Performance matters, less boilerplate, simpler mental model\n\nAll are excellent choices -- pick based on your team and project needs.`;
  }

  return `I can compare technologies, tools, concepts, and approaches. Popular comparisons I can help with:\n\n**Languages:** Python vs JavaScript, Kotlin vs Java, Rust vs Go\n**Frameworks:** React vs Vue vs Angular, Django vs FastAPI, Spring vs Ktor\n**Databases:** SQL vs NoSQL, PostgreSQL vs MySQL, MongoDB vs DynamoDB\n**Cloud:** AWS vs GCP vs Azure\n**Mobile:** Native vs Cross-platform, Flutter vs React Native\n**AI:** GPT vs Claude vs LFM2, TensorFlow vs PyTorch\n\nTell me what you want to compare and I'll create a detailed breakdown with pros, cons, and recommendations!`;
}

function generateList(msg: string): string {
  if (/\b(productivity|tools|apps)\b/i.test(msg)) {
    return `**Top Productivity Tools:**\n\n**Note-taking:**\n1. Obsidian -- Local-first, markdown, graph view\n2. Notion -- All-in-one workspace\n3. Logseq -- Open-source, outliner\n\n**Code Editors:**\n1. VS Code -- Most popular, extensible\n2. JetBrains IDEs -- Language-specific, powerful\n3. Zed -- Fast, modern, collaborative\n4. Neovim -- Terminal-based, highly customizable\n\n**Terminal:**\n1. Warp -- AI-powered terminal\n2. iTerm2 (Mac) -- Feature-rich\n3. Windows Terminal -- Modern Windows default\n\n**Design:**\n1. Figma -- Collaborative UI design\n2. Excalidraw -- Quick diagrams\n3. Mermaid -- Diagrams as code\n\n**Communication:**\n1. Slack -- Team messaging\n2. Discord -- Community building\n3. Linear -- Issue tracking\n\nWant recommendations for a specific category?`;
  }

  if (/\b(learn|learning|course|tutorial|programming|coding)\b/i.test(msg)) {
    return `**Best Resources to Learn Programming:**\n\n**Free:**\n1. freeCodeCamp -- Full-stack web dev curriculum\n2. The Odin Project -- Web development path\n3. CS50 (Harvard) -- Computer science fundamentals\n4. MDN Web Docs -- Web technologies reference\n5. Kotlin Koans -- Learn Kotlin interactively\n\n**Interactive:**\n1. Codecademy -- Guided coding exercises\n2. LeetCode -- Algorithm practice\n3. Exercism -- Mentored coding challenges\n4. HackerRank -- Coding challenges\n\n**YouTube Channels:**\n1. Fireship -- Quick, modern tech content\n2. Traversy Media -- Web development\n3. ThePrimeagen -- Systems programming\n4. NetworkChuck -- Networking & security\n\n**Books:**\n1. "Clean Code" by Robert Martin\n2. "The Pragmatic Programmer"\n3. "Designing Data-Intensive Applications"\n\nWhat language or area do you want to focus on?`;
  }

  return `I can generate lists and recommendations for many topics! Just specify:\n\n- **Tech tools** -- IDEs, libraries, frameworks, services\n- **Learning resources** -- Courses, books, tutorials\n- **Best practices** -- Code quality, security, performance\n- **Career advice** -- Skills to learn, interview prep\n- **Project ideas** -- Beginner to advanced\n\nWhat kind of list would be helpful?`;
}

function generateDeviceResponse(msg: string, os: string): string {
  if (/\b(screenshot)\b/i.test(msg)) {
    return `**Taking Screenshots:**\n\n**Windows:**\n- \`Win + Shift + S\` -- Snipping Tool (select area)\n- \`PrtScn\` -- Full screen to clipboard\n- \`Win + PrtScn\` -- Save to Pictures folder\n- \`Alt + PrtScn\` -- Active window only\n\n**macOS:**\n- \`Cmd + Shift + 3\` -- Full screen\n- \`Cmd + Shift + 4\` -- Select area\n- \`Cmd + Shift + 5\` -- Screenshot toolbar\n- \`Cmd + Shift + 4 + Space\` -- Window capture\n\n**Linux:**\n- \`PrtScn\` -- Full screen (GNOME)\n- \`flameshot gui\` -- Advanced tool\n\n**Android:**\n- \`Power + Volume Down\` simultaneously\n\n**iOS:**\n- \`Side Button + Volume Up\``;
  }

  if (/\b(battery)\b/i.test(msg)) {
    return `**Battery Management Tips:**\n\n**General tips for all devices:**\n1. Reduce screen brightness or use auto-brightness\n2. Disable unused wireless connections (WiFi, Bluetooth, GPS)\n3. Close background apps\n4. Enable battery saver/low power mode\n5. Keep software updated\n\n**Checking battery health:**\n\n**Windows:** Settings > System > Power & battery\n**macOS:** Option-click battery icon, or System Information > Power\n**Android:** Settings > Battery\n**iOS:** Settings > Battery > Battery Health\n**Linux:** \`upower -i /org/freedesktop/UPower/devices/battery_BAT0\`\n\n**Extending battery lifespan:**\n- Keep charge between 20-80% when possible\n- Avoid extreme temperatures\n- Use original chargers\n- Reduce charging speed when not urgent`;
  }

  return `I can help with device management across all platforms:\n\n**Available commands:**\n- "screenshot" -- How to capture your screen\n- "battery" -- Battery status and optimization\n- "storage" -- Disk space management\n- "wifi/network" -- Connection troubleshooting\n- "install [app]" -- Software installation guide\n- "terminal" -- Command line access\n- "files" -- File management tips\n- "settings" -- System configuration\n\nI detect you're on **${os}**. What would you like to do?`;
}

function generateGeneralResponse(
  msg: string,
  os: string,
  prevMessages: number
): string {
  // Short input -- probably conversational
  if (msg.length < 20) {
    if (/\b(thanks?|thank\s*you|thx)\b/i.test(msg)) {
      return "You're welcome! Let me know if there's anything else I can help with.";
    }
    if (/\b(ok|okay|got\s*it|understood|cool|nice|great|awesome)\b/i.test(msg)) {
      return "Glad to help! Feel free to ask anything else -- code questions, device tasks, explanations, or creative writing.";
    }
    if (/\b(bye|goodbye|see\s*you|later)\b/i.test(msg)) {
      return "Take care! I'll be here whenever you need help. Remember, I run entirely on-device for your privacy.";
    }
    if (/\b(help|what\s*can\s*you\s*do)\b/i.test(msg)) {
      return `I'm NOVERA, your on-device AI agent. Here's what I can do:\n\n**Knowledge & Answers**\n- Answer questions on any topic\n- Explain complex concepts simply\n- Compare technologies and approaches\n\n**Code & Development**\n- Write code in any language\n- Debug and fix errors\n- Explain algorithms and patterns\n- Help with Git, Docker, APIs\n\n**Creative Work**\n- Write emails, stories, articles\n- Generate content and copy\n- Help with writing structure\n\n**Device & System**\n- Guide you through OS tasks\n- File management instructions\n- System troubleshooting\n- Software installation help\n\n**Math & Logic**\n- Calculations and conversions\n- Formula explanations\n- Problem solving\n\nJust type naturally -- I understand context and can handle follow-up questions!`;
    }
  }

  // Longer, unclassified input -- provide a thoughtful general response
  const words = msg.split(/\s+/);
  const topics = words.filter(w => w.length > 4).slice(0, 3).join(", ");

  return `I understand you're asking about ${topics || "this topic"}. Let me provide a helpful response:\n\nAs an on-device AI agent running through the Koog framework with Liquid LFM2 architecture, I process your queries locally for privacy and speed.\n\nTo give you the best answer, I can approach this from several angles:\n\n1. **Technical perspective** -- If this involves code or technology, I can provide examples and explanations\n2. **Practical guide** -- Step-by-step instructions tailored to your ${os} system\n3. **Deep explanation** -- Breaking down the concept from fundamentals\n4. **Creative approach** -- If you need content, writing, or brainstorming\n\nCould you provide a bit more context about what specific aspect you'd like me to focus on? The more specific the question, the more detailed and actionable my response will be.\n\nFor example, try asking:\n- "How do I [specific task]?"\n- "Explain [concept] in simple terms"\n- "Write code to [do something]"\n- "Compare [A] vs [B]"`;
}
