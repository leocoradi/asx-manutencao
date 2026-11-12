# Plano de refatoração: abas, tela de Navegação e mapa

> **Andamento:** etapas 1 a 4 e a opção A do mapa (Navigation SDK) foram implementadas; o dono escolheu a opção A. Falta testar em aparelho e executar as etapas 5 (web embutido no APK) e os itens menores listados em `docs/ESTADO.md`. A view nativa ficou por cima da WebView (e não por baixo, como proposto na seção 5), para o toque ir direto ao mapa.

Revisão feita após o primeiro APK rodar em aparelho real (capturas em paisagem, Android com barra de status e de navegação sobrepostas). Este documento é o roteiro; `docs/ESTADO.md` continua sendo o registro do que está pronto.

## 1. Defeitos vistos nas capturas do APK (corrigir primeiro)

| Defeito | Causa | Correção |
|---|---|---|
| Título "ASX 2.0" atrás do relógio; engrenagem, "Atualizar" e "próxima faixa" atrás da barra de navegação | `targetSdk 35` força edge-to-edge e a WebView não recebe `env(safe-area-inset-*)` | `MainActivity`: aplicar os `WindowInsets` (barras do sistema e recorte) como padding do contêiner da WebView; em paisagem, modo imersivo (barras escondidas, voltam com gesto) |
| Card de manobra mostra a instrução inteira na fonte dot gigante e "Navegando" como descrição | O Google Maps manda a **instrução no título** e deixa o texto vazio; o código assumia distância no título | Em `celAplicar`: se o título casa com distância (`/^\d+([.,]\d+)?\s?(m|km)\b/`) vai para `.dist`, senão é instrução em fonte sans. Ler também `android.shortCriticalText` (Android 16, é o "0 m" do chip da barra de status) como distância. Conferir no aparelho os extras do Vela e do Waze |
| Ícone da manobra | `filter: invert(1)` foi pensado para ícones brancos da central | Aplicar o filtro só na fonte "central" |
| Coluna da direita cortada em paisagem | Mesmo problema de insets | Resolvido pelo primeiro item |

## 2. Abas

De cinco para quatro: **Início · Navegação · Manutenção · Combustível**.

- `#/manutencao` ganha um seletor segmentado no topo: **Plano · Ficha · OBD** (`#/manutencao`, `#/manutencao/ficha`, `#/manutencao/obd`). As funções `ficha()` e `obdView()` de `src/app.js` são reaproveitadas como subseções; nada é reescrito. `#/ficha` e `#/obd` redirecionam para as novas rotas.
- **Início** volta a ser painel do carro: odômetro, carro 3D, próximas manutenções, consumo. O card "Trânsito" sai do Início e vira a aba Navegação. Com navegação ativa, o Início mostra só uma faixa compacta de manobra que leva à aba Navegação.
- O rodapé de mídia continua em todas as abas, **menos** na Navegação, onde a mídia é um widget próprio.

## 3. Tela de Navegação

Tela sem rolagem de página, ocupando a área útil inteira (`height: 100dvh` menos cabeçalho e barras). Layout em CSS Grid com áreas nomeadas; a interface é toda web, então não há XML de layout. A camada nativa só entrega dados e, na fase 5, a view do mapa.

```css
.nav-view { display: grid; gap: 10px; height: 100%; min-height: 0;
  grid-template: "mapa" minmax(0, 1fr) "midia" auto "avisos" minmax(110px, 28dvh) / minmax(0, 1fr); }
@media (orientation: landscape) and (min-width: 640px) {
  .nav-view { grid-template: "mapa midia" minmax(0, 1fr) "mapa avisos" minmax(0, 1fr) / minmax(0, 2.2fr) minmax(240px, 1fr); }
}
```

- **Mapa** (`grid-area: mapa`): ocupa a maior parte. Sobre ele, em posição absoluta: card de manobra no canto superior esquerdo (seta, distância em fonte dot, rua em sans), faixa de chegada no canto inferior esquerdo (tempo, distância, hora), botões de zoom/recentralizar e campo "Para onde?".
- **Mídia** (`midia`): capa grande, faixa, artista, barra de progresso, anterior / play-pause / próxima com alvos de 56 px. Reusa os dados de `cel.midia` e de `midia` (central).
- **Avisos** (`avisos`): central de notificações (seção 4).
- Em retrato as três áreas empilham; em paisagem o mapa fica à esquerda e os dois widgets empilhados à direita, como na referência do Android Auto. Em telas estreitas (< 640 px de largura em paisagem) os widgets viram uma faixa única rolável.
- Widgets são componentes independentes (`widgetMidia()`, `widgetAvisos()`, `widgetMapa()`), para a mesma tela servir celular, central Android e central Hudiy.

