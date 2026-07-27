# Debug Session: `badge-wrong-instance`

Status: [OPEN]

## Sintoma

- O usuário recebe/gera atualização de unread e o badge muda na instância errada.
- A mensagem cai na instância correta, mas o badge é aplicado em outra.

## Hipóteses (falsificáveis)

1. O backend está emitindo `instanceName` errado no SSE (mapeamento/normalização incorreta).
2. O backend está calculando unread por instância errado (query no pool retorna contagem atribuída a outra instância).
3. O frontend está aplicando o update na chave errada (case mismatch, nome divergente entre Evolution vs tabela de acesso).
4. A lista de instâncias permitidas no backend (gestão de acessos) contém nomes divergentes/duplicados e o stream mistura chaves.
5. Existe concorrência entre `unreadCount` inicial do payload de `/instancias/permitidas` e updates do stream que sobrescrevem o estado com dados de outra instância.

## Instrumentação

- Backend: logs do ciclo `readUnreadCountsForMatricula` e `pollForChanges` (matricula, allowedNames, counts, diffs).
- Frontend: logs de cada mensagem SSE recebida e do merge aplicado no state, com chaves visíveis.

## Evidências

- Logs `pre` mostram o backend emitindo update para `Topx` enquanto o usuário afirma ter recebido mensagem em `Consultor Moisés`.
- Evidência do usuário: o conflito acontece quando o mesmo contato existe em mais de uma instância (mesmo `remoteJid` em instâncias diferentes).
- Leitura do Evolution confirma uma atualização de unread por `remoteJid` sem filtrar por `instanceId` em `updateChatUnreadMessages`, o que pode atualizar a instância errada quando o contato existe em múltiplas instâncias.

## Correção proposta

- Ajustar `updateChatUnreadMessages` no Evolution para filtrar por `instanceId` ao localizar/atualizar o Chat.
- Desacoplar no frontend o badge da instância de qualquer fallback local/`rows.unreadCount`; o badge passa a ler apenas do mapa `unreadCountsByInstance` abastecido pelo stream/pool.
