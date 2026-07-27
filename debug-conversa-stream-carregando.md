[CLOSED] Debug Session: conversa-stream-carregando

## Sintoma
- Ao abrir uma conversa, a tela fica carregando indefinidamente.
- Network mostra:
  - GET `/api/zaphub/conversas/mensagens/stream?...` com 200 (SSE permanece aberto).
  - GET `/api/zaphub/conversas/mensagens?...` com 304 Not Modified.

## Hipóteses (falsificáveis)
1) O backend (Express) está respondendo 304 via ETag/If-None-Match e o frontend trata 304 como erro/pendência, deixando `loading` preso.
2) O stream SSE está disparando eventos com alta frequência e re-disparando fetch de mensagens, mantendo o estado em “carregando”.
3) O endpoint `/conversas/mensagens` está retornando 304 sem corpo e o frontend tenta ler JSON/texto e trava em await, não chegando ao `finally`.
4) Há disputa de estado: `setLoading(true)` acontece numa chamada e `setLoading(false)` não acontece por early return/throw antes do `finally`.
5) O proxy/cache (Vite/NGINX) está adicionando cache/ETag/304 de forma inesperada para rotas `/api`, interferindo com fetch.

## Plano de evidências
- Instrumentar backend:
  - Logar request headers (If-None-Match, Cache-Control) e status final em `/api/zaphub/conversas/mensagens`.
  - Logar eventos enviados no SSE `/api/zaphub/conversas/mensagens/stream` (snapshot/update/error) e periodicidade.
- Reproduzir abrindo uma conversa e coletar logs do Debug Server.

## Evidências coletadas (pré-fix)
- `GET /api/zaphub/conversas/mensagens` retorna `304` quando o client manda `If-None-Match`:
  - exemplo via curl: `If-None-Match: W/"a931-..."` → `304 Not Modified`
  - logs do Debug Server confirmam `route.finish statusCode=304` com `headers.ifNoneMatch` presente.
- Impacto: o frontend (fetch) recebe 304 sem body e trata como erro; em modo `silent`, isso mantém a conversa sem mensagens.

## Evidências coletadas (stream churn)
- O SSE de mensagens estava fechando logo após abrir (reconexão a cada ~1–2s):
  - logs mostram sequência `hub.snapshot` → `route.start/finish` → `stream.close` em poucos ms.
  - causa provável: efeito do React dependia de `conversas`, então ao atualizar conversas o efeito limpava e reabria o EventSource.

## Critério de sucesso
- Ao abrir conversa: `loading` finaliza e mensagens aparecem.
- Requests não ficam em loop; SSE permanece aberto mas sem “refetch infinito”.

## Conclusão
- Causa raiz 1: `304 Not Modified` via `ETag/If-None-Match` em `fetch` de mensagens, que pode resultar em payload sem body para o frontend.
- Causa raiz 2: o stream SSE de mensagens estava sendo refeito (close/reopen) porque o efeito dependia de `conversas` (mudanças em conversas derrubavam o EventSource).
- Correção:
  - `fetch` de conversas/mensagens no frontend envia `Cache-Control: no-cache` e `Pragma: no-cache`.
  - Stream de mensagens usa `ref` para a conversa selecionada e aplica o snapshot do SSE direto (sem refetch), evitando loop e reconexões por dependência.
