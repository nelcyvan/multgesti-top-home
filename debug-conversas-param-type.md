# [OPEN] Debug Session: conversas-param-type

## Sintoma
- Endpoint `GET /api/zaphub/conversas?limit=40&instanceId=d70190ec-98ae-44c8-a551-2a76abed423f&excludePulled=true&matricula=1`
- Resposta `500 Internal Server Error`
- Payload: `{ "message": "could not determine data type of parameter $3", "elapsedMs": 5354 }`

## Hipoteses
1. A query de `fetchInstanceConversations()` usa `$3` dentro de um trecho condicional com `IS NULL`/`CASE`/`NOT EXISTS`, e o Postgres nao consegue inferir o tipo sem cast explicito.
2. O parametro `$3` muda de significado conforme `excludePulled=true`, entao a ordem dos placeholders da query dinamica fica inconsistente.
3. O valor ligado ao `$3` chega como `null`/`undefined` na query montada para `excludePulled`, disparando ambiguidade de tipo no planner.
4. O erro nao esta na query principal de conversas, mas em uma subquery/helper reutilizado para excluir puxadas da principal.
5. Existe diferenca entre chamar por `instanceId` e `instanceName`, fazendo o placeholder de matricula/remoteJid perder o cast esperado.

## Plano
1. Localizar a rota `/api/zaphub/conversas` e o SQL de `fetchInstanceConversations`.
2. Confirmar qual placeholder corresponde ao `$3`.
3. Coletar evidencia com logs/analise do SQL montado e dos valores bindados.
4. Aplicar correcao minima com tipagem explicita ou ajuste de ordem de parametros.
5. Validar o endpoint com a mesma URL reportada.

## Evidencias
- `reabrirPuxadasEncerradasComNovaMensagem()` concluiu sem erro; nao foi a origem do `42P18`.
- Em `fetchInstanceConversationsWithClient()`, a instrumentacao registrou `queryParamsCount=4` com `$1=instanceId`, `$2=limit`, `$3="Topx"` e `$4=array de JIDs`.
- O SQL principal de conversas com `excludePulled=true` usava placeholders `$1`, `$2` e `$4`, deixando um gap no `$3`.
- O Postgres retornou `code=42P18` (`could not determine data type of parameter $3`) exatamente na query principal.
- A correcao minima foi renumerar o filtro `excludePulled` para usar `$3` e remover o bind extra `instance.name`.

## Verificacao
- Reproducao pre-fix: `GET /api/zaphub/conversas?...excludePulled=true...` retornou `500` com `could not determine data type of parameter $3`.
- Validacao post-fix: a mesma URL retornou `200 OK` com payload de conversas.

## Status
- Instrumentacao: CONCLUIDA
- Evidencia: CONCLUIDA
- Fix: CONCLUIDA
- Aguardando confirmacao do usuario para limpeza da instrumentacao