## 4. Central de notificações (APK)

O `NotificacoesService` já tem a permissão. Passa a encaminhar também notificações de conversa e chamada:

- Filtro: `category` `msg`/`call`/`email` ou `MessagingStyle`, de uma lista de apps configurável (WhatsApp, Telegram, SMS, telefone). Ignora notificações em andamento, silenciosas e de grupo-resumo.
- Dados enviados à WebView: app, remetente, texto, hora, ícone. **Só em memória**: nada é gravado em disco nem sai do aparelho.
- Ações: dispensar (`cancelNotification`), abrir no app, **ouvir** (leitura em voz alta por `TextToSpeech` nativo) e resposta rápida por frases prontas via `RemoteInput` da própria notificação. Sem digitação com o carro em movimento.
- Ponte: `AsxNative.aviso(acao, chave, texto?)` e evento `asxNativo.evento({ avisos: [...] })`.

## 5. Mapa: veredito

**Waze dentro do app: não é viável.** O Waze não oferece SDK de mapa ou de navegação embutível. O que existe:

- *Deep links* (`waze://`, `https://waze.com/ul`): abrem o app do Waze, sem troca de dados.
- *Waze Transport SDK*: só para parceiros aprovados de transporte; entrega dados (ETA, próxima manobra) e a documentação veda usá-lo para construir um app de navegação próprio.
- *iframe* do mapa ao vivo: só visualização, sem rota guiada (já usamos e removemos).
- Embutir a tela de outro app (Waze, Maps) dentro do nosso: o Android não permite a apps comuns (`TaskView`/display virtual com apps de terceiros é restrito ao sistema).

**Alternativas para ter um mapa na área principal, da melhor para a mais simples:**

| Opção | O que entrega | Custo | Contras |
|---|---|---|---|
| **A. Google Navigation SDK (nativo, no APK)** — recomendada | Mapa 3D com guia curva a curva, faixas e trânsito do Google **dentro do nosso layout**; eventos de manobra para o nosso card | Grátis até 1.000 destinos/mês (SKU *Navigation Request*); exige conta de faturamento com cartão | Traz AndroidX e Google Play Services; chave embutida no APK (vem de *secret* do CI, restrita ao pacote e à assinatura); a confirmar no protótipo: quanto da UI padrão pode ser escondida |
| B. Mapa Google JS com trânsito (já pronto) + manobra lida da notificação do Vela/Maps | Mapa com trânsito e rota no nosso layout; guia por outro app em segundo plano | Grátis nas cotas (10 mil cargas, 5 mil rotas/mês) | Mapa não acompanha a condução como um navegador; termos do Google vedam usar a API JS como navegação |
| C. Tela dividida do Android: nosso app + Waze/Vela/Maps lado a lado | Waze de verdade ao lado dos nossos widgets de mídia e avisos | Grátis, ~20 linhas (`FLAG_ACTIVITY_LAUNCH_ADJACENT`) | O mapa não fica "dentro" da nossa UI; divisor é do sistema; algumas centrais Android desativam multi-janela |
| D. MapLibre + OpenStreetMap | Mapa próprio, offline possível | Grátis, sem chave | Sem trânsito em tempo real |

**Decisão proposta:** fazer a tela com a opção **B** primeiro (já funciona, valida o layout), adicionar o botão "Abrir ao lado" da opção **C** (barato, dá Waze real hoje) e prototipar a **A** como substituta da área do mapa no APK. Vela continua como navegador sem Google, por `geo:`. Se o protótipo da A falhar (peso, UI não personalizável), B + C ficam como solução final.

**Como a opção A encaixa na WebView:** a WebView fica com fundo transparente por cima de uma `NavigationView` nativa. O web app informa o retângulo de `.nav-view .mapa` (`ResizeObserver` → `AsxNative.mapa(x, y, w, h)`); o nativo posiciona o mapa ali. Cards de manobra e chegada continuam em HTML por cima.

