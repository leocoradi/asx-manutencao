# ASX Manutenção

Web app (PWA) para acompanhar o Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2, câmbio manual 5M. Mobile first, funciona offline, sem build e sem dependências.

## O que tem

- **Início**: odômetro, carro 3D com estado por área (motor, câmbio, freios, rodas, elétrica), próximas manutenções, consumo e, com navegação ativa, uma faixa de manobra que leva à aba Navegação.
- **Navegação**: mapa na área principal, widget de mídia e central de avisos. Em paisagem os widgets empilham à direita do mapa; em retrato, abaixo. O mapa é o **Google Navigation SDK** nativo no APK compilado com chave (guia curva a curva com voz, faixas e trânsito). Sem essa chave, ou no navegador, é o mapa web do Google com trânsito e rota pela Routes API, com o botão **Navegar no Vela**.
- **Manutenção**, com três subseções: **Plano** (preventivo em uso severo, km ou meses, com especificações, part numbers e histórico), **Ficha** (motor, fluidos, pneus, lâmpadas, velas, fusíveis) e **OBD** (leitura ao vivo via ELM327 Bluetooth LE, códigos de falha, odômetro e contador de revisão do painel, com simulador).
- **Combustível**: registro de abastecimentos, km/L por tanque cheio, média e custo por km.
- **Mídia (no APK)**: rodapé em todas as abas e widget na Navegação com o que o celular está tocando (YouTube Music, Spotify…): capa, faixa, artista, progresso e anterior / play-pause / próxima.
- **Avisos (no APK)**: mensagens, chamadas e e-mail vindos das notificações do celular, com Ouvir (leitura em voz alta), abrir e Dispensar. Ficam só em memória.
- **Manobra de outros navegadores (no APK)**: com Vela, Google Maps ou Waze guiando em segundo plano, a próxima manobra aparece em um card, lida da notificação.
- **Na central Hudiy**, mídia e manobra vêm do que a central recebe do Android Auto.
- **Backup**: ícone de engrenagem exporta e importa JSON. Os dados ficam no `localStorage` do aparelho.

Base técnica em `src/data.js`, extraída do manual do proprietário e do manual do Copilito da ASX (intervalos de uso severo no Brasil).

## Rodar

Qualquer servidor estático:

```bash
npm start
```

Abre em `http://localhost:8080`. Testes (Node 22, `node:test`, sem instalar nada):

```bash
npm test
```

## Publicar (GitHub Pages)

O workflow em `.github/workflows/pages.yml` publica a raiz do repositório. Em *Settings → Pages → Source* escolha **GitHub Actions**. HTTPS é obrigatório para instalar como app e para o Web Bluetooth.

No Android (Chrome): abrir a URL → menu → *Instalar app*.

## App Android (APK)

O APK é uma casca fina em Kotlin (`android/`): uma WebView com o app publicado mais o que o navegador não consegue fazer:

- **Sessão de mídia**: lê o que está tocando no celular e manda os controles (`MediaSessionManager`).
- **Notificações**: manobra do Vela, Google Maps ou Waze e central de avisos (`NotificationListenerService`), só em memória.
- **Mapa nativo**: `NavigationView` do Google Navigation SDK posicionada sobre a WebView, no retângulo do mapa da aba Navegação.
- **Intents e sistema**: links externos abrem os apps do Android; barras do sistema viram margem e somem em paisagem; geolocalização pede a permissão do sistema.

Instalação: baixe `asx-manutencao.apk`, instale (permitir fontes desconhecidas) e, no rodapé, toque em **Permitir** para dar "Acesso a notificações" ao app. Sem isso, mídia, manobras e avisos não aparecem.

Onde baixar: sem a chave do Google, no artefato do workflow **Android** (aba Actions). Com a chave, em **Releases**, no rascunho "APK com mapa nativo (privado)", visível só para quem tem acesso de escrita ao repositório. O APK com chave não vai para o artefato porque artefatos de repositório público podem ser baixados por qualquer conta do GitHub.

### Mapa nativo (Navigation SDK)

