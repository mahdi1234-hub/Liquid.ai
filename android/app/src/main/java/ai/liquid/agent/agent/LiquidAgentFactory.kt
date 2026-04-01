package ai.liquid.agent.agent

import ai.koog.agents.core.agent.AIAgent
import ai.koog.agents.core.tools.ToolRegistry
import ai.koog.prompt.executor.llms.all.simpleOpenRouterExecutor
import ai.liquid.agent.tools.DeviceToolSet
import ai.liquid.agent.tools.FileManagerToolSet
import ai.liquid.agent.tools.SystemInfoToolSet

/**
 * Factory for creating Koog AI Agents configured with Liquid AI's LFM2 model
 * accessed via OpenRouter API.
 *
 * The Koog framework handles:
 * - Reasoning and planning (via graph-based strategies)
 * - Tool invocation (device interaction, file management, system info)
 * - MCP integration for extensible tool ecosystems
 * - On-device execution with streaming responses
 */
object LiquidAgentFactory {

    // Liquid LFM2 model identifier on OpenRouter
    private const val LIQUID_LFM2_MODEL = "liquid/lfm2"

    // System prompt defining the agent's capabilities
    private const val SYSTEM_PROMPT = """
You are NOVERA, an on-device AI agent powered by Liquid AI's LFM2 architecture, 
running through the Koog framework on Android. You can:

1. DEVICE INTERACTION: Read screen content, manage notifications, control device settings
2. FILE MANAGEMENT: Browse, create, read, move, and delete files on the device
3. SYSTEM INFORMATION: Check battery, storage, network, installed apps, and system status
4. TASK AUTOMATION: Chain multiple operations to complete complex tasks
5. CODE EXECUTION: Help write, review, and explain code

You run entirely on-device for privacy and speed. Always be specific about what 
you're doing and ask for confirmation before destructive operations (delete, modify).

When using tools, explain what each tool does before invoking it.
Respond concisely but thoroughly. Use markdown formatting for readability.
"""

    /**
     * Creates a fully configured Koog AI Agent with Liquid LFM2 model
     * and all device interaction tools.
     *
     * @param apiKey OpenRouter API key for accessing Liquid LFM2
     * @param deviceToolSet Tools for device interaction
     * @param fileManagerToolSet Tools for file management
     * @param systemInfoToolSet Tools for system information
     * @return Configured AIAgent instance
     */
    fun createAgent(
        apiKey: String,
        deviceToolSet: DeviceToolSet,
        fileManagerToolSet: FileManagerToolSet,
        systemInfoToolSet: SystemInfoToolSet
    ): AIAgent<String, String> {
        // Build tool registry with all available tools
        val toolRegistry = ToolRegistry {
            tools(deviceToolSet)
            tools(fileManagerToolSet)
            tools(systemInfoToolSet)
        }

        // Create the Koog agent with Liquid LFM2 via OpenRouter
        return AIAgent(
            promptExecutor = simpleOpenRouterExecutor(apiKey),
            systemPrompt = SYSTEM_PROMPT.trimIndent(),
            llmModel = LIQUID_LFM2_MODEL,
            toolRegistry = toolRegistry
        )
    }

    /**
     * Creates a minimal agent without tools for simple chat mode.
     *
     * @param apiKey OpenRouter API key
     * @return Basic AIAgent for conversation
     */
    fun createChatAgent(apiKey: String): AIAgent<String, String> {
        return AIAgent(
            promptExecutor = simpleOpenRouterExecutor(apiKey),
            systemPrompt = SYSTEM_PROMPT.trimIndent(),
            llmModel = LIQUID_LFM2_MODEL
        )
    }
}
