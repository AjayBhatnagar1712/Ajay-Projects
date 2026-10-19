package com.ivar.guruvandan

import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : AudioServiceActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "guru_vandan/android_diagnostics"
        ).setMethodCallHandler { call, result ->
            if (call.method == "appSignatureInfo") {
                result.success(appSignatureInfo())
            } else {
                result.notImplemented()
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun appSignatureInfo(): Map<String, Any?> {
        val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        } else {
            packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
        }
        val signatures: Array<out Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = packageInfo.signingInfo
            if (signingInfo?.hasMultipleSigners() == true) {
                signingInfo.apkContentsSigners ?: emptyArray()
            } else {
                signingInfo?.signingCertificateHistory ?: emptyArray()
            }
        } else {
            packageInfo.signatures ?: emptyArray()
        }
        val signature = signatures.firstOrNull()
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            packageInfo.versionCode.toLong()
        }

        return mapOf(
            "packageName" to packageName,
            "versionName" to packageInfo.versionName,
            "versionCode" to versionCode,
            "sha1" to signature?.digest("SHA-1"),
            "sha256" to signature?.digest("SHA-256")
        )
    }

    private fun Signature.digest(algorithm: String): String {
        val bytes = MessageDigest.getInstance(algorithm).digest(toByteArray())
        return bytes.joinToString(":") { "%02X".format(it.toInt() and 0xFF) }
    }
}
