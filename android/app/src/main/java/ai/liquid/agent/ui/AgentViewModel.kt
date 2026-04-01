package ai.liquid.agent.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.liquid.agent.agent.LiquidAgentFactory
import ai.liquid.agent.data.ChatMessage
import ai.liquid.agent.data.MessageRole
import ai.liquid.agent.tools.DeviceToolSet
import ai.liquid.agent.tools.FileManagerToolSet
import ai.liquid.agent.tools.SystemInfoToolSet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * ViewModel managing the Koog AI Agent state and chat interactions.
 * Handles communication between the Compose UI and the Liquid LFM2 agent.
 */
class AgentViewModel(application: Application) : AndroidViewModel(application) {

    // UI State
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _apiKey = MutableStateFlow("")
    val apiKey: StateFlow<String> = _apiKey.asStateFlow()

    private val _agentReady = MutableStateFlow(false)
    val agentReady: StateFlow<Boolean> = _agentReady.asStateFlow()

    // Tool sets
    private val deviceToolSet = DeviceToolSet(application.applicationContext)
    private val fileManagerToolSet = FileManagerToolSet(application.applicationContext)
    private val systemInfoToolSet = SystemInfoToolSet(application.applicationContext)

    init {
        // Add welcome message
        _messages.value = listOf(
            ChatMessage(
                role = MessageRole.ASSISTANT,
                content = """Welcome to **NOVERA Agent** -- powered by Liquid AI's LFM2 model running through the Koog framework.

I can help you with:
- **Device Info**: Battery, network, display, and system details
- **File Management**: Browse, create, read, and manage files
- **System Monitoring**: Memory, processes, installed apps
- **Task Automation**: Chain multiple operations together

Enter your OpenRouter API key in settings to get started, or try the demo mode."""
            )
        )
    }

    fun setApiKey(key: String) {
        _apiKey.value = key
        _agentReady.value = key.isNotBlank()
    }

    fun sendMessage(userInput: String) {
        if (userInput.isBlank() || _isProcessing.value) return

        // Add user message
        val userMessage = ChatMessage(role = MessageRole.USER, content = userInput)
        _messages.update { it + userMessage }

        _isProcessing.value = true

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val key = _apiKey.value

                if (key.isNotBlank()) {
                    // Create and run the Koog agent with Liquid LFM2
                    val agent = LiquidAgentFactory.createAgent(
                        apiKey = key,
                        deviceToolSet = deviceToolSet,
                        fileManagerToolSet = fileManagerToolSet,
                        systemInfoToolSet = systemInfoToolSet
                    )

                    // Add streaming placeholder
                    val streamingMessage = ChatMessage(
                        role = MessageRole.ASSISTANT,
                        content = "",
                        isStreaming = true
                    )
                    _messages.update { it + streamingMessage }

                    // Run the agent
                    val result = agent.run(userInput)

                    // Replace streaming message with final result
                    _messages.update { messages ->
                        messages.map { msg ->
                            if (msg.id == streamingMessage.id) {
                                msg.copy(content = result, isStreaming = false)
                            } else msg
                        }
                    }
                } else {
                    // Demo mode: use local tool execution
                    val response = handleLocalDemo(userInput)
                    _messages.update { it + ChatMessage(role = MessageRole.ASSISTANT, content = response) }
                }
            } catch (e: Exception) {
                val errorMessage = ChatMessage(
                    role = MessageRole.ASSISTANT,
                    content = "Error: ${e.message ?: "Unknown error occurred"}\n\nPlease check your API key and network connection."
                )
                _messages.update { msgs ->
                    // Remove any streaming messages and add error
                    msgs.filter { !it.isStreaming } + errorMessage
                }
            } finally {
                _isProcessing.value = false
            }
        }
    }

    /**
     * Demo mode -- runs tools locally without LLM.
     */
    private fun handleLocalDemo(input: String): String {
        val lowerInput = input.lowercase()
        return when {
            "battery" in lowerInput -> {
                "**Demo Mode** -- Running `getBatteryStatus` tool:\n\n${deviceToolSet.getBatteryStatus()}"
            }
            "wifi" in lowerInput || "network" in lowerInput -> {
                "**Demo Mode** -- Running `getWifiStatus` tool:\n\n${deviceToolSet.getWifiStatus()}"
            }
            "device" in lowerInput || "info" in lowerInput || "system" in lowerInput -> {
                "**Demo Mode** -- Running `getSystemInfo` tool:\n\n${systemInfoToolSet.getSystemInfo()}"
            }
            "file" in lowerInput || "list" in lowerInput || "directory" in lowerInput -> {
                "**Demo Mode** -- Running `listFiles` tool:\n\n${fileManagerToolSet.listFiles("/")}"
            }
            "storage" in lowerInput || "disk" in lowerInput || "space" in lowerInput -> {
                "**Demo Mode** -- Running `getStorageInfo` tool:\n\n${fileManagerToolSet.getStorageInfo()}"
            }
            "app" in lowerInput || "installed" in lowerInput -> {
                "**Demo Mode** -- Running `listInstalledApps` tool:\n\n${systemInfoToolSet.listInstalledApps()}"
            }
            "process" in lowerInput || "running" in lowerInput -> {
                "**Demo Mode** -- Running `getRunningProcesses` tool:\n\n${systemInfoToolSet.getRunningProcesses()}"
            }
            "display" in lowerInput || "screen" in lowerInput -> {
                "**Demo Mode** -- Running `getDisplayInfo` tool:\n\n${systemInfoToolSet.getDisplayInfo()}"
            }
            "time" in lowerInput || "date" in lowerInput -> {
                "**Demo Mode** -- Running `getCurrentDateTime` tool:\n\n${deviceToolSet.getCurrentDateTime()}"
            }
            else -> {
                """**Demo Mode** -- No API key configured. To use the full LFM2 agent with reasoning and planning, add your OpenRouter API key in settings.

Available demo commands:
- "battery status" -- Check battery
- "network status" -- Check WiFi/network
- "system info" -- Device details
- "list files" -- Browse file storage
- "storage info" -- Disk space
- "installed apps" -- List apps
- "running processes" -- Active processes
- "display info" -- Screen details
- "current time" -- Date and time"""
            }
        }
    }

    fun clearMessages() {
        _messages.value = listOf(
            ChatMessage(
                role = MessageRole.ASSISTANT,
                content = "Conversation cleared. How can I help you?"
            )
        )
    }
}
