# Central multimídia dedicada: reavaliação da arquitetura

Objetivo novo: o APK é a **central principal** de um Galaxy Tab S6 Lite fixo no painel do ASX, substituindo Android Auto e CarPlay, **sem projeção do celular**. Ligar e despertar o tablet com o carro já está resolvido fora do app.

**Restrição do dono:** fora do carro o tablet continua um tablet comum. Nada de reset de fábrica, nada de travar o aparelho, nada de trocar a tela inicial do Android. A central só assume a tela quando o tablet está no carro.

Este documento substitui as partes de `docs/PLANO.md` que assumiam o celular como tela principal. `docs/ESTADO.md` continua sendo o registro do que está pronto.

## Lacunas do APK atual para esse objetivo

| Lacuna | Por quê | Consequência no carro |
|---|---|---|
| A interface é baixada do GitHub Pages a cada abertura | A WebView carrega `https://<usuario>.github.io/asx-manutencao/` | Sem o hotspot do celular ligado, a central abre vazia ou com a versão em cache |
| OBD por Bluetooth não funciona dentro do APK | A WebView do Android não implementa Web Bluetooth (`navigator.bluetooth` não existe) | O botão "Conectar Bluetooth" só funciona no Chrome, não no app |
| Alvos de toque de 44 px e texto de 15 px | Pensados para celular na mão | Abaixo do mínimo do Google para telas de carro: 76 dp de alvo, 32 dp de texto principal e 24 dp de secundário |
| Nada impede sair do app no carro | É um app comum | Um toque acidental em Início ou Recentes tira a central da tela |
| Avisos leem as notificações **do tablet** | O `NotificationListenerService` só vê o aparelho onde roda | Mensagens que chegam no celular não aparecem, a menos que o app (ex.: WhatsApp) esteja vinculado também no tablet |

## 1. Modo carro: tela cheia e retenção só dentro do carro

Como o tablet precisa funcionar normalmente fora do carro, **ficam descartados** o modo quiosque com Device Owner (exige reset e trava o aparelho para todos os usos) e o app como tela inicial padrão (substituiria a tela inicial da Samsung o tempo todo). No lugar, um **modo carro** que liga e desliga sozinho.

**Detecção do carro (liga e desliga o modo):**
- **Rotina da Samsung** ("Modos e rotinas", nativo da One UI, sem instalar nada): condição "Bluetooth conectado ao rádio do ASX" (ou ao adaptador OBD). Ações: abrir o ASX, Não perturbar com exceções, tempo de tela máximo, brilho alto. Ao desconectar, a rotina desfaz os ajustes sozinha. Há relatos de ajustes que não voltam (ex.: volume); conferir no tablet e, se preciso, adicionar ações de término.
- **No próprio app**, como reforço: o modo carro liga quando o adaptador OBD aparece (`CompanionDeviceManager`), quando o áudio do carro conecta, ou por um botão manual; desliga quando os dois somem por alguns minutos, ou pelo botão.

**Dentro do modo carro:**
- Layout automotivo (seção 4), paisagem, barras do sistema escondidas (gesto de borda para mostrá-las), tela sempre acesa.
- Voltar não fecha o app; sair é uma ação explícita ("Sair do modo carro").
- Botão Início e Recentes continuam funcionando: fixar o app (lock task) bloquearia o Waze em tela dividida. Contra saída acidental, um **botão flutuante "Voltar à central"** aparece por cima de outros apps enquanto o modo carro está ligado e a central não está visível (permissão "Sobrepor a outros apps", pedida uma vez).
- O serviço do OBD só roda no modo carro; em casa não há serviço consumindo bateria.

**Fora do modo carro:** o ASX é um app comum no tablet, com o layout atual (manutenção, combustível, ficha), Voltar normal e nenhuma sobreposição.

**Configurações do Android que valem nos dois usos** e não atrapalham o tablet em casa: ASX, Waze e YouTube Music em "Apps nunca suspensos"; "Proteger bateria" (carga até 85%), recomendado pelo calor no painel. O bloqueio de tela pode continuar ativo em casa e ser dispensado pela rotina no carro ("Smart Lock" com o Bluetooth do carro como dispositivo confiável).

## 2. Conectividade automática

Princípio: o Android já reconecta Wi-Fi e áudio Bluetooth sozinho; o app **observa e mostra o estado**, e só assume o que o Android não faz, que é o OBD.

