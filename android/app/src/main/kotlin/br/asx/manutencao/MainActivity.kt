package br.asx.manutencao

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import java.util.Locale

// Casca fina: WebView com o web app publicado + ponte nativa (mídia, manobras, avisos e mapa de navegação).
class MainActivity : Activity() {
    private lateinit var raiz: FrameLayout
    private lateinit var web: WebView
    private var mapa: MapaNativo? = null
    private var geoOrigem: String? = null
    private var geoCallback: GeolocationPermissions.Callback? = null
    private var destinoPendente: Triple<Double, Double, String>? = null
    private var tts: TextToSpeech? = null
    private var ttsPronto = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        raiz = FrameLayout(this)
        raiz.setBackgroundColor(0xFF0A0A0A.toInt())
        web = WebView(this)
        web.setBackgroundColor(0xFF0A0A0A.toInt())
        raiz.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(raiz)

        // Android 15+ desenha o app atrás das barras do sistema; a WebView não recebe essas margens,
        // então elas viram padding do contêiner (barras, recorte da tela e teclado).
        raiz.setOnApplyWindowInsetsListener { v, i ->
            if (Build.VERSION.SDK_INT >= 30) {
                val b = i.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                v.setPadding(b.left, b.top, b.right, b.bottom)
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(i.systemWindowInsetLeft, i.systemWindowInsetTop, i.systemWindowInsetRight, i.systemWindowInsetBottom)
            }
            i
        }
        aplicarBarras()

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(true)
            userAgentString = "$userAgentString AsxApp/2"
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
                if (temLocalizacao()) callback.invoke(origin, true, true)
                else { geoOrigem = origin; geoCallback = callback; pedirLocalizacao() }
            }
        }

        if (BuildConfig.TEM_NAV) mapa = try { MapaNativo(this, raiz, savedInstanceState) } catch (e: Exception) { null }
        tts = TextToSpeech(this) { st -> if (st == TextToSpeech.SUCCESS) { tts?.language = Locale("pt", "BR"); ttsPronto = true } }

        Estado.ouvinte = { json -> runOnUiThread { web.evaluateJavascript("window.asxNativo && window.asxNativo.evento($json)", null) } }
        if (savedInstanceState == null) web.loadUrl(base.toString()) else web.restoreState(savedInstanceState)
    }

    // Em paisagem (uso no carro) as barras do sistema ficam escondidas e voltam com um gesto.
    private fun aplicarBarras() {
        if (Build.VERSION.SDK_INT < 30) return
        val c = window.insetsController ?: return
        if (resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            c.hide(WindowInsets.Type.systemBars())
        } else c.show(WindowInsets.Type.systemBars())
    }

    private fun temLocalizacao() = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    private fun pedirLocalizacao() = requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 1)

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        val ok = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        geoCallback?.invoke(geoOrigem, ok, ok)
        geoCallback = null; geoOrigem = null
        val d = destinoPendente; destinoPendente = null
        if (d != null) {
            if (ok) navegar(d.first, d.second, d.third)
            else { Estado.guia = Estado.Guia(false, d.third, 0, 0, "Sem permissão de localização."); Estado.emitir() }
        }
    }

    // --- Chamados pela Ponte ---
    fun temMapaNativo() = mapa != null
    fun posicionarMapa(x: Float, y: Float, w: Float, h: Float) { mapa?.posicionar(x, y, w, h) }
    fun navegar(lat: Double, lng: Double, titulo: String) {
        if (!temLocalizacao()) { destinoPendente = Triple(lat, lng, titulo); pedirLocalizacao(); return }
        mapa?.navegar(lat, lng, titulo)
    }
    fun pararGuia() { mapa?.parar() }
    fun falar(texto: String) { if (ttsPronto) tts?.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "aviso") }

    // --- Ciclo de vida (repassado ao mapa nativo) ---
    override fun onStart() { super.onStart(); mapa?.view?.onStart() }
    override fun onResume() {
        super.onResume()
        mapa?.view?.onResume()
        Midia.conectar(this) // depois de o usuário dar o acesso a notificações, a sessão passa a ser lida
        Estado.emitir()
    }
    override fun onPause() { mapa?.view?.onPause(); super.onPause() }
    override fun onStop() { mapa?.view?.onStop(); super.onStop() }
    override fun onDestroy() {
        Estado.ouvinte = null
        tts?.shutdown()
        mapa?.destruir()
        super.onDestroy()
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) aplicarBarras() }
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        mapa?.view?.onConfigurationChanged(newConfig)
        aplicarBarras()
    }
    override fun onTrimMemory(level: Int) { super.onTrimMemory(level); mapa?.view?.onTrimMemory(level) }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
        mapa?.view?.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
