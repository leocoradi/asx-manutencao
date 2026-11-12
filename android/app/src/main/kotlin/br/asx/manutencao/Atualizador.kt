package br.asx.manutencao

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

// Botão "Procurar atualização" (engrenagem): consulta a release mais nova do repositório e instala o APK
// pelo instalador do Android. O Android só aceita a troca se o APK novo tiver a mesma assinatura do instalado,
// por isso o CI assina todos os builds com a mesma chave (rascunho de release "assinatura").
object Atualizador {
    private const val API = "https://api.github.com/repos/leocoradi/asx-manutencao/releases/latest"
    @Volatile var ouvinte: ((String) -> Unit)? = null
    @Volatile private var apk: String? = null

    fun publicar(estado: String, extra: JSONObject.() -> Unit = {}) {
        ouvinte?.invoke(JSONObject().put("estado", estado).apply(extra).toString())
    }

    private fun abrir(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15000; readTimeout = 30000
    }

    fun verificar() = thread {
        publicar("procurando")
        try {
            val c = abrir(API).apply { setRequestProperty("Accept", "application/vnd.github+json") }
            when (c.responseCode) {
                404 -> return@thread publicar("atual") { put("versao", BuildConfig.VERSION_NAME) } // nenhuma versão publicada ainda
                200 -> Unit
                else -> return@thread publicar("erro") { put("msg", "O GitHub respondeu ${c.responseCode}. Tente mais tarde.") }
            }
            val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
            // Tag "apk-<número do build>"; o mesmo número é o versionCode do APK.
            val codigo = Regex("""^apk-(\d+)$""").find(j.optString("tag_name"))?.groupValues?.get(1)?.toIntOrNull() ?: 0
            val lista = j.optJSONArray("assets")
            val url = (0 until (lista?.length() ?: 0)).map { lista!!.getJSONObject(it) }
                .firstOrNull { it.optString("name").endsWith(".apk") }?.optString("browser_download_url")
            if (codigo > BuildConfig.VERSION_CODE && url != null) {
                apk = url
                publicar("disponivel") { put("versao", "1.$codigo"); put("atual", BuildConfig.VERSION_NAME) }
            } else publicar("atual") { put("versao", BuildConfig.VERSION_NAME) }
        } catch (e: Exception) {
            publicar("erro") { put("msg", "Sem conexão com o GitHub.") }
        }
    }

    fun instalar(act: Activity) {
        val url = apk ?: return publicar("erro") { put("msg", "Procure a atualização de novo.") }
        if (Build.VERSION.SDK_INT >= 26 && !act.packageManager.canRequestPackageInstalls()) {
            act.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${act.packageName}")))
            return publicar("permissao")
        }
        thread {
            val pi = act.packageManager.packageInstaller
            var id = -1
            try {
                id = pi.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                    .apply { setAppPackageName(act.packageName) })
                pi.openSession(id).use { s ->
                    val c = abrir(url)
                    if (c.responseCode != 200) throw IllegalStateException("HTTP ${c.responseCode}")
                    val total = c.contentLengthLong
                    c.inputStream.use { entrada ->
                        s.openWrite("asx.apk", 0, total).use { saida ->
                            val buf = ByteArray(64 * 1024)
                            var lido = 0L
                            var ultimo = -1
                            while (true) {
                                val n = entrada.read(buf)
                                if (n < 0) break
                                saida.write(buf, 0, n)
                                lido += n
                                val pct = if (total > 0) (lido * 100 / total).toInt() else -1
                                if (pct != ultimo && pct % 5 == 0) { ultimo = pct; publicar("baixando") { put("pct", pct) } }
                            }
                            s.fsync(saida)
                        }
                    }
                    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                    val retorno = PendingIntent.getBroadcast(act, id, Intent(act, InstalacaoReceiver::class.java), flags)
                    s.commit(retorno.intentSender)
                }
                publicar("instalando")
            } catch (e: Exception) {
                if (id >= 0) try { pi.abandonSession(id) } catch (ex: Exception) { }
                publicar("erro") { put("msg", "Falha ao baixar a atualização. Confira a internet e tente de novo.") }
            }
        }
    }
}

// Resposta do instalador: pede a confirmação do usuário (o Android sempre pergunta) ou informa o erro.
class InstalacaoReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (val st = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirmar = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                ctx.startActivity(confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> Unit // o processo é encerrado e o app reabre na versão nova
            PackageInstaller.STATUS_FAILURE_CONFLICT, PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> Atualizador.publicar("erro") {
                put("msg", "O app instalado tem outra assinatura. Exporte o backup, desinstale uma vez e instale o APK novo; daí em diante o botão funciona.")
            }
            PackageInstaller.STATUS_FAILURE_ABORTED -> Atualizador.publicar("erro") { put("msg", "Instalação cancelada.") }
            else -> Atualizador.publicar("erro") {
                put("msg", "Instalação não concluída (${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: st}).")
            }
        }
    }
}
