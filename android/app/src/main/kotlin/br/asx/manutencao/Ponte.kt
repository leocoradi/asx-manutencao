package br.asx.manutencao

import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

// Exposta ao web app como window.AsxNative. Os métodos rodam fora da thread principal.
class Ponte(private val act: MainActivity) {
    @JavascriptInterface fun versaoApp(): String = BuildConfig.VERSION_NAME

    // Atualização do APK: o resultado chega em window.asxNativo.atualizacao(estado).
    @JavascriptInterface fun procurarAtualizacao() { Atualizador.verificar() }
    @JavascriptInterface fun instalarAtualizacao() { act.runOnUiThread { Atualizador.instalar(act) } }

    // Abre a tela do Android onde o usuário libera "Acesso a notificações" para o app.
    @JavascriptInterface fun pedirAcesso() {
        act.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // "toggle", "next" ou "prev" na sessão de mídia ativa.
    @JavascriptInterface fun midia(cmd: String) { Midia.comando(cmd) }

    // Estado atual (mídia, manobra, avisos, modo carro) como JSON; o web app usa ao abrir e ao voltar das configurações.
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

    // --- Modo carro ---
    @JavascriptInterface fun modoCarro(ligar: Boolean) { act.runOnUiThread { ModoCarro.manual(ligar) } }
    // Nome do dispositivo Bluetooth do carro; vazio esquece.
    @JavascriptInterface fun lembrarCarro(nome: String) { act.runOnUiThread { ModoCarro.lembrar(act, nome.ifBlank { null }) } }

    // --- Atalhos do Início no modo carro ---
    // Lista dos apps conhecidos que estão instalados: [{ id, nome, tipo }].
    @JavascriptInterface fun apps(): String = JSONArray().apply {
        APPS.filter { act.packageManager.getLaunchIntentForPackage(it.pacote) != null }
            .forEach { put(JSONObject().put("id", it.pacote).put("nome", it.nome).put("tipo", it.tipo)) }
    }.toString()
    // Abre um app da lista (nenhum outro pacote é aceito). Navegação abre em tela dividida, ao lado da central.
    // Com endereço próprio (Android Auto), vai direto à função; se a versão instalada não o reconhecer, abre o app.
    @JavascriptInterface fun abrirApp(id: String) {
        val app = APPS.firstOrNull { it.pacote == id } ?: return
        val inicial = act.packageManager.getLaunchIntentForPackage(id) ?: return
        val direto = app.endereco?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)).setPackage(id) }
            ?.takeIf { it.resolveActivity(act.packageManager) != null }
        val i = (direto ?: inicial).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (app.aoLado) i.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT)
        act.runOnUiThread { try { act.startActivity(i) } catch (e: Exception) { } }
    }

    // Isenção de otimização de bateria: sem ela a One UI pode suspender a central em segundo plano.
    @JavascriptInterface fun bateriaLivre(): Boolean =
        act.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(act.packageName)
    @JavascriptInterface fun pedirBateria() {
        act.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${act.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private class App(val pacote: String, val nome: String, val tipo: String, val aoLado: Boolean, val endereco: String? = null)
    private companion object {
        // Os pacotes também estão em <queries> no manifesto; sem isso o Android 11+ não os enxerga.
        val APPS = listOf(
            App("com.waze", "Waze", "nav", true),
            App("com.google.android.apps.maps", "Google Maps", "nav", true),
            App("app.vela", "Vela", "nav", true),
            App("com.google.android.apps.youtube.music", "YouTube Music", "musica", false),
            // Open Headunit: headunit://selfmode inicia o Android Auto do próprio tablet (Self Mode) num toque.
            App("com.andrerinas.headunitrevived", "Android Auto", "auto", false, "headunit://selfmode"),
        )
    }
}
