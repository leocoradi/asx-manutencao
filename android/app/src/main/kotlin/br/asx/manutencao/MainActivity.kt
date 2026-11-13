package br.asx.manutencao

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.RenderProcessGoneDetail
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import java.io.ByteArrayInputStream
import java.util.Locale

// Casca da central: WebView com a interface embutida no APK + ponte nativa (mídia, manobras, avisos,
// modo carro e atualização). Fora do modo carro é um app comum.
class MainActivity : Activity() {
    private lateinit var raiz: FrameLayout
    private lateinit var web: WebView
    private lateinit var base: Uri
    private var geoOrigem: String? = null
    private var geoCallback: GeolocationPermissions.Callback? = null
    private var tts: TextToSpeech? = null
    private var ttsPronto = false
    private val audioCb = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(d: Array<out AudioDeviceInfo>) = atualizarAudio()
        override fun onAudioDevicesRemoved(d: Array<out AudioDeviceInfo>) = atualizarAudio()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        base = Uri.parse(getString(R.string.app_url))
        raiz = FrameLayout(this)
        raiz.setBackgroundColor(0xFF0A0A0A.toInt())
        setContentView(raiz)

        // Android 15+ desenha o app atrás das barras do sistema: as margens (barras, recorte da tela e
        // teclado) viram padding do contêiner e são consumidas, senão a WebView aplica as mesmas margens
        // de novo via env(safe-area-inset-*) e aparecem faixas vazias duplicadas no topo e embaixo.
        raiz.setOnApplyWindowInsetsListener { v, i ->
            if (Build.VERSION.SDK_INT >= 30) {
                val b = i.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                v.setPadding(b.left, b.top, b.right, b.bottom)
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(i.systemWindowInsetLeft, i.systemWindowInsetTop, i.systemWindowInsetRight, i.systemWindowInsetBottom)
            }
            if (Build.VERSION.SDK_INT >= 30) WindowInsets.CONSUMED else consumir(i)
        }

