package br.asx.manutencao

import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface

// Exposta ao web app como window.AsxNative. Os métodos rodam fora da thread principal.
class Ponte(private val act: MainActivity) {
    @JavascriptInterface fun versao(): Int = 3

    @JavascriptInterface fun versaoApp(): String = BuildConfig.VERSION_NAME

    // Atualização do APK: o resultado chega em window.asxNativo.atualizacao(estado).
    @JavascriptInterface fun procurarAtualizacao() { Atualizador.verificar() }
    @JavascriptInterface fun instalarAtualizacao() { act.runOnUiThread { Atualizador.instalar(act) } }

    @JavascriptInterface fun temAcesso(): Boolean = NotificacoesService.ativo(act)

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

    // Isenção de otimização de bateria: sem ela a One UI pode suspender a central em segundo plano.
    @JavascriptInterface fun bateriaLivre(): Boolean =
        act.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(act.packageName)
    @JavascriptInterface fun pedirBateria() {
        act.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${act.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
