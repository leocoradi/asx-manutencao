# Guia para agentes neste repositório

Leia também `docs/ESTADO.md` (o que existe, decisões, pendências) e `docs/CENTRAL.md` (objetivo atual: central multimídia dedicada num tablet no painel, e a ordem de execução) antes de mudar qualquer coisa. `docs/PLANO.md` é histórico da fase em que o celular era a tela principal.

## Regras do projeto

- **Minimalismo (ponytail)**: a menor mudança que resolve o pedido inteiro. Ordem: não construir se não foi pedido → reutilizar o que já existe → stdlib/plataforma → dependência já instalada → código direto → mínimo novo. Nunca cortar validação em fronteiras de confiança, tratamento de erro que evita perda de dados, segurança e acessibilidade.
- **Sem build e sem dependências de runtime**: HTML, CSS e ES modules servidos estáticos. Bibliotecas de terceiros entram vendoradas em `vendor/` com a licença ao lado (hoje: model-viewer e decodificador meshopt). Fontes do Google Fonts são a única carga externa fixa.
- **Idioma**: interface, comentários, commits e documentação em português do Brasil.
- **Dados do usuário só no aparelho**: `localStorage` (registros em `asx.v1`, chaves e preferências em `asx.*`). Nenhum backend, nenhuma telemetria. Chaves de API do usuário nunca vão para o repositório.
- **Repositório público**: não commitar backups (`asx-backup-*.json`), chaves, e-mails, endereços ou qualquer dado pessoal. Commits usam o endereço noreply.
- **Testes**: lógica nova com ramo, laço, parser ou protocolo ganha um caso em `tests/*.test.mjs` (`node:test`, sem instalar nada). `npm test` precisa passar antes de qualquer push; o workflow de Pages também roda os testes.
- **Verificação visual**: `tools/screens.cjs` (Playwright) gera capturas em 390, 820 e 1366 px; paisagem de celular é 844×390. Conferir antes de commitar mudanças de layout.
- **Fluxo git**: desenvolver no branch de trabalho, commits pequenos com mensagem explicando o porquê, push, e abrir pull request para `main`. O merge é do dono do repositório. O push em `main` publica no GitHub Pages. Nunca force-push em `main`.

## Mapa do código

```
index.html          app shell, navegação, rodapé do player
style.css           tema (Nothing UI: preto, cartões brancos, fonte Doto, tracejados, vermelho só em alerta) e breakpoints
src/app.js          estado, telas (Início, Navegação, Manutenção com Plano/Ficha/OBD, Combustível), formulários, backup, mídia, avisos, mapa, Hudiy
src/painel.js       lógica pura: rotas das abas, manobra a partir da notificação, formatação
src/data.js         base técnica do veículo e plano de manutenção (uso severo)
src/plan.js         vencimento (km/tempo, estimativa pelo odômetro) e consumo
src/car.js          modelo 3D (model-viewer) e silhueta SVG com pontos por área
src/obd.js          decodificador OBDb v3, ISO-TP, DTCs, transportes (Bluetooth LE, Hudiy, simulador)
src/signalset.js    sinais no formato OBDb (CC-BY-SA-4.0)
src/hudiy.js        cliente da API da central Hudiy (protobuf mínimo à mão)
src/mapa.js         Google Maps JS (trânsito) + Routes API + links para o Vela
sw.js               cache offline (bump de CACHE a cada mudança no shell)
tests/              node --test
tools/              servidor Hudiy falso, ponte nativa falsa, capturas de tela, mapa falso
hudiy/              configs de exemplo para registrar o app na central
android/            APK em Kotlin (interface embutida + modo carro + ponte nativa); compila só no CI; o workflow copia o site para assets/www
.github/workflows   Pages (testa e publica) e Android (gera o APK)
```

## Convenções de UI

- Cartões brancos (`.card`) para conteúdo, escuros (`.card.dark`) para contexto/instrumentos; `.chip` para estado (`vencido`, `breve`, `ok`, `sem`); barra segmentada `.seg` para progresso.
- Números e títulos em fonte dot (`.num`, `.dot-title`, `h1`, `h2`); texto corrido em sans do sistema.
- Alvos de toque de no mínimo 44 px; foco visível tracejado vermelho; `aria-label` em botões só com ícone.
- Grades com `minmax(0, 1fr)` para conteúdo largo não estourar.
