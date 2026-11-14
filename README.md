# ASX Manutenção

Web app (PWA) para acompanhar o Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2, câmbio manual 5M. Mobile first, funciona offline, sem build e sem dependências.

## O que tem

- **Início**: odômetro, carro 3D com estado por área (motor, câmbio, freios, rodas, elétrica), próximas manutenções, consumo e, com navegação ativa, uma faixa de manobra que leva à aba Navegação.
- **Navegação**: mapa web do Google com trânsito ao vivo e rota (chave sua, abaixo), widget de mídia e central de avisos. Em paisagem os widgets empilham à direita do mapa; em retrato, abaixo. Guia curva a curva é com o Vela, Waze ou Google Maps; a manobra deles aparece no card sobre o mapa.
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

O APK é a central do carro num tablet (pensado para o Galaxy Tab S6 Lite no painel), em Kotlin (`android/`): uma WebView com a interface **embutida no APK** mais o que o navegador não consegue fazer. Fora do carro o tablet continua normal; a central só assume a tela no modo carro.

- **Interface embutida**: os arquivos do site vão dentro do APK e são servidos no mesmo endereço do GitHub Pages, então a central abre sem internet e os registros já gravados no aparelho continuam valendo.
- **Modo carro**: liga quando o tablet conecta ao áudio Bluetooth do carro escolhido (ou pelo botão do carro no topo) e desliga quando desconecta. No modo carro: paisagem, tela cheia, tela sempre acesa e Voltar não fecha o app. Fora dele, o ASX é um app comum.
- **Início no modo carro**: velocidade pelo GPS do tablet; **odômetro automático**, que soma a distância percorrida ao último valor digitado (o Início mostra quantos km vieram do GPS, e um abastecimento ou "Atualizar" com a leitura do painel corrige o desvio); e **atalhos** para os apps instalados entre Waze, Google Maps, Vela, YouTube Music e Android Auto. Os de navegação abrem em tela dividida, ao lado da central. O odômetro só conta com a central na tela (inteira ou dividida).
- **Sessão de mídia**: lê o que está tocando no tablet e manda os controles (`MediaSessionManager`).
- **Notificações**: manobra do Vela, Google Maps ou Waze e central de avisos (`NotificationListenerService`), só em memória.
- **Sistema**: links externos abrem os apps do Android; barras do sistema viram margem; se o processo de desenho da WebView morrer, ela é recriada; pedido de isenção de otimização de bateria.

Instalação: baixe `asx-manutencao.apk`, instale (permitir fontes desconhecidas) e, no rodapé, toque em **Permitir** para dar "Acesso a notificações" ao app. Sem isso, mídia, manobras e avisos não aparecem.

Onde baixar: em **Releases**, na versão mais nova ("App 1.N"). Cada build do `main` que mexe em `android/` ou nos arquivos do site publica uma.

### Preparar o tablet para o carro

