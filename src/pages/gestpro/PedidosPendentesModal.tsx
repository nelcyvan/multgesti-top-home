import React from "react";

export interface PendenciaGestproRow {
  NUMPED: number;
  NUMPEDENTFUT?: number;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  DATA: string;
  CODUSUR: number;
  LOG2: string;
  LOG2_REAL?: string;
  TIPOENTREGA?: string;
  CODFILIALRETIRA?: string;
  POSICAO: string;
  CODPROD: number;
  QT: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  MULTIPLO?: number;
  EMBALAGEMMASTER?: string | number;
  QTD_TOTAL?: string;
  MOTIVO_CORTE?: string;
  NOME?: string;
  ENDERENT?: string;
  NUMEROENT?: string;
  BAIRROENT?: string;
  MUNICENT?: string;
  CEP?: string;
  OBS?: string;
  OBS1?: string;
  OBS2?: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
  SEPERADOR?: string;
  NUMVIASMAPASEP?: number;
  EMISSOR_MAPA?: string;
  CODFUNCSEP?: number;
  SEPERADOR_ITEM?: string;
  IMPRIME?: string;
}

type Props = {
  pendencias: PendenciaGestproRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh?: () => void;
};

const PedidosPendentesModal: React.FC<Props> = ({ pendencias, loading, error, onClose, onRefresh }) => {

  // Auto-refresh every 5 minutes
  React.useEffect(() => {
    if (!onRefresh) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  const handleValidarPendencias = () => {
      const pendenciasRelevantes = pendencias.filter(p => 
          p.LOG2 === '13' || // Corte
          p.LOG2 === '14' || // Pegar Localização
          p.LOG2 === '17' || // Coleta
          p.LOG2 === '21' || // Coleta Separando
          p.LOG2 === '22'    // Corte Realizado
      );

      if (pendenciasRelevantes.length === 0) {
          onClose();
          window.location.reload();
      } else {
          alert('Ainda existem pendências nos cards de Corte, Pegar Localização, Coleta, Coleta Separando ou Corte Realizado.');
      }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: 'fixed', inset: 0 }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3103, position: 'fixed', inset: 0 }}>
        <div className="modal-dialog modal-dialog-centered modal-fullscreen" role="document">
          <div className="modal-content" style={{ fontSize: '0.95rem' }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '1rem' }}>Pedidos pendentes</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: '1rem', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
              {loading && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
              {error && <div className="alert alert-danger">{error}</div>}
              
              {!loading && !error && (
                <div className="container-fluid p-0">
                  <div className="alert alert-info m-2">
                    Cards de pendências foram movidos para a sidebar vertical.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-primary btn-gestpro me-2" onClick={handleValidarPendencias}>Validar Pendencias</button>
              <button type="button" className="btn btn-secondary btn-gestpro" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PedidosPendentesModal;
