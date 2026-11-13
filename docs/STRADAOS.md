# Avaliação do StradaOS

Repositório: https://github.com/lordnordic-debug/StradaOS (versão 2.20.0, lida em 13/11/2026). Fontes: o código-fonte do repositório e um relatório de decompilação do APK trazido pelo dono, conferido contra o código.

## O que é

Um **launcher** (tela inicial) Android para centrais multimídia de carro, em Java puro, sem dependências, com menos de 1 MB. GPL-3.0. Nasceu para centrais chinesas que rodam Android 4.x (minSdk 16, targetSdk 28) e é testado até o Android 17. Projeto ativo, com várias versões por semana.

O que ele faz:

- Tela inicial com mapa (posição do GPS sobre tiles do OpenStreetMap ou mapa offline no formato mapsforge), velocímetro por GPS, clima (Open-Meteo), relógio, foto do carro.
- Cartão de mídia: lê a sessão de mídia do Android (`MediaSessionManager` + acesso a notificações, igual ao nosso `Midia.kt`) e, nas centrais chinesas, conversa com o app Bluetooth de fábrica (`com.clw.btmusic`).
- Barra de atalhos e gaveta de apps: abre Waze, Google Maps, YouTube Music etc. em tela cheia.
- Botão "Android Auto": abre o Open Headunit (app separado), que recebe a **projeção do celular por USB**.
- Lembretes de manutenção genéricos por km ou tempo, com odômetro somado pelo GPS.
- Atualização por GitHub Releases, registro de falhas e de travamentos.

O que ele **não** tem: OBD, cálculo de rota, trânsito, card de manobra, central de avisos, tela dividida, detecção de "estou no carro".

## Conferência do relatório de decompilação

O relatório bate com o código em pacote, versões, componentes e permissões. Três pontos precisam de correção:

- **"APK do Open Headunit embutido e instalado sem aviso"**: não procede. A constante `ASSET_HUR` existe em `Main.java` mas não é usada, a pasta `assets` do código não tem `apps/`, e o APK inteiro pesa 690 KB. O Open Headunit é instalado pelo usuário.
- **`REQUEST_INSTALL_PACKAGES` e `REQUEST_DELETE_PACKAGES` como risco crítico**: no Android 8+ essas permissões só permitem **pedir** ao usuário; cada instalação ou remoção passa pela tela de confirmação do sistema. O nosso APK usa a primeira para o botão de atualização.
- **Serviço de acessibilidade com "acesso completo à UI"**: o XML restringe o serviço a eventos de notificação do pacote do Open Headunit, com `canRetrieveWindowContent="false"`. É opcional.

O que procede e pesa: `usesCleartextTraffic="true"` com recuo para HTTP em mapas, clima e no `update.json`; `KILL_BACKGROUND_PROCESSES` e `GET_TASKS` (usados para contornar o app Bluetooth das centrais chinesas); targetSdk 28, que dispensa regras de privacidade de versões novas do Android. Tudo isso existe por causa do Android 4.x e não tem utilidade num Tab S6 Lite.

## Serve para o nosso objetivo?

Objetivo (ver `docs/CENTRAL.md`): central dedicada num Tab S6 Lite, **sem projeção do celular**, com o tablet normal fora do carro, custo zero, trânsito ao vivo, OBD e manutenção do ASX.

| Critério | StradaOS | Nosso caminho |
|---|---|---|
| Tablet normal fora do carro | Feito para ser a tela inicial fixa; dá para abrir como app comum, mas não tem modo carro | Modo carro liga pelo Bluetooth do carro e desliga sozinho |
| Sem projeção do celular | O "Android Auto" dele **é** projeção por USB | Controla os apps do próprio tablet |
| Navegação com trânsito | Só mostra a posição no mapa; para navegar abre o Waze em tela cheia | Waze ou Google Maps ao lado da central (etapa 4), manobra lida da notificação |
| OBD | Não tem | Decodificador pronto e testado; transporte nativo na etapa 2 |
| Manutenção do ASX | Lembretes genéricos | Plano de uso severo do manual, histórico, combustível, ficha |
| Avisos (mensagens, chamadas) | Não tem | Pronto |
| Maturidade em carro real | Alta: usado em várias centrais, com diagnóstico de campo | Nada nativo foi testado no tablet ainda |

**Veredito: não é um caminho melhor; é um produto para outro problema** (dar uma tela inicial decente a centrais Android antigas). Trocar o nosso app por ele perderia OBD, plano do ASX, manobra, avisos e o modo carro, e traria de volta a projeção do celular. Usar os dois juntos também não compensa: seriam duas centrais disputando a tela.

**Reuso de código: não.** Três motivos: a licença GPL-3.0 obrigaria o nosso APK inteiro a ser GPL-3.0 (hoje o projeto não tem licença definida, ver pendência em `docs/ESTADO.md`); a interface dele é desenhada em `View` nativa dentro de um `Main.java` de 6 mil linhas, sem ponto de encaixe na nossa WebView; e boa parte do código resolve limitações do Android 4.x que o S6 Lite não tem. Ideias não são cobertas por licença e podem ser reimplementadas.

## O que vale aproveitar (ideias, reimplementadas)

Em ordem de ganho para o projeto:

1. **Odômetro automático por GPS.** Hoje o plano de manutenção depende de o dono digitar o odômetro. O StradaOS soma a distância percorrida com três filtros simples: ignora leituras com precisão pior que 40 m, ignora deslocamentos menores que 20 m (ruído com o carro parado) e descarta saltos acima de 250 km/h; grava a cada 200 m ou 60 s. No nosso caso: `odômetro = último valor digitado + distância somada desde então`, com o selo "est." que já existe. Para contar também com o Waze em tela cheia, a soma precisa ficar no serviço em primeiro plano do modo carro (o mesmo `ObdService` da etapa 2); com OBD conectado, a velocidade do PID 010D integrada no tempo substitui o GPS.
2. **Velocímetro por GPS no painel de direção.** O Início da etapa 3 previa velocidade só pelo OBD. O GPS do tablet entrega o mesmo dado sem adaptador (`coords.speed` da geolocalização que a WebView já tem), e serve também para o bloqueio de formulários em movimento. OBD passa a ser complemento, não requisito.
3. **Atalhos de apps na central.** Uma fileira configurável (Waze, Google Maps, YouTube Music, telefone) resolve boa parte do "sair da central para abrir outra coisa". Encaixa na etapa 4, com a diferença de abrir ao lado (`FLAG_ACTIVITY_LAUNCH_ADJACENT`) em vez de tela cheia.
4. **Registro de falhas no aparelho.** O `Guard` dele grava exceções não tratadas e travamentos da thread principal (mais de 8 s sem resposta) num arquivo que o usuário exporta. Como o tablet não está ao alcance de quem desenvolve, um registro equivalente (exceção nativa + `window.onerror` da WebView, visível na engrenagem) encurta o diagnóstico dos testes no carro.

Avaliados e **não** recomendados: mapa offline mapsforge (não calcula rota nem mostra trânsito, que é o requisito do dono); clima (não foi pedido); ponte com `com.clw.btmusic`, API oculta de mídia e truques de tela inicial (específicos de centrais chinesas e Android 4.x).

## Uso direto, se o dono quiser comparar

Instalar o StradaOS no tablet como app comum (sem escolher "Sempre" como tela inicial) custa cinco minutos e serve de referência de tamanho de botão, leitura no sol e disposição de tela para a etapa 3. Não substitui nada do plano.