1. **Escolher o carro**: conecte o tablet ao Bluetooth do rádio do ASX, abra a engrenagem → **Modo carro** → **Usar "<nome>" como o carro**. Daí em diante o modo carro liga sozinho quando esse Bluetooth conecta.
2. **Bateria**: na mesma seção, **Liberar uso de bateria**. Em *Configurações → Bateria → Limites de uso em segundo plano*, coloque ASX, Waze e YouTube Music em **Apps nunca suspensos**. Ligue **Proteger bateria** (carga até 85%) por causa do calor no painel.
3. **Abrir sozinho** (opcional): em *Configurações → Modos e rotinas → Rotinas → +*, condição **Dispositivo Bluetooth conectado** (o rádio do carro), ações **Abrir app** (ASX), **Não perturbar** e **Tempo limite da tela** no máximo. Ao desconectar, a rotina desfaz os ajustes. Há relatos de ajustes que não voltam; confira no tablet e, se preciso, adicione ações de término.
4. **Sem bloqueio no carro** (opcional): *Configurações → Tela de bloqueio → Smart Lock → Dispositivos confiáveis*, adicione o Bluetooth do rádio. Em casa o bloqueio continua.
5. **Android Auto no tablet** (opcional): instale o [Open Headunit](https://github.com/andreknieriem/open-headunit) (app separado, AGPL-3.0, não certificado pelo Google). O APK da página **Releases** do GitHub é gratuito e tem as mesmas funções; a versão da Play Store é paga. Instalado fora da loja, ele não se atualiza sozinho: baixe a versão nova na mesma página. O atalho **Android Auto** aparece no Início do modo carro e inicia o Android Auto do próprio tablet (Self Mode) num toque; com uma versão do Open Headunit que não aceite esse comando, abre a tela inicial dele. Preparação, uma vez: instale também o app Android Auto no tablet; nas configurações do Android Auto, toque 10 vezes em **Versão**, depois em **⋮ → Iniciar servidor da unidade principal**; no Open Headunit, permita **Sobrepor a outros apps**. Se depois de reiniciar o tablet o Self Mode ficar em "Buscando Headunit Server…", ligue o servidor de novo pelo mesmo menu.

### Atualizar

- **Interface e APK** vêm juntos: a interface está embutida, então qualquer mudança chega pela versão nova do APK.
- Engrenagem → **Procurar atualização**. O app consulta a release mais nova; se houver, mostra **Baixar e instalar**, baixa o APK e o Android pede confirmação. Na primeira vez o Android pede para permitir "Instalar apps desconhecidos" para o ASX.
- Todos os APKs são assinados pela mesma chave, guardada pelo CI num **rascunho de release "assinatura"**. Não apague nem publique esse rascunho: sem ele, o app instalado deixa de aceitar atualizações.
- APKs instalados antes da versão com o botão foram assinados com chaves descartáveis. Para a primeira instalação com a chave fixa: exporte o backup, desinstale o app antigo, instale o novo e importe o backup. Daí em diante, o botão resolve.
- No navegador (GitHub Pages), a página se atualiza sozinha.

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

`CLAUDE.md` tem as regras do projeto para agentes e `docs/ESTADO.md` tem o estado, as decisões e as pendências; `docs/SEGURANCA.md` tem a varredura de segurança. Scripts de verificação em `tools/` (Playwright e `ws` como devDependencies: `npm i`).

## Estrutura

```
index.html          app shell e navegação
style.css           tema inspirado no Nothing UI (preto, cartões brancos, fonte dot-matrix Doto)
src/app.js          estado, rotas, telas, formulários, backup
src/data.js         base técnica do veículo e plano de manutenção
src/plan.js         vencimentos e consumo
src/car.js          modelo 3D e silhueta SVG com pontos de atenção
vendor/             model-viewer, decodificador meshopt e fonte Doto, com as licenças
assets/asx.glb      modelo 3D preto (CC-BY-4.0, ver asx-LICENSE.txt)
src/obd.js          decodificador OBDb, ISO-TP, DTCs, ELM327 BLE, simulador
src/mapa.js         mapa web do Google com trânsito, rota pela Routes API e entrega ao Vela
src/painel.js       rotas das abas, manobra a partir da notificação e odômetro por GPS
src/dados.js        formato e validação dos registros (localStorage e backup)
src/hudiy.js        cliente da API da central Hudiy (protobuf mínimo, mídia, navegação, OBD, teclas)
src/signalset.js    sinais no formato OBDb v3
sw.js               cache offline
tests/              node --test
tools/              central Hudiy falsa, capturas de tela, fluxo do mapa simulado
docs/ESTADO.md      estado, decisões e pendências
```

Créditos: tipografia Doto (The Doto Project Authors, OFL-1.1, em `vendor/`), inspiração visual Nothing UI (Community, Zognest), dados OBD de OBDb, modelo 3D de mamont nikita (CC-BY-4.0).
