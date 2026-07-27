[OPEN] Debug Session: conversa-stream-grupo-carregando

## Sintoma
- Ao abrir uma conversa de grupo, a interface permanece em "Carregando mensagens..." continuamente.
- O stream `GET /api/zaphub/conversas/mensagens/stream?...remoteJid=...@g.us` fica aberto com status 200.

## Hipoteses
1) O stream abre, mas o frontend nao recebe evento `snapshot/update`, entao `carregandoConversaId` nunca volta para `null`.
2) O stream envia eventos, mas o `remoteJid` do payload nao bate com o `remoteJid` da conversa selecionada em grupos, entao o loading nao e liberado.
3) O efeito do `EventSource` da conversa continua sendo refeito para grupos especificos e perde o primeiro `snapshot`.
4) O payload do stream para grupo chega sem `rows` ou com formato diferente e `aplicarSnapshotMensagens()` nao conclui o estado esperado.
5) O backend entrega `snapshot`, mas o frontend entra em erro silencioso no `onmessage` e ignora a atualizacao.

## Plano
- Instrumentar frontend no fluxo do stream de mensagens e no estado `carregandoConversaId`.
- Reproduzir com uma conversa de grupo.
- Confirmar qual hipotese bate com os logs antes de alterar a logica.

## Evidencias
- O `snapshot` chega normalmente no grupo com `payloadRemoteJid = selectedRemoteJid = 120363199240715295@g.us`.
- O problema observado nos logs nao e ausencia de snapshot, e sim loop de `frontend.stream-close` -> `frontend.stream-open` a cada ~300-500ms.
- A causa confirmada foi a identidade de `marcarConversaComoLida`: o callback dependia de `instancia`, e `aplicarSnapshotMensagens()` atualizava `instancia` em cada snapshot, forçando remount do efeito do `EventSource`.

## Fix aplicado
- `marcarConversaComoLida` passou a ler a instancia atual via `instanciaRef`.
- O efeito do stream passou a chamar `marcarConversaComoLidaRef.current`, sem depender da identidade do callback.
