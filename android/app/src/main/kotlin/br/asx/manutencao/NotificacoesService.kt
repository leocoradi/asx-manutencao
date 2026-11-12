package br.asx.manutencao

import android.app.Notification
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import java.io.ByteArrayOutputStream

// Lê a notificação em andamento dos apps de navegação (próxima manobra, distância, seta)
// e dá ao app a permissão que o MediaSessionManager exige.
class NotificacoesService : NotificationListenerService() {
    companion object {
        val NAVEGADORES = mapOf("app.vela" to "Vela", "com.google.android.apps.maps" to "Google Maps", "com.waze" to "Waze")

        fun ativo(ctx: Context): Boolean =
            Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")?.contains(ctx.packageName) == true
    }

    override fun onListenerConnected() {
        Midia.conectar(this)
        activeNotifications?.forEach { if (it.packageName in NAVEGADORES) processar(it) }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName in NAVEGADORES) processar(sbn)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (sbn.packageName in NAVEGADORES && Estado.nav?.app == NAVEGADORES[sbn.packageName]) {
            Estado.nav = null; Estado.emitir()
        }
    }

    // Só a notificação fixa (em andamento) é a navegação; avisos avulsos ("rota mais rápida") são ignorados.
    private fun processar(sbn: StatusBarNotification) {
        if (!sbn.isOngoing) return
        val e = sbn.notification.extras
        val titulo = e.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val texto = e.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: e.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
        val sub = e.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""
        if (titulo.isEmpty() && texto.isEmpty()) return
        val icone = try { sbn.notification.getLargeIcon()?.loadDrawable(this) } catch (ex: Exception) { null }
        Estado.nav = Estado.Nav(NAVEGADORES[sbn.packageName] ?: sbn.packageName, titulo, texto, sub, icone?.let { d ->
            val bmp = (d as? BitmapDrawable)?.bitmap ?: Bitmap.createBitmap(d.intrinsicWidth.coerceAtLeast(1), d.intrinsicHeight.coerceAtLeast(1), Bitmap.Config.ARGB_8888).also { b ->
                val c = Canvas(b); d.setBounds(0, 0, c.width, c.height); d.draw(c)
            }
            val out = ByteArrayOutputStream()
            Bitmap.createScaledBitmap(bmp, 96, 96 * bmp.height / bmp.width.coerceAtLeast(1), true).compress(Bitmap.CompressFormat.PNG, 100, out)
            "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        })
        Estado.emitir()
    }
}
