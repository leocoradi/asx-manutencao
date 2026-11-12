package br.asx.manutencao

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

// Casca fina: WebView com o web app publicado + ponte nativa (mídia e navegação).
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var geoOrigem: String? = null
    private var geoCallback: GeolocationPermissions.Callback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        web = WebView(this)
        web.setBackgroundColor(0xFF0A0A0A.toInt())
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(true)
            userAgentString = "$userAgentString AsxApp/1"
        }
        web.addJavascriptInterface(Ponte(this), "AsxNative")

        val base = Uri.parse(getString(R.string.app_url))
        web.webViewClient = object : WebViewClient() {
            // Links do próprio app ficam na WebView; geo:, intents e sites externos vão para o Android.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.scheme in setOf("http", "https") && u.host == base.host) return false
                return try { startActivity(Intent(Intent.ACTION_VIEW, u)); true } catch (e: ActivityNotFoundException) { false }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, true)
                } else {
                    geoOrigem = origin; geoCallback = callback
                    requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 1)
                }
            }
        }

        Estado.ouvinte = { json -> runOnUiThread { web.evaluateJavascript("window.asxNativo && window.asxNativo.evento($json)", null) } }
        if (savedInstanceState == null) web.loadUrl(base.toString()) else web.restoreState(savedInstanceState)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        val ok = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        geoCallback?.invoke(geoOrigem, ok, ok)
        geoCallback = null; geoOrigem = null
    }

    override fun onResume() {
        super.onResume()
        Midia.conectar(this) // depois de o usuário dar o acesso a notificações, a sessão passa a ser lida
        Estado.emitir()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
