import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import TopBar from "../../components/TopBar";
import ModaCarteiraCliente from "./ModaCarteiraCliente";
import BuscarLancamentosApagar from "./BuscarLancamentosApagar";
import BuscarLancamentosAreceber from "./areceber/BuscarLancamentosAreceber";
import ModalNovoLancamento from "./ModalNovoLancamento";

interface Usuario {
  usuario?: string;
  matricula?: string;
  codfilial?: string;
}

const Gestfin: React.FC = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modalCarteiraAberto, setModalCarteiraAberto] = useState<boolean>(false);
  const [modalApagarAberto, setModalApagarAberto] = useState<boolean>(false);
  const [modalAreceberAberto, setModalAreceberAberto] = useState<boolean>(false);
  const [modalNovoLancAberto, setModalNovoLancAberto] = useState<boolean>(false);
  const [alertaSucesso, setAlertaSucesso] = useState<string>("");

  useEffect(() => {
    const dadosSalvos = localStorage.getItem("usuarioLogado");
    if (dadosSalvos) setUsuario(JSON.parse(dadosSalvos));
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
      }}
    >
      {/* Header */}
      <TopBar 
        title="GestFIN" 
        titleClassName="" 
        showBack={true} 
        backLink="/dashboard"
      />

      {/* Alerta global de sucesso */}
      {alertaSucesso && (
        <div className="container mt-3">
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {alertaSucesso}
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setAlertaSucesso("")}
            />
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="container py-4">
        <div className="row g-4">
          {/* Seções principais, replicando padrão de cards do GestPRO */}
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Operações Financeiras</h5>
                <span className="badge bg-primary">Gestão</span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Conciliação Carteira Cliente</small>
                        <h5 className="text-dark mt-1 mb-3">—</h5>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark btn-gestpro mt-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalCarteiraAberto(true);
                          }}
                        >
                          Acessar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Importação OFX</small>
                        <h5 className="text-info mt-1 mb-3">—</h5>
                        <a className="btn btn-sm btn-outline-info btn-gestpro mt-auto" href="#">Acessar</a>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Provisões</small>
                        <h5 className="text-warning mt-1 mb-3">—</h5>
                        <a className="btn btn-sm btn-outline-warning btn-gestpro mt-auto" href="#">Acessar</a>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Novo Lançamento</small>
                        <h5 className="text-success mt-1 mb-3">—</h5>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success btn-gestpro mt-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalNovoLancAberto(true);
                          }}
                        >
                          Acessar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Gerir lançamentos à Receber</small>
                        <h5 className="text-primary mt-1 mb-3">—</h5>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary btn-gestpro mt-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalAreceberAberto(true);
                          }}
                        >
                          Acessar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body d-flex flex-column">
                        <small className="text-muted">Gerir lançamentos à Pagar</small>
                        <h5 className="text-danger mt-1 mb-3">—</h5>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger btn-gestpro mt-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalApagarAberto(true);
                          }}
                        >
                          Acessar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observação */}
                <div className="mt-4">
                  <div className="alert alert-light border">
                    <div className="d-flex align-items-center">
                      <span className="me-2">🧮</span>
                      <div>
                        <strong>Observação:</strong> Funcionalidades serão integradas à API do GestFIN.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos / Complementares */}
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Atalhos</h5>
                <span className="badge bg-secondary">Financeiro</span>
              </div>
              <div className="card-body">
                <div className="card border-0 bg-light mb-3">
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-muted">Exportações</small>
                      <h6 className="text-dark mt-1 mb-0">—</h6>
                    </div>
                    <a className="btn btn-sm btn-outline-dark btn-gestpro" href="#">Acessar</a>
                  </div>
                </div>

                <div className="card border-0 bg-light mb-3">
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-muted">Relatórios</small>
                      <h6 className="text-primary mt-1 mb-0">—</h6>
                    </div>
                    <a className="btn btn-sm btn-outline-primary btn-gestpro" href="#">Acessar</a>
                  </div>
                </div>

                <div className="card border-0 bg-light">
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-muted">Integrações</small>
                      <h6 className="text-secondary mt-1 mb-0">—</h6>
                    </div>
                    <a className="btn btn-sm btn-outline-secondary btn-gestpro" href="#">Acessar</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-top mt-4">
        <div className="container py-3 d-flex justify-content-between align-items-center">
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            © 2025 GestFácil. GestFIN
          </span>
          <a href="/dashboard" className="text-decoration-none">Voltar ao Dashboard</a>
        </div>
      </footer>

      {/* Modal: Conciliação Carteira Cliente */}
      <ModaCarteiraCliente
        isOpen={modalCarteiraAberto}
        onClose={() => setModalCarteiraAberto(false)}
      />
      <BuscarLancamentosApagar
        isOpen={modalApagarAberto}
        onClose={() => setModalApagarAberto(false)}
      />
      {/* Modal: Lançamentos à Receber */}
      <BuscarLancamentosAreceber
        isOpen={modalAreceberAberto}
        onClose={() => setModalAreceberAberto(false)}
      />
      <ModalNovoLancamento
        isOpen={modalNovoLancAberto}
        onClose={() => setModalNovoLancAberto(false)}
        nomeFunc={usuario?.usuario}
        onSuccess={(recnum) => {
          // Define a mensagem e garante que o modal seja fechado
          setModalNovoLancAberto(false);
          setAlertaSucesso(`Registro inserido com sucesso. RECNUM: ${recnum}`);
        }}
      />
    </div>
  );
};

export default Gestfin;