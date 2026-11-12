# Estado do projeto e decisões

Documento de continuidade: o que existe, por que está assim, o que falta. Atualize ao fechar cada etapa.

## Objetivo

Web app (PWA) para acompanhar um Mitsubishi ASX 2017/2018 2.0 16V MIVEC 4x2 manual: manutenção, combustível, ficha técnica, OBD-II, com uso no celular e em central multimídia. Gratuito, sem backend, dados só no aparelho, visual inspirado no Nothing UI.

## O que está pronto

| Área | Estado | Observações |
|---|---|---|
| Plano de manutenção | pronto | Intervalos de uso severo em `src/data.js`. Sem registro, estima pelo múltiplo do intervalo a partir do odômetro (selo "est."). |
| Histórico, combustível, ficha, backup JSON | pronto | |
| Modelo 3D preto | pronto | GLB CC-BY-4.0 (crédito em `assets/asx-LICENSE.txt`), 291 mil triângulos, meshopt, 2,5 MB. Materiais: 9 carroceria, 18 maçanetas (pretos), 4 pinças (vermelho). Pontos de atenção por área em `src/car.js`. |
| OBD por Bluetooth LE | código pronto, **não testado em adaptador real** | Perfis GATT FFF0 e 18F0. Decodificador validado com respostas gravadas do OBDb. |
| OBD pela central Hudiy | código pronto, validado só contra `tools/fake-hudiy.mjs` | Só PIDs padrão da ECU 7E0 (API não troca cabeçalho CAN). |
| Player e manobra pela central Hudiy | idem | Mídia e navegação do Android Auto via API da central. |
| Player do YouTube embutido | pronto, **a ser substituído** (ver pendências) | API de iframe; playlist colada pelo usuário. |
| Trânsito ao vivo do Google | pronto, **não testado com chave real** | Mapa JS com TrafficLayer; rota pela **Routes API** (TRAFFIC_AWARE, alternativas). Chave do usuário em `localStorage` (`asx.gmaps`). |
| Navegação | entregue ao **Vela** pelo intent `geo:` | Botão "Navegar no Vela" com coordenadas do destino. |
| Layouts | pronto | 390 retrato, 844×390 paisagem, 820 tablet, 1366 desktop, 1024×600 central. |
| Publicação | GitHub Pages via Actions | `https://<usuario>.github.io/asx-manutencao/`. Workflow roda `npm test` antes. |

## Decisões e motivos

- **Sem framework e sem build**: o app cabe em módulos ES simples; qualquer servidor estático publica. Facilita rodar no web view da central.
- **Dados no aparelho**: sem conta, sem servidor, sem custo. Backup manual em JSON.
- **Android Auto**: não executa web apps; só nativos aprovados. Caminho adotado: central Hudiy (Linux, Raspberry Pi/x86) que roda apps HTML e expõe ELM327, mídia e navegação por API local. App nativo Kotlin fica como opção futura reaproveitando `src/signalset.js` e `src/obd.js`.
- **Waze removido**: sem API de rota; o usuário escolheu Vela como navegador. O mapa ao vivo do Waze foi substituído pelo Google com trânsito.
- **Vela (github.com/PimpinPumpkin/Vela)**: app nativo Android, GPL-3; não embute em web. Registra `geo:`, `google.navigation:` e é app de navegação do Android Auto. Seu trânsito vem de endpoint não oficial do Google; **não replicar** isso aqui (CORS impede em web, viola termos, quebra sem aviso).
- **Google Maps**: Directions API (legada) não pode ser ativada em projetos novos desde outubro de 2026; por isso a rota usa a Routes API. Cotas grátis mensais: 10 mil cargas de mapa, 5 mil rotas com trânsito. Exige conta de faturamento com cartão. Termos proíbem guiar curva a curva no app; por isso a condução vai para o Vela.
- **Hudiy**: protobuf das poucas mensagens usadas é codificado à mão (`src/hudiy.js`) em vez de carregar protobuf.js e o `.proto`.
- **Fonte Doto (Google Fonts)**: a mais próxima da NDot do Nothing UI disponível livremente.

## Pendências (em ordem)

1. **Controle do YouTube Music do celular pelo rodapé**: o usuário quer que o web app apenas controle e exiba o que o app do YouTube Music está tocando. Web não consegue (sem API). Proposta aguardando confirmação: app companheiro Android mínimo (`companion-android/`, Kotlin, NotificationListenerService + MediaSessionManager + WebSocket em localhost com token; APK gerado por GitHub Actions). Ao confirmar: remover o player embutido do YouTube (`src/media.js`, parte de `renderPlayer` em `src/app.js`, estilos `.ytwrap`) e reaproveitar o modo "hudiy" da barra para o modo "celular".
2. **Testes em hardware real**: adaptador ELM327 BLE no carro; chave do Google no celular; central Hudiy.
3. **Histórico do git**: dois commits do `main` carregam o e-mail pessoal do autor (commit inicial e merge do PR 1). Remover exige reescrever o histórico com force-push em `main`; só com autorização explícita do dono. Alternativa: ativar "Keep my email addresses private" no GitHub para commits futuros.
4. **Tablet retrato (820 px)**: card do carro fica estreito e rótulos de motor e elétrica se aproximam. Cosmético.
5. **Licença do projeto**: sem `LICENSE`. Se quiser permitir reuso, MIT é o padrão; o GLB (CC-BY-4.0), OBDb (CC-BY-SA-4.0), model-viewer (Apache-2.0) e meshopt (MIT) mantêm as suas.

## Como verificar

```bash
npm test                      # 21 casos
npm start                     # http://localhost:8080
node tools/screens.cjs shots  # capturas em 390/820/1366 (precisa de playwright instalado)
node tools/fake-hudiy.mjs assets/icon-512.png   # API Hudiy falsa em ws://localhost:44406 (precisa de ws)
node tools/hudiy-screens.cjs shots              # app conectado à central falsa
node tools/mapa-falso.cjs shots                 # fluxo do mapa com google.maps e Routes API simulados
```

Os scripts em `tools/` usam Playwright com Chromium; em ambiente sem GPU, as flags de software já estão nos scripts.

## Chaves e dados que nunca entram no repositório

Chave do Google Maps, backups `asx-backup-*.json`, posição salva, links de playlist, o PDF do manual do proprietário (direitos da Mitsubishi) e qualquer dado pessoal do dono.
