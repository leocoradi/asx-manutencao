package br.asx.manutencao

import android.app.PendingIntent
import org.json.JSONArray
import org.json.JSONObject

// Estado compartilhado entre o serviço de notificações, a sessão de mídia, o guia de navegação e a WebView.
// Fica só em memória: nada de mídia, manobras ou avisos é gravado em disco.
object Estado {
    data class Midia(val app: String, val titulo: String, val artista: String, val album: String, val tocando: Boolean,
                     val posicaoMs: Long, val duracaoMs: Long, val instante: Long, val capa: String?)
    data class Nav(val app: String, val titulo: String, val texto: String, val sub: String, val curta: String, val icone: String?)
    data class Aviso(val chave: String, val app: String, val titulo: String, val texto: String, val quando: Long, val abrir: PendingIntent?)
    data class Guia(val ativo: Boolean, val destino: String, val segundos: Int, val metros: Int, val erro: String)

    @Volatile var acesso: Boolean = false
    @Volatile var midia: Midia? = null
    @Volatile var nav: Nav? = null
    @Volatile var guia: Guia? = null
    @Volatile var ouvinte: ((String) -> Unit)? = null
    private val avisos = LinkedHashMap<String, Aviso>()
    private const val MAX_AVISOS = 20

    @Synchronized fun porAviso(a: Aviso) {
        avisos.remove(a.chave); avisos[a.chave] = a
        while (avisos.size > MAX_AVISOS) avisos.remove(avisos.keys.first())
    }
    @Synchronized fun tirarAviso(chave: String): Boolean = avisos.remove(chave) != null
    @Synchronized fun aviso(chave: String): Aviso? = avisos[chave]
    @Synchronized private fun listaAvisos(): List<Aviso> = avisos.values.sortedByDescending { it.quando }

    fun json(): JSONObject = JSONObject().apply {
        put("acesso", acesso)
        put("midia", midia?.let { m -> JSONObject().apply {
            put("app", m.app); put("titulo", m.titulo); put("artista", m.artista); put("album", m.album); put("tocando", m.tocando)
            put("posicao", m.posicaoMs); put("duracao", m.duracaoMs); put("instante", m.instante); put("capa", m.capa ?: JSONObject.NULL)
        } } ?: JSONObject.NULL)
        put("nav", nav?.let { n -> JSONObject().apply {
            put("app", n.app); put("titulo", n.titulo); put("texto", n.texto); put("sub", n.sub); put("curta", n.curta); put("icone", n.icone ?: JSONObject.NULL)
        } } ?: JSONObject.NULL)
        put("guia", guia?.let { g -> JSONObject().apply {
            put("ativo", g.ativo); put("destino", g.destino); put("segundos", g.segundos); put("metros", g.metros); put("erro", g.erro)
        } } ?: JSONObject.NULL)
        put("avisos", JSONArray().apply { listaAvisos().forEach { a -> put(JSONObject().apply {
            put("chave", a.chave); put("app", a.app); put("titulo", a.titulo); put("texto", a.texto); put("quando", a.quando)
        }) } })
    }

    fun emitir() { ouvinte?.invoke(json().toString()) }
}
