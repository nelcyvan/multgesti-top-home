import React from "react";
import { atualizarStatusEspecial } from "../../../services/gestlog/MarcarVisualizacao";

type Props = {
  numped: number;
  cliente: string;
  onRefresh?: () => void;
};

const getUsuario = () => {
  try {
    const raw = localStorage.getItem("usuarioLogado");
    if (!raw) return "APP";
    const obj = JSON.parse(raw);
    const nome = (obj?.usuario ?? "").toString().trim();
    return nome || "APP";
  } catch {
    return "APP";
  }
};

export const Faltando: React.FC<Props> = ({ numped, cliente, onRefresh }) => {
  const [showConfirmFalta, setShowConfirmFalta] = React.useState<boolean>(false);
  const [sendingFalta, setSendingFalta] = React.useState<boolean>(false);

  const handleConfirmFalta = async () => {
    if (!Number.isFinite(numped)) return;
    setSendingFalta(true);
    try {
      await atualizarStatusEspecial({
        numped: Number(numped),
        status: 10,
        usuario: getUsuario()
      });
      setShowConfirmFalta(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Erro ao enviar para Falta de Mercadoria:", err);
    } finally {
      setSendingFalta(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-outline-danger btn-gestpro py-0 px-3"
        style={{ fontSize: "0.75rem", height: "24px" }}
        type="button"
        onClick={() => setShowConfirmFalta(true)}
      >
        Faltando
      </button>

      {showConfirmFalta && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4000, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4010 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.95rem" }}>Enviar para Falta de Mercadoria</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={sendingFalta}
                    onClick={() => {
                      if (sendingFalta) return;
                      setShowConfirmFalta(false);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <p className="mb-2">
                    Pedido <strong>{numped}</strong>
                  </p>
                  <p className="mb-3">
                    Cliente <strong>{cliente}</strong>
                  </p>
                  <p className="mb-0">
                    Deseja enviar este pedido para a situação <strong>Falta de Mercadoria (Aguardando Fornecedor)</strong>?
                  </p>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sendingFalta}
                    onClick={() => {
                      if (sendingFalta) return;
                      setShowConfirmFalta(false);
                    }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={sendingFalta}
                    onClick={handleConfirmFalta}
                  >
                    {sendingFalta ? "Enviando..." : "Sim, enviar"}
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

export default Faltando;

