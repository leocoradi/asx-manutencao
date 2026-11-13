# Segurança: varredura pela tríade CIA

Leitura completa do código (web, APK e CI) em 13/11/2026, organizada por Confidencialidade, Integridade e Disponibilidade. Cada achado tem o estado: **corrigido** nesta varredura, **aceito** (risco conhecido, com o motivo) ou **pendente** (depende do dono).

## O que o app protege e de quem

O app não tem servidor, conta nem login. O que existe para proteger:

| Ativo | Onde fica |
|---|---|
| Registros de manutenção e combustível | `localStorage` do aparelho (`asx.v1`) e backups JSON exportados |
| Chave do Google Maps do usuário | `localStorage` (`asx.gmaps`) |
| Última posição | `localStorage` (`asx.pos`) |
| Conteúdo de notificações (mensagens, chamadas) e mídia do tablet | Só em memória, no APK |
| Chave que assina o APK | Rascunho de release privado "assinatura" |

Entradas que o app não controla: arquivo de backup importado, nome do adaptador Bluetooth, respostas do adaptador OBD, texto de notificações de outros apps, respostas da rede (Google, GitHub), endereço digitado na barra do navegador.

O ponto mais sensível é a **ponte nativa do APK** (`window.AsxNative`): código JavaScript rodando na WebView consegue ler as notificações do tablet. Por isso, qualquer injeção de script na interface vira vazamento de mensagens. Boa parte das correções abaixo fecha caminhos até a ponte.

## Confidencialidade

| Achado | Estado |
|---|---|
| Uma página de fora aberta dentro da WebView teria acesso à ponte. Se nenhum app tratasse um link externo, a WebView o carregava nela mesma; e qualquer caminho do mesmo domínio (outros sites do GitHub Pages do dono) ficava na WebView. | **Corrigido.** Só o endereço do próprio app navega na WebView; o resto vai para o Android se o esquema for `https`, `http`, `geo` ou `google.navigation`, e é descartado nos outros casos. |
| A posição do GPS era concedida a qualquer origem que pedisse dentro da WebView (inclusive quadros de terceiros). | **Corrigido.** Só a origem do app recebe. |
| A WebView podia abrir `content://` do aparelho. | **Corrigido.** `allowFileAccess` e `allowContentAccess` desligados; a interface vem só do interceptador de `assets`. |
| A cada abertura, o navegador pedia a fonte ao Google Fonts (endereço IP e horário de uso expostos a terceiro). | **Corrigido** na limpeza anterior: fonte vendorada, nenhuma carga externa fixa. |
| O service worker guardava respostas do Google Maps no cache do aparelho. | **Corrigido** na limpeza anterior: só arquivos do app. |
| A ponte fica visível para qualquer quadro (`iframe`) dentro da WebView, porque `addJavascriptInterface` não distingue origens. | **Aceito.** A política de conteúdo só permite quadros de `*.google.com` (exigência do Maps). A alternativa correta (`addWebMessageListener` com lista de origens) exige a biblioteca AndroidX WebKit, e o APK não tem dependências. Rever se entrar outra fonte de quadros. |
| Notificações passam pelo JavaScript da interface. | **Aceito.** Ficam só em memória (no máximo 20, texto cortado em 300 caracteres), nunca em disco nem na rede. |
| Chave do Google Maps e última posição em texto puro no `localStorage`. | **Aceito.** São dados do próprio aparelho, fora do backup exportado. A chave deve ser restrita por site no console do Google (README). |
| A senha do keystore está no workflow; a proteção é o rascunho de release ser privado. | **Aceito**, com a ressalva em Disponibilidade. Quem tem escrita no repositório já pode publicar um APK de qualquer forma. |
| Dois commits do `main` carregam o e-mail pessoal do autor. | **Pendente.** Remover exige reescrever o histórico do `main` com force-push; só com autorização explícita do dono (`docs/ESTADO.md`). |
| Adaptadores ELM327 não têm autenticação: qualquer aparelho próximo pode parear. | **Aceito.** Limitação do hardware; preferir adaptador com PIN ou botão de pareamento. |
| API da central Hudiy em `ws://localhost` sem criptografia. | **Aceito.** Só trafega dentro da própria central. |

## Integridade

