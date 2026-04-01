package ai.liquid.agent.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.liquid.agent.data.ChatMessage
import ai.liquid.agent.data.MessageRole
import kotlinx.coroutines.launch

// NOVERA brand colors matching the web UI
private val NoveraDark = Color(0xFF1C1917)
private val NoveraAccent = Color(0xFFA68B6A)
private val NoveraSurface = Color(0xFF292524)
private val NoveraLight = Color(0xFFF9F8F6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentChatScreen(viewModel: AgentViewModel) {
    val messages by viewModel.messages.collectAsState()
    val isProcessing by viewModel.isProcessing.collectAsState()
    val agentReady by viewModel.agentReady.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var showSettings by remember { mutableStateOf(false) }
    var apiKeyInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // Auto-scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        containerColor = NoveraDark,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(NoveraAccent, NoveraSurface)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("N", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                "NOVERA Agent",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                buildString {
                                    append("Liquid AI LFM2")
                                    append(" \u00B7 ")
                                    append(if (agentReady) "Connected" else "Demo Mode")
                                    append(" \u00B7 ")
                                    append(if (isProcessing) "Thinking..." else "Ready")
                                },
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 10.sp,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.clearMessages() }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear", tint = Color.White.copy(alpha = 0.6f))
                    }
                    IconButton(onClick = { showSettings = !showSettings }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White.copy(alpha = 0.6f))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NoveraDark)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Settings panel
            AnimatedVisibility(visible = showSettings) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    color = NoveraSurface,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "OPENROUTER API KEY",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 10.sp,
                            letterSpacing = 2.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = apiKeyInput,
                            onValueChange = { apiKeyInput = it },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("sk-or-...", color = Color.White.copy(alpha = 0.3f)) },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = NoveraAccent,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                                cursorColor = NoveraAccent
                            )
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                viewModel.setApiKey(apiKeyInput)
                                showSettings = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = NoveraAccent),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text("Connect to Liquid LFM2", color = NoveraDark, fontSize = 12.sp)
                        }
                    }
                }
            }

            // Quick actions
            if (messages.size <= 1) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("Battery" to "battery status", "System" to "system info", "Files" to "list files", "Apps" to "installed apps").forEach { (label, cmd) ->
                        SuggestionChip(
                            onClick = {
                                inputText = cmd
                                viewModel.sendMessage(cmd)
                                inputText = ""
                            },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = Color.White.copy(alpha = 0.05f),
                                labelColor = Color.White.copy(alpha = 0.6f)
                            ),
                            border = SuggestionChipDefaults.suggestionChipBorder(
                                enabled = true,
                                borderColor = Color.White.copy(alpha = 0.1f)
                            )
                        )
                    }
                }
            }

            // Messages
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(messages, key = { it.id }) { message ->
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 })
                    ) {
                        MessageBubble(message = message, isProcessing = isProcessing)
                    }
                }
            }

            // Input bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = NoveraDark,
                tonalElevation = 2.dp
            ) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                        .fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(
                                "Ask NOVERA to perform a task...",
                                color = Color.White.copy(alpha = 0.3f),
                                fontSize = 14.sp
                            )
                        },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (inputText.isNotBlank()) {
                                    viewModel.sendMessage(inputText)
                                    inputText = ""
                                }
                            }
                        ),
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color.White.copy(alpha = 0.2f),
                            unfocusedBorderColor = Color.White.copy(alpha = 0.1f),
                            cursorColor = NoveraAccent
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    FilledIconButton(
                        onClick = {
                            if (inputText.isNotBlank()) {
                                viewModel.sendMessage(inputText)
                                inputText = ""
                            }
                        },
                        enabled = inputText.isNotBlank() && !isProcessing,
                        modifier = Modifier.size(48.dp),
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = if (inputText.isNotBlank()) NoveraAccent else Color.White.copy(alpha = 0.1f),
                            contentColor = if (inputText.isNotBlank()) NoveraDark else Color.White.copy(alpha = 0.3f)
                        ),
                        shape = CircleShape
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                    }
                }
            }
        }
    }
}

@Composable
fun MessageBubble(message: ChatMessage, isProcessing: Boolean) {
    val isUser = message.role == MessageRole.USER

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 320.dp),
            color = if (isUser) Color.White.copy(alpha = 0.1f) else NoveraSurface,
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isUser) 12.dp else 2.dp,
                bottomEnd = if (isUser) 2.dp else 12.dp
            ),
            border = if (!isUser) androidx.compose.foundation.BorderStroke(
                0.5.dp, Color.White.copy(alpha = 0.05f)
            ) else null
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (!isUser) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(
                                            NoveraAccent.copy(alpha = 0.6f),
                                            NoveraSurface
                                        )
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("N", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "NOVERA",
                            color = Color.White.copy(alpha = 0.3f),
                            fontSize = 9.sp,
                            letterSpacing = 2.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (message.isStreaming && message.content.isEmpty()) {
                    // Loading indicator
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        repeat(3) { index ->
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.4f))
                            )
                        }
                    }
                } else {
                    Text(
                        text = message.content,
                        color = Color.White.copy(alpha = if (isUser) 1f else 0.9f),
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatTime(message.timestamp),
                    color = Color.White.copy(alpha = 0.15f),
                    fontSize = 9.sp
                )
            }
        }
    }
}

private fun formatTime(timestamp: Long): String {
    val sdf = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(timestamp))
}
