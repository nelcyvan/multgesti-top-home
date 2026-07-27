[OPEN] Debug session: zaphub-pool-stopped

## Sintoma
- “pool parou de funcionar” após ajuste para compatibilidade da coluna `canonicalJid`.

## Ambiente
- Serviço: /home/multgesti/serversNodes/Evolution (Express)
- Banco: Postgres (pg Pool via DATABASE_URL)

## Hipóteses
- A) `DATABASE_URL` ausente/errada no processo em execução → `databasePool` fica `null` ou falha ao conectar.
- B) Exaustão do pool: conexões não estão sendo liberadas (client.release) ou há long queries → `waitingCount` cresce e o endpoint trava.
- C) Erro recorrente no `information_schema` / lock / permissão → bloqueia requisições na checagem de coluna.
- D) Erro no fetch para Evolution API (timeouts) fazendo request ficar pendurado e aparentar “pool travado”.
- E) Exceção não tratada derruba o processo do node (ou reinicia via pm2), perdendo pool.

## Coleta de evidências
- Instrumentar: criação do pool, connect/release, stats do pool, tempo de queries e erros.
- Reproduzir: abrir o modal Mensagens / chamar GET /api/zaphub/mensagens e POST /api/zaphub/mensagens/marcar-lida.

## Status
- Instrumentação: PENDENTE
- Evidência: PENDENTE
- Fix: PENDENTE