1. No [Google Cloud](https://console.cloud.google.com), no mesmo projeto, ative a API **Navigation SDK**.
2. Crie uma **segunda chave de API** só para o app Android, com restrição de API apenas ao Navigation SDK. A chave do mapa web é restrita por site e não serve aqui.
3. Em *APIs e serviços → Navigation SDK → Cotas*, limite os pedidos por dia (30 por dia mantém o mês abaixo dos 1.000 destinos gratuitos). Crie também um alerta de orçamento.
4. No GitHub: *Settings → Secrets and variables → Actions → New repository secret*, nome `MAPS_API_KEY`, valor a chave.
5. Rode o workflow **Android**. O APK sai no rascunho de release.

Uso: na aba Navegação, digite o destino e toque em **Ir**. Na primeira vez o Google mostra os termos de uso. O endereço vira coordenada pelo Geocoder do Android, sem custo; cada destino pedido conta 1 na cota do Navigation SDK.

Assinatura: sem keystore próprio, cada build é assinado com uma chave de debug nova e atualizar exige desinstalar antes (os registros ficam no app; exporte o backup). Para assinatura estável e para poder restringir a chave do Google ao pacote `br.asx.manutencao`, cadastre os secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_SENHA`, `ANDROID_CHAVE` e `ANDROID_CHAVE_SENHA`.

Numa central multimídia Android, instale o APK e defina como tela inicial.

## Chave do Google Maps para o mapa web

1. Em [console.cloud.google.com](https://console.cloud.google.com) crie um projeto e ative **Maps JavaScript API** e **Routes API** (a antiga Directions API não pode mais ser ativada em projetos novos desde outubro de 2026). O Google exige conta de faturamento com cartão, mas o uso pessoal fica dentro da cota gratuita mensal: 10 mil carregamentos de mapa e 5 mil rotas com trânsito. Vale criar um alerta de orçamento de R$ 1 em *Faturamento → Orçamentos e alertas*.
2. Em *APIs e serviços → Credenciais* crie uma **chave de API**. Em *Restrições de aplicativo* escolha "Sites" e adicione `https://leocoradi.github.io/*` (e `http://localhost:8080/*` para testar). Em *Restrições de API* marque só as duas APIs acima.
3. No app, engrenagem → **Google Maps** → cole a chave. Ela fica no `localStorage` do aparelho e nunca vai para o repositório.

Os termos do Google Maps Platform não permitem usar os dados para guiar curva a curva no próprio app. Por isso o app mostra mapa, trânsito, rota e manobras, e a condução guiada é entregue ao Vela.

## OBD-II

- Decodificador no formato **OBDb signalset v3** (`src/obd.js`, `src/signalset.js`), portado de `OBDb/.schemas`. Sinais padrão vêm de `OBDb/SAEJ1979`; os estendidos (odômetro `6A0 21AD`, contador de revisão `6A0 21BC`) de `OBDb/Mitsubishi-ASX`, confirmados pela comunidade em ASX 2020/2021. No 2017/2018 nacional, alguns podem não responder; o app mostra `—` e registra no log.
- Adaptadores suportados: ELM327 **Bluetooth LE** (Vgate iCar Pro BLE 4.0, OBDLink CX, Carista e similares, perfis GATT FFF0/FFF1/FFF2 e 18F0/2AF0/2AF1). Adaptadores Bluetooth clássico (SPP, a maioria dos baratos) não são acessíveis pelo navegador.
- Não há limpeza de códigos (serviço 04) por decisão: é ação irreversível e fica para uma leitora.
- Dados OBDb sob CC-BY-SA-4.0.

## Android Auto e central multimídia

Android Auto só executa apps nativos de categorias aprovadas pelo Google; um web app não roda nele. Em uma central multimídia com **Android embarcado** (a maioria das centrais chinesas), o Chrome instala este PWA como qualquer outro e o Web Bluetooth funciona para o ELM327. Se um dia precisar de Android Auto de verdade, o caminho é um app nativo (Kotlin) reaproveitando `src/signalset.js` e a lógica de `src/obd.js`.

### Central Hudiy (Raspberry Pi / x86)

[Hudiy](https://github.com/wiboma/hudiy) é uma plataforma de central multimídia Linux (Raspberry Pi 3/4/5 ou PC x86) com Android Auto e CarPlay com e sem fio, Bluetooth, rádio, câmera de ré e **apps em HTML/JavaScript** em web views Chromium. Ela mesma conecta ao ELM327 (Bluetooth ou USB) e expõe o adaptador pela API local. É o caminho mais direto para este app rodar no carro:

1. Publique o app em HTTPS (GitHub Pages) ou sirva a pasta por HTTP na própria central (`python3 -m http.server 8080`). O web view não carrega módulos ES por `file://`.
2. Copie `hudiy/applications.json` e `hudiy/applications_menu.json` para `~/.hudiy/share/config/`, ajustando a URL. Isso cria o item "ASX" no menu de aplicativos.
3. Na tela OBD, toque em **Central Hudiy**. O app fala com `ws://localhost:44406` (porta `webSocketEndpointPort` da configuração), faz o hello da API 1.0, assina o status do OBD e envia os PIDs pelo `QueryObdDeviceRequest`. O protobuf dessas três mensagens é codificado à mão em `src/obd.js` (sem protobuf.js).
4. O botão/gesto de voltar da central chama `history.back()` no app.
5. Dentro do web view da central o app conecta sozinho à API (detecta o objeto `hudiy`), assina mídia, navegação e OBD, e mostra player e manobra. O YouTube Music tocando pelo Android Auto aparece no player; o app de navegação em uso no Android Auto aparece no card. Os botões do player injetam as teclas de mídia da central (`KeyEvent`).

Por que só na central: nem o YouTube Music nem os apps de navegação têm API pública para um site ler o que toca ou as instruções no celular. Essa informação só sai do telefone pelo protocolo do Android Auto, e é a central que a recebe. A integração foi validada contra um servidor falso que fala o protocolo do `Api.proto` (hello, assinaturas, mídia, navegação, OBD, teclas); falta o teste na central real.

Limites: pela API do Hudiy só vão os PIDs padrão da ECU do motor (sem `ATSH`, então odômetro e contador de revisão do painel não são lidos por esse caminho). A central precisa de uma tela de 7" ou mais; o layout de tablet (768 px) é o que aparece.

### Projetos avaliados

- **wiboma/hudiy**: compatível e útil. 272 estrelas, último commit em outubro de 2026 (versão 1.28/2.24), documentação completa da API. Integração feita acima. Pendente: testar com a central real, pois a API foi validada só contra o `.proto` e os exemplos do repositório.
- **nguyenhuugiatri/ai-car-voice-assistant**: simulador de central no navegador com comandos de voz em vietnamita (Web Speech API + LLM local via WebGPU ou OpenAI + ElevenLabs). Não fala com carro nem OBD, tem 3 commits e 2 estrelas. Não há o que reaproveitar diretamente. A ideia aplicável aqui seria um "Copilito por voz" sobre a base de `src/data.js`, usando a Web Speech API do Chrome e um LLM; fica como possibilidade futura, não foi construído.

## Visualizador 3D do ASX

O card do carro na tela Início mostra um modelo 3D preto (`assets/asx.glb`, 2,5 MB) com os pontos de atenção por área posicionados sobre a carroceria. Dá para girar com o dedo; o zoom fica travado. Enquanto carrega, e se o WebGL ou o arquivo falharem, aparece a silhueta vetorial de `src/car.js`.

Modelo: "Mitsubishi ASX" por mamont nikita (Sketchfab), CC-BY-4.0. Crédito completo em `assets/asx-LICENSE.txt`. Modificações feitas aqui: carroceria e maçanetas pintadas de preto (materiais 9 e 18), pinças de freio (material 4) mantidas vermelhas, malha simplificada de 712 mil para 291 mil triângulos e compactada com meshopt via glTF Transform:

```bash
npx @gltf-transform/cli optimize scene.gltf asx.glb --compress meshopt --simplify-ratio 0.2 --simplify-error 0.001 --palette false --texture-compress false
```

Visualizador: `<model-viewer>` 4.7 (Google, Apache-2.0) e o decodificador meshopt (MIT), vendorados em `vendor/` para funcionar offline.

## Continuidade

`CLAUDE.md` tem as regras do projeto para agentes e `docs/ESTADO.md` tem o estado, as decisões e as pendências. Scripts de verificação em `tools/` (Playwright e `ws` como devDependencies: `npm i`).

## Estrutura

```
index.html          app shell e navegação
style.css           tema inspirado no Nothing UI (preto, cartões brancos, fonte dot-matrix Doto)
src/app.js          estado, rotas, telas, formulários, backup
src/data.js         base técnica do veículo e plano de manutenção
src/plan.js         vencimentos e consumo
src/car.js          modelo 3D e silhueta SVG com pontos de atenção
vendor/             model-viewer e decodificador meshopt
assets/asx.glb      modelo 3D preto (CC-BY-4.0, ver asx-LICENSE.txt)
src/obd.js          decodificador OBDb, ISO-TP, DTCs, ELM327 BLE, simulador
src/mapa.js         mapa web do Google com trânsito, rota pela Routes API e entrega ao Vela
src/painel.js       rotas das abas e leitura da manobra a partir da notificação
src/hudiy.js        cliente da API da central Hudiy (protobuf mínimo, mídia, navegação, OBD, teclas)
src/signalset.js    sinais no formato OBDb v3
sw.js               cache offline
tests/              node --test
tools/              central Hudiy falsa, capturas de tela, fluxo do mapa simulado
docs/ESTADO.md      estado, decisões e pendências
```

Créditos: tipografia Doto (Google Fonts), inspiração visual Nothing UI (Community, Zognest), dados OBD de OBDb, modelo 3D de mamont nikita (CC-BY-4.0).
