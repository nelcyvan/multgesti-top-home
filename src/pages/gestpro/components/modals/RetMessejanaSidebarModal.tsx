import React, { useCallback, useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import TriagemModal from "./TriagemModal";
import EnviarMessejanaStatus20Modal from "./EnviarMessejanaStatus20Modal";
import { PedidoCard, type PedidoAnaliseGroup } from "./PedidosParaAnaliseModal";

interface Props {
  onClose: () => void;
}

interface PedidoAnalise {
  DATA: string;
  POSICAO: string;
  TIPOENTREGA: string;
  CODCLI: number;
  CLIENTE: string;
  NUMERO_DO_PEDIDO_TV8: number;
  CODPROD: number;
  DESCRICAO: string;
  QUANTIDADE_ITEM_PEDIDO: number;
  CODIGO_DE_BARRAS: string;
  COBRANCA: string;
  CODFILIAL: string;
  CODFILIALRETIRA: string;
  VENDEDOR: string;
  ENDERENT: string;
  NUMEROENT: string;
  BAIRROENT: string;
  MUNICENT: string;
  VLFRETE: number;
  QT_TOTAL: string;
  STATUS_PEDIDO: string;
  ULTIMASITUACAOCFAT: string;
  MULTIPLO?: number;
  EMBALAGEM?: string;
  OBS: string;
  OBS1?: string;
  OBS2?: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
}

const resolveBaseApi = (): string => {
  const envRaw = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  return "/api";
};

const parseDateFlexible = (v: unknown): Date | null => {
  if (v == null) return null;
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === "string") {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (br) {
      const day = parseInt(br[1], 10);
      const mon = parseInt(br[2], 10) - 1;
      const yr = parseInt(br[3], 10);
      const d2 = new Date(yr, mon, day);
      if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    }
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const yr = parseInt(iso[1], 10);
      const mon = parseInt(iso[2], 10) - 1;
      const day = parseInt(iso[3], 10);
      const d2 = new Date(yr, mon, day);
      if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    }
    const tmp = new Date(v);
    if (!isNaN(tmp.getTime())) return new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
  }
  return null;
};

const businessDaysSince = (d: Date | null): number => {
  if (!d) return 0;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (end <= start) return 0;
  let count = 0;
  const dt = new Date(start.getTime());
  while (true) {
    dt.setDate(dt.getDate() + 1);
    if (dt > end) break;
    const day = dt.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

const RetMessejanaSidebarModal: React.FC<Props> = ({ onClose }) => {
  const [pedidosRaw, setPedidosRaw] = useState<PedidoAnalise[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoTriagem, setPedidoTriagem] = useState<PedidoAnaliseGroup | null>(null);

  const loadPedidos = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setLoading(true);
      setError(null);
    }
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const dataFim = `${yyyy}-${mm}-${dd}`;
      const dataInicio = "2025-01-01";

      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestlog/buscar-pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filiais: [1],
          tiposEntrega: ["EF", "EN", "RP"],
          filiaisRetira: [1],
          posicoesPedido: ["P", "L", "M"],
          dataInicio,
          dataFim
        })
      });

      if (!response.ok) throw new Error("Falha ao buscar pedidos");
      const data = await response.json();
      setPedidosRaw(data.rows || []);
      if (isAutoRefresh) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPedidos(false);
    const interval = setInterval(() => {
      loadPedidos(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadPedidos]);

  const groupedPedidos = useMemo(() => {
    const map = new Map<number, PedidoAnaliseGroup>();
    pedidosRaw.forEach(r => {
      const key = r.NUMERO_DO_PEDIDO_TV8;
      const existing = map.get(key);
      const d = parseDateFlexible(r.DATA);
      const age = businessDaysSince(d);

      if (!existing) {
        map.set(key, {
          pedido: key,
          data: r.DATA,
          tipoEntrega: r.TIPOENTREGA,
          cliente: r.CLIENTE,
          codFilial: r.CODFILIAL,
          codFilialRetira: r.CODFILIALRETIRA,
          codCli: r.CODCLI,
          cobranca: r.COBRANCA,
          vendedor: r.VENDEDOR,
          bairroEnt: r.BAIRROENT,
          enderEnt: r.ENDERENT,
          numeroEnt: r.NUMEROENT,
          municEnt: r.MUNICENT,
          posicao: r.POSICAO,
          obs: r.OBS,
          obs1: r.OBS1,
          obs2: r.OBS2,
          obsEntrega1: r.OBSENTREGA1,
          obsEntrega2: r.OBSENTREGA2,
          obsEntrega3: r.OBSENTREGA3,
          vlFrete: r.VLFRETE,
          items: [
            {
              codProd: r.CODPROD,
              descricao: r.DESCRICAO,
              quantidade: r.QUANTIDADE_ITEM_PEDIDO,
              codigoDeBarras: r.CODIGO_DE_BARRAS,
              multiplo: r.MULTIPLO,
              embalagem: r.EMBALAGEM,
              qtTotal: r.QT_TOTAL
            }
          ],
          ageDays: age,
          normalizedDate: d,
          statusPedido: r.STATUS_PEDIDO,
          ultimoStatusRaw: r.ULTIMASITUACAOCFAT
        });
      } else {
        existing.items.push({
          codProd: r.CODPROD,
          descricao: r.DESCRICAO,
          quantidade: r.QUANTIDADE_ITEM_PEDIDO,
          codigoDeBarras: r.CODIGO_DE_BARRAS,
          multiplo: r.MULTIPLO,
          embalagem: r.EMBALAGEM,
          qtTotal: r.QT_TOTAL
        });
        existing.ageDays = Math.max(existing.ageDays, age);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.ageDays - a.ageDays);
  }, [pedidosRaw]);

  const enviarMessejana20 = useMemo(() => {
    return groupedPedidos.filter(g => {
      const statusCode = g.ultimoStatusRaw ? parseInt(g.ultimoStatusRaw.split("__")[0], 10) : -1;
      return statusCode === 20 || g.statusPedido === "20";
    });
  }, [groupedPedidos]);

  return (
    <>
      <EnviarMessejanaStatus20Modal
        pedidos={enviarMessejana20}
        onClose={onClose}
        onTriagem={setPedidoTriagem}
        PedidoCardComponent={PedidoCard}
      />

      {loading && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.2)" }}
        >
          <div className="spinner-border text-light" role="status" />
        </div>
      )}

      {error && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-3 alert alert-danger shadow"
          style={{ zIndex: 2001, maxWidth: 720 }}
        >
          {error}
        </div>
      )}

      {pedidoTriagem && (
        <TriagemModal
          pedido={pedidoTriagem}
          onClose={() => setPedidoTriagem(null)}
          onSuccess={() => loadPedidos(true)}
        />
      )}
    </>
  );
};

export default RetMessejanaSidebarModal;
