# Debug Session: zaphub-realtime-sync

- Status: OPEN
- StartedAt: 2026-06-08
- Symptom: a pagina web de Mensagens nao atualiza em tempo real
- Expected: quando tabelas relacionadas mudarem, a interface recebe snapshot/update automaticamente

## Hipoteses

1. A rota SSE nao esta sendo assinada pelo navegador ou falha na conexao inicial.
2. O backend aceita a conexao SSE, mas o polling compartilhado nao detecta mudancas.
3. O backend detecta mudanca e faz broadcast, mas o proxy/navegador nao entrega os eventos ao frontend.
4. O frontend abre o `EventSource`, mas descarta ou sobrescreve os eventos recebidos.
5. O servidor `7008` em execucao nao foi reiniciado com o codigo novo, entao a web continua falando com uma versao sem stream funcional.

## Evidencias

- Pendente

## Plano

1. Instrumentar a rota SSE e o ciclo de polling/broadcast.
2. Instrumentar a assinatura do frontend no modal Mensagens.
3. Reproduzir a abertura da tela e coletar logs.
4. Confirmar ou rejeitar as hipoteses.
5. Aplicar a menor correcao necessaria e validar.