| Achado | Estado |
|---|---|
| **Injeção de código por backup adulterado.** O campo `id` de um registro ia direto para um atributo HTML. Um arquivo JSON preparado executaria script ao ser importado; no APK, esse script leria as notificações. | **Corrigido.** `validar()` (agora em `src/dados.js`, com testes) só aceita `id` com letras, números, `-` e `_`; a saída também passa por `esc()`. |
| Não havia segunda barreira contra injeção. | **Corrigido.** Política de conteúdo (CSP) em `index.html`: script em linha e atributos `on*` não executam; `object`, `base` e envio de formulário para fora ficam bloqueados. Verificado em Chromium que um `onerror` injetado não roda e que o modelo 3D continua funcionando. **Não verificado com o Google Maps real** (só com o simulado); a lista de domínios é a da documentação do Maps. Se o mapa não abrir no tablet, é aqui que se olha primeiro. |
| Datas impossíveis (`9999-99-99`), números gigantes e entradas que não são objeto passavam pela validação e quebravam os cálculos de vencimento. | **Corrigido.** Data precisa existir; quilometragem limitada a 2.000.000; no máximo 5.000 registros por lista; arquivo de backup até 5 MB. |
| Um erro de digitação no odômetro (um dígito a mais num abastecimento) não tinha conserto: o campo só aceitava valores maiores. | **Corrigido.** "Atualizar" aceita valor menor, com confirmação. |
| Odômetro lido do adaptador OBD entrava sem conferência. | **Corrigido.** Só entra entre 1 e 2.000.000 km. |
| Parâmetro `?area=` do endereço era usado como chave de objeto sem checagem. | **Corrigido.** Só áreas existentes. |
| Duas abas do app abertas gravavam uma por cima da outra. | **Corrigido.** A aba recarrega os registros quando outra grava. |
| No APK, um arquivo da interface ausente em `assets` era buscado na rede. | **Corrigido.** Responde 404: a interface vem só de dentro do APK assinado. |
| O atualizador baixava o APK do endereço que a API do GitHub devolvesse. | **Corrigido.** Só aceita endereços das releases deste repositório. O Android continua conferindo a assinatura e recusando versão mais antiga. |
| As ações do workflow que assina o APK eram referenciadas por tag móvel (`@v4`). Uma tag adulterada teria acesso à chave e à permissão de publicar. | **Corrigido** em `android.yml`: fixadas por commit. Em `pages.yml` ficaram por tag: esse workflow só roda no `main`, então uma fixação errada só apareceria depois do merge. |
| `main` sem proteção de branch. | **Pendente** (configuração do GitHub, do dono): exigir pull request e os testes para entrar no `main`. |
| CSP com `'unsafe-eval'` (exigido pelo Maps e pelo decodificador WebAssembly do modelo 3D) e `'unsafe-inline'` em estilos. | **Aceito.** Nenhum dos dois permite executar script em linha. |

## Disponibilidade

| Achado | Estado |
|---|---|
| Registro ilegível no `localStorage` era substituído por um vazio no primeiro salvamento, sem volta. | **Corrigido.** Uma cópia fica em `asx.v1.ilegivel` para recuperação manual. |
| Armazenamento cheio ou bloqueado: o app quebrava ao abrir ou perdia o registro sem avisar. | **Corrigido.** Abre mesmo sem `localStorage` e avisa quando não consegue gravar. |
| Uma notificação malformada de outro app podia derrubar o serviço de notificações e, com ele, a central. | **Corrigido.** A notificação é ignorada. |
| Um link com esquema inesperado podia fechar o app com exceção. | **Corrigido.** |
| A central dependia da rede para abrir e para a fonte. | **Corrigido** nas etapas anteriores: interface e fonte embutidas. O Google Maps continua dependendo de internet e avisa quando falha. |
| **A chave de assinatura existe em um só lugar** (o rascunho "assinatura"). Se for apagada, o app instalado não aceita mais atualização. | **Pendente.** O dono deve baixar `assinatura.p12` do rascunho e guardar uma cópia fora do GitHub. |
| **Os registros existem em um só lugar** (o aparelho). Desinstalar o app, limpar os dados ou perder o tablet apaga tudo; o backup do Android está desligado de propósito, para os dados não saírem do aparelho. | **Pendente** (hábito do dono): exportar o JSON de tempos em tempos. Um lembrete automático não foi pedido e não foi feito. |
| Consulta de atualização sem autenticação: o GitHub limita a 60 por hora por endereço IP. | **Aceito.** O app mostra o erro e a consulta volta a funcionar sozinha. |
| O site pode ser exibido dentro de um quadro por outra página (sem cabeçalho `frame-ancestors`, que o GitHub Pages não permite configurar). | **Aceito.** Ações destrutivas pedem confirmação por `confirm()`, que navegadores bloqueiam em quadros de outra origem. |

## Como repetir a verificação

```bash
npm test                              # inclui tests/dados.test.mjs (backup adulterado)
node tools/celular-falso.cjs shots    # ponte nativa simulada
node tools/mapa-falso.cjs shots       # mapa simulado, com a política de conteúdo ativa
```

No navegador, com o app aberto, a política de conteúdo aparece no console quando bloqueia algo ("violates the following Content Security Policy directive").