## 6. OpenAuto e Crankshaft: veredito

- **OpenAuto** (f1xpl/openauto): emulador de *head unit* Android Auto em C++/Qt5 sobre a biblioteca aasdk, com Boost, RtAudio e decodificação OpenMAX do Raspberry Pi 3. GPLv3. Na prática parado: último commit de código em maio de 2020.
- **Crankshaft** (opencardev/crankshaft): distribuição Linux para Raspberry Pi que empacota um fork do OpenAuto e o gerador de imagem. GPL-3.0. Ativo (commits em setembro de 2026).

Os dois fazem o papel **oposto** ao do nosso app: são o *receptor* que mostra a projeção do Android Auto vinda do celular. Nosso app é um painel que roda no Android (ou na web). Por isso:

- **Código reaproveitável: nenhum.** C++/Qt/Linux contra Kotlin/Web, e GPL-3 obrigaria o projeto inteiro à mesma licença.
- **O que serve como referência:** a arquitetura do receptor (transporte USB AOAP ou TCP → handshake TLS → canais multiplexados de vídeo H.264, áudio, toque, sensores, microfone e Bluetooth). É esse caminho que permite ver o Waze e o YouTube Music *de verdade* numa tela que não é a do celular.
- **Se o hardware for um Raspberry Pi:** a central Hudiy, já integrada, cobre o mesmo papel e ainda roda nosso web app com API de mídia, navegação e OBD. Crankshaft não tem camada de apps web. Não há motivo para trocar.
- **Equivalente em Android:** *Open Headunit* (andreknieriem/open-headunit, antes "Headunit Revived"), em Kotlin, AGPL-3.0, ativo, com modo USB, sem fio e **"self mode"** (o próprio celular projeta o Android Auto para si). É o único caminho conhecido para ter o Waze real numa tela Android controlada por app de terceiro. Ressalvas: não é certificado pelo Google, depende de engenharia reversa do protocolo, o Android Auto 17.4+ restringe o self mode, e embutir o código tornaria nosso projeto AGPL. **Uso recomendado: como app separado**, quando a tela for uma central/tablet Android recebendo o celular; não embutir.

## 7. Repositório privado

Hoje **não dá**: o APK carrega o app de `https://<usuario>.github.io/asx-manutencao/`, e o GitHub Pages em repositório privado exige plano pago. Para liberar:

1. No workflow Android, copiar `index.html`, `style.css`, `src/`, `vendor/`, `assets/` para `android/app/src/main/assets/www/`.
2. Na `MainActivity`, servir esses arquivos por `shouldInterceptRequest` sob uma origem HTTPS fixa (ex.: `https://asx.app/`), para módulos ES e geolocalização continuarem funcionando; sem service worker dentro do APK.
3. Restringir a chave do Google Maps a essa origem (JS) e ao pacote do app (nativa).

Depois disso o repositório pode ser privado: o GitHub Actions continua gerando o APK (2.000 minutos grátis por mês em repositório privado; o build leva poucos minutos). Perde-se o acesso pelo navegador e pela central Hudiy via Pages, a menos que o site seja hospedado em outro lugar.

## 8. Ordem de execução

1. **Correções das capturas** (seção 1): insets/imersivo, card de manobra, ícone.
2. **Abas** (seção 2): quatro abas, subseções de Manutenção, redirecionamentos, Início sem mapa.
3. **Tela de Navegação** (seção 3) com o mapa Google JS, widget de mídia e widget de avisos vazio; botão "Abrir ao lado".
4. **Central de notificações** nativa (seção 4).
5. **Web embutido no APK** (seção 7), habilitando repositório privado.
6. **Protótipo do Navigation SDK** (seção 5, opção A) em branch separado; decisão de manter ou não.

Cada etapa é um pull request com testes (`npm test`), capturas (`tools/`) e APK gerado pelo CI.

## Fontes

- Waze Transport SDK: https://developers.google.com/waze/intro-transport
- Navigation SDK, preços: https://developers.google.com/maps/documentation/navigation/android-sdk/pricing e https://console.cloud.google.com/apis/library/navigationsdk.googleapis.com
- OpenAuto: https://github.com/f1xpl/openauto · Crankshaft: https://github.com/opencardev/crankshaft
- Open Headunit: https://github.com/andreknieriem/open-headunit
