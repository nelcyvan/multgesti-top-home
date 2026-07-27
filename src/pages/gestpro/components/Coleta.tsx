import React from "react";
import type { PedidoDetalhe, PedidoItem } from "../../../components/gestlog/VisualizarPedido";
import type { PendenciaGestproRow } from "./types/ColetaSeparandoPendencias.types";

type Props = {
  items: PendenciaGestproRow[];
  head: PendenciaGestproRow;
  onPrint?: (pd: PedidoDetalhe) => void;
  onPrinted?: () => void;
  label?: string;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
};

export const Coleta: React.FC<Props> = ({ items, head, onPrint, onPrinted, label }) => {
  return (
    <button
      className="btn btn-success text-white btn-gestpro py-0 px-3"
      style={{ fontSize: "0.75rem", height: "24px" }}
      type="button"
      onClick={() => {
        const pedidoItems: PedidoItem[] = items.map(p => ({
          descricao: p.DESCRICAO,
          quantidade: p.QT,
          codigoDeBarras: p.CODAUXILIAR,
          codProd: p.CODPROD,
          posicao: p.POSICAO,
          multiplo: p.MULTIPLO,
          embalagemMaster: toFiniteNumber(p.EMBALAGEMMASTER)
        }));
        const pd: PedidoDetalhe = {
          pedido: String(head.NUMPED),
          data: head.DATA,
          tipoEntrega: head.TIPOENTREGA || "-",
          cliente: head.CLIENTE,
          vendedor: `${head.CODUSUR} - ${head.NOME || ""}`,
          codFilial: head.CODFILIAL,
          codFilialRetira: head.CODFILIALRETIRA,
          codCli: head.CODCLI,
          posicao: head.POSICAO,
          items: pedidoItems,
          ageDays: 0,
          normalizedDate: null,
          statusPedido: Number(head.LOG2_REAL || head.LOG2),
          log2Real: head.LOG2_REAL || head.LOG2,
          enderEnt: head.ENDERENT,
          numeroEnt: head.NUMEROENT,
          bairroEnt: head.BAIRROENT,
          municEnt: head.MUNICENT,
          cep: head.CEP,
          vlTotal: head.VLTOTAL,
          separador: head.SEPERADOR,
          emissorMapa: head.EMISSOR_MAPA,
          viasMapa: head.NUMVIASMAPASEP
        };
        if (onPrint) {
          onPrint(pd);
        } else {
          console.log("Print data:", pd);
        }
        if (onPrinted) onPrinted();
      }}
    >
      {label || "Imprimir"}
    </button>
  );
};

export default Coleta;
