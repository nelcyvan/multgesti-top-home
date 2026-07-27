import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { PersonCircle, BoxArrowRight, House } from "react-bootstrap-icons";

interface Usuario {
  usuario?: string;
  matricula?: string;
  codfilial?: string;
  // Allow other properties just in case
  [key: string]: any;
}

interface TopBarProps {
  title?: string;
  titleClassName?: string;
  children?: React.ReactNode;
  showBack?: boolean;
  backLink?: string;
  actions?: React.ReactNode;
}

const TopBar: React.FC<TopBarProps> = ({ 
  title = "Portal GestFácil", 
  titleClassName = "text-primary d-none d-md-block",
  children, 
  showBack = false, 
  backLink = "/dashboard",
  actions
}) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const dadosSalvos = localStorage.getItem("usuarioLogado");
    if (dadosSalvos) {
      try {
        setUsuario(JSON.parse(dadosSalvos));
      } catch (e) {
        console.error("Erro ao fazer parse do usuario", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "/";
  };

  return (
    <header className="bg-white flex-shrink-0" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="container-fluid px-4">
        <div className="d-flex justify-content-between align-items-center py-3">
          <div className="d-flex align-items-center">
             <h1 className={`h4 m-0 ${titleClassName}`}>{title}</h1>
             {children}
          </div>
          
          <div className="d-flex align-items-center position-relative">
            <div className="position-relative me-3">
              <button 
                className="btn btn-link text-decoration-none d-flex align-items-center p-0"
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{ color: 'inherit' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2 d-none d-md-block text-secondary">
                    {usuario?.usuario || "Usuário"}
                  </span>
                  <PersonCircle size={32} className="text-primary" />
                </div>
              </button>

              {showUserMenu && (
                <div 
                  className="dropdown-menu show position-absolute end-0 mt-2 shadow border-0" 
                  style={{ 
                    top: '100%', 
                    zIndex: 1050, 
                    minWidth: '280px',
                    borderRadius: '12px'
                  }}
                >
                  {usuario ? (
                    <>
                      <div className="px-4 py-3 bg-light border-bottom rounded-top">
                        <h6 className="fw-bold text-primary mb-1">{usuario.usuario}</h6>
                        <small className="text-muted">Portal GestFácil</small>
                      </div>
                      <div className="p-2">
                        <div className="px-3 py-2">
                          <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>MATRÍCULA</small>
                          <span className="fw-medium">{usuario.matricula || "-"}</span>
                        </div>
                        <div className="px-3 py-2">
                          <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>FILIAL</small>
                          <span className="fw-medium">{usuario.codfilial || "Matriz"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 text-center text-muted">
                      Usuário não identificado
                    </div>
                  )}
                </div>
              )}
            </div>

            {showBack && (
              <a className="btn btn-outline-secondary ms-3 d-flex align-items-center justify-content-center" href={backLink} title="Voltar" style={{ width: '38px', height: '38px', padding: 0 }}>
                <House size={20} />
              </a>
            )}

            {actions && (
              <div className="ms-3">
                {actions}
              </div>
            )}

            <button 
              className="btn btn-outline-danger ms-3 d-flex align-items-center justify-content-center"
              onClick={handleLogout}
              title="Sair"
              style={{ width: '38px', height: '38px', padding: 0 }}
            >
              <BoxArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
