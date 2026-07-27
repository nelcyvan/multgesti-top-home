import React, { useEffect, useState } from "react";
import type { ProdutoSemVendaRow } from "../../services/gestmkt/ProdutosSemVenda";
import { registrarPromocao } from "../../services/gestmkt/RegistrarPromocao";

interface ModalResumoProdutoSemVendaProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProdutoSemVendaRow;
  onSuccess?: () => void;
}

const ModalResumoProdutoSemVenda: React.FC<ModalResumoProdutoSemVendaProps> = ({ isOpen, onClose, row, onSuccess }) => {
  const [mesDataPromocao, setMesDataPromocao] = useState<string>(""); // YYYY-MM
  const [dtAdd, setDtAdd] = useState<string>(""); // DD/MM/YYYY
  const [tipoCampanha, setTipoCampanha] = useState<string>("Selecione");
  const [codFilialSel, setCodFilialSel] = useState<string>("");
  const [erro, setErro] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    try {
      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, '0');
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const yyyy = String(hoje.getFullYear());
      setDtAdd(`${dd}/${mm}/${yyyy}`);
      setErro("");
      const f = String(row.CODFILIAL ?? '').trim();
      setCodFilialSel(f);
    } catch {}
  }, [isOpen, row]);

  const confirmar = () => {
    setErro("");
    if (!mesDataPromocao || !/^\d{4}-\d{2}$/.test(mesDataPromocao)) {
      setErro("Informe o Mês/Ano da Campanha");
      return;
    }
    if (!dtAdd || !/^\d{2}\/\d{2}\/\d{4}$/.test(dtAdd)) {
      setErro("Data de add inválida");
      return;
    }
    if (!tipoCampanha || tipoCampanha === "Selecione") {
      setErro("Selecione o Tipo de Campanha");
      return;
    }
    if (!codFilialSel) {
      setErro("Selecione a Filial");
      return;
    }

    const [y, m] = mesDataPromocao.split('-');
    const mesDataPromocaoFinal = `01/${m}/${y}`; // DD/MM/YYYY
    const usuarioLogadoRaw = localStorage.getItem("usuarioLogado");
    let matricula = 0;
    try {
      if (usuarioLogadoRaw) {
        const u = JSON.parse(usuarioLogadoRaw || '{}');
        const mStr = String(u?.matricula ?? '').trim();
        if (mStr && !isNaN(Number(mStr))) {
          matricula = Number(mStr);
        }
      }
    } catch {}
    if (!matricula) {
      setErro("Não foi possível obter a matrícula do usuário (CODUSUR_ADD)");
      return;
    }

    const payload = {
      codFilial: String(codFilialSel),
      codProd: Number(row.CODPROD || 0),
      tipoCampanha: String(tipoCampanha),
      mesDataPromocao: mesDataPromocaoFinal, // DD/MM/YYYY (01/MM/YYYY)
      codUsurAdd: matricula,
    };

    registrarPromocao(payload)
      .then((resp) => {
        if (resp.exists) {
          setErro("Registro já existe para este mês e campanha");
          return;
        }
        onClose();
        try { onSuccess?.(); } catch {}
      })
      .catch((err) => {
        setErro(String(err?.message || 'Falha ao registrar promoção'));
      });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3095, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3100 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "640px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Resumo do Produto</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              <div className="row g-3">
                <div className="col-12">
                  <div className="card border-0 bg-light">
                    <div className="card-body">
                      <div style={{ fontSize: "0.8rem" }}>
                        <div className="mb-2"><strong>Filial:</strong> {String(row.CODFILIAL ?? '')}</div>
                        <div className="mb-2"><strong>Produto:</strong> {String(row.CODPROD ?? '')}</div>
                        <div className="mb-2"><strong>Auxiliar:</strong> {String(row.CODAUXILIAR ?? '')}</div>
                        <div className="mb-2"><strong>Descrição:</strong> {String(row.DESCRICAO ?? '')}</div>
                        <div className="mb-2"><strong>Marca:</strong> {String(row.MARCA ?? '')}</div>
                        <div className="mb-2"><strong>Disponível:</strong> {Number(row.DISPONIVEL ?? 0)}</div>
                        <div className="mb-2"><strong>Bloqueado:</strong> {Number(row.BLOQUEADO ?? 0)}</div>
                        <div className="mb-2"><strong>Avaria:</strong> {Number(row.AVARIA ?? 0)}</div>
                        <div className="mb-2"><strong>Estoque Geral:</strong> {Number(row.ESTOQUE_GERAL ?? 0)}</div>
                        <div className="mb-2"><strong>Últ. Saída:</strong> {String(row.DTULTSAIDA ?? '')}</div>
                        <div className="mb-2"><strong>Custo:</strong> {Number(row.CUSTOULTENT ?? 0).toFixed(2)}</div>
                        <div className="mb-0"><strong>Venda:</strong> {Number(row.PRECO_VENDA ?? 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  {erro && (
                    <div className="alert alert-danger py-2 mb-2" role="alert" style={{ fontSize: "0.75rem" }}>
                      {erro}
                    </div>
                  )}
                </div>
                <div className="col-12">
                  <small className="text-muted">Preencha os campos obrigatórios</small>
                </div>
                <div className="col-12">
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-md-3">
                      <label htmlFor="mes-promocao" className="form-label mb-1">Mês/Ano</label>
                      <input
                        id="mes-promocao"
                        type="month"
                        className="form-control form-control-sm"
                        value={mesDataPromocao}
                        onChange={(e) => setMesDataPromocao(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="dt-add" className="form-label mb-1">Dt. Add</label>
                      <input
                        id="dt-add"
                        type="text"
                        className="form-control form-control-sm"
                        value={dtAdd}
                        readOnly
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="tipo-campanha" className="form-label mb-1">Tipo Campanha</label>
                      <select
                        id="tipo-campanha"
                        className="form-select form-select-sm"
                        value={tipoCampanha}
                        onChange={(e) => setTipoCampanha(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      >
                        <option value="Selecione">Selecione</option>
                        <option value="PE">PE</option>
                        <option value="PQ">PQ</option>
                        <option value="PP">PP</option>
                        <option value="PA">PA</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="cod-filial" className="form-label mb-1">Filial</label>
                      <select
                        id="cod-filial"
                        className="form-select form-select-sm"
                        value={codFilialSel}
                        onChange={(e) => setCodFilialSel(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      >
                        <option value="">Selecione</option>
                        <option value="1">Messejana</option>
                        <option value="2">Horizonte</option>
                        <option value="3">CD</option>
                        <option value="4">Santa Maria</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={onClose}
              >
                Fechar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={confirmar}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalResumoProdutoSemVenda;