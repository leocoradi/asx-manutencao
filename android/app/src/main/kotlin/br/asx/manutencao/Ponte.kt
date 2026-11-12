package br.asx.manutencao

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.webkit.JavascriptInterface

// Exposta ao web app como window.AsxNative. Os métodos rodam fora da thread principal.
class Ponte(private val act: Activity) {
    @JavascriptInterface fun versao(): Int = 1

    @JavascriptInterface fun temAcesso(): Boolean = NotificacoesService.ativo(act)

    // Abre a tela do Android onde o usuário libera "Acesso a notificações" para o app.
    @JavascriptInterface fun pedirAcesso() {
        act.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // "toggle", "next" ou "prev" na sessão de mídia ativa.
    @JavascriptInterface fun midia(cmd: String) { Midia.comando(cmd) }

    // Estado atual (mídia + navegação) como JSON; o web app usa ao abrir e ao voltar das configurações.
    @JavascriptInterface fun estado(): String = Estado.json().toString()
}
