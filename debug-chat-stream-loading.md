[OPEN]

# Debug Session: chat-stream-loading

## Symptom
- Ao abrir uma conversa, a interface permanece em carregamento contínuo.
- A requisição SSE `GET /api/zaphub/conversas/mensagens/stream?...` fica aberta com `200 OK`.

## Scope
- Frontend principal: `src/pages/zaphub/modals/MensagensModal.tsx`
- Backend relacionado: stream SSE de mensagens do Zaphub

## Hypotheses
1. O snapshot do SSE chega, mas o `remoteJid` recebido nao bate com a conversa selecionada e `carregandoConversaId` nao e limpo.
2. O stream de mensagens esta sendo remontado em loop por alguma dependencia instavel do `useEffect`.
3. O payload chega com estrutura valida para manter o SSE aberto, mas sem `rows` ou sem os campos esperados para aplicar o snapshot completo.
4. Existe erro silencioso dentro do `onmessage` ou de `aplicarSnapshotMensagens`, impedindo a transicao de loading.
5. O estado de loading esta sendo reativado por outro efeito apos a abertura inicial da conversa.

## Evidence Log
- Instrumentacao adicionada em `src/pages/zaphub/modals/MensagensModal.tsx`.
- Coletor remoto ativo em `http://72.60.247.126:7781/event`.
- Aguardando reproducao do usuario para capturar `select -> stream open -> snapshot -> clear loading`.

## Status
- Sessao aberta para coleta de evidencias.
