package expo.modules.browserlauncher

import android.content.Intent
import android.content.pm.PackageManager
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
            )

            val browsers = mutableListOf<Map<String, String>>()

            val activities = pm.queryIntentActivities(
                intent,
                PackageManager.MATCH_DEFAULT_ONLY
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

        AsyncFunction("open") { url: String, packageName: String ->

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
    }
}