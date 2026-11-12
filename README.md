# ASX Manutenção

Web app (PWA) para acompanhar o Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2, câmbio manual 5M. Mobile first, funciona offline, sem build e sem dependências.

## O que tem

- **Início**: odômetro, silhueta do carro com estado por área (motor, câmbio, freios, rodas, elétrica), próximas manutenções e consumo.
- **Manutenção**: plano preventivo em uso severo (km ou meses, o que vencer primeiro) com especificações, part numbers e histórico de serviços.
- **Combustível**: registro de abastecimentos, km/L por tanque cheio, média e custo por km.
- **Ficha**: motor, fluidos e capacidades, pneus, lâmpadas, velas, fusíveis.
- **OBD**: leitura ao vivo via ELM327 Bluetooth LE (Web Bluetooth), códigos de falha (serviço 03), odômetro e contador de revisão do painel. Há um simulador para ver a tela sem adaptador.
- **YouTube Music no rodapé**: player do YouTube embutido (API oficial de iframe). Cole o link de uma playlist ou música do YouTube Music; o rodapé mostra faixa e artista com anterior / play-pause / próxima e um painel de vídeo que abre e fecha. Playlists privadas não tocam fora do app do YouTube. Com a tela desligada o YouTube pausa a reprodução em navegadores; é regra da plataforma.
- **Waze no Início**: mapa ao vivo oficial do Waze (embed.waze.com) centrado na sua posição, com o trânsito ao redor, e campo "Para onde?" que abre o Waze já roteando (deep link `waze.com/ul`). Instruções curva a curva dentro do app não existem: o Waze não tem API pública para isso fora do Android Auto.
- **Na central Hudiy**, o rodapé e o Início passam a usar o que a central recebe do Android Auto: faixa tocando com controles e a manobra atual (ícone, distância, instrução).
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
5. Dentro do web view da central o app conecta sozinho à API (detecta o objeto `hudiy`), assina mídia, navegação e OBD, e mostra player e manobra. O YouTube Music tocando pelo Android Auto aparece no player; o Waze (ou Maps) em navegação aparece no card. Os botões do player injetam as teclas de mídia da central (`KeyEvent`).

Por que só na central: nem o YouTube Music nem o Waze têm API pública para um site ler o que toca ou as instruções no celular. Essa informação só sai do telefone pelo protocolo do Android Auto, e é a central que a recebe. A integração foi validada contra um servidor falso que fala o protocolo do `Api.proto` (hello, assinaturas, mídia, navegação, OBD, teclas); falta o teste na central real.

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
src/media.js        links do YouTube/YouTube Music e URLs do Waze (mapa e navegação)
src/hudiy.js        cliente da API da central Hudiy (protobuf mínimo, mídia, navegação, OBD, teclas)
src/signalset.js    sinais no formato OBDb v3
sw.js               cache offline
tests/              node --test
```

Créditos: tipografia Doto (Google Fonts), inspiração visual Nothing UI (Community, Zognest), dados OBD de OBDb, modelo 3D de mamont nikita (CC-BY-4.0).
