import React, { useEffect, useMemo, useState } from "react";

type Row = {
  CODFILIAL?: number | string;
  CODPROD?: number | string;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  MARCA?: string;
  QTBLOQUEADA?: number;
  AVARIA?: number;
  QTRESERV?: number;
  DISPONIVEL?: number;
};

const resolveBaseApi = (): string => {
  const env = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
};

interface ProdutosDisponiveisModalProps {
  onClose: () => void;
}

const ProdutosDisponiveisModal: React.FC<ProdutosDisponiveisModalProps> = ({ onClose }) => {
  const [tipo, setTipo] = useState<'pisos'|'mix'>('pisos');
  const [qtMin, setQtMin] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [marca, setMarca] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [qtdMinFilter, setQtdMinFilter] = useState<string>('');
  const [qtdMaxFilter, setQtdMaxFilter] = useState<string>('');

  const podeBuscar = useMemo(() => {
    const n = Number(qtMin);
    return Number.isFinite(n) && n >= 0;
  }, [qtMin]);

  const executarBusca = async () => {
    const baseApi = resolveBaseApi();
    const qtDinponivel = Number(qtMin);
    if (!Number.isFinite(qtDinponivel)) {
      setErro('Informe um número válido para disponibilidade mínima');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      const body: any = { qtDinponivel };
      if (tipo === 'pisos') body.pisos = 1; else body.mix = 2;
      const resp = await fetch(`${baseApi}/gestmkt/produtos-disponiveis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data = isJson ? await resp.json() : await resp.text();
      if (!resp.ok) {
        const message = isJson ? (data as any)?.message : String(data || 'Falha ao buscar produtos disponíveis');
        throw new Error(message);
      }
      const lista = (data as any)?.rows ?? [];
      setRows(Array.isArray(lista) ? lista : []);
      if ((Array.isArray(lista) ? lista.length : 0) === 0) {
        setErro('Nenhum produto encontrado para os filtros informados');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na consulta';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setRows([]); setErro(''); }, [tipo]);

  const filteredRows = useMemo(() => {
    const m = marca.trim().toLowerCase();
    const d = descricao.trim().toLowerCase();
    const qMin = qtdMinFilter.trim() === '' ? undefined : Number(qtdMinFilter);
    const qMax = qtdMaxFilter.trim() === '' ? undefined : Number(qtdMaxFilter);
    return rows.filter((r) => {
      const marcaOk = m ? String(r.MARCA ?? '').toLowerCase().includes(m) : true;
      const descOk = d ? String(r.DESCRICAO ?? '').toLowerCase().includes(d) : true;
      const dispon = Number(r.DISPONIVEL ?? 0);
      const qMinOk = qMin === undefined ? true : dispon >= qMin;
      const qMaxOk = qMax === undefined ? true : dispon <= qMax;
      return marcaOk && descOk && qMinOk && qMaxOk;
    });
  }, [rows, marca, descricao, qtdMinFilter, qtdMaxFilter]);

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3198, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3203 }}>
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem", maxHeight: "85vh" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Busca Avançada Estoque</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Tipo</label>
                  <select className="form-select form-select-sm" value={tipo} onChange={(e) => setTipo(e.target.value as any)} style={{ height: "28px", fontSize: "0.7rem" }}>
                    <option value="pisos">Pisos/Revestimentos</option>
                    <option value="mix">Mix Geral</option>
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Disponível mínimo</label>
                  <input type="number" className="form-control form-control-sm" value={qtMin} onChange={(e) => setQtMin(e.target.value)} style={{ height: "28px", fontSize: "0.7rem" }} />
                </div>
                <div className="col-12 col-md-4">
                  <button type="button" className="btn btn-primary btn-sm py-1 px-3" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} disabled={loading || !podeBuscar} onClick={executarBusca}>
                    {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="row g-2 align-items-end mt-1">
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Marca</label>
                  <input type="text" className="form-control form-control-sm" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Portobello" style={{ height: "28px", fontSize: "0.7rem" }} />
                </div>
                <div className="col-12 col-md-5">
                  <label className="form-label mb-1">Descrição</label>
                  <input type="text" className="form-control form-control-sm" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Porcelanato 60x60" style={{ height: "28px", fontSize: "0.7rem" }} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label mb-1">Qtd. mín.</label>
                  <input type="number" className="form-control form-control-sm" value={qtdMinFilter} onChange={(e) => setQtdMinFilter(e.target.value)} style={{ height: "28px", fontSize: "0.7rem" }} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label mb-1">Qtd. máx.</label>
                  <input type="number" className="form-control form-control-sm" value={qtdMaxFilter} onChange={(e) => setQtdMaxFilter(e.target.value)} style={{ height: "28px", fontSize: "0.7rem" }} />
                </div>
              </div>

              {erro && (
                <div className="alert alert-danger py-2 mt-2" role="alert" style={{ fontSize: "0.75rem" }}>{erro}</div>
              )}

              <div className="mt-2" style={{ maxHeight: "58vh", overflowY: "auto" }}>
                <table className="table table-sm table-hover" style={{ fontSize: "0.72rem", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "8%" }}>Filial</th>
                      <th style={{ width: "10%" }}>Cód.</th>
                      <th style={{ width: "14%" }}>Auxiliar</th>
                      <th>Descrição</th>
                      <th style={{ width: "12%" }}>Marca</th>
                      <th className="text-end" style={{ width: "12%" }}>Disp.</th>
                      <th className="text-end" style={{ width: "10%" }}>Reserv.</th>
                      <th className="text-end" style={{ width: "10%" }}>Bloq.</th>
                      <th className="text-end" style={{ width: "10%" }}>Avaria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9}>Carregando...</td></tr>
                    ) : filteredRows.length === 0 ? (
                      <tr><td colSpan={9}>Nenhum item listado</td></tr>
                    ) : (
                      filteredRows.map((r: Row, idx: number) => (
                        <tr key={`${r.CODFILIAL}-${r.CODPROD}-${idx}`}>
                          <td>{String(r.CODFILIAL ?? '')}</td>
                          <td>{String(r.CODPROD ?? '')}</td>
                          <td className="text-truncate">{String(r.CODAUXILIAR ?? '')}</td>
                          <td className="text-truncate">{String(r.DESCRICAO ?? '')}</td>
                          <td className="text-truncate">{String(r.MARCA ?? '')}</td>
                          <td className="text-end">{Number(r.DISPONIVEL ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-end">{Number(r.QTRESERV ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-end">{Number(r.QTBLOQUEADA ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-end">{Number(r.AVARIA ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-gestpro" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProdutosDisponiveisModal;