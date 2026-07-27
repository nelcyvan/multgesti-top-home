import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/__dbg': {
        target: 'http://127.0.0.1:7778',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/__dbg/, ''),
      },
      // GestFIN Receber (novo servidor na porta 7006) - colocar ANTES da genérica
      '/api/gestfin/lancamentos-areceber': {
        target: 'http://localhost:7006',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestfin/areceber': {
        target: 'http://localhost:7006',
        changeOrigin: true,
        secure: false,
      },
      // Login (servidor appGestPRO na porta 7007)
      '/api/login': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      // Permissão GestMKT deve ir ao servidor de conexões (7001)
      '/api/gestmkt/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestlog/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub/usuarios': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub/instancias': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub/mensagens': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub/instancias/acao': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/zaphub': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      // GestPRO Geral (servidor gestpro na porta 7004) - DEPOIS da permissao
      '/api/gestpro/pedidos-prioridade': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/definir-prioridade': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/faturamento-111': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/salvar-cliente-sem-venda': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/clientes-sem-venda': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },

      '/api/ofxconcilia/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      // OFX Concilia (servidor na porta 7003) - DEPOIS da permissao
      '/api/ofxconcilia': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      // GestFIN permissão (servidor conexao na porta 7001)
      '/api/gestfin/permissao': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      // GestLOG (servidor gestlog na porta 7002)
      '/api/gestlog': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestlog/buscar-pedidos': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestlog/separadores': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestlog/definir-separador': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Atualização de OBS de Entrega (Localização)
      '/api/gestlog/atualizar-obs-entrega': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint de atualização de cadastro GestLOG
      '/api/gestlog/atualizar-cadastro': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Atualização de status do pedido GestLOG
      '/api/gestlog/atualizar-status': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Atualização de status especial (Separação, Corte) GestLOG
      '/api/gestlog/atualizar-status-especial': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint de endereço do cliente (GestLOG)
      '/api/gestlog/endereco-cliente': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Voltar triagem GestLOG
      '/api/gestlog/voltar-triagem': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Logs do pedido GestLOG
      '/api/gestlog/logs': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Notas recentes (GestLOG)
      '/api/gestlog/notas-recentes': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Marcar SITDOC da nota (GestLOG)
      '/api/gestlog/marcar-sitdoc': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      '/apis/gestlog': {
        target: 'http://localhost:7009',
        changeOrigin: true,
        secure: false,
      },
      '/apis/gestpro': {
        target: 'http://localhost:7010',
        changeOrigin: true,
        secure: false,
      },
      // Inventário - Adicionar pendente (GestLOG)
      '/api/gestlog/inventario/adicionar-pendente': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      // Inventário - Verificar pendentes (GestLOG)
      '/api/gestlog/inventario/verificar-pendentes': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/buscar-pedidos': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/disparo-imediato': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/disparo-entregas': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/status-envio': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/status-entregas': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/status-pedidos': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/disparo-status-pedidos': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      '/api/evolution/disparo-coletas': {
        target: 'http://localhost:7008',
        changeOrigin: true,
        secure: false,
      },
      // OFX-Concilia (servidor ofxconcilia na porta 7003)
      '/api/ofxconcilia/dias-do-mes': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/total-transacoes': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/total-saldo': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/provisao-mes-atual': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/detalhamento-provisao-mes-atual': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/provisao-proximo-mes': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/detalhamento-provisao-proximo-mes': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/total-resultado-saida': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/api/ofxconcilia/total-resultado-saida', '/api/ofxconcilia/total-resultado-saida'),
      },
      '/api/ofxconcilia/detalhamento-conciliado-saida': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      // Novos endpoints retroativos
      '/api/ofxconcilia/provisao-retroativa-em-aberto': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      '/api/ofxconcilia/detalhamento-provisao-retroativo': {
        target: 'http://localhost:7003',
        changeOrigin: true,
        secure: false,
      },
      // GestPRO (servidor gestpro na porta 7004)
      // GestMKT (rotas hospedadas no servidor GestPRO na porta 7004)
      '/api/gestmkt': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/comissao-por-liquidez': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/conciliacao-tv7/buscar-notas': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/conciliacao-tv7/buscar-pedido': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/comissao-por-liquidez-mes-anterior': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/campanha-vendas-mes-anterior': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/em-aberto-mes-atual': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Em Aberto (Mês Anterior)
      '/api/gestpro/em-aberto-mes-anterior': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/duplicatas-em-aberto-mes-atual': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/duplicatas-em-aberto-mes-anterior': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/estoque-e-movimentos': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pedido-por-numped': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pedidos-fotos': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pedidos-fotos/por-entregador': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pedidos-fotos/arquivo': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pedidos-separador': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/confirmar-separacao': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/cancelar-separacao': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      // Rota específica deve vir ANTES das genéricas para evitar captura por prefixo
      '/api/gestpro/inventario/avulso/usuario/ajusteEstoque': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/contagens-por-produto': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/reabrir': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/marcar-primeira-tratativa': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/produto': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/encerrar': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/produtos': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/produtos-pendentes/atualizar-data': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/produtos-pendentes': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/produto-estoque': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/cliente-por-cpf': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/inventario/avulso/usuario': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/usuarios': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/carrinho-clientes': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/carrinho-clientes/inserir': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/carrinho-clientes/produtos/inserir': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/carrinho-clientes/completo': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/produtos-promocao-por-depto': {
        target: 'http://localhost:7007',
        changeOrigin: true,
        secure: false,
      },
      // (já declarado acima)
      '/api/gestpro/enviar-comprovante': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Histórico do Produto (GestPRO)
      '/api/gestpro/historico-produto': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Comissões por Frete (Mês Atual)
      '/api/gestpro/comissoes-por-frete-mes-atual': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Comissões por Frete (Mês Anterior)
      '/api/gestpro/comissoes-por-frete-mes-anterior': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestpro/pcpedc-log2-gestpro': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Pendencias Gestpro
      '/api/gestpro/pendenciasGestpro': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Histórico de Campanhas
      '/api/gestpro/historico-campanhas': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint de confirmação de encarte (GestMKT)
      '/api/gestmkt/produtos-promocao/confirmar-encarte': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      '/api/gestmkt/produtos-disponiveis': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // Novo endpoint: Clientes sem Venda
      // Removido duplicata

      // GestPRO Geral (servidor gestpro na porta 7004) - Mover para o final
      '/api/gestpro': {
        target: 'http://localhost:7004',
        changeOrigin: true,
        secure: false,
      },
      // GestFIN (servidor gestfin na porta 7005)
      '/api/gestfin': {
        target: 'http://localhost:7005',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
