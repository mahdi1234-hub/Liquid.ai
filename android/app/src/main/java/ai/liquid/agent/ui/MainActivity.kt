package ai.liquid.agent.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import ai.liquid.agent.ui.theme.LiquidAgentTheme

/**
 * Main entry point for the Liquid AI Agent Android app.
 * Uses Jetpack Compose for the UI with the Koog agent framework underneath.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: AgentViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            LiquidAgentTheme {
                AgentChatScreen(viewModel = viewModel)
            }
        }
    }
}
