[OPEN] Debug session: message-edit-failure

Contexto
- Problema: edição de mensagens no ZapHub não está funcionando corretamente ao chamar Evolution API.
- Alvo: /home/evolution-api/ endpoint /chat/updateMessage/{instanceName}

Sintomas observados
- Ação “Editar” no ZapHub retorna falha/intermitência (detalhes a coletar via logs).

Evidência coletada (runtime)
- Requisição de edição com `remoteJid` canônico (`558...@s.whatsapp.net`) falhou com:
  - `400 Bad Request` → `"RemoteJid does not match"`
- A mesma edição usando `remoteJid` do registro (`...@lid`) funcionou (`ok: true`), retornando payload com `protocolMessage` tipo `MESSAGE_EDIT`.

Hipóteses (falsificáveis)
1) O payload enviado para /chat/updateMessage usa `number` no formato errado (ex.: remoteJid completo em vez de número E.164/dígitos), fazendo a Evolution editar no JID errado ou falhar.
2) O `key` enviado (id/remoteJid/fromMe/participant) está incompleto ou incorreto para a mensagem alvo (ex.: `remoteJid`/`participant` errado em grupo), então o Baileys não encontra a mensagem.
3) A Evolution está bloqueando a edição por regra do WhatsApp (janela expirada), mas o erro não está sendo propagado/interpretado corretamente.
4) O apikey/headers usados internamente para operar a instância não estão corretos para updateMessage (ex.: usa apikey global em vez do token da instância).
5) O ZapHub marca localmente como EDITED, mas a Evolution não confirma; há divergência entre “sucesso HTTP” e operação real no WhatsApp.

Evidências a coletar
- Request recebido pela Evolution: instanceName, number, key (id, remoteJid, fromMe, participant), text.
- Resposta do Baileys/Evolution e erros (stack + status).
- Normalização/transformações aplicadas em `number` e `key`.

Plano
1) Subir Debug Server e instrumentar /chat/updateMessage (controller/service) para reportar eventos.
2) Reproduzir a edição com 1:1 e em grupo.
3) Analisar logs e confirmar hipótese.
4) Aplicar correção mínima baseada em evidência.

Status das hipóteses
- H2: Confirmada (para 1:1): mensagens podem estar com `remoteJid` em formato `@lid`, e a edição falha se enviarmos o `remoteJid` canônico no payload (gera `RemoteJid does not match`). Usar o `remoteJid` original da mensagem (ex.: `...@lid`) resolve.
