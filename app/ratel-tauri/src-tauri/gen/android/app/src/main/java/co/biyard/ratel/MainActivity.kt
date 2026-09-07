package co.biyard.ratel

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebView
import androidx.core.content.FileProvider
import java.io.File
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : TauriActivity() {
  private var webView: WebView? = null
  private var pendingUrl: String? = null
  private var fcmToken: String? = null
  private var deviceId: String = "android"
  private val handler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    createNotificationChannel()
    requestNotificationPermission()
    // Cold start from a notification tap carries the route in the intent.
    pendingUrl = intent?.getStringExtra("url")
  }

  // Tapped while the app is already running (singleTask) → page is live, so a
  // single inject reaches the SPA listeners immediately.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    val url = intent.getStringExtra("url")
    if (!url.isNullOrEmpty()) {
      pendingUrl = url
      injectNow()
    }
  }

  // CookieManager on Android System WebView rejects third-party cookies by
  // default; the backend (`*.ratel.foundation`) is cross-site relative to the
  // WebView origin so without this every Set-Cookie is blocked. This is also
  // where we capture the FCM token + stable device id for backend registration.
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    this.webView = webView

    val cm = CookieManager.getInstance()
    cm.setAcceptCookie(true)
    cm.setAcceptThirdPartyCookies(webView, true)

    deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "android"
    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
      if (task.isSuccessful) {
        fcmToken = task.result
      }
    }

    // `onWebViewCreate` fires BEFORE the page/WASM is loaded, so a single inject
    // here lands on a window that the SPA boot then replaces (token + deep link
    // lost; the web listeners aren't attached yet either). Re-inject on a few
    // delays so at least one lands after the SPA is ready and its listeners are
    // up. Re-firing is idempotent (token upsert; same-route nav).
    scheduleInjects()
  }

  private fun scheduleInjects() {
    for (delay in longArrayOf(800, 2000, 4000, 7000)) {
      handler.postDelayed({ injectNow() }, delay)
    }
  }

  private fun injectNow() {
    val wv = webView ?: return
    fcmToken?.let { token ->
      wv.evaluateJavascript(
        "window.__RATEL_FCM__={token:'$token',deviceId:'$deviceId',platform:'android'};" +
          "window.dispatchEvent(new Event('ratel-fcm-ready'));",
        null
      )
    }
    pendingUrl?.let { url ->
      wv.evaluateJavascript(deepLinkJs(url), null)
    }
  }

  private fun deepLinkJs(url: String): String =
    "window.__RATEL_PENDING_URL__='$url';" +
      "window.dispatchEvent(new CustomEvent('ratel-deeplink',{detail:'$url'}));"

  // ── File delivery (called over JNI from `commands/native_file.rs`) ──
  //
  // Android System WebView drops `<a download>` / `blob:` navigations unless
  // the host registers a DownloadListener, and has no print UI at all. So the
  // Excel export and the report "download" both did nothing in the app. These
  // two methods are the native landing spots for those buttons.
  //
  // Both are invoked on the UI thread by the JNI handle and return a plain
  // Boolean the Rust side turns into a typed result — nothing here may throw
  // across the FFI boundary, hence the broad catches.

  /// Save `bytesB64` as `fileName` somewhere the user can actually reach it.
  ///
  /// API 29+ writes into the shared Downloads collection, so the file lands
  /// where a browser download would and needs no storage permission. Below 29
  /// there is no scoped-storage Downloads API and `WRITE_EXTERNAL_STORAGE`
  /// would mean a runtime permission prompt for a one-off save, so those
  /// devices get a share sheet instead (the app still ships `minSdk 24`).
  fun ratelSaveFile(fileName: String, mimeType: String, bytesB64: String): Boolean {
    return try {
      val bytes = Base64.decode(bytesB64, Base64.DEFAULT)
      val safeName = sanitizeFileName(fileName)
      val type = mimeType.ifBlank { "application/octet-stream" }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveToDownloads(safeName, type, bytes)
      } else {
        shareViaProvider(safeName, type, bytes)
      }
    } catch (t: Throwable) {
      Log.e(TAG, "ratelSaveFile failed", t)
      false
    }
  }

  /// Hand the WebView's current page to the system print stack, which renders
  /// it to a PDF. The system dialog's "Save as PDF" destination is what makes
  /// this a working "download" — we deliberately do not render the PDF
  /// ourselves, because `createPrintDocumentAdapter` already paginates the
  /// exact page the user is looking at.
  fun ratelPrintPage(jobName: String): Boolean {
    return try {
      val wv = webView ?: return false
      val pm = getSystemService(PrintManager::class.java) ?: return false
      val name = jobName.ifBlank { "Ratel" }
      pm.print(
        name,
        wv.createPrintDocumentAdapter(name),
        PrintAttributes.Builder()
          .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
          .build()
      )
      true
    } catch (t: Throwable) {
      Log.e(TAG, "ratelPrintPage failed", t)
      false
    }
  }

  private fun saveToDownloads(fileName: String, mimeType: String, bytes: ByteArray): Boolean {
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, fileName)
      put(MediaStore.Downloads.MIME_TYPE, mimeType)
      // IS_PENDING hides the row until the bytes are fully written, so nothing
      // can open a half-written file.
      put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val resolver = contentResolver
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
    resolver.openOutputStream(uri).use { out ->
      if (out == null) {
        resolver.delete(uri, null, null)
        return false
      }
      out.write(bytes)
    }
    values.clear()
    values.put(MediaStore.Downloads.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    return true
  }

  private fun shareViaProvider(fileName: String, mimeType: String, bytes: ByteArray): Boolean {
    // Cache dir + FileProvider: a raw `file://` URI would throw
    // FileUriExposedException on API 24+, which is exactly the range this
    // branch serves.
    val dir = File(cacheDir, "downloads").apply { mkdirs() }
    val file = File(dir, fileName)
    file.writeBytes(bytes)

    val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = mimeType
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    startActivity(Intent.createChooser(intent, fileName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    return true
  }

  /// Strip anything that would let a server-supplied name escape the target
  /// directory or collide with path syntax.
  private fun sanitizeFileName(name: String): String {
    val cleaned = name.replace(Regex("[/\\\\:*?\"<>|]"), "_").trim()
    return cleaned.ifBlank { "ratel-download" }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel(
          RatelMessagingService.CHANNEL_ID, "Ratel", NotificationManager.IMPORTANCE_HIGH
        )
      )
    }
  }

  private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
    }
  }

  companion object {
    private const val TAG = "RatelNativeFile"
  }
}
