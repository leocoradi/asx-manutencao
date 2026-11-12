package br.asx.manutencao

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.util.Base64
import java.io.ByteArrayOutputStream

// Sessão de mídia ativa do aparelho (YouTube Music, Spotify…): leitura e controles de transporte.
// Exige o acesso a notificações concedido ao NotificacoesService.
object Midia {
    private var gerente: MediaSessionManager? = null
    private var controle: MediaController? = null
    private var escutando = false
    private var capaCache: Pair<Bitmap, String>? = null

    private val callback = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = atualizar()
        override fun onPlaybackStateChanged(state: PlaybackState?) = atualizar()
        override fun onSessionDestroyed() { controle = null; atualizar() }
    }

    private val NOMES = mapOf(
        "com.google.android.apps.youtube.music" to "YouTube Music", "com.spotify.music" to "Spotify",
        "com.google.android.youtube" to "YouTube", "com.deezer.android.app" to "Deezer", "com.amazon.mp3" to "Amazon Music",
    )

    // Chamar na thread principal (precisa de Looper para o listener).
    fun conectar(ctx: Context) {
        val ativo = NotificacoesService.ativo(ctx)
        Estado.acesso = ativo
        if (!ativo) return
        if (gerente == null) gerente = ctx.getSystemService(MediaSessionManager::class.java)
        val comp = ComponentName(ctx, NotificacoesService::class.java)
        try {
            if (!escutando) { gerente!!.addOnActiveSessionsChangedListener({ escolher(it) }, comp); escutando = true }
            escolher(gerente!!.getActiveSessions(comp))
        } catch (e: SecurityException) { Estado.acesso = false }
    }

    private fun escolher(lista: List<MediaController>?) {
        val c = lista?.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: lista?.firstOrNull()
        if (c?.sessionToken != controle?.sessionToken) {
            controle?.unregisterCallback(callback)
            controle = c
            c?.registerCallback(callback)
        }
        atualizar()
    }

    private fun atualizar() {
        val c = controle
        val md = c?.metadata
        Estado.midia = if (c == null || md == null) null else Estado.Midia(
            app = NOMES[c.packageName] ?: c.packageName,
            titulo = md.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "",
            artista = md.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: md.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST) ?: "",
            album = md.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: "",
            tocando = c.playbackState?.state == PlaybackState.STATE_PLAYING,
            posicaoMs = c.playbackState?.position ?: 0L,
            duracaoMs = md.getLong(MediaMetadata.METADATA_KEY_DURATION),
            instante = System.currentTimeMillis(),
            capa = capa(md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART) ?: md.getBitmap(MediaMetadata.METADATA_KEY_ART)),
        )
        Estado.emitir()
    }

    // Capa reduzida a 160 px em JPEG data URL; a mesma bitmap não é recodificada a cada estado.
    private fun capa(bmp: Bitmap?): String? {
        if (bmp == null) return null
        capaCache?.let { if (it.first === bmp) return it.second }
        val lado = 160
        val menor = Bitmap.createScaledBitmap(bmp, lado, (bmp.height * lado / bmp.width).coerceAtLeast(1), true)
        val out = ByteArrayOutputStream()
        menor.compress(Bitmap.CompressFormat.JPEG, 80, out)
        val url = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        capaCache = bmp to url
        return url
    }

    fun comando(cmd: String) {
        val t = controle?.transportControls ?: return
        when (cmd) {
            "toggle" -> if (controle?.playbackState?.state == PlaybackState.STATE_PLAYING) t.pause() else t.play()
            "next" -> t.skipToNext()
            "prev" -> t.skipToPrevious()
        }
    }
}
