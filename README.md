# NOVERA AI Agent -- Liquid AI LFM2 + Koog Framework

A cross-platform AI agent system powered by **Liquid AI's LFM2** model and JetBrains' **Koog** open-source agent framework. Includes both a web interface and a native Android app with on-device agent capabilities.

**Live Web Demo:** [https://novera-liquid-ai.vercel.app](https://novera-liquid-ai.vercel.app)

## Architecture

```
+---------------------------+     +---------------------------+
|     Web (Next.js)         |     |   Android (Kotlin)        |
|  - Hero landing page      |     |  - Jetpack Compose UI     |
|  - Chat UI (any browser)  |     |  - Native device access   |
|  - SSE streaming          |     |  - On-device tools        |
|  - Vercel deployment      |     |  - Koog agent framework   |
+----------+----------------+     +----------+----------------+
           |                                 |
           v                                 v
    +------+------+                 +--------+--------+
    | /api/chat   |                 | Koog AIAgent    |
    | (API route) |                 | (local runtime) |
    +------+------+                 +--------+--------+
           |                                 |
           v                                 v
    +------+-------------------------------+-------+
    |        Liquid AI LFM2 via OpenRouter          |
    |        (or Liquid Playground API)             |
    +-----------------------------------------------+
```

## Project Structure

```
Liquid.ai/
  src/                    # Next.js web application
    app/
      page.tsx            # Main page with hero + chat launcher
      api/chat/route.ts   # Streaming chat API (SSE)
      globals.css         # NOVERA theme styles
      layout.tsx          # Root layout
    components/
      HeroSection.tsx     # Full-screen hero with GSAP animations
      ChatPanel.tsx       # Slide-in chat UI panel
  android/                # Android application
    app/src/main/java/ai/liquid/agent/
      agent/
        LiquidAgentFactory.kt  # Koog agent creation with LFM2
      tools/
        DeviceToolSet.kt       # Battery, WiFi, settings tools
        FileManagerToolSet.kt  # File CRUD operations
        SystemInfoToolSet.kt   # System info, apps, processes
      ui/
        MainActivity.kt       # Entry point
        AgentChatScreen.kt    # Compose chat UI
        AgentViewModel.kt     # Agent state management
        theme/Theme.kt        # Material3 NOVERA theme
      data/
        ChatMessage.kt        # Message data model
```

## Web Application

### Features
- Full-screen hero section matching the NOVERA luxury design theme
- GSAP parallax animations and word-reveal effects
- Glassmorphism search/action bar
- Slide-in AI chat panel with streaming responses
- Device detection for cross-platform assistance
- Responsive design for mobile, tablet, and desktop

### Run locally
```bash
npm install
npm run dev
```

### Environment Variables
```
LIQUID_API_KEY=your_openrouter_or_liquid_api_key
LIQUID_API_URL=https://openrouter.ai/api/v1/chat/completions
LIQUID_MODEL=liquid/lfm2
```

## Android Application

### Features
- **Koog Framework** (v0.7.1) -- JetBrains' open-source AI agent framework
- **Liquid LFM2** via OpenRouter API for reasoning and planning
- **On-device tools** using Koog's annotation-based tool system:
  - `DeviceToolSet` -- Battery, WiFi, brightness, settings, date/time
  - `FileManagerToolSet` -- List, read, write, delete, move files
  - `SystemInfoToolSet` -- Memory, network, apps, processes, display
- **Jetpack Compose** Material3 UI with NOVERA brand theme
- **Demo mode** -- Works without API key using local tool execution
- **Streaming responses** with real-time UI updates

### How the Koog Agent Works

1. User sends a message through the Compose chat UI
2. `AgentViewModel` creates a Koog `AIAgent` via `LiquidAgentFactory`
3. The agent uses `simpleOpenRouterExecutor` to connect to Liquid LFM2
4. Tools are registered via `ToolRegistry` with `@Tool` annotations
5. LFM2 reasons about the task and invokes tools as needed
6. Tool results are sent back to LFM2 for further reasoning
7. Final response streams back to the UI

### Build the Android app
```bash
cd android
./gradlew assembleDebug
```

### Requirements
- JDK 17+
- Android SDK 35
- Kotlin 2.2.0+
- OpenRouter API key (for LFM2 access)

### Configure API Key
Add to `android/local.properties`:
```properties
OPENROUTER_API_KEY=sk-or-your-key-here
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| AI Model | Liquid AI LFM2 |
| Agent Framework | Koog (JetBrains, open-source) |
| API Gateway | OpenRouter |
| Web Frontend | Next.js 16, Tailwind CSS, GSAP |
| Android UI | Jetpack Compose, Material3 |
| Android Agent | Koog agents + annotation-based tools |
| Deployment | Vercel (web), APK (Android) |

## References

- [Koog Documentation](https://docs.koog.ai/)
- [Koog GitHub](https://github.com/JetBrains/koog)
- [Liquid AI](https://www.liquid.ai/)
- [LFM2 on HuggingFace](https://huggingface.co/liquid)
- [OpenRouter](https://openrouter.ai/)
