# Estado do projeto e decisões

Documento de continuidade: o que existe, por que está assim, o que falta. Atualize ao fechar cada etapa.

## Objetivo

> **Atualizado:** o objetivo passou a ser uma central multimídia dedicada (Galaxy Tab S6 Lite no painel, sem projeção do celular). A reavaliação e a nova ordem de execução estão em `docs/CENTRAL.md`; o texto abaixo descreve a fase anterior.

Web app (PWA) para acompanhar um Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2 manual: manutenção, combustível, ficha técnica, OBD-II, com uso no celular e em central multimídia. Gratuito, sem backend, dados só no aparelho, visual inspirado no Nothing UI.

## O que está pronto

| Área | Estado | Observações |
|---|---|---|
| Plano de manutenção | pronto | Intervalos de uso severo em `src/data.js`, incluindo troca dos pneus (50.000 km ou 5 anos, estimativa; o manual não fixa quilometragem). Sem registro, estima pelo múltiplo do intervalo a partir do odômetro (selo "est."). |
| Histórico, combustível, ficha, backup JSON | pronto | |
| Modelo 3D preto | pronto | GLB CC-BY-4.0 (crédito em `assets/asx-LICENSE.txt`), 291 mil triângulos, meshopt, 2,5 MB. Materiais: 9 carroceria, 18 maçanetas (pretos), 4 pinças (vermelho). Pontos de atenção por área em `src/car.js`. |
| OBD por Bluetooth LE | código pronto, **não testado em adaptador real** | Perfis GATT FFF0 e 18F0. Decodificador validado com respostas gravadas do OBDb. |
| OBD pela central Hudiy | código pronto, validado só contra `tools/fake-hudiy.mjs` | Só PIDs padrão da ECU 7E0 (API não troca cabeçalho CAN). |
| Player e manobra pela central Hudiy | idem | Mídia e navegação do Android Auto via API da central. |
| APK Android (`android/`) | rodou em aparelho real (celular) até a versão com avisos e margens corrigidas; **as partes de central (interface embutida, modo carro, Início do carro) só foram compiladas no CI, não testadas no tablet** | WebView + sessão de mídia + notificações (manobra e avisos) + modo carro + atalhos. Ponte `window.AsxNative` / `window.asxNativo`. Sem dependências além do SDK do Android. |
| Atualização | código pronto; **instalar por cima só foi verificado no CI** (assinatura reaproveitada), não no aparelho | Página: service worker revalida os arquivos a cada carga. APK: `Atualizador.kt` consulta `releases/latest` (tag `apk-<build>`, igual ao versionCode) e instala por `PackageInstaller`. Chave fixa em rascunho de release "assinatura". |
| Abas e tela de Navegação | pronto | Início, Navegação, Manutenção (Plano/Ficha/OBD), Combustível. Navegação em grid: mapa, mídia, avisos. Verificado em 390×844, 844×390, 1024×600 com a ponte simulada (`tools/celular-falso.cjs`). |
| Mapa nativo (Google Navigation SDK) | **removido** | Exigia depósito de R$ 170 no Google Cloud; o dono quer custo zero. Navegação guiada fica com Waze, Google Maps ou Vela. |
| Interface embutida e modo carro | código pronto, **compilado no CI, não testado no tablet** | `MainActivity.local()` serve `assets/www` no endereço do Pages; `ModoCarro.kt` liga pelo áudio Bluetooth do carro escolhido ou pelo botão. |
| Início do modo carro: velocidade, odômetro por GPS e atalhos | código pronto, verificado com a ponte e o GPS simulados (`tools/celular-falso.cjs`); **não testado no tablet** | Um só `watchPosition` alimenta mapa, velocidade e odômetro. `passoOdometro` (`src/painel.js`) filtra leitura imprecisa (> 40 m), ruído parado (< 20 m) e salto (> 250 km/h). `S.odo.gps` guarda os km somados desde a última leitura digitada e `S.odo.m` o resto em metros. Atalhos: `AsxNative.apps()` / `abrirApp(id)`, lista fixa em `Ponte.APPS` e em `<queries>`; navegação com `FLAG_ACTIVITY_LAUNCH_ADJACENT`. |
| Segurança (tríade CIA) | varredura feita; correções verificadas em Chromium e no CI, **política de conteúdo não testada com o Google Maps real** | Achados, correções, riscos aceitos e pendências do dono em `docs/SEGURANCA.md`. |
| Trânsito ao vivo do Google | pronto, **não testado com chave real** | Mapa JS com TrafficLayer; rota pela **Routes API** (TRAFFIC_AWARE, alternativas). Chave do usuário em `localStorage` (`asx.gmaps`). |
| Navegação | entregue ao **Vela** pelo intent `geo:` | Botão "Navegar no Vela" com coordenadas do destino. |
| Layouts | pronto | 390 retrato, 844×390 paisagem, 820 tablet, 1366 desktop, 1024×600 central. |
| Publicação | GitHub Pages via Actions | `https://<usuario>.github.io/asx-manutencao/`. Workflow roda `npm test` antes. |

