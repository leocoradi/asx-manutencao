package br.asx.manutencao

import android.content.Intent
import android.location.Geocoder
import android.provider.Settings
import android.webkit.JavascriptInterface
import java.util.Locale

// Exposta ao web app como window.AsxNative. Os métodos rodam fora da thread principal.
class Ponte(private val act: MainActivity) {
    @JavascriptInterface fun versao(): Int = 2

    @JavascriptInterface fun temAcesso(): Boolean = NotificacoesService.ativo(act)

    // Abre a tela do Android onde o usuário libera "Acesso a notificações" para o app.
    @JavascriptInterface fun pedirAcesso() {
        act.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // "toggle", "next" ou "prev" na sessão de mídia ativa.
    @JavascriptInterface fun midia(cmd: String) { Midia.comando(cmd) }

    // Estado atual (mídia, manobra, guia, avisos) como JSON; o web app usa ao abrir e ao voltar das configurações.
    @JavascriptInterface fun estado(): String = Estado.json().toString()

    // Central de avisos: "ouvir" (voz), "abrir" (no app de origem) ou "dispensar".
    @JavascriptInterface fun aviso(acao: String, chave: String) {
        val a = Estado.aviso(chave) ?: return
        when (acao) {
            "ouvir" -> act.falar("${a.app}. ${a.titulo}. ${a.texto}")
            "abrir" -> try { a.abrir?.send() } catch (e: Exception) { }
            "dispensar" -> { NotificacoesService.instancia?.dispensar(chave); if (Estado.tirarAviso(chave)) Estado.emitir() }
        }
    }

    // --- Mapa nativo (Navigation SDK). Só existe quando o APK foi compilado com a chave do Google. ---
    @JavascriptInterface fun navSdk(): Boolean = act.temMapaNativo()

    // Retângulo do mapa em px de CSS, relativo à WebView; largura ou altura zero esconde.
    @JavascriptInterface fun mapa(x: Float, y: Float, w: Float, h: Float) { act.runOnUiThread { act.posicionarMapa(x, y, w, h) } }

    // Endereço em texto -> coordenadas (Geocoder do Android, sem chave) -> rota e guia.
    @JavascriptInterface fun navegar(destino: String) {
        val achado = try {
            @Suppress("DEPRECATION")
            Geocoder(act, Locale("pt", "BR")).getFromLocationName(destino, 1)?.firstOrNull()
        } catch (e: Exception) { null }
        if (achado == null) {
            Estado.guia = Estado.Guia(false, destino, 0, 0, "Destino não encontrado: $destino")
            Estado.emitir(); return
        }
        act.runOnUiThread { act.navegar(achado.latitude, achado.longitude, destino) }
    }

    @JavascriptInterface fun pararGuia() { act.runOnUiThread { act.pararGuia() } }
}
