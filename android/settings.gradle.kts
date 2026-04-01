pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // JetBrains Koog repository
        maven("https://packages.jetbrains.team/maven/p/grazi/grazie-platform-public")
    }
}

rootProject.name = "LiquidAIAgent"
include(":app")