## Decisões e motivos

- **Sem framework e sem build**: o app cabe em módulos ES simples; qualquer servidor estático publica. Facilita rodar no web view da central.
- **Dados no aparelho**: sem conta, sem servidor, sem custo. Backup manual em JSON.
- **Android Auto**: não executa web apps; só nativos aprovados em categorias fechadas. Dois caminhos adotados: central Hudiy (Linux) que roda apps HTML e expõe ELM327, mídia e navegação por API local; e o **APK fino** (`android/`), uma WebView do mesmo app com ponte nativa para sessão de mídia e notificações de navegação, pensado para celular no suporte e para centrais Android (instalar e definir como tela inicial).
- **APK sem Capacitor e sem dependências**: WebView, `addJavascriptInterface`, `MediaSessionManager` e `NotificationListenerService`, só com o SDK do Android. Compila no GitHub Actions (`.github/workflows/android.yml`), sem Android Studio: AGP 9.2, Kotlin 2.3, Gradle 9.4, compileSdk 37.
- **Navigation SDK do Google: adotado e depois removido.** Dava mapa nativo com guia curva a curva, mas ativar exige depósito de R$ 170 no Google Cloud, e o projeto é de custo zero. O mapa do app é o web (Maps JS com trânsito); guiar fica com Waze, Google Maps ou Vela, abertos ao lado da central.
- **Atualização do APK**: o versionCode é o número do build do GitHub Actions; builds do `main` publicam a release `apk-<n>`. A assinatura fixa fica num rascunho de release (privado a quem tem escrita), gerado no primeiro build; senha fixa no workflow porque a proteção é a privacidade do rascunho. Escolhido em vez de secrets para não exigir que o dono gere e cole um keystore.
- **YouTube Music**: o web app não consegue controlar outros apps; o player embutido do YouTube foi removido quando o APK assumiu esse papel.
- **Waze removido**: sem API de rota; o usuário escolheu Vela como navegador. O mapa ao vivo do Waze foi substituído pelo Google com trânsito.
- **Vela (github.com/PimpinPumpkin/Vela)**: app nativo Android, GPL-3; não embute em web. Registra `geo:`, `google.navigation:` e é app de navegação do Android Auto. Seu trânsito vem de endpoint não oficial do Google; **não replicar** isso aqui (CORS impede em web, viola termos, quebra sem aviso).
- **Google Maps**: Directions API (legada) não pode ser ativada em projetos novos desde outubro de 2026; por isso a rota usa a Routes API. Cotas grátis mensais: 10 mil cargas de mapa, 5 mil rotas com trânsito. Exige conta de faturamento com cartão. Termos proíbem guiar curva a curva no app; por isso a condução vai para o Vela.
- **StradaOS (github.com/lordnordic-debug/StradaOS)**: launcher GPL-3.0 para centrais Android antigas; sem OBD, rota, trânsito ou modo carro, e o "Android Auto" dele é projeção do celular. Não substitui o nosso caminho e o código não é reaproveitado; quatro ideias entram no roteiro (odômetro e velocidade por GPS, atalhos de apps, registro de falhas). Avaliação em `docs/STRADAOS.md`.
- **Odômetro por GPS em JavaScript, não em serviço nativo**: conta só com a central visível (inteira ou em tela dividida). Com outro app em tela cheia a WebView pausa e o trecho entra como linha reta entre o último e o próximo ponto, o que subestima. Aceito por ora porque o plano é navegar com o app ao lado e porque qualquer leitura real (abastecimento, serviço, "Atualizar") acima da última digitada substitui a estimativa. A contagem em segundo plano entra junto com o serviço em primeiro plano da etapa 2.
- **Android Auto no tablet**: pelo Open Headunit, como app separado aberto por atalho. Não é embutido (AGPL-3.0, engenharia reversa do protocolo). O self mode, sem celular, depende de o Android Auto instalar no tablet e de uma opção de desenvolvedor no Android Auto 17.4+; **não verificado no S6 Lite**.
- **Limpeza e otimização (leitura completa do código)**: o service worker só trata arquivos do próprio app (antes guardava também respostas do Google Maps, sem limite); o GPS de alta precisão liga só no modo carro e na aba Navegação; rodapé, widgets e manobra só tocam no DOM quando o HTML muda (`pintar()`), porque o Android reenvia o estado inteiro a cada notificação. Tentado e **descartado**: guardar o `<model-viewer>` entre renders do Início para não redecodificar o GLB; ao ser reinserido no DOM ele não desenha mais (verificado em Chromium), então o elemento continua sendo recriado.
- **Hudiy**: protobuf das poucas mensagens usadas é codificado à mão (`src/hudiy.js`) em vez de carregar protobuf.js e o `.proto`.
- **Fonte Doto**: a mais próxima da NDot do Nothing UI disponível livremente (OFL-1.1). Vai vendorada em `vendor/doto.woff2` (subconjunto latino, 5 KB): a central abre sem internet com a tipografia certa e o carregamento não espera um servidor externo.

