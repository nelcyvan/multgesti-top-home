import React, { useEffect, useState } from "react";
import { salvarNovaConta, type NovaContaPayload } from "../../services/gestfin/SalvarNovaConta";
import { buscarUltimoCodConta } from "../../services/gestfin/BuscarUltimoCodConta";
import { buscarGruposConta, type GrupoContaItem } from "../../services/gestfin/BuscarGruposConta";

interface ModalNovaContaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (novaConta: { CODCONTA: number; CONTA: string }) => void;
}

const ModalNovaConta: React.FC<ModalNovaContaProps> = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState<NovaContaPayload>({
    CODCONTA: 0,
    CONTA: "",
    GRUPOCONTA: 0,
    TIPO: "",
    INVESTIMENTO: "",
    USARATEIOCENTROCUSTO: "",
    RESTRINGIRNOBALANCETE: "",
    UTILIZACENTROCUSTORESTRITO: "",
    FIXAVARIAVEL: "",
  });
  const [erro, setErro] = useState<string>("");
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucesso, setSucesso] = useState<string>("");
  const [showBuscaGrupo, setShowBuscaGrupo] = useState<boolean>(false);
  const [loadingGrupos, setLoadingGrupos] = useState<boolean>(false);
  const [grupos, setGrupos] = useState<GrupoContaItem[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const ultimo = await buscarUltimoCodConta();
        setForm(prev => ({ ...prev, CODCONTA: ultimo }));
      } catch (err) {
        console.error("Falha ao obter último CODCONTA:", err);
      }
    })();
  }, [isOpen]);

  const handleInputChange = (field: keyof NovaContaPayload, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErro(""); // Limpa erro ao digitar
    setSucesso(""); // Limpa sucesso ao digitar
  };

  const abrirBuscaGrupo = async () => {
    setShowBuscaGrupo(true);
    setLoadingGrupos(true);
    setErro("");
    try {
      const lista = await buscarGruposConta();
      setGrupos(lista);
    } catch (e: any) {
      setErro(e?.message || "Falha ao buscar grupos de contas");
    } finally {
      setLoadingGrupos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!form.CODCONTA || form.CODCONTA <= 0) {
      setErro("Código da conta é obrigatório e deve ser maior que zero");
      return;
    }
    
    if (!form.CONTA.trim()) {
      setErro("Nome da conta é obrigatório");
      return;
    }
    
    if (!form.GRUPOCONTA || form.GRUPOCONTA <= 0) {
      setErro("Grupo da conta é obrigatório e deve ser maior que zero");
      return;
    }

    // Validações dos seletores obrigatórios
    if (!form.TIPO) {
      setErro("Selecione o Tipo da conta");
      return;
    }
    if (!form.INVESTIMENTO) {
      setErro("Selecione se é Investimento");
      return;
    }
    if (!form.USARATEIOCENTROCUSTO) {
      setErro("Selecione se usa Rateio de Centro de Custo");
      return;
    }
    if (!form.RESTRINGIRNOBALANCETE) {
      setErro("Selecione se restringe no Balancete");
      return;
    }
    if (!form.UTILIZACENTROCUSTORESTRITO) {
      setErro("Selecione se utiliza Centro de Custo Restrito");
      return;
    }
    if (!form.FIXAVARIAVEL) {
      setErro("Selecione se é Fixa ou Variável");
      return;
    }

    try {
      setSalvando(true);
      setErro("");
      
      const response = await salvarNovaConta(form);
      
      if (response.success) {
        setSucesso(`Conta criada com sucesso! Código: ${form.CODCONTA}`);
        
        // Notifica o componente pai sobre o sucesso
        if (onSuccess) {
          onSuccess({
            CODCONTA: form.CODCONTA,
            CONTA: form.CONTA
          });
        }
        
        // Fecha o modal após um breve delay
        setTimeout(() => {
          onClose();
          // Reset form
          setForm({
            CODCONTA: 0,
            CONTA: "",
            GRUPOCONTA: 0,
            TIPO: "",
            INVESTIMENTO: "",
            USARATEIOCENTROCUSTO: "",
            RESTRINGIRNOBALANCETE: "",
            UTILIZACENTROCUSTORESTRITO: "",
            FIXAVARIAVEL: "",
          });
          setSucesso("");
        }, 1500);
      } else {
        setErro(response.message || "Erro ao criar conta");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao criar conta";
      setErro(errorMessage);
    } finally {
      setSalvando(false);
    }
  };

  const handleClose = () => {
    setErro("");
    setSucesso("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 4995, backgroundColor: "rgba(0,0,0,0.5)" }} />

      {/* Modal */}
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 5000 }}>
        <div className="modal-dialog modal-md modal-dialog-centered" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Nova Conta</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={handleClose} />
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                {erro && (
                  <div className="alert alert-danger py-2" role="alert">
                    {erro}
                  </div>
                )}
                
                {sucesso && (
                  <div className="alert alert-success py-2" role="alert">
                    {sucesso}
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Código da Conta *</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={form.CODCONTA || ""}
                      readOnly
                      disabled
                      required
                      min="1"
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Grupo da Conta *</label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={form.GRUPOCONTA || ""}
                        readOnly
                        disabled
                        required
                        min="1"
                        style={{ fontSize: "0.7rem", height: "28px" }}
                      />
                      <button type="button" className="btn btn-outline-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={abrirBuscaGrupo}>Buscar</button>
                    </div>
                    {grupoSelecionado && (
                      <small className="text-muted" style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>
                        {grupoSelecionado}
                      </small>
                    )}
                  </div>
                  
                  <div className="col-12">
                    <label className="form-label">Nome da Conta *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={form.CONTA}
                      onChange={(e) => handleInputChange("CONTA", e.target.value)}
                      required
                      maxLength={100}
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Tipo *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.TIPO}
                      onChange={(e) => handleInputChange("TIPO", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="A">Ativo</option>
                      <option value="P">Passivo</option>
                      <option value="R">Receita</option>
                      <option value="D">Despesa</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Investimento *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.INVESTIMENTO}
                      onChange={(e) => handleInputChange("INVESTIMENTO", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="N">Não</option>
                      <option value="S">Sim</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Usar Rateio Centro Custo *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.USARATEIOCENTROCUSTO}
                      onChange={(e) => handleInputChange("USARATEIOCENTROCUSTO", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="N">Não</option>
                      <option value="S">Sim</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Restringir no Balancete *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.RESTRINGIRNOBALANCETE}
                      onChange={(e) => handleInputChange("RESTRINGIRNOBALANCETE", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="N">Não</option>
                      <option value="S">Sim</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Utiliza Centro Custo Restrito *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.UTILIZACENTROCUSTORESTRITO}
                      onChange={(e) => handleInputChange("UTILIZACENTROCUSTORESTRITO", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="N">Não</option>
                      <option value="S">Sim</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Fixa/Variável *</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.FIXAVARIAVEL}
                      onChange={(e) => handleInputChange("FIXAVARIAVEL", e.target.value)}
                      required
                      style={{ fontSize: "0.7rem", height: "28px" }}
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="F">Fixa</option>
                      <option value="V">Variável</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
                <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleClose}>
                  Fechar
                </button>
                <button type="submit" className="btn btn-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showBuscaGrupo && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4998, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 5001 }}>
            <div className="modal-dialog modal-md modal-dialog-centered" role="document">
              <div className="modal-content" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Selecionar Grupo de Conta</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowBuscaGrupo(false)} />
                </div>
                <div className="modal-body">
                  <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
                    <table className="table table-sm table-hover" style={{ fontSize: "0.7rem" }}>
                      <thead>
                        <tr>
                          <th style={{ width: 100 }}>Código</th>
                          <th>Grupo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map((g) => (
                          <tr key={`grupo-${g.CODGRUPO}`} style={{ cursor: "pointer" }}
                              onClick={() => { setForm(prev => ({ ...prev, GRUPOCONTA: g.CODGRUPO })); setGrupoSelecionado(g.GRUPO); setShowBuscaGrupo(false); }}>
                            <td>{g.CODGRUPO}</td>
                            <td>{g.GRUPO}</td>
                          </tr>
                        ))}
                        {!loadingGrupos && grupos.length === 0 && (
                          <tr>
                            <td colSpan={2} className="text-muted">Nenhum grupo encontrado</td>
                          </tr>
                        )}
                        {loadingGrupos && (
                          <tr>
                            <td colSpan={2}>Carregando grupos...</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => setShowBuscaGrupo(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </>
  );
};

export default ModalNovaConta;