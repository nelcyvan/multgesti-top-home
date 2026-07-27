import React, { useEffect, useMemo, useState } from "react";
import type { ProdutoVendaBaixaRow } from "../../services/gestmkt/ProdutosVendaBaixa";
import { buscarAvancadaPorDescricao } from "../../services/gestmkt/BuscarAvancadaDescricao";

interface ModalBuscaAvancadaDescricaoProps {
  codFilialSel: string;
  descricaoInicial: string;
  onSelecionar: (produto: ProdutoVendaBaixaRow) => void;
  onCancelar: () => void;
}

const ModalBuscaAvancadaDescricao: React.FC<ModalBuscaAvancadaDescricaoProps> = ({
  codFilialSel,
  descricaoInicial,
  onSelecionar,
  onCancelar,
}) => {
  const [desc, setDesc] = useState<string>(descricaoInicial || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string>("");
  const [rows, setRows] = useState<ProdutoVendaBaixaRow[]>([]);

  useEffect(() => {
    setDesc(descricaoInicial || "");
  }, [descricaoInicial]);

  const podeBuscar = useMemo(() => {
    return !!desc.trim() && ["1","2","4"].includes(String(codFilialSel || ""));
  }, [desc, codFilialSel]);

  const executarBusca = async () => {
    const q = desc.trim();
    if (!q) {
      setErro("Informe uma descrição para buscar");
      return;
    }
    if (!["1","2","4"].includes(String(codFilialSel || ""))) {
      setErro("Selecione a Filial");
      return;
    }
    setErro("");
    setLoading(true);
    try {
      const { rows: lista } = await buscarAvancadaPorDescricao({ q, codFilial: String(codFilialSel) });
      setRows(Array.isArray(lista) ? lista : []);
      if ((Array.isArray(lista) ? lista.length : 0) === 0) {
        setErro("Nenhum resultado para a descrição informada");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na busca';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, minHeight: "58vh" }}>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-7">
            <label htmlFor="busca-desc" className="form-label mb-1">Descrição</label>
            <input
              id="busca-desc"
              type="text"
              className="form-control form-control-sm"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); executarBusca(); } }}
              placeholder="Digite parte da descrição"
              style={{ height: "28px", fontSize: "0.7rem" }}
            />
          </div>
          <div className="col-12 col-md-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary px-3"
              style={{ height: "1.5rem", fontSize: "0.7rem", lineHeight: 1.1 }}
              disabled={loading || !podeBuscar}
              onClick={executarBusca}
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {erro && (
          <div className="alert alert-danger py-2 mt-2" role="alert" style={{ fontSize: "0.75rem" }}>
            {erro}
          </div>
        )}

        <div className="mt-2" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <table className="table table-sm table-hover" style={{ fontSize: "0.72rem", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "8%" }}>Filial</th>
                <th style={{ width: "10%" }}>Cód.</th>
                <th style={{ width: "14%" }}>Auxiliar</th>
                <th>Descrição</th>
                <th style={{ width: "12%" }}>Marca</th>
                <th className="text-end" style={{ width: "12%" }}>Disponível</th>
                <th className="text-end" style={{ width: "12%" }}>Venda</th>
                <th style={{ width: "8%" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted">Nenhum item listado</td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.CODFILIAL}-${r.CODPROD}-${idx}`}>
                    <td>{String(r.CODFILIAL ?? '')}</td>
                    <td>{String(r.CODPROD ?? '')}</td>
                    <td>{String(r.CODAUXILIAR ?? '')}</td>
                    <td className="text-truncate">{String(r.DESCRICAO ?? '')}</td>
                    <td className="text-truncate">{String(r.MARCA ?? '')}</td>
                    <td className="text-end">{Number(r.DISPONIVEL ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-end">{Number(r.PVENDA ?? 0).toFixed(2)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm py-1 px-2"
                        style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                        onClick={() => onSelecionar(r)}
                      >
                        Selecionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm py-1 px-2"
          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>
    </>
  );
};

export default ModalBuscaAvancadaDescricao;