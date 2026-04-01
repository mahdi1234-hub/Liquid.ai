package ai.liquid.agent.tools

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import ai.koog.agents.core.tools.annotations.LLMDescription
import ai.koog.agents.core.tools.annotations.Tool
import ai.koog.agents.core.tools.reflect.ToolSet

/**
 * Koog ToolSet for retrieving system information on Android.
 * Enables the LFM2 agent to inspect device state, network, apps, and resources.
 */
@LLMDescription("Tools for retrieving Android system information")
class SystemInfoToolSet(private val context: Context) : ToolSet {

    @Tool
    @LLMDescription("Get detailed system information including CPU, memory, and OS details")
    fun getSystemInfo(): String {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val totalMem = formatBytes(memInfo.totalMem)
        val availMem = formatBytes(memInfo.availMem)
        val usedMem = formatBytes(memInfo.totalMem - memInfo.availMem)

        return """
            ## System Information
            - **Device:** ${Build.MANUFACTURER} ${Build.MODEL}
            - **Android Version:** ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})
            - **Build:** ${Build.DISPLAY}
            - **Hardware:** ${Build.HARDWARE}
            - **Board:** ${Build.BOARD}
            - **CPU ABI:** ${Build.SUPPORTED_ABIS.joinToString(", ")}
            
            ## Memory
            - **Total:** $totalMem
            - **Used:** $usedMem
            - **Available:** $availMem
            - **Low Memory:** ${memInfo.lowMemory}
        """.trimIndent()
    }

    @Tool
    @LLMDescription("Get current network connectivity status and type")
    fun getNetworkStatus(): String {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
            ?: return "No active network connection"

        val capabilities = connectivityManager.getNetworkCapabilities(network)
            ?: return "Unable to determine network capabilities"

        val connectionType = when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WiFi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "Bluetooth"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
            else -> "Unknown"
        }

        val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

        return """
            ## Network Status
            - **Connection Type:** $connectionType
            - **Internet Access:** $hasInternet
            - **Validated:** $isValidated
            - **Not Metered:** ${capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)}
        """.trimIndent()
    }

    @Tool
    @LLMDescription("List installed applications on the device")
    fun listInstalledApps(): String {
        val packageManager = context.packageManager
        val packages = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)

        val userApps = packages.filter { appInfo ->
            (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0
        }

        val appList = userApps.take(50).joinToString("\n") { appInfo ->
            val appName = packageManager.getApplicationLabel(appInfo)
            val packageName = appInfo.packageName
            "- $appName ($packageName)"
        }

        return """
            ## Installed Apps (${userApps.size} user apps)
            $appList
            ${if (userApps.size > 50) "\n... and ${userApps.size - 50} more" else ""}
        """.trimIndent()
    }

    @Tool
    @LLMDescription("Get running processes and their memory usage")
    fun getRunningProcesses(): String {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val runningApps = activityManager.runningAppProcesses ?: return "No running processes found"

        val processList = runningApps.take(20).joinToString("\n") { process ->
            val importance = when (process.importance) {
                ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND -> "Foreground"
                ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE -> "Visible"
                ActivityManager.RunningAppProcessInfo.IMPORTANCE_SERVICE -> "Service"
                ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED -> "Cached"
                else -> "Background"
            }
            "- ${process.processName} [$importance]"
        }

        return """
            ## Running Processes (${runningApps.size} total)
            $processList
        """.trimIndent()
    }

    @Tool
    @LLMDescription("Get display information including screen resolution and density")
    fun getDisplayInfo(): String {
        val displayMetrics = context.resources.displayMetrics
        return """
            ## Display Information
            - **Resolution:** ${displayMetrics.widthPixels} x ${displayMetrics.heightPixels}
            - **Density:** ${displayMetrics.density}x (${displayMetrics.densityDpi} dpi)
            - **Scaled Density:** ${displayMetrics.scaledDensity}
        """.trimIndent()
    }

    private fun formatBytes(bytes: Long): String {
        return when {
            bytes >= 1_073_741_824 -> "%.2f GB".format(bytes / 1_073_741_824.0)
            bytes >= 1_048_576 -> "%.2f MB".format(bytes / 1_048_576.0)
            bytes >= 1024 -> "%.2f KB".format(bytes / 1024.0)
            else -> "$bytes B"
        }
    }
}