- **Wi-Fi pelo celular.** Rede do hotspot salva no tablet com reconexão automática. Se o celular for Samsung com a mesma conta, o "Hotspot automático" liga sozinho quando o tablet pede. Em outros celulares, uma rotina ("Modos e rotinas" na Samsung, Atalhos no iPhone) liga o hotspot quando o celular conecta ao Bluetooth do carro. No app: `ConnectivityManager.registerDefaultNetworkCallback` alimenta um indicador de rede e decide o que depende de internet.
- **Som do carro.** Tablet pareado ao rádio do ASX como áudio Bluetooth (A2DP); o Android reconecta sozinho quando o rádio liga. Se o rádio não aceitar áudio Bluetooth, cabo P2 (adaptador USB-C) é mais confiável e não depende de pareamento. No app: indicador de "áudio do carro" a partir do dispositivo de saída de áudio atual (`AudioManager.getDevices`).
- **OBD2 (scanner).** Passa a ser **nativo**, num serviço em primeiro plano (`ObdService`, tipo `connectedDevice`):
  - Suporta **Bluetooth clássico (SPP)**, que é o da maioria dos ELM327 baratos, além de BLE.
  - O adaptador é associado uma vez pelo `CompanionDeviceManager`; com `startObservingDevicePresence` o Android avisa quando ele aparece (adaptador ligado na ignição) mesmo com o app em segundo plano, e o serviço conecta. Ao cair, tenta de novo com espera crescente (2 s, 4 s, 8 s… até 60 s).
  - O protocolo continua em JavaScript (`src/obd.js` já decodifica e é testado): o nativo só transporta texto pela ponte (`AsxNative.obd(comando)` → resposta), então nada do decodificador é reescrito.
  - Velocidade (PID 010D) e temperatura do motor viram dados do painel e alimentam o bloqueio de digitação em movimento (seção 4).
- **Ordem de inicialização:** interface local (sem rede) → OBD → indicadores de rede e áudio. Nada bloqueia a tela esperando conexão.
- Fora do carro nada disso roda: o tablet usa o Wi-Fi de casa e o Bluetooth normalmente.

## 3. Multitarefa: mapa e música sem o Android matar processos

- **Cada app no seu processo, cada um protegido pelo próprio serviço.** O Waze (ou Google Maps) guia em primeiro plano com serviço de navegação; o YouTube Music toca com serviço de mídia; os dois são os últimos que o Android encerra. A central não tenta segurar esses processos: ela os **mostra** (tela dividida) e os **controla** (sessão de mídia, já pronto).
- **Mapa: Waze ou Google Maps em tela dividida** com a central. Botão "Navegar" abre o app escolhido ao lado (`FLAG_ACTIVITY_LAUNCH_ADJACENT`); o card de manobra e a mídia continuam no lado da central. Isso dá trânsito ao vivo de graça e sem chave. O Google Navigation SDK e o mapa web do Google saem do APK (reduzem tamanho e memória, e o Demo Key não navega).
- **A central também precisa sobreviver:**
  - Como janela visível no modo carro, ela já tem a maior prioridade.
  - O `ObdService` em primeiro plano e o `NotificacoesService` (ligado pelo sistema) mantêm o processo vivo.
  - Se o processo de desenho da WebView morrer, `onRenderProcessGone` recria a WebView em vez de deixar a tela em branco.
