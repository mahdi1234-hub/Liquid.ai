package ai.liquid.agent.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// NOVERA brand palette -- matching the web hero section
private val NoveraDark = Color(0xFF1C1917)
private val NoveraSurface = Color(0xFF292524)
private val NoveraAccent = Color(0xFFA68B6A)
private val NoveraLight = Color(0xFFF9F8F6)
private val NoveraError = Color(0xFFDC2626)

private val DarkColorScheme = darkColorScheme(
    primary = NoveraAccent,
    onPrimary = NoveraDark,
    secondary = Color(0xFF78716C),
    onSecondary = Color.White,
    tertiary = Color(0xFF44403C),
    background = NoveraDark,
    surface = NoveraSurface,
    onBackground = NoveraLight,
    onSurface = NoveraLight,
    error = NoveraError,
    onError = Color.White
)

@Composable
fun LiquidAgentTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography(),
        content = content
    )
}
