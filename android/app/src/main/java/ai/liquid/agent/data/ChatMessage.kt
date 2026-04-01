package ai.liquid.agent.data

/**
 * Represents a single message in the agent chat conversation.
 */
data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isStreaming: Boolean = false,
    val toolCalls: List<ToolCallInfo> = emptyList()
)

enum class MessageRole {
    USER,
    ASSISTANT,
    SYSTEM,
    TOOL
}

data class ToolCallInfo(
    val name: String,
    val arguments: String,
    val result: String? = null
)
