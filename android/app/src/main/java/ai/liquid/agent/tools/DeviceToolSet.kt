package ai.liquid.agent.tools

import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.provider.Settings
import ai.koog.agents.core.tools.annotations.LLMDescription
import ai.koog.agents.core.tools.annotations.Tool
import ai.koog.agents.core.tools.reflect.ToolSet

/**
 * Koog ToolSet for Android device interaction.
 * Provides tools that the LFM2 agent can invoke to interact with the device.
 */
@LLMDescription("Tools for interacting with the Android device")
class DeviceToolSet(private val context: Context) : ToolSet {

    @Tool
    @LLMDescription("Get the current battery level and charging status of the device")
    fun getBatteryStatus(): String {
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val isCharging = batteryManager.isCharging
        val status = if (isCharging) "Charging" else "Not charging"
        return "Battery: $level% ($status)"
    }

    @Tool
    @LLMDescription("Get the current screen brightness level (0-255)")
    fun getScreenBrightness(): String {
        return try {
            val brightness = Settings.System.getInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS
            )
            "Screen brightness: $brightness/255"
        } catch (e: Exception) {
            "Unable to read screen brightness: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Check if WiFi is enabled on the device")
    fun getWifiStatus(): String {
        val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val isEnabled = wifiManager.isWifiEnabled
        return if (isEnabled) "WiFi is enabled" else "WiFi is disabled"
    }

    @Tool
    @LLMDescription("Get the device model, manufacturer, and Android version")
    fun getDeviceInfo(): String {
        val manufacturer = android.os.Build.MANUFACTURER
        val model = android.os.Build.MODEL
        val androidVersion = android.os.Build.VERSION.RELEASE
        val sdkVersion = android.os.Build.VERSION.SDK_INT
        return """
            Device: $manufacturer $model
            Android: $androidVersion (SDK $sdkVersion)
        """.trimIndent()
    }

    @Tool
    @LLMDescription("Open the device settings app")
    fun openSettings(): String {
        return try {
            val intent = Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            "Settings app opened successfully"
        } catch (e: Exception) {
            "Failed to open settings: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Open WiFi settings on the device")
    fun openWifiSettings(): String {
        return try {
            val intent = Intent(Settings.ACTION_WIFI_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            "WiFi settings opened successfully"
        } catch (e: Exception) {
            "Failed to open WiFi settings: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Get the current date and time on the device")
    fun getCurrentDateTime(): String {
        val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", java.util.Locale.getDefault())
        val currentDate = dateFormat.format(java.util.Date())
        val timezone = java.util.TimeZone.getDefault().displayName
        return "Current time: $currentDate\nTimezone: $timezone"
    }

    @Tool
    @LLMDescription("Get the current locale and language settings of the device")
    fun getLocaleInfo(): String {
        val locale = java.util.Locale.getDefault()
        return """
            Language: ${locale.displayLanguage}
            Country: ${locale.displayCountry}
            Locale: ${locale.toLanguageTag()}
        """.trimIndent()
    }
}
