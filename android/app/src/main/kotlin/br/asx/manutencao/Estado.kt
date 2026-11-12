package br.asx.manutencao

import org.json.JSONObject

// Estado compartilhado entre o serviço de notificações, a sessão de mídia e a WebView.
object Estado {
    data class Midia(val app: String, val titulo: String, val artista: String, val album: String, val tocando: Boolean,
                     val posicaoMs: Long, val duracaoMs: Long, val instante: Long, val capa: String?)
    data class Nav(val app: String, val titulo: String, val texto: String, val sub: String, val icone: String?)

    @Volatile var midia: Midia? = null
    @Volatile var nav: Nav? = null
    @Volatile var ouvinte: ((String) -> Unit)? = null

    fun json(): JSONObject = JSONObject().apply {
        put("acesso", acesso)
        put("midia", midia?.let { m -> JSONObject().apply {
            put("app", m.app); put("titulo", m.titulo); put("artista", m.artista); put("album", m.album); put("tocando", m.tocando)
            put("posicao", m.posicaoMs); put("duracao", m.duracaoMs); put("instante", m.instante); put("capa", m.capa ?: JSONObject.NULL)
        } } ?: JSONObject.NULL)
        put("nav", nav?.let { n -> JSONObject().apply {
            put("app", n.app); put("titulo", n.titulo); put("texto", n.texto); put("sub", n.sub); put("icone", n.icone ?: JSONObject.NULL)
        } } ?: JSONObject.NULL)
    }

    @Volatile var acesso: Boolean = false

    fun emitir() { ouvinte?.invoke(json().toString()) }
}
