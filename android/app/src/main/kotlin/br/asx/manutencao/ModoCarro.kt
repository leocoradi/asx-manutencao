package br.asx.manutencao

import android.content.Context

// Modo carro: liga quando o áudio Bluetooth conectado é o do carro escolhido, ou pelo botão.
// O botão vale até a próxima mudança de áudio (conectar ou desconectar), então o carro sempre retoma o controle.
// Fora do modo carro o ASX é um app comum; o tablet segue normal para outros usos.
object ModoCarro {
    private const val PREFS = "carro"
    @Volatile var ativo = false; private set
    @Volatile var salvo: String? = null; private set     // nome do dispositivo Bluetooth do carro
    @Volatile var audio: String? = null; private set     // áudio Bluetooth conectado agora
    private var manual: Boolean? = null
    var aoMudar: ((Boolean) -> Unit)? = null

    fun iniciar(ctx: Context) {
        salvo = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("dispositivo", null)
    }

    // Chamar na thread principal.
    fun audioMudou(nome: String?) {
        if (nome == audio) return
        audio = nome; manual = null; avaliar()
    }

    fun manual(ligar: Boolean) { manual = ligar; avaliar() }

    fun lembrar(ctx: Context, nome: String?) {
        salvo = nome
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            if (nome == null) remove("dispositivo") else putString("dispositivo", nome)
        }.apply()
        avaliar()
    }

    private fun avaliar() {
        val novo = manual ?: (salvo != null && audio == salvo)
        if (novo != ativo) { ativo = novo; aoMudar?.invoke(novo) }
        Estado.emitir()
    }
}
