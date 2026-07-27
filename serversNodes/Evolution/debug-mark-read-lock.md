# Debug Session: mark-read-lock
- **Status**: [OPEN]
- **Issue**: `POST /api/zaphub/mensagens/marcar-lida` sofre `canceling statement due to lock timeout` e suspeita de lock gerado no Postgres.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `/tmp/mark-read-lock-dbg/trae-debug-log-mark-read-lock.ndjson`

## Reproduction Steps
1. Enviar `POST /api/zaphub/mensagens/marcar-lida`.
2. Observar erro `canceling statement due to lock timeout` na aplicação ou no banco.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | O lock nasce no próprio update de `Chat`/`Message` durante `markChatAsRead` | High | Med | Pending |
| B | DDL/runtime migration em `IsOnWhatsapp` ou `zaphub_event_jid_links` bloqueia a transação | High | Med | Pending |
| C | A Evolution externa responde, mas o persist local no Postgres trava | Med | Med | Pending |
| D | Concorrência de outro processo faz update/insert em massa nas mesmas tabelas | High | Med | Pending |
| E | Há ordem de lock conflitante entre rotas `mensagens` e `marcar-lida` | Med | High | Pending |

## Log Evidence
- Confirmado `deadlock detected (40P01)` no `GET /api/zaphub/mensagens` dentro de `fetchOpenInstanceMessagesWithClient`.
- Cadeia do deadlock (OID->tabela):
  - relation 17327 = `IsOnWhatsapp`
  - relation 56727 = `zaphub_event_jid_links`
- Sintoma compatível com DDL/locks em runtime: `AccessShareLock` vs `AccessExclusiveLock` entre essas tabelas.

## Verification Conclusion
- Mitigação aplicada: remover DDL/migrations automáticas em runtime (pool startup e rotas).
- Pós-mudança: teste concorrente de `GET /api/zaphub/mensagens` sem ocorrência de `40P01`.
