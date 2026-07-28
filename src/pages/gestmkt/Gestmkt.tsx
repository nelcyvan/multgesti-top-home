import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import TopBar from "../../components/TopBar";
import { BarChartLine, Calendar3, ChevronRight, Cpu, GraphDownArrow, Images, LightningChargeFill, MegaphoneFill, Plug, PlusCircle, SlashCircle } from "react-bootstrap-icons";
import ModalCampanhasAtivas from "./ModalCampanhasAtivas";
import ModalProdutosVendaBaixa from "./ModalProdutosVendaBaixa";
import ModalProdutosSemVenda from "./ModalProdutosSemVenda";
import ModalAdicionarProdutoManual from "./ModalAdicionarProdutoManual";

import { appUrl } from "../../utils/appUrl";
interface Usuario {
  usuario?: string;
  matricula?: number;
  codfilial?: string;
}

const Gestmkt: React.FC = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [alertaSucesso, setAlertaSucesso] = useState<string>("");
  const [modalCampanhasAberto, setModalCampanhasAberto] = useState<boolean>(false);
  const [modalVendaBaixaAberto, setModalVendaBaixaAberto] = useState<boolean>(false);
  const [modalSemVendaAberto, setModalSemVendaAberto] = useState<boolean>(false);
  const [modalAddManualAberto, setModalAddManualAberto] = useState<boolean>(false);

  useEffect(() => {
    const dadosSalvos = localStorage.getItem("usuarioLogado");
    if (dadosSalvos) {
      try {
        const raw = JSON.parse(dadosSalvos || '{}');
        const mStr = String(raw?.matricula ?? '').trim();
        const mNum = mStr !== '' && !isNaN(Number(mStr)) ? Number(mStr) : undefined;
        setUsuario({
          ...raw,
          matricula: mNum,
        });
      } catch {
        setUsuario(null);
      }
    }
  }, []);

  // Auto-fecha o alerta de sucesso em 3 segundos
  useEffect(() => {
    if (!alertaSucesso) return;
    const t = setTimeout(() => {
      setAlertaSucesso("");
    }, 3000);
    return () => clearTimeout(t);
  }, [alertaSucesso]);

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
        title="GestMKT" 
        titleClassName="text-primary" 
        showBack={true} 
        backLink={appUrl("/dashboard")}
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
      <div className="container py-3">
        <div className="row g-3">
          {/* Seções principais, replicando padrão de cards do GestFIN */}
          <div className="col-12 col-xl-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary-subtle text-primary flex-shrink-0"
                      style={{ width: 34, height: 34 }}
                    >
                      <MegaphoneFill size={18} />
                    </span>
                    <div className="lh-sm">
                      <div className="fw-semibold">Operações de Marketing</div>
                      <small className="text-muted">Campanhas e performance</small>
                    </div>
                  </div>
                  <span className="badge text-bg-primary">Gestão</span>
                </div>
              </div>
              <div className="card-body p-3">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-dark-subtle text-dark flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <Calendar3 size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Preparar Campanhas</div>
                            <small className="text-muted">Campanhas ativas</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark btn-gestpro d-flex flex-column align-items-end py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalCampanhasAberto(true);
                          }}
                        >
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Campanhas ativas</small>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-info-subtle text-info flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <GraphDownArrow size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Produtos com venda baixa</div>
                            <small className="text-muted">Identificar queda</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info btn-gestpro d-flex flex-column align-items-end py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalVendaBaixaAberto(true);
                          }}
                        >
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Identificar queda</small>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <SlashCircle size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Produtos sem venda</div>
                            <small className="text-muted">Oportunidades</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning btn-gestpro d-flex flex-column align-items-end py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalSemVendaAberto(true);
                          }}
                        >
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Oportunidades</small>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <PlusCircle size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Adicionar produto</div>
                            <small className="text-muted">Manual na campanha</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success btn-gestpro d-flex flex-column align-items-end py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalAddManualAberto(true);
                          }}
                        >
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Manual na campanha</small>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <Cpu size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Automação</div>
                            <small className="text-muted">Fluxos e ações</small>
                          </div>
                        </div>
                        <a className="btn btn-sm btn-outline-primary btn-gestpro d-flex flex-column align-items-end py-1" href="#">
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Fluxos e ações</small>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-2 d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-secondary-subtle text-secondary flex-shrink-0"
                            style={{ width: 32, height: 32 }}
                          >
                            <BarChartLine size={16} />
                          </span>
                          <div className="lh-sm">
                            <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>Relatórios</div>
                            <small className="text-muted">Indicadores</small>
                          </div>
                        </div>
                        <a className="btn btn-sm btn-outline-secondary btn-gestpro d-flex flex-column align-items-end py-1" href="#">
                          <span className="d-inline-flex align-items-center gap-1">
                            <span>Acessar</span>
                            <ChevronRight size={14} />
                          </span>
                          <small className="text-body-secondary">Indicadores</small>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observação */}
                <div className="mt-4">
                  <div className="alert alert-light border py-2 mb-0">
                    <div className="d-flex align-items-center gap-2">
                      <MegaphoneFill size={16} className="text-primary" />
                      <div>
                        <strong>Observação:</strong> Funcionalidades serão integradas à API do GestMKT.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos / Complementares */}
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-3 bg-secondary-subtle text-secondary flex-shrink-0"
                      style={{ width: 34, height: 34 }}
                    >
                      <LightningChargeFill size={18} />
                    </span>
                    <div className="lh-sm">
                      <div className="fw-semibold">Atalhos</div>
                      <small className="text-muted">Acessos rápidos</small>
                    </div>
                  </div>
                  <span className="badge text-bg-secondary">Marketing</span>
                </div>
              </div>
              <hr className="my-0" />
              <div className="card-body p-0">
                <div className="list-group list-group-flush">
                  <a
                    className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-2 px-3 gestmkt-hover"
                    href="#"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle bg-dark-subtle text-dark flex-shrink-0"
                        style={{ width: 32, height: 32 }}
                      >
                        <Images size={16} />
                      </span>
                      <div className="lh-sm">
                        <div className="fw-semibold gestmkt-hover-title" style={{ fontSize: "0.9rem" }}>Biblioteca de Mídia</div>
                        <small className="text-muted">Arquivos e criativos</small>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary flex-shrink-0" />
                  </a>

                  <a
                    className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-2 px-3 gestmkt-hover"
                    href="#"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary flex-shrink-0"
                        style={{ width: 32, height: 32 }}
                      >
                        <Calendar3 size={16} />
                      </span>
                      <div className="lh-sm">
                        <div className="fw-semibold gestmkt-hover-title" style={{ fontSize: "0.9rem" }}>Calendário de Campanhas</div>
                        <small className="text-muted">Agenda e períodos</small>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary flex-shrink-0" />
                  </a>

                  <a
                    className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-2 px-3 gestmkt-hover"
                    href="#"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle bg-secondary-subtle text-secondary flex-shrink-0"
                        style={{ width: 32, height: 32 }}
                      >
                        <Plug size={16} />
                      </span>
                      <div className="lh-sm">
                        <div className="fw-semibold gestmkt-hover-title" style={{ fontSize: "0.9rem" }}>Integrações</div>
                        <small className="text-muted">Conexões e canais</small>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Campanhas Ativas */}
      <ModalCampanhasAtivas
        isOpen={modalCampanhasAberto}
        onClose={() => setModalCampanhasAberto(false)}
      />

      {/* Modal: Produtos com venda Baixa */}
      <ModalProdutosVendaBaixa
        isOpen={modalVendaBaixaAberto}
        onClose={() => setModalVendaBaixaAberto(false)}
        codFilial={usuario?.codfilial}
      />

      {/* Modal: Produtos sem Venda */}
      <ModalProdutosSemVenda
        isOpen={modalSemVendaAberto}
        onClose={() => setModalSemVendaAberto(false)}
        codFilial={usuario?.codfilial}
      />

      {/* Modal: Adicionar Produto Manualmente */}
      <ModalAdicionarProdutoManual
        isOpen={modalAddManualAberto}
        onClose={() => setModalAddManualAberto(false)}
        codFilial={usuario?.codfilial}
        onSuccess={() => setAlertaSucesso("Produto adicionado à campanha.")}
      />
    </div>
  );
};

export default Gestmkt;