## Pendências (em ordem)

1. **Testar no tablet** (nada das partes de central rodou em aparelho): interface embutida abrindo sem internet; modo carro ligando pelo Bluetooth do rádio; paisagem, tela cheia e Voltar; velocidade e odômetro com GPS real; tela dividida ao abrir Waze ou Maps pelo atalho; self mode do Open Headunit; instalar atualização por cima. Ajustar conforme o retorno.
1. **Próximas etapas de `docs/CENTRAL.md`**: OBD nativo (etapa 2, que também leva o odômetro por GPS para um serviço em segundo plano), UX automotiva (etapa 3), multitarefa e botão flutuante (etapa 4), registro de falhas no aparelho.
2. **Testes em hardware real**: adaptador ELM327 BLE no carro; chave do Google no celular; central Hudiy.
3. **Pendências de segurança do dono** (`docs/SEGURANCA.md`): guardar uma cópia de `assinatura.p12` fora do GitHub; proteger o branch `main`; exportar o backup JSON de tempos em tempos; conferir no tablet que o mapa do Google abre com a política de conteúdo.
3. **Histórico do git**: dois commits do `main` carregam o e-mail pessoal do autor (commit inicial e merge do PR 1). Remover exige reescrever o histórico com force-push em `main`; só com autorização explícita do dono. Alternativa: ativar "Keep my email addresses private" no GitHub para commits futuros.
4. **Tablet retrato (820 px)**: card do carro fica estreito e rótulos de motor e elétrica se aproximam. Cosmético.
5. **Licença do projeto**: sem `LICENSE`. Se quiser permitir reuso, MIT é o padrão; o GLB (CC-BY-4.0), OBDb (CC-BY-SA-4.0), model-viewer (Apache-2.0) e meshopt (MIT) mantêm as suas.

## Como verificar

```bash
npm test                      # 28 casos
npm start                     # http://localhost:8080
node tools/screens.cjs shots  # capturas em 390/820/1366 (precisa de playwright instalado)
node tools/fake-hudiy.mjs assets/icon-512.png   # API Hudiy falsa em ws://localhost:44406 (precisa de ws)
node tools/hudiy-screens.cjs shots              # app conectado à central falsa
node tools/mapa-falso.cjs shots                 # fluxo do mapa com google.maps e Routes API simulados
node tools/celular-falso.cjs shots              # rodapé e card de manobra com a ponte nativa simulada
```

Os scripts em `tools/` usam Playwright com Chromium; em ambiente sem GPU, as flags de software já estão nos scripts.

## Chaves e dados que nunca entram no repositório

Chave do Google Maps, backups `asx-backup-*.json`, posição salva, keystore do APK, o PDF do manual do proprietário (direitos da Mitsubishi) e qualquer dado pessoal do dono.
