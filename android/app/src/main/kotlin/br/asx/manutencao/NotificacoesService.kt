package br.asx.manutencao

import android.app.Notification
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import java.io.ByteArrayOutputStream

// Lê a notificação em andamento dos apps de navegação (próxima manobra, distância, seta), as notificações
// de conversa e chamada (central de avisos) e dá ao app a permissão que o MediaSessionManager exige.
class NotificacoesService : NotificationListenerService() {
    companion object {
        val NAVEGADORES = mapOf("app.vela" to "Vela", "com.google.android.apps.maps" to "Google Maps", "com.waze" to "Waze")
        private val CATEGORIAS = setOf(Notification.CATEGORY_MESSAGE, Notification.CATEGORY_CALL, Notification.CATEGORY_EMAIL, "missed_call")
        @Volatile var instancia: NotificacoesService? = null

        fun ativo(ctx: Context): Boolean =
            Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")?.contains(ctx.packageName) == true
    }

    override fun onListenerConnected() {
        instancia = this
        Midia.conectar(this)
        try { activeNotifications?.forEach { processar(it) } } catch (e: SecurityException) { }
        Estado.emitir()
    }

    override fun onListenerDisconnected() { instancia = null }

    override fun onNotificationPosted(sbn: StatusBarNotification) { if (processar(sbn)) Estado.emitir() }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        var mudou = Estado.tirarAviso(sbn.key)
        if (sbn.packageName in NAVEGADORES && Estado.nav?.app == NAVEGADORES[sbn.packageName]) { Estado.nav = null; mudou = true }
        if (mudou) Estado.emitir()
    }

    // O conteúdo vem de outros apps: uma notificação malformada é ignorada em vez de derrubar a central.
    private fun processar(sbn: StatusBarNotification): Boolean = try {
        when {
            sbn.packageName in NAVEGADORES -> manobra(sbn)
            ehAviso(sbn) -> aviso(sbn)
            else -> false
        }
    } catch (e: Exception) { false }

    // Só a notificação fixa (em andamento) é a navegação; avisos avulsos ("rota mais rápida") são ignorados.
    private fun manobra(sbn: StatusBarNotification): Boolean {
        if (!sbn.isOngoing) return false
        val e = sbn.notification.extras
        val titulo = e.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val texto = e.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: e.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
        val sub = e.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""
        // Android 16: texto curto do chip da barra de status; no Google Maps é a distância até a manobra.
        val curta = e.getCharSequence("android.shortCriticalText")?.toString() ?: ""
        if (titulo.isEmpty() && texto.isEmpty()) return false
        val icone = try { sbn.notification.getLargeIcon()?.loadDrawable(this) } catch (ex: Exception) { null }
        Estado.nav = Estado.Nav(NAVEGADORES[sbn.packageName] ?: sbn.packageName, titulo, texto, sub, curta, icone?.let { d ->
            val bmp = (d as? BitmapDrawable)?.bitmap ?: Bitmap.createBitmap(d.intrinsicWidth.coerceAtLeast(1), d.intrinsicHeight.coerceAtLeast(1), Bitmap.Config.ARGB_8888).also { b ->
                val c = Canvas(b); d.setBounds(0, 0, c.width, c.height); d.draw(c)
            }
            val out = ByteArrayOutputStream()
            Bitmap.createScaledBitmap(bmp, 96, (96 * bmp.height / bmp.width.coerceAtLeast(1)).coerceAtLeast(1), true).compress(Bitmap.CompressFormat.PNG, 100, out)
            "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        })
        return true
    }

    // Conversas, chamadas e e-mail; ignora o próprio app, notificações fixas e o resumo de grupo.
    private fun ehAviso(sbn: StatusBarNotification): Boolean {
        val n = sbn.notification
        if (sbn.isOngoing || sbn.packageName == packageName) return false
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return false
        return n.category in CATEGORIAS || n.extras.containsKey(Notification.EXTRA_MESSAGES)
    }

    private fun aviso(sbn: StatusBarNotification): Boolean {
        val e = sbn.notification.extras
        val titulo = ((e.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE) ?: e.getCharSequence(Notification.EXTRA_TITLE))?.toString() ?: "").take(120)
        val texto = (e.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "").take(300)
        if (titulo.isEmpty() && texto.isEmpty()) return false
        @Suppress("DEPRECATION")
        val app = try { e.getParcelable<ApplicationInfo>("android.appInfo")?.let { packageManager.getApplicationLabel(it).toString() } } catch (ex: Exception) { null }
        Estado.porAviso(Estado.Aviso(sbn.key, app ?: sbn.packageName, titulo, texto, sbn.postTime, sbn.notification.contentIntent))
        return true
    }

    fun dispensar(chave: String) { try { cancelNotification(chave) } catch (e: Exception) { } }
}
