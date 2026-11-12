package br.asx.manutencao

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.maps.GoogleMap
import com.google.android.libraries.navigation.NavigationApi
import com.google.android.libraries.navigation.NavigationView
import com.google.android.libraries.navigation.Navigator
import com.google.android.libraries.navigation.Waypoint

// Mapa e guia curva a curva do Google Navigation SDK. A view fica por cima da WebView, no retângulo
// que o web app informa (área do mapa na aba Navegação). A interface de guia (manobra, faixas, chegada)
// é a do próprio SDK. Cada destino pedido conta na cota do SKU "Navigation Request".
class MapaNativo(private val act: Activity, raiz: FrameLayout, estado: Bundle?) {
    val view = NavigationView(act)
    private var mapa: GoogleMap? = null
    private var navigator: Navigator? = null
    private var destino = ""

    init {
        view.visibility = View.GONE
        raiz.addView(view, FrameLayout.LayoutParams(0, 0))
        view.onCreate(estado)
        view.getMapAsync { m -> mapa = m; seguir() }
    }

    // Retângulo em px de CSS (1 px de CSS = 1 dp na WebView com viewport de largura do aparelho).
    fun posicionar(x: Float, y: Float, w: Float, h: Float) {
        if (w < 1f || h < 1f) { view.visibility = View.GONE; return }
        val d = act.resources.displayMetrics.density
        val lp = view.layoutParams as FrameLayout.LayoutParams
        lp.width = (w * d).toInt(); lp.height = (h * d).toInt()
        lp.leftMargin = (x * d).toInt(); lp.topMargin = (y * d).toInt()
        view.layoutParams = lp
        view.visibility = View.VISIBLE
    }

    @SuppressLint("MissingPermission")
    private fun seguir() {
        try {
            mapa?.isMyLocationEnabled = true
            mapa?.followMyLocation(GoogleMap.CameraPerspective.TILTED)
        } catch (e: SecurityException) { }
    }

    fun navegar(lat: Double, lng: Double, titulo: String) {
        destino = titulo
        publicar(false, "")
        val nav = navigator
        if (nav != null) { iniciar(nav, lat, lng); return }
        // Primeira vez: termos de uso do Google e criação do navegador.
        if (NavigationApi.areTermsAccepted(act.application)) obter(lat, lng)
        else NavigationApi.showTermsAndConditionsDialog(act, "ASX Manutenção") { aceitou ->
            if (aceitou) obter(lat, lng) else publicar(false, "Termos do Google Maps não aceitos.")
        }
    }

    private fun obter(lat: Double, lng: Double) {
        NavigationApi.getNavigator(act, object : NavigationApi.NavigatorListener {
            override fun onNavigatorReady(nav: Navigator) {
                navigator = nav
                nav.addArrivalListener { parar() }
                nav.addRemainingTimeOrDistanceChangedListener(30, 100) { publicar(true, "") }
                iniciar(nav, lat, lng)
            }
            override fun onError(codigo: Int) {
                publicar(false, when (codigo) {
                    NavigationApi.ErrorCode.NOT_AUTHORIZED -> "Chave do Google sem acesso ao Navigation SDK."
                    NavigationApi.ErrorCode.TERMS_NOT_ACCEPTED -> "Termos do Google Maps não aceitos."
                    NavigationApi.ErrorCode.NETWORK_ERROR -> "Sem rede para iniciar a navegação."
                    NavigationApi.ErrorCode.LOCATION_PERMISSION_MISSING -> "Sem permissão de localização."
                    else -> "Navegação indisponível (erro $codigo)."
                })
            }
        })
    }

    private fun iniciar(nav: Navigator, lat: Double, lng: Double) {
        val ponto = try { Waypoint.builder().setLatLng(lat, lng).setTitle(destino).build() }
                    catch (e: Exception) { publicar(false, "Destino inválido."); return }
        nav.setDestination(ponto).setOnResultListener { status ->
            if (status == Navigator.RouteStatus.OK) {
                nav.setAudioGuidance(Navigator.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE)
                nav.startGuidance()
                seguir()
                publicar(true, "")
            } else publicar(false, when (status) {
                Navigator.RouteStatus.NO_ROUTE_FOUND -> "Nenhuma rota até $destino."
                Navigator.RouteStatus.NETWORK_ERROR -> "Sem rede para calcular a rota."
                Navigator.RouteStatus.QUOTA_CHECK_FAILED -> "Cota do Navigation SDK esgotada ou chave recusada."
                Navigator.RouteStatus.LOCATION_DISABLED, Navigator.RouteStatus.LOCATION_UNKNOWN -> "Posição atual indisponível. Ative o GPS."
                else -> "Rota não calculada ($status)."
            })
        }
    }

    fun parar() {
        navigator?.let { it.stopGuidance(); it.clearDestinations() }
        Estado.guia = null
        Estado.emitir()
    }

    private fun publicar(ativo: Boolean, erro: String) {
        val td = if (ativo) try { navigator?.currentTimeAndDistance } catch (e: Exception) { null } else null
        Estado.guia = Estado.Guia(ativo, destino, td?.seconds ?: 0, td?.meters ?: 0, erro)
        Estado.emitir()
    }

    fun destruir() {
        try { navigator?.stopGuidance() } catch (e: Exception) { }
        view.onDestroy()
    }
}
