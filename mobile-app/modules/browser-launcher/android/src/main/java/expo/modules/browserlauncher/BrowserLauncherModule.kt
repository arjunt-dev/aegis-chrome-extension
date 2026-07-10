package expo.modules.browserlauncher

import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BrowserLauncherModule : Module() {

    override fun definition() = ModuleDefinition {

        Name("BrowserLauncher")

        AsyncFunction("getInstalledBrowsers") {

            val context = appContext.reactContext
                ?: throw Exception("Context unavailable")

            val pm = context.packageManager

            val intent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://example.com")
            ).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
            }

            val browsers = mutableListOf<Map<String, String>>()

            @Suppress("DEPRECATION")
            val activities: List<ResolveInfo> = pm.queryIntentActivities(
                intent,
                PackageManager.MATCH_ALL
            )

            for (activity in activities) {

                val packageName = activity.activityInfo.packageName

                // Skip AEGIS itself
                if (packageName == context.packageName)
                    continue

                val name = activity.loadLabel(pm).toString()

                browsers.add(
                    mapOf(
                        "name" to name,
                        "packageName" to packageName
                    )
                )
            }

            browsers
        }

        // Opens a URL in a specific external browser by package name.
        AsyncFunction("openExternal") { url: String, packageName: String ->

            val context = appContext.reactContext
                ?: throw Exception("Context unavailable")

            val intent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse(url)
            )

            intent.setPackage(packageName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            context.startActivity(intent)
        }

        // Opens a URL in an Android Custom Tab (system chooser fallback).
        AsyncFunction("openCustomTab") { url: String ->

            val context = appContext.reactContext
                ?: throw Exception("Context unavailable")

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }

        // Returns the default browser's package name and label, or null if none is set.
        AsyncFunction("getDefaultBrowser") {

            val context = appContext.reactContext
                ?: throw Exception("Context unavailable")

            val pm = context.packageManager

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
            val resolveInfo = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
                ?: return@AsyncFunction null

            val pkgName = resolveInfo.activityInfo.packageName

            // If the resolved default is AEGIS itself, there's no external default set.
            if (pkgName == context.packageName) return@AsyncFunction null

            mapOf(
                "name" to resolveInfo.loadLabel(pm).toString(),
                "packageName" to pkgName
            )
        }
    }
}