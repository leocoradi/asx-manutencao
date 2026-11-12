# ASX Manutenção

Web app (PWA) para acompanhar o Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2, câmbio manual 5M. Mobile first, funciona offline, sem build e sem dependências.

## O que tem

- **Início**: odômetro, silhueta do carro com estado por área (motor, câmbio, freios, rodas, elétrica), próximas manutenções e consumo.
- **Manutenção**: plano preventivo em uso severo (km ou meses, o que vencer primeiro) com especificações, part numbers e histórico de serviços.
- **Combustível**: registro de abastecimentos, km/L por tanque cheio, média e custo por km.
- **Ficha**: motor, fluidos e capacidades, pneus, lâmpadas, velas, fusíveis.
- **OBD**: leitura ao vivo via ELM327 Bluetooth LE (Web Bluetooth), códigos de falha (serviço 03), odômetro e contador de revisão do painel. Há um simulador para ver a tela sem adaptador.
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

## Visualizador 3D do ASX

O app usa uma silhueta vetorial preta (`src/car.js`) por ser leve e não depender de licença. Modelos 3D gratuitos encontrados para evoluir no futuro (verificar licença na página antes de usar):

- Sketchfab, "Mitsubishi ASX 2024" por teenlin3, CC Attribution, download livre, mas gerado por IA e da 2ª geração: https://sketchfab.com/3d-models/mitsubishi-asx-2024-d750320c556e4ec0b95a0628efbd24b9
- SketchUp 3D Warehouse, "2011 Mitsubishi Outlander Sport/RVR/ASX (Low Poly)", 1ª geração (mesma carroceria do 2017/2018), gratuito: https://embed-3dwarehouse-classic.sketchup.com/model/318cd080dba5dc4a94db926ad0cd7381/2011-Mitsubishi-Outlander-SportRVRASX-Low-Poly
- 3DModels.org, "Mitsubishi Outlander Sport (RVR / ASX) 2014" em glTF/GLB com materiais editáveis (dá para pintar de preto), licença royalty free, pago: https://3dmodels.org/3d-models/mitsubishi-outlander-sport-rvr-asx-2012/
- Blueprint 2D CC do ASX 2010 (base para redesenhar a silhueta): https://getoutlines.com/blueprints/16296/2010-mitsubishi-asx-suv-blueprints

Para usar um GLB: converter com Blender, pintar o material da carroceria de preto e exibir com `<model-viewer>` no card do carro.

## Estrutura

```
index.html          app shell e navegação
style.css           tema inspirado no Nothing UI (preto, cartões brancos, fonte dot-matrix Doto)
src/app.js          estado, rotas, telas, formulários, backup
src/data.js         base técnica do veículo e plano de manutenção
src/plan.js         vencimentos e consumo
src/car.js          silhueta do carro com pontos de atenção
src/obd.js          decodificador OBDb, ISO-TP, DTCs, ELM327 BLE, simulador
src/signalset.js    sinais no formato OBDb v3
sw.js               cache offline
tests/              node --test
```

Créditos: tipografia Doto (Google Fonts), inspiração visual Nothing UI (Community, Zognest), dados OBD de OBDb.