        // Pedidos do service worker de versões antigas também são servidos pelos arquivos embutidos.
        ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
            override fun shouldInterceptRequest(request: WebResourceRequest) = local(request.url)
        })

        criarWebView()
        tts = TextToSpeech(this) { st -> if (st == TextToSpeech.SUCCESS) { tts?.language = Locale("pt", "BR"); ttsPronto = true } }

        Estado.ouvinte = { json -> runOnUiThread { web.evaluateJavascript("window.asxNativo && window.asxNativo.evento($json)", null) } }
        Atualizador.ouvinte = { json -> runOnUiThread { web.evaluateJavascript("window.asxNativo && window.asxNativo.atualizacao && window.asxNativo.atualizacao($json)", null) } }
        ModoCarro.iniciar(this)
        ModoCarro.aoMudar = { aplicarModo(it) }
        // O Android chama o callback na hora com os dispositivos já conectados.
        getSystemService(AudioManager::class.java).registerAudioDeviceCallback(audioCb, Handler(Looper.getMainLooper()))
        aplicarModo(ModoCarro.ativo)

        if (savedInstanceState == null) web.loadUrl(base.toString()) else web.restoreState(savedInstanceState)
    }

    private fun criarWebView() {
        web = WebView(this)
        web.setBackgroundColor(0xFF0A0A0A.toInt())
        raiz.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(true)
            // A interface vem de assets pelo interceptador; a WebView não precisa ler arquivos nem content:// do aparelho.
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString AsxApp/3"
        }
        web.addJavascriptInterface(Ponte(this), "AsxNative")
        web.webViewClient = object : WebViewClient() {
            // Interface embutida: os arquivos do app saem do APK, no mesmo endereço do site, então os
            // registros já gravados no aparelho continuam valendo e a central abre sem internet.
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = local(request.url)

            // Só o próprio app navega dentro da WebView. Qualquer outro endereço vai para o Android (se o esquema
            // for conhecido) ou é descartado: uma página de fora aberta aqui teria acesso à ponte nativa.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val u = request.url
                if (doApp(u) && (u.path ?: "/").startsWith(base.path ?: "/")) return false
                if (u.scheme in ESQUEMAS_EXTERNOS) try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (e: Exception) { }
                return true
            }

            // Se o processo de desenho da WebView morrer (memória), recria em vez de deixar a tela em branco.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                raiz.removeView(web)
                web.destroy()
                criarWebView()
                web.loadUrl(base.toString())
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                // Só a interface do app recebe a posição; um quadro de outra origem dentro da WebView, não.
                if (!doApp(Uri.parse(origin))) callback.invoke(origin, false, false)
                else if (temLocalizacao()) callback.invoke(origin, true, true)
                else { geoOrigem = origin; geoCallback = callback; pedirLocalizacao() }
            }
        }
    }

    private fun doApp(u: Uri) = u.scheme == "https" && u.host == base.host

    // Arquivo embutido (assets/www) para um endereço do app; null (outros sites) deixa ir para a rede.
    // No endereço do app, o que não está embutido responde 404: a interface vem só de dentro do APK assinado,
    // nunca da rede, e a central não fica esperando um servidor quando está sem internet.
    private fun local(url: Uri): WebResourceResponse? {
        if (url.host != base.host) return null
        val prefixo = base.path ?: "/"
        val caminho = url.path ?: ""
        val arquivo = caminho.removePrefix(prefixo).let { if (it.isEmpty() || it.endsWith("/")) it + "index.html" else it }
        val tipo = TIPOS[arquivo.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
        val texto = tipo.startsWith("text/") || tipo.endsWith("json") || tipo.endsWith("javascript")
        return try {
            if (!caminho.startsWith(prefixo) || arquivo.contains("..")) throw IllegalArgumentException(arquivo)
            WebResourceResponse(tipo, if (texto) "utf-8" else null, assets.open("www/$arquivo"))
        } catch (e: Exception) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
        }
    }

    @Suppress("DEPRECATION")
    private fun consumir(i: WindowInsets): WindowInsets = i.consumeSystemWindowInsets()

    // Áudio Bluetooth conectado agora; o modo carro compara com o carro escolhido.
    private fun atualizarAudio() {
        val bt = getSystemService(AudioManager::class.java).getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
        ModoCarro.audioMudou(bt?.productName?.toString()?.takeIf { it.isNotBlank() })
    }

    // Modo carro: paisagem, tela sempre acesa e barras escondidas. Fora dele, o app segue o tablet.
    private fun aplicarModo(carro: Boolean) {
        if (carro) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestedOrientation = if (carro) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        aplicarBarras()
    }

    // Barras do sistema escondidas no modo carro e em paisagem; voltam com um gesto da borda.
    private fun aplicarBarras() {
        if (Build.VERSION.SDK_INT < 30) return
        val c = window.insetsController ?: return
        if (ModoCarro.ativo || resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
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
    }

    fun falar(texto: String) { if (ttsPronto) tts?.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "aviso") }

    override fun onResume() {
        super.onResume()
        Midia.conectar(this) // depois de o usuário dar o acesso a notificações, a sessão passa a ser lida
        Estado.emitir()
    }
    override fun onDestroy() {
        Estado.ouvinte = null
        Atualizador.ouvinte = null
        ModoCarro.aoMudar = null
        getSystemService(AudioManager::class.java).unregisterAudioDeviceCallback(audioCb)
        tts?.shutdown()
        web.destroy()
        super.onDestroy()
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) aplicarBarras() }
    override fun onConfigurationChanged(newConfig: Configuration) { super.onConfigurationChanged(newConfig); aplicarBarras() }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    // No modo carro, Voltar navega dentro do app mas não fecha a central.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            web.canGoBack() -> web.goBack()
            ModoCarro.ativo -> Toast.makeText(this, "Modo carro: para sair, toque no botão do carro no topo.", Toast.LENGTH_SHORT).show()
            else -> super.onBackPressed()
        }
    }

    companion object {
        private val ESQUEMAS_EXTERNOS = setOf("https", "http", "geo", "google.navigation")
        private val TIPOS = mapOf(
            "html" to "text/html", "css" to "text/css", "js" to "text/javascript", "mjs" to "text/javascript",
            "json" to "application/json", "webmanifest" to "application/manifest+json", "svg" to "image/svg+xml",
            "png" to "image/png", "jpg" to "image/jpeg", "glb" to "model/gltf-binary", "wasm" to "application/wasm",
            "txt" to "text/plain", "woff2" to "font/woff2",
        )
    }
}