- **Ajustes da Samsung** (One UI suspende apps agressivamente): ASX, Waze e YouTube Music em "Apps nunca suspensos"; uso de bateria "Sem restrições" para os três; o app pede `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Com o tablet sempre na tomada e no sol, ligar **"Proteger bateria" (carga até 85%)** para reduzir calor e desgaste.
- **Memória:** o S6 Lite tem 4 GB. Waze + YouTube Music + central cabem, desde que a central não carregue peso desnecessário: modelo 3D só na tela Início e trocado pela silhueta SVG quando há outro app em tela dividida; mapa web do Google removido.

## 4. UX automotiva

Referência: diretrizes de design do Google para telas de carro (alvo de toque mínimo 76×76 dp, espaço de 23 dp entre alvos, texto principal 32 dp e secundário 24 dp, contraste mínimo 4,5:1). Tela do S6 Lite: 10,4", 2000×1200; o motorista fica a uns 60–70 cm.

- **Toque:** botões principais com 76 dp no mínimo e controles de mídia com 88 dp; nada de alvo pequeno colado em outro. Hoje são 44 px.
- **Texto:** título de faixa, instrução de manobra e valores do painel em 32 dp ou mais; textos de apoio em 24 dp. A fonte dot (Doto) só para números grandes; rótulos e frases em sans, que leem melhor no sol.
- **Contraste e sol:** tema escuro como padrão; trocar tracejados de 1 px em cinza escuro (somem no sol) por bordas sólidas de 2 px com contraste 4,5:1; modo "alto contraste" para o dia. Brilho automático do Android ligado; opção de forçar brilho máximo de dia e reduzir à noite pelo horário.
- **Navegação entre abas:** trilho fixo à esquerda (lado do motorista no Brasil), quatro itens grandes, sempre visível; qualquer função em no máximo dois toques. Sem rolagem nas telas de direção (Início e Navegação).
- **Telas de direção vs. telas de parado:**
  - Início vira o painel de direção: relógio, velocidade e temperatura (OBD), próxima manobra, mídia, avisos e alertas de manutenção vencida.
  - Manutenção, Combustível e formulários são telas de parado: com velocidade acima de 5 km/h (OBD ou GPS), campos de texto e formulários ficam bloqueados com "Disponível com o carro parado".
- **Avisos:** só remetente e ação "Ouvir" em movimento; ler o texto inteiro só parado. Nada de vídeo na tela em movimento.
- **Fixação física:** suporte que não cubra a zona de abertura do airbag do passageiro nem a visão da via; tablet na altura do painel para o olhar sair pouco da estrada.

## 5. O APK é o melhor formato?

**Sim, desde que vire um APK de central, e não um navegador que abre um site.**

| Formato | Para central dedicada |
|---|---|
| PWA no navegador | Não serve: sem Bluetooth clássico, sem controlar mídia de outros apps, sem detectar o carro |
| **APK híbrido (casca nativa + interface web embutida)** | **Recomendado.** Reaproveita a interface e a lógica testada; o nativo cuida do modo carro, OBD, mídia, avisos e conectividade |
| APK todo nativo (Jetpack Compose) | Melhor desempenho e acessibilidade, mas reescreve tudo; só compensa se a WebView mostrar limite real no tablet |
| Android Automotive OS | Exige hardware de montadora; não roda num tablet comum |
| Raspberry Pi com Hudiy/Crankshaft | Feito para receber projeção do celular, o oposto do objetivo |
| ROM customizada no tablet | Trabalho e risco altos para ganho pequeno sobre o modo quiosque |

O APK também é o único formato que permite o modo carro sem mexer no tablet: ele detecta o carro, controla a mídia e mostra o botão flutuante sem exigir reset nem trocar a tela inicial.

Mudança central da arquitetura: **a interface web passa a ser embutida no APK** (copiada para `assets` no build e servida por `shouldInterceptRequest` sob uma origem HTTPS fixa). A central abre sem internet, a versão da interface acompanha a do APK (atualizada pelo botão "Procurar atualização", já pronto) e o repositório pode ficar privado. O site no GitHub Pages continua opcional para uso no celular.

## Ordem de execução proposta

1. **Base de central** (feito, falta testar no tablet; o mapa web do Google foi mantido porque funciona com a chave gratuita já configurada): interface embutida no APK; modo carro (detecção, liga e desliga, layout em paisagem com tela cheia, Voltar sem sair); reabrir a WebView se o processo de desenho morrer; pedido de isenção de otimização de bateria; remover Navigation SDK e mapa web do Google. Guia da rotina da Samsung no README.
2. **OBD nativo:** `ObdService` com SPP e BLE, associação pelo `CompanionDeviceManager`, reconexão automática, ponte para o decodificador em JS; adaptador presente também liga o modo carro.
3. **UX automotiva:** novos tamanhos (76 dp, 32/24 dp), contraste, Início como painel de direção, bloqueio de formulários em movimento.
4. **Multitarefa:** botão "Navegar" abrindo Waze ou Google Maps ao lado; indicadores de rede, áudio e OBD; avisos resumidos em movimento; botão flutuante "Voltar à central".

Acréscimos vindos da avaliação do StradaOS (`docs/STRADAOS.md`), ainda não aprovados pelo dono: odômetro automático por GPS no serviço do modo carro (etapa 2); velocidade por GPS no painel de direção, sem depender do OBD (etapa 3); fileira de atalhos de apps e registro de falhas no aparelho (etapa 4).

Cada etapa é um pull request com testes, capturas em 1333×800 (S6 Lite em paisagem) e APK pelo CI.

## Fontes

- WebView sem Web Bluetooth: https://lists.w3.org/Archives/Public/public-web-bluetooth-log/2021Aug/0019.html
- Tamanhos para telas de carro: https://developers.google.com/cars/design/design-foundations/visual-principles e https://developers.google.com/cars/design/android-auto/design-system/sizing
- Modo de tarefa bloqueada (avaliado e descartado): https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode
- Bluetooth em segundo plano e dispositivo complementar: https://developer.android.com/develop/connectivity/bluetooth/ble/background e https://developer.android.com/reference/android/companion/CompanionDeviceManager
- Versões do S6 Lite: https://doc.samsungmobile.com/SM-P613/026508230329/eng.html e https://www.gsmarena.com/samsung_galaxy_tab_s6_lite_2020_wifi_model_android_13_one_ui_5_update-news-57288.php
