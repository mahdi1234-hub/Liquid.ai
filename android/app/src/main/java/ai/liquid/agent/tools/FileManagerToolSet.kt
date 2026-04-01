package ai.liquid.agent.tools

import android.content.Context
import android.os.Environment
import ai.koog.agents.core.tools.annotations.LLMDescription
import ai.koog.agents.core.tools.annotations.Tool
import ai.koog.agents.core.tools.reflect.ToolSet
import java.io.File

/**
 * Koog ToolSet for file management operations on Android.
 * Allows the LFM2 agent to browse, read, create, and manage files.
 */
@LLMDescription("Tools for managing files and directories on the Android device")
class FileManagerToolSet(private val context: Context) : ToolSet {

    private val baseDir: File = context.getExternalFilesDir(null)
        ?: context.filesDir

    @Tool
    @LLMDescription("List files and directories in the specified path relative to app storage. Use '/' for root.")
    fun listFiles(path: String): String {
        val targetDir = if (path == "/" || path.isEmpty()) {
            baseDir
        } else {
            File(baseDir, path)
        }

        if (!targetDir.exists()) {
            return "Directory not found: $path"
        }

        if (!targetDir.isDirectory) {
            return "$path is a file, not a directory"
        }

        val contents = targetDir.listFiles() ?: return "Unable to list directory contents"
        if (contents.isEmpty()) return "Directory is empty: $path"

        return contents.joinToString("\n") { file ->
            val type = if (file.isDirectory) "[DIR]" else "[FILE]"
            val size = if (file.isFile) formatFileSize(file.length()) else ""
            "$type ${file.name} $size"
        }
    }

    @Tool
    @LLMDescription("Read the contents of a text file at the specified path relative to app storage")
    fun readFile(path: String): String {
        val file = File(baseDir, path)
        if (!file.exists()) return "File not found: $path"
        if (!file.isFile) return "$path is not a file"
        if (file.length() > 1_000_000) return "File too large to read (${formatFileSize(file.length())})"

        return try {
            file.readText()
        } catch (e: Exception) {
            "Error reading file: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Create or overwrite a file with the given content at the specified path")
    fun writeFile(path: String, content: String): String {
        return try {
            val file = File(baseDir, path)
            file.parentFile?.mkdirs()
            file.writeText(content)
            "File written successfully: $path (${formatFileSize(file.length())})"
        } catch (e: Exception) {
            "Error writing file: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Create a new directory at the specified path")
    fun createDirectory(path: String): String {
        return try {
            val dir = File(baseDir, path)
            if (dir.exists()) return "Directory already exists: $path"
            val created = dir.mkdirs()
            if (created) "Directory created: $path" else "Failed to create directory: $path"
        } catch (e: Exception) {
            "Error creating directory: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Delete a file or empty directory at the specified path")
    fun deleteFile(path: String): String {
        return try {
            val file = File(baseDir, path)
            if (!file.exists()) return "File not found: $path"
            val deleted = file.delete()
            if (deleted) "Deleted successfully: $path" else "Failed to delete: $path"
        } catch (e: Exception) {
            "Error deleting: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Move or rename a file from sourcePath to destinationPath")
    fun moveFile(sourcePath: String, destinationPath: String): String {
        return try {
            val source = File(baseDir, sourcePath)
            val dest = File(baseDir, destinationPath)
            if (!source.exists()) return "Source not found: $sourcePath"
            dest.parentFile?.mkdirs()
            val success = source.renameTo(dest)
            if (success) "Moved: $sourcePath -> $destinationPath" else "Failed to move file"
        } catch (e: Exception) {
            "Error moving file: ${e.message}"
        }
    }

    @Tool
    @LLMDescription("Get file or directory information (size, modified date, permissions)")
    fun getFileInfo(path: String): String {
        val file = File(baseDir, path)
        if (!file.exists()) return "File not found: $path"

        val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault())
        return """
            Path: $path
            Type: ${if (file.isDirectory) "Directory" else "File"}
            Size: ${formatFileSize(file.length())}
            Modified: ${dateFormat.format(java.util.Date(file.lastModified()))}
            Readable: ${file.canRead()}
            Writable: ${file.canWrite()}
        """.trimIndent()
    }

    @Tool
    @LLMDescription("Get device storage information (total, free, used space)")
    fun getStorageInfo(): String {
        val internal = Environment.getDataDirectory()
        val totalSpace = internal.totalSpace
        val freeSpace = internal.freeSpace
        val usedSpace = totalSpace - freeSpace

        return """
            Internal Storage:
              Total: ${formatFileSize(totalSpace)}
              Used: ${formatFileSize(usedSpace)}
              Free: ${formatFileSize(freeSpace)}
              Usage: ${(usedSpace * 100 / totalSpace)}%
        """.trimIndent()
    }

    private fun formatFileSize(bytes: Long): String {
        return when {
            bytes >= 1_073_741_824 -> "%.2f GB".format(bytes / 1_073_741_824.0)
            bytes >= 1_048_576 -> "%.2f MB".format(bytes / 1_048_576.0)
            bytes >= 1024 -> "%.2f KB".format(bytes / 1024.0)
            else -> "$bytes B"
        }
    }
}
