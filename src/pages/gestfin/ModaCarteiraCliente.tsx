import React, { useEffect, useMemo, useState } from "react";
import { buscarCarteiraCliente, buscarUsuarioPorCodigo, vincularUsuarioPrestacao } from "../../services/gestfin/Gestfin";
import type { CarteiraClienteRow, UsuarioRow } from "../../services/gestfin/Gestfin";

interface ModaCarteiraClienteProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModaCarteiraCliente: React.FC<ModaCarteiraClienteProps> = ({ isOpen, onClose }) => {
  const [codigoCliente, setCodigoCliente] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const yyyy = inicioMes.getFullYear();
    const mm = String(inicioMes.getMonth() + 1).padStart(2, "0");
    const dd = String(inicioMes.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [dataFinal, setDataFinal] = useState<string>(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string>("");
  const [resultados, setResultados] = useState<CarteiraClienteRow[]>([]);

  // Modal de conciliação
  const [conciliarOpen, setConciliarOpen] = useState<boolean>(false);
  const [registroSelecionado, setRegistroSelecionado] = useState<CarteiraClienteRow | null>(null);
  const [novoCodUsuario, setNovoCodUsuario] = useState<string>("");
  const [novoUsuario, setNovoUsuario] = useState<UsuarioRow | null>(null);
  const [buscandoUsuario, setBuscandoUsuario] = useState<boolean>(false);
  const [erroUsuario, setErroUsuario] = useState<string>("");
  const [vinculando, setVinculando] = useState<boolean>(false);
  const [erroVinculo, setErroVinculo] = useState<string>("");
  const [sucessoVinculo, setSucessoVinculo] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setCodigoCliente("");
      const hoje = new Date();
      const yyyyF = hoje.getFullYear();
      const mmF = String(hoje.getMonth() + 1).padStart(2, "0");
      const ddF = String(hoje.getDate()).padStart(2, "0");
      setDataFinal(`${yyyyF}-${mmF}-${ddF}`);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const yyyyI = inicioMes.getFullYear();
      const mmI = String(inicioMes.getMonth() + 1).padStart(2, "0");
      const ddI = String(inicioMes.getDate()).padStart(2, "0");
      setDataInicio(`${yyyyI}-${mmI}-${ddI}`);
      setErro("");
      setResultados([]);
      setCarregando(false);
      // Reset modal de conciliação
      setConciliarOpen(false);
      setRegistroSelecionado(null);
      setNovoCodUsuario("");
      setNovoUsuario(null);
      setErroUsuario("");
      setBuscandoUsuario(false);
    }
  }, [isOpen]);

  const titulo = useMemo(() => "Conciliação Carteira Cliente", []);

  const onBuscar = async () => {
    setErro("");
    const codigo = Number(codigoCliente);
    if (!codigoCliente.trim()) {
      setErro("Informe o código do cliente");
      return;
    }
    if (!Number.isFinite(codigo)) {
      setErro("Código do cliente deve ser numérico");
      return;
    }
    if (!dataInicio || !dataFinal) {
      setErro("Informe as datas de início e final");
      return;
    }

    try {
      setCarregando(true);

      // Assumimos filial padrão 1; pode ser ajustado conforme necessidade
      const codigoFilial = 1;

      const data = await buscarCarteiraCliente({
        codigoCliente: codigo,
        dataInicio,
        dataFinal,
        codigoFilial,
      });
      setResultados(data);
    } catch (e) {
      setErro("Falha ao buscar carteira do cliente");
    } finally {
      setCarregando(false);
    }
  };

  const abrirConciliar = (reg: CarteiraClienteRow) => {
    setRegistroSelecionado(reg);
    setConciliarOpen(true);
    setNovoCodUsuario("");
    setNovoUsuario(null);
    setErroUsuario("");
    setErroVinculo("");
    setSucessoVinculo("");
    setVinculando(false);
  };

  const buscarNovoUsuario = async () => {
    setErroUsuario("");
    const cod = Number(novoCodUsuario);
    if (!novoCodUsuario.trim()) {
      setErroUsuario("Informe o novo código de usuário");
      return;
    }
    if (!Number.isFinite(cod)) {
      setErroUsuario("Código de usuário deve ser numérico");
      return;
    }
    try {
      setBuscandoUsuario(true);
      const usuario = await buscarUsuarioPorCodigo(cod);
      if (!usuario) {
        setErroUsuario("Usuário não encontrado");
      } else {
        setNovoUsuario(usuario);
      }
    } catch (e) {
      setErroUsuario("Falha ao buscar usuário");
    } finally {
      setBuscandoUsuario(false);
    }
  };

  const vincularUsuario = async () => {
    if (!registroSelecionado || !novoUsuario) {
      setErroVinculo("Selecione um novo usuário antes de vincular");
      return;
    }

    setErroVinculo("");
    setSucessoVinculo("");
    try {
      setVinculando(true);
      const rows = await vincularUsuarioPrestacao({
        CODUSUR_BIND: novoUsuario.CODUSUR,
        DUPLIC_BIND: registroSelecionado.DUPLIC,
        PREST_BIND: registroSelecionado.PREST,
        CODFILIAL_BIND: registroSelecionado.CODFILIAL,
        CODCLI_BIND: registroSelecionado.CODCLI,
      });
      if (rows > 0) {
        setSucessoVinculo("Vínculo realizado com sucesso.");
        setRegistroSelecionado({ ...registroSelecionado, CODUSUR: novoUsuario.CODUSUR, NOME: novoUsuario.NOME });
        setResultados((prev) => prev.map((r) => {
          if (r.CODCLI === registroSelecionado.CODCLI && r.DUPLIC === registroSelecionado.DUPLIC && r.PREST === registroSelecionado.PREST && r.CODFILIAL === registroSelecionado.CODFILIAL) {
            return { ...r, CODUSUR: novoUsuario.CODUSUR, NOME: novoUsuario.NOME };
          }
          return r;
        }));
      } else {
        setErroVinculo("Nenhuma linha atualizada. Verifique os filtros.");
      }
    } catch (e) {
      setErroVinculo("Falha ao vincular usuário");
    } finally {
      setVinculando(false);
    }
  };

  const fecharConciliar = async () => {
    setConciliarOpen(false);
    // Atualiza a lista no modal principal usando os filtros atuais
    try {
      await onBuscar();
    } catch {
      // onBuscar já trata estados/erros internamente
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />

      {/* Modal centralizado */}
      <div
        className="modal fade show"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalCarteiraTitulo"
        style={{ display: "block", zIndex: 1050 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="modalCarteiraTitulo">{titulo}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="row g-3 mb-3 align-items-end">
                <div className="col-12 col-lg-4">
                  <label htmlFor="codigoCliente" className="form-label">Código do cliente</label>
                  <div className="input-group">
                    <input
                      id="codigoCliente"
                      type="text"
                      className={`form-control ${erro ? "is-invalid" : ""}`}
                      placeholder="Ex.: 12345"
                      value={codigoCliente}
                      onChange={(e) => setCodigoCliente(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={onBuscar}
                      disabled={carregando}
                    >
                      {carregando ? "Buscando..." : "Buscar"}
                    </button>
                    {erro && <div className="invalid-feedback">{erro}</div>}
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label htmlFor="dataInicio" className="form-label">Data Início</label>
                  <input
                    id="dataInicio"
                    type="date"
                    className={`form-control ${!dataInicio && erro ? "is-invalid" : ""}`}
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label htmlFor="dataFinal" className="form-label">Data Final</label>
                  <input
                    id="dataFinal"
                    type="date"
                    className={`form-control ${!dataFinal && erro ? "is-invalid" : ""}`}
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h6 className="mb-2">Resultados</h6>
                {resultados.length === 0 ? (
                  <div className="alert alert-light border">Nenhum resultado.</div>
                ) : (
                  <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    <ul className="list-group">
                      {resultados.map((r, idx) => (
                        <li key={`${r.CODCLI}-${r.DUPLIC}-${r.PREST}-${idx}`} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-semibold">#{r.CODCLI} — {r.CLIENTE}</div>
                              <small className="text-muted">Cobrança: {r.COBRANCA} · Usuário: {r.CODUSUR} · {r.NOME}</small>
                            </div>
                            <div className="text-end">
                              <div className="badge bg-light text-dark border">Emissão: {r.DTEMISSAO}</div>
                              <div className="badge bg-light text-dark border ms-1">Pagamento: {r.DTPAGTO}</div>
                            </div>
                          </div>
                          <div className="mt-2 d-flex justify-content-between align-items-center">
                            <div>
                              <small className="text-muted">Duplicata: {r.DUPLIC} · Parcela: {r.PREST}</small>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-secondary">{Number(r.VALOR).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => abrirConciliar(r)}>Conciliar</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" onClick={onClose} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
      {conciliarOpen && registroSelecionado && (
        <>
          {/* Backdrop for conciliar modal */}
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
          <div
            className="modal fade show"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modalConciliarTitulo"
            style={{ display: "block", zIndex: 1070 }}
          >
            <div className="modal-dialog modal-md modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="modalConciliarTitulo">Conciliar título</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={fecharConciliar} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <div className="fw-semibold">#{registroSelecionado.CODCLI} — {registroSelecionado.CLIENTE}</div>
                    <small className="text-muted">Cobrança: {registroSelecionado.COBRANCA} · Usuário atual: {registroSelecionado.CODUSUR} · {registroSelecionado.NOME}</small>
                    <div className="mt-2 d-flex justify-content-between">
                      <span className="badge bg-light text-dark border">Emissão: {registroSelecionado.DTEMISSAO}</span>
                      <span className="badge bg-light text-dark border">Pagamento: {registroSelecionado.DTPAGTO}</span>
                    </div>
                    <div className="mt-2 d-flex justify-content-between">
                      <small className="text-muted">Duplicata: {registroSelecionado.DUPLIC} · Parcela: {registroSelecionado.PREST}</small>
                      <span className="badge bg-secondary">{Number(registroSelecionado.VALOR).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="novoCodUsuario" className="form-label">Novo Código de Usuário</label>
                    <div className="input-group">
                      <input
                        id="novoCodUsuario"
                        type="text"
                        className={`form-control ${erroUsuario ? "is-invalid" : ""}`}
                        placeholder="Ex.: 60"
                        value={novoCodUsuario}
                        onChange={(e) => setNovoCodUsuario(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={buscarNovoUsuario}
                        disabled={buscandoUsuario}
                      >
                        {buscandoUsuario ? "Buscando..." : "Buscar"}
                      </button>
                      {erroUsuario && <div className="invalid-feedback">{erroUsuario}</div>}
                    </div>
                    {novoUsuario && (
                      <div className="alert alert-success mt-2 py-2 mb-0">
                        <strong>Novo Usuário:</strong> {novoUsuario.CODUSUR} · {novoUsuario.NOME}
                      </div>
                    )}
                    {erroVinculo && (
                      <div className="alert alert-danger mt-2 py-2 mb-0">{erroVinculo}</div>
                    )}
                    {sucessoVinculo && (
                      <div className="alert alert-success mt-2 py-2 mb-0">{sucessoVinculo}</div>
                    )}
                  </div>
                </div>
                <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary btn-sm py-1 px-2" onClick={fecharConciliar} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>Fechar</button>
                  <button type="button" className="btn btn-success" onClick={vincularUsuario} disabled={!novoUsuario || vinculando}>
                    {vinculando ? "Vinculando..." : "Vincular"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ModaCarteiraCliente;