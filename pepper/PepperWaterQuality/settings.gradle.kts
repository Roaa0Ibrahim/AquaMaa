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
        // Pepper QiSDK (NAOqi 2.9) repositories
        maven { url = uri("https://qisdk.softbankrobotics.com/sdk/maven") }
        maven { url = uri("https://qisdk.softbankrobotics.com/sdk-beta/maven") }
    }
}

rootProject.name = "PepperWaterQuality"
include(":app")
