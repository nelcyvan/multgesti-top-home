# Debug Session: instancias-permitidas-freeze

- Status: OPEN
- Sintoma: a UI para ao carregar `GET /api/zaphub/instancias/permitidas?matricula=...` e depois vários erros aparecem em sequência.
- Escopo inicial: `MensagensModal.tsx`, rota `/api/zaphub/instancias/permitidas`, proxy/dev-server e backend correspondente.
- Restrições: sem alterar lógica de negócio antes de coletar evidência em runtime.

## Hipóteses

1. A requisição fica pendurada no frontend porque a rota `/api/zaphub/instancias/permitidas` nunca responde ou responde tarde demais no backend.
2. O problema está no proxy/dev server de `5173`, então o browser mostra request pendente antes mesmo de a chamada chegar ao backend real.
3. Há um efeito em cascata no `MensagensModal` que dispara novas requisições/streams após a primeira ficar presa, gerando os erros seguintes.
4. A troca recente no fluxo de carregamento criou concorrência/cancelamento indevido e deixou algum estado inconsistente depois da primeira chamada.
5. A requisição depende de `matricula` ou outro dado inválido em tempo de execução e entra em um caminho que não finaliza corretamente.

## Plano

1. Localizar os pontos exatos da chamada e da rota.
2. Instrumentar somente logs de depuração.
3. Reproduzir e coletar evidências.
4. Confirmar ou descartar hipóteses antes de corrigir.

## Evidências coletadas

- `curl http://72.60.247.126:7008/api/zaphub/instancias/permitidas?matricula=1` ficou pendurado e estourou timeout (sem bytes recebidos). Indica travamento no backend/proxy antes de responder.
- Browser não conseguia postar logs no debug server em `127.0.0.1:7777` por Private Network Access (loopback). Ajustado via proxy do Vite.

## Mudanças aplicadas (a confirmar)

- Adicionado proxy `/__dbg/*` no Vite para encaminhar para o debug server local (evita PNA/CORS).
- Adicionado timeouts defensivos no endpoint `/api/zaphub/instancias/permitidas` para não ficar "Pending" indefinidamente:
  - DB/permissões: 8s
  - Evolution/instâncias: 9s
  - Enriquecimento (responsáveis/televendas/unread): 8s cada
  - Retorno `504` quando estoura timeout
