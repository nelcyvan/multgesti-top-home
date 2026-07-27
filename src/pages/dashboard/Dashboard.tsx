// home/multgesti/src/pages/dashboard/Dashboard.tsx
import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import TopBar from "../../components/TopBar";


interface CardOpcao {
  titulo: string;
  descricao: string;
  cor: string;
  onClick?: () => void;
  actions?: { label: string; onClick: () => void; className?: string }[];
}



const Dashboard: React.FC = () => {
  const [showResumo, setShowResumo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Campos do formulário (padrão 0.7rem / altura 28px via CSS global)
  const [recnum, setRecnum] = useState<string>("");
  const [recPrinc, setRecPrinc] = useState<string>("");
  const [filial, setFilial] = useState<string>("");
  const [tipoLanc, setTipoLanc] = useState<string>("");
  const [tipoServico, setTipoServico] = useState<string>("");
  const [tipoParceiro, setTipoParceiro] = useState<string>("");
  const [tipoNota, setTipoNota] = useState<string>("");
  const [codConta, setCodConta] = useState<string>("");
  const [contaNome, setContaNome] = useState<string>("");
  const [codFornec, setCodFornec] = useState<string>("");
  const [fornecNome, setFornecNome] = useState<string>("");
  const [dtInicio, setDtInicio] = useState<string>("");
  const [dtFinal, setDtFinal] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [numeroNota, setNumeroNota] = useState<string>("");

  const cards: CardOpcao[] = [
    {
      titulo: "GestMKT",
      descricao: "Gerencie marketing e campanhas",
      cor: "primary",
      onClick: () => (window.location.href = "/gestmkt/permissao"),
    },
    {
      titulo: "Chat Hub",
      descricao: "Acesse suas Mensagens",
      cor: "success",
      onClick: () => (window.location.href = "/zaphub/permissao"),
    },
    {
      titulo: "GestLOG",
      descricao: "Gerencie rotas e entregas",
      cor: "warning",
      onClick: () => (window.location.href = "/gestlog/permissao"),
    },
    {
      titulo: "GestPRO",
      descricao: "Acesse o sistema GesPRO",
      cor: "info",
      actions: [
        { label: "GestPRO", onClick: () => (window.location.href = "/gestpro/permissao") },
        { label: "GestOPER", onClick: () => (window.location.href = "/gestoper") },
        { label: "GestVENDAS", onClick: () => (window.location.href = "/gestvendas") },
      ],
    },
    {
      titulo: "GestFIN",
      descricao: "Gestão financeira e conciliações",
      cor: "secondary",
      onClick: () => (window.location.href = "/gestfin/permissao"),
    },
    {
      titulo: "Concilia",
      descricao: "Conciliar informações de Fechamento",
      cor: "danger",
      onClick: () => (window.location.href = "/ofxconcilia/permissao"),
    },
  ];

  return (
    <div
      className="d-flex flex-column"
      style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
      }}
    >
      {/* Header */}
      <TopBar />

      <div className="container py-4 flex-grow-1 d-flex flex-column justify-content-center">

        {/* Cards de opções */}
        <div className="row g-4 justify-content-center">
          {cards.map((card, index) => (
            <div key={index} className="col-12 col-md-6 col-lg-4">
              <div
                className={`card h-100 shadow-sm border-0`}
                style={{ 
                  cursor: "pointer", 
                  borderRadius: "10px",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  overflow: "hidden"
                }}
                onClick={card.onClick}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 0.125rem 0.25rem rgba(0,0,0,0.075)";
                }}
              >
                <div className={`card-header bg-${card.cor} text-white py-3 d-flex align-items-center`}>
                  <h5 className="card-title fw-semibold m-0">{card.titulo}</h5>
                </div>
                <div className="card-body">
                  <p className="card-text">{card.descricao}</p>
                  {card.actions ? (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {card.actions.map((act, i) => (
                        <button
                          key={i}
                          className={`btn btn-outline-${card.cor} btn-gestpro flex-grow-1`}
                          style={{ fontSize: "0.8rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            act.onClick();
                          }}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button className={`btn btn-outline-${card.cor} btn-gestpro mt-2`}>
                      Acessar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}


        </div>

        {/* Modal: Resumo de Pendências */}
        {showResumo && (
          <>
            <div className="modal-backdrop fade show" style={{ zIndex: 2995 }}></div>
            <div className="modal fade show" style={{ display: "block", zIndex: 3000 }} aria-modal="true" role="dialog">
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "720px" }}>
                <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                  <div className="modal-header">
                    <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Resumo de Pendências</h5>
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowResumo(false)}></button>
                  </div>
                  <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
                    {erro && (<div className="alert alert-danger mb-2">{erro}</div>)}
                    {sucesso && (<div className="alert alert-success mb-2">{sucesso}</div>)}

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label">Recnum</label>
                        <input className="form-control form-control-sm" value={recnum} onChange={(e) => setRecnum(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Rec. Princ.</label>
                        <input className="form-control form-control-sm" value={recPrinc} onChange={(e) => setRecPrinc(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Filial</label>
                        <select className="form-select form-select-sm" value={filial} onChange={(e) => setFilial(e.target.value)} style={{ fontSize: "0.7rem" }}>
                          <option value="">Selecione</option>
                          <option value="Matriz">Matriz</option>
                          <option value="Filial-01">Filial 01</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Tipo Lanç.</label>
                        <select className="form-select form-select-sm" value={tipoLanc} onChange={(e) => setTipoLanc(e.target.value)} style={{ fontSize: "0.7rem" }}>
                          <option value="">Selecione</option>
                          <option value="P">Pagar</option>
                          <option value="R">Receber</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Tipo Serviço</label>
                        <select className="form-select form-select-sm" value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} style={{ fontSize: "0.7rem" }}>
                          <option value="">Selecione</option>
                          <option value="Frete">Frete</option>
                          <option value="Produto">Produto</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Tipo Parceiro</label>
                        <select className="form-select form-select-sm" value={tipoParceiro} onChange={(e) => setTipoParceiro(e.target.value)} style={{ fontSize: "0.7rem" }}>
                          <option value="">Selecione</option>
                          <option value="Fornecedor">Fornecedor</option>
                          <option value="Cliente">Cliente</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Tipo de Nota</label>
                        <select className="form-select form-select-sm" value={tipoNota} onChange={(e) => setTipoNota(e.target.value)} style={{ fontSize: "0.7rem" }}>
                          <option value="">Selecione</option>
                          <option value="NF">NF</option>
                          <option value="NFE">NFE</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Cod. Conta</label>
                        <div className="input-group input-group-sm">
                          <input className="form-control form-control-sm" value={codConta} onChange={(e) => setCodConta(e.target.value)} style={{ fontSize: "0.7rem" }} />
                          <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => setContaNome("Conta Exemplo")}>Buscar</button>
                        </div>
                        {contaNome && (
                          <small className="text-muted d-block mt-1 text-truncate" title={contaNome}>{contaNome}</small>
                        )}
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Cod. Fornec</label>
                        <div className="input-group input-group-sm">
                          <input className="form-control form-control-sm" value={codFornec} onChange={(e) => setCodFornec(e.target.value)} style={{ fontSize: "0.7rem" }} />
                          <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => setFornecNome("Fornecedor Exemplo")}>Buscar</button>
                        </div>
                        {fornecNome && (
                          <small className="text-muted d-block mt-1 text-truncate" title={fornecNome}>{fornecNome}</small>
                        )}
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label">Início</label>
                        <input type="date" className="form-control form-control-sm" value={dtInicio} onChange={(e) => setDtInicio(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Final</label>
                        <input type="date" className="form-control form-control-sm" value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Valor</label>
                        <input type="number" className="form-control form-control-sm" value={valor} onChange={(e) => setValor(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Número Nota</label>
                        <input className="form-control form-control-sm" value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} style={{ fontSize: "0.7rem" }} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
                    <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => setShowResumo(false)}>Fechar</button>
                    <button type="button" className="btn btn-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => { setSalvando(true); setErro(null); setSucesso(null); setTimeout(() => { setSalvando(false); setSucesso("Filtros aplicados com sucesso."); }, 800); }} disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Rodapé */}
        <footer className="mt-5 pt-4 border-top">
          <div className="row justify-content-center">
            <div className="col-md-5 mb-3 mb-md-0">
              <h5 className="text-primary mb-3">GestFácil</h5>
              <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                Plataforma integrada de gestão empresarial para otimizar seus processos e aumentar a produtividade.
              </p>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <h6 className="text-dark mb-3">Links Rápidos</h6>
              <ul className="list-unstyled">
                <li className="mb-2"><a href="#" className="text-decoration-none text-muted">Suporte</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none text-muted">Documentação</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none text-muted">Treinamentos</a></li>
              </ul>
            </div>
            <div className="col-md-3">
              <h6 className="text-dark mb-3">Contato</h6>
              <ul className="list-unstyled">
                <li className="mb-2 text-muted" style={{ fontSize: "0.9rem" }}>gestfacil.com.br</li>
                <li className="mb-2 text-muted" style={{ fontSize: "0.9rem" }}>(85) 9.9815-1684</li>
              </ul>
            </div>
          </div>
          <div className="text-center mt-4 pb-3">
            <p className="text-muted" style={{ fontSize: "0.8rem" }}>
              © 2025 GestFácil. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
