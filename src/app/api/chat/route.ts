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

    // If no API key is configured, use a local fallback response
    if (!LIQUID_API_KEY) {
      return createFallbackResponse(messages);
    }

    // Call Liquid AI API with streaming
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Liquid AI API error:", response.status, errorText);
      return createFallbackResponse(messages);
    }

    // Stream the response back
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
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
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function createFallbackResponse(messages: ChatMessage[]) {
  const lastUserMessage =
    messages.filter((m) => m.role === "user").pop()?.content || "";

  const response = generateAgentResponse(lastUserMessage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Simulate streaming with word-by-word delivery
      const words = response.split(" ");
      let index = 0;

      function pushWord() {
        if (index < words.length) {
          const word = (index === 0 ? "" : " ") + words[index];
          const data = JSON.stringify({
            choices: [{ delta: { content: word } }],
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          index++;
          setTimeout(pushWord, 30 + Math.random() * 40);
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

function generateAgentResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes("terminal") || msg.includes("command line") || msg.includes("cmd")) {
    return `Here's how to open a terminal on different operating systems:

**Windows:**
- Press \`Win + R\`, type \`cmd\` or \`powershell\`, press Enter
- Or right-click the Start button and select "Terminal"
- Or search for "Terminal" in the Start menu

**macOS:**
- Press \`Cmd + Space\`, type "Terminal", press Enter
- Or go to Applications > Utilities > Terminal
- For a better experience, try iTerm2

**Linux:**
- Press \`Ctrl + Alt + T\` (most distros)
- Or search for "Terminal" in your application menu

**Android:**
- Install Termux from F-Droid or Play Store

**iOS/iPadOS:**
- Use the "a-Shell" app or "iSH" from the App Store

Would you like me to help you run specific commands once you have the terminal open?`;
  }

  if (msg.includes("screenshot")) {
    return `Here's how to take a screenshot on each platform:

**Windows:**
- \`Win + Shift + S\` -- Snipping Tool (select area)
- \`PrtScn\` -- Full screen to clipboard
- \`Win + PrtScn\` -- Save full screen to Pictures folder

**macOS:**
- \`Cmd + Shift + 3\` -- Full screen
- \`Cmd + Shift + 4\` -- Select area
- \`Cmd + Shift + 5\` -- Screenshot toolbar with options

**Linux:**
- \`PrtScn\` -- Full screen (GNOME)
- Install \`flameshot\` for advanced screenshots: \`sudo apt install flameshot\`

**Android:**
- \`Power + Volume Down\` simultaneously
- Or swipe down and tap "Screenshot" in quick settings

**iOS:**
- \`Side Button + Volume Up\` simultaneously
- On older devices: \`Home + Power\`

Screenshots are saved to your default Pictures/Photos location.`;
  }

  if (msg.includes("file") || msg.includes("folder") || msg.includes("directory")) {
    return `Here's how to navigate files on your system:

**Windows:**
- Open File Explorer: \`Win + E\`
- Navigate with the address bar or folder tree
- Quick access: Pin frequently used folders

**macOS:**
- Open Finder: \`Cmd + Space\`, type "Finder"
- Use \`Cmd + Shift + G\` to go to a specific path
- Column view (\`Cmd + 3\`) is great for navigation

**Linux:**
- Most distros: Files/Nautilus (GNOME) or Dolphin (KDE)
- Terminal: \`ls\`, \`cd\`, \`find\`, \`tree\` commands
- \`Ctrl + L\` in most file managers for path entry

**Common terminal commands (all OS):**
\`\`\`bash
ls -la          # List files with details
cd /path/to/dir # Change directory
mkdir new_folder # Create directory
cp file dest    # Copy file
mv file dest    # Move/rename file
find . -name "*.txt" # Search files
\`\`\`

What specific file operation would you like help with?`;
  }

  if (msg.includes("system info") || msg.includes("specs") || msg.includes("hardware")) {
    return `Here's how to check system information on each OS:

**Windows:**
\`\`\`powershell
systeminfo              # Full system details
Get-ComputerInfo        # PowerShell detailed info
msinfo32                # GUI system information
\`\`\`

**macOS:**
\`\`\`bash
system_profiler SPHardwareDataType  # Hardware info
sw_vers                              # OS version
sysctl -n machdep.cpu.brand_string  # CPU info
\`\`\`
Or: Apple Menu > About This Mac

**Linux:**
\`\`\`bash
neofetch          # Pretty system summary
lscpu             # CPU info
free -h           # Memory info
df -h             # Disk usage
uname -a          # Kernel info
lsb_release -a    # Distro info
\`\`\`

**Android:**
Settings > About Phone > Software/Hardware Information

**iOS:**
Settings > General > About

Would you like to know something specific about your system?`;
  }

  if (msg.includes("install") || msg.includes("setup") || msg.includes("download")) {
    return `I can help you install software. Here are common package managers by OS:

**Windows:**
\`\`\`powershell
# Using winget (built-in)
winget install <package>
winget search <name>

# Using Chocolatey
choco install <package>
\`\`\`

**macOS:**
\`\`\`bash
# Using Homebrew
brew install <package>
brew install --cask <app>  # GUI apps
\`\`\`

**Linux (Debian/Ubuntu):**
\`\`\`bash
sudo apt update
sudo apt install <package>
\`\`\`

**Linux (Fedora):**
\`\`\`bash
sudo dnf install <package>
\`\`\`

**Linux (Arch):**
\`\`\`bash
sudo pacman -S <package>
\`\`\`

What would you like to install? I'll give you the exact commands.`;
  }

  // Default response
  return `I'm NOVERA, your AI computer-use agent. I can help you with a wide range of tasks across any device and operating system.

Here are some things I can assist with:

**Device Operations:**
- Opening apps and system utilities
- Taking screenshots and screen recordings
- Managing files and folders
- Checking system information

**Development:**
- Setting up development environments
- Running and debugging code
- Git operations and version control
- Package management

**System Administration:**
- Installing and configuring software
- Network diagnostics
- Process management
- Disk and memory monitoring

**Automation:**
- Creating shell scripts and batch files
- Scheduling tasks (cron, Task Scheduler)
- Workflow automation

Just describe what you'd like to accomplish and I'll provide specific instructions for your platform. I adapt to your OS and device automatically.

What task can I help you with?`;
}
