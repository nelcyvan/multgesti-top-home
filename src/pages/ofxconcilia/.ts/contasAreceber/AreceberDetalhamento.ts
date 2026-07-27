import { PedidoCarteira } from "./AreceberService";

export interface GrupoVendedor {
  codusur: number;
  nome: string;
  pedidos: PedidoCarteira[];
  totalValor: number;
}

export const agruparPorVendedor = (pedidos: PedidoCarteira[]): GrupoVendedor[] => {
  const grupos: Record<number, GrupoVendedor> = {};

  pedidos.forEach((pedido) => {
    if (!grupos[pedido.CODUSUR]) {
      grupos[pedido.CODUSUR] = {
        codusur: pedido.CODUSUR,
        nome: pedido.NOME || "NÃO INFORMADO",
        pedidos: [],
        totalValor: 0,
      };
    }

    grupos[pedido.CODUSUR].pedidos.push(pedido);
    grupos[pedido.CODUSUR].totalValor += pedido.VALOR;
  });

  return Object.values(grupos).sort((a, b) => b.totalValor - a.totalValor);
};
