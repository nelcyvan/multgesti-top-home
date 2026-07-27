import React, { useEffect, useState, useMemo, useCallback } from 'react';
import "bootstrap/dist/css/bootstrap.min.css";
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import type { ClientesSemVendaRow } from '../../../../services/gestpro/ClientesSemVenda';
import { buscarClientesSemVenda, salvarClienteSemVenda } from '../../../../services/gestpro/ClientesSemVenda';
import ContactarClienteModal from '../../ContactarClienteModal';

interface Props {
  onClose?: () => void;
  style?: React.CSSProperties;
  embedded?: boolean;
}

// Componente HeaderField reutilizado
const HeaderField: React.FC<{
  label: string;
  value: React.ReactNode;
  divider?: boolean;
  valueClassName?: string;
  valueStyle?: React.CSSProperties;
  title?: string;
}> = React.memo(({ label, value, divider, valueClassName, valueStyle, title }) => (
  <div
    className={`d-flex flex-row align-items-baseline ${divider ? 'border-start ps-2 ms-2' : ''}`}
    style={{ minWidth: 0, gap: '4px' }}
    title={title}
  >
    <span style={{ fontSize: '0.7rem', lineHeight: 1, whiteSpace: 'nowrap', color: 'inherit', opacity: 0.9 }}>{label}</span>
    <span className={`${valueClassName ?? ''} fw-bold`} style={{ fontSize: '0.7rem', lineHeight: 1.1, ...valueStyle, minWidth: 0, color: 'inherit' }}>
      {value}
    </span>
  </div>
));

// Helper de Moeda
const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

// Helper de Dias
const getDaysSince = (dateStr: string): number => {
    if (!dateStr) return 0;
    try {
        const today = new Date();
        const lastPurchase = new Date(dateStr);
        // Normalize to start of day
        today.setHours(0, 0, 0, 0);
        lastPurchase.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - lastPurchase.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch {
        return 0;
    }
};

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
        return dateStr;
    }
};

// Estilos do Card baseados no Status
const getCardStyleByStatus = (status: string | number | null | undefined): React.CSSProperties => {
  const s = status ? String(status) : null;
  
  // Clientes sem atendimento (null) -> Vermelho
  if (s === null) {
    return { backgroundColor: 'var(--bs-danger)', color: '#fff' };
  }
  
  // Em atendimento (1, 3) -> Amarelo
  if (['1', '3'].includes(s)) {
    return { backgroundColor: 'var(--bs-warning)', color: '#212529' };
  }
  
  // Finalizados (2, 4, 5) -> Verde
  if (['2', '4', '5'].includes(s)) {
    return { backgroundColor: 'var(--bs-success)', color: '#fff' };
  }
  
  // Fallback
  return { backgroundColor: 'var(--bs-secondary)', color: '#fff' };
};

// Componente Card de Cliente
const ClienteCard = React.memo(({ row, onContactar }: {
  row: ClientesSemVendaRow;
  onContactar: (c: ClientesSemVendaRow) => void;
}) => {
  const days = getDaysSince(row.DATA_ULTIMA_COMPRA);
  const isContacting = String(row.STATUS_ATUAL) === "1";
  const isFinalized = ['2', '4', '5'].includes(String(row.STATUS_ATUAL));
  const headerStyle = getCardStyleByStatus(row.STATUS_ATUAL);
  
  return (
    <div className="card shadow-sm">
      {/* Header Colorido */}
      <div className="card-header py-1 px-2 position-relative" style={headerStyle}>
        
        {/* Status no canto superior direito */}
        <div className="position-absolute top-0 end-0 p-1 d-flex flex-column align-items-end" style={{ gap: '2px', zIndex: 10 }}>
           <span className="fw-bold mb-0" style={{ fontSize: '0.75rem', lineHeight: 1, textAlign: 'right', color: 'inherit' }}>
             {isContacting ? 'Contactando' : (isFinalized ? 'Finalizado' : (row.CONTACTADO || 'Não Contactado'))}
           </span>
           <span className="mb-0" style={{ fontSize: '0.7rem', lineHeight: 1, textAlign: 'right', color: 'inherit', opacity: 0.9 }}>
             Status: {row.STATUS_ATUAL || '-'}
           </span>
        </div>

        {/* Informações do Cliente */}
        <div className="d-flex flex-wrap align-items-center" style={{ fontSize: '0.68rem', rowGap: '4px', paddingRight: 'clamp(0px, 20vw, 150px)' }}>
          <div className="d-flex flex-wrap align-items-center" style={{ minWidth: 0, rowGap: '4px', width: '100%' }}>
            <div className="d-flex flex-row align-items-stretch w-100" style={{ minWidth: 0, gap: '12px', flexWrap: 'wrap' }}>
              
              {/* Grupo 1: Cliente */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '250px', flex: '2 1 250px' }}>
                <HeaderField label="Cód:" value={row.CODCLI} />
                <HeaderField 
                  label="Cliente:" 
                  value={row.CLIENTE} 
                  title={row.CLIENTE}
                  valueClassName="text-truncate"
                  valueStyle={{ maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }}
                />
              </div>

              {/* Grupo 2: Localização */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '200px', flex: '1 1 200px', borderLeft: '1px solid currentColor', paddingLeft: '12px' }}>
                <HeaderField label="Cidade:" value={row.MUNICENT} />
                <HeaderField label="Bairro:" value={row.BAIRROENT} />
              </div>

              {/* Grupo 3: Venda */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '200px', flex: '1 1 200px', borderLeft: '1px solid currentColor', paddingLeft: '12px' }}>
                <HeaderField label="Vendedor:" value={row.VENDEDOR_ULT_VENDA || '-'} />
                <HeaderField label="Vl. Últ. Compra:" value={currency(row.VALOR_ULTIMA_COMPRA)} />
              </div>

              {/* Grupo 4: Data/Dias */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '150px', flex: '1 1 150px', borderLeft: '1px solid currentColor', paddingLeft: '12px' }}>
                <HeaderField label="Data:" value={formatDate(row.DATA_ULTIMA_COMPRA)} />
                <HeaderField label="Dias sem compra:" value={days} />
              </div>

            </div>

            {/* Linha Responsável (visível apenas se houver responsável e estiver em atendimento ou finalizado) */}
            {row.CODUSUR_RESPONSAVEL_CLIENTE && (['1', '2', '3', '4', '5'].includes(String(row.STATUS_ATUAL))) && (
               <div className="d-flex flex-row align-items-center mt-1 pt-1 border-top" style={{ borderColor: 'currentColor', opacity: 0.9 }}>
                 <HeaderField 
                    label="RESPONSÁVEL:" 
                    value={row.NOME_RESPONSAVEL ? `${row.NOME_RESPONSAVEL} (${row.CODUSUR_RESPONSAVEL_CLIENTE})` : row.CODUSUR_RESPONSAVEL_CLIENTE} 
                    valueStyle={{ fontSize: '0.75rem' }}
                 />
               </div>
            )}
          </div>
        </div>

        {/* Rodapé do Header com Ação */}
        <div className="mt-1 pt-1 border-top border-opacity-25 d-flex justify-content-end align-items-center" style={{ fontSize: '0.68rem', borderColor: 'currentColor' }}>
          <button
            type="button"
            className={`btn btn-sm py-0 px-2 fw-bold ${isContacting ? 'btn-success' : (isFinalized ? 'btn-dark' : 'btn-light')}`}
            style={{ fontSize: '0.65rem', height: '20px', lineHeight: 1, whiteSpace: 'nowrap' }}
            onClick={(e) => {
              e.stopPropagation();
              onContactar(row);
            }}
          >
            {isContacting ? "Em Atendimento" : (isFinalized ? "Finalizado" : "Contactar")}
          </button>
        </div>
      </div>
    </div>
  );
});

// Componente Coluna Kanban
const KanbanColumn: React.FC<{
  title: string;
  colorClass: string;
  items: ClientesSemVendaRow[];
  onContactar: (c: ClientesSemVendaRow) => void;
  enableMyItemsFilter?: boolean;
  currentUserId?: number | null;
}> = React.memo(({ title, colorClass, items, onContactar, enableMyItemsFilter, currentUserId }) => {
  const [visibleCount, setVisibleCount] = useState(20);
  const [filterMyItems, setFilterMyItems] = useState(false);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  const filteredItems = useMemo(() => {
    if (!filterMyItems || !enableMyItemsFilter || !currentUserId) return items;
    return items.filter(i => Number(i.CODUSUR_RESPONSAVEL_CLIENTE) === Number(currentUserId));
  }, [items, filterMyItems, enableMyItemsFilter, currentUserId]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [items]); // Re-attach se a lista mudar drasticamente, ou depender apenas do ref

  return (
    <div className="d-flex flex-column h-100 border-end" style={{ minWidth: '320px', flex: 1, backgroundColor: '#f8f9fa' }}>
      {/* Header da Coluna */}
      <div className={`p-2 border-bottom border-${colorClass} border-3 bg-white shadow-sm`} style={{ zIndex: 10 }}>
        <div className="d-flex justify-content-between align-items-center">
          <h6 className={`m-0 fw-bold text-${colorClass === 'warning' ? 'dark' : colorClass}`}>
            {title}
          </h6>
          
          <div className="d-flex align-items-center gap-2">
            {enableMyItemsFilter && (
               <div className="form-check form-switch m-0 d-flex align-items-center" style={{ fontSize: '0.8rem', minHeight: 'unset' }}>
                 <input 
                   className="form-check-input m-0 me-1" 
                   type="checkbox" 
                   id={`switch-${title.replace(/\s+/g, '-')}`} 
                   checked={filterMyItems}
                   onChange={(e) => setFilterMyItems(e.target.checked)}
                   style={{ cursor: 'pointer', marginTop: 0 }}
                 />
                 <label className="form-check-label user-select-none" htmlFor={`switch-${title.replace(/\s+/g, '-')}`} style={{ cursor: 'pointer' }}>
                   Meus clientes
                 </label>
               </div>
            )}
            
            <span className={`badge rounded-pill bg-${colorClass} ${colorClass === 'warning' ? 'text-dark' : 'text-white'}`}>
              {filteredItems.length}
            </span>
          </div>
        </div>
      </div>

      {/* Lista Scrollável */}
      <div className="flex-grow-1 overflow-y-auto overflow-x-hidden p-2 d-flex flex-column gap-2" style={{ minHeight: 0 }}>
        {visibleItems.map((c, idx) => (
          <ClienteCard 
            key={`${c.CODCLI}-${idx}`} 
            row={c} 
            onContactar={onContactar} 
          />
        ))}
        
        {/* Loader / Sentinel */}
        {visibleCount < items.length && (
          <div ref={loadMoreRef} className="text-center p-2 opacity-50">
            <small>Carregando mais...</small>
          </div>
        )}
        
        {items.length === 0 && (
          <div className="text-center text-muted mt-5 opacity-50">
            <small>Nenhum cliente</small>
          </div>
        )}
      </div>
    </div>
  );
});

const ClientesSemVendaModal: React.FC<Props> = ({ onClose, style, embedded = false }) => {
  const [clientes, setClientes] = useState<ClientesSemVendaRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<ClientesSemVendaRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showAccessDeniedToast, setShowAccessDeniedToast] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("usuarioLogado");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const codusur = user.codusur || user.CODUSUR || user.matricula || user.MATRICULA;
      if (codusur) setCurrentUserId(Number(codusur));
    }
  }, []);
  
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await buscarClientesSemVenda();
      setClientes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Distribuição nas colunas
  const { semAtendimento, emAtendimento, finalizados } = useMemo(() => {
    const sem = [] as ClientesSemVendaRow[];
    const em = [] as ClientesSemVendaRow[];
    const fim = [] as ClientesSemVendaRow[];

    clientes.forEach(c => {
      const s = c.STATUS_ATUAL ? String(c.STATUS_ATUAL) : null;
      if (s === null) sem.push(c);
      else if (['1', '3'].includes(s)) em.push(c);
      else if (['2', '4', '5'].includes(s)) fim.push(c);
      else sem.push(c); // Fallback para sem atendimento se status desconhecido? Ou cria uma lista 'Outros'? Vamos assumir null
    });

    return { semAtendimento: sem, emAtendimento: em, finalizados: fim };
  }, [clientes]);

  const fecharContactar = () => {
    setSelectedCliente(null);
    loadData(); // Recarrega para atualizar status se mudou
  };

  const handleCardContact = async (cliente: ClientesSemVendaRow) => {
    const isStatus1 = String(cliente.STATUS_ATUAL) === "1";
    const isFinalized = ['2', '4', '5'].includes(String(cliente.STATUS_ATUAL));

    if (isStatus1 || isFinalized) {
      if (currentUserId && Number(cliente.CODUSUR_RESPONSAVEL_CLIENTE) !== Number(currentUserId)) {
         setShowAccessDeniedToast(true);
         return;
      }
    }

    if (!isStatus1 && !isFinalized) {
       // Se não estiver contactando nem finalizado, inicia o contato automaticamente (Status 1)
       try {
          const storedUser = localStorage.getItem("usuarioLogado");
          const user = storedUser ? JSON.parse(storedUser) : {};
          const codusur = user.codusur || user.CODUSUR || user.matricula || user.MATRICULA;
          const nomeResponsavel = user.nome || user.NOME || user.nome_guerra || user.NOME_GUERRA;

          await salvarClienteSemVenda({
             codcli: cliente.CODCLI,
             codusur: codusur ? Number(codusur) : null,
             contactado: new Date(),
             status: 1,
             ultimaData: new Date(),
             nomeResponsavel: nomeResponsavel || null
          });
          
          // Atualiza localmente para refletir imediatamente no modal e na lista (optimistic update parcial)
          const updatedCliente = { 
            ...cliente, 
            STATUS_ATUAL: "1",
            CODUSUR_RESPONSAVEL_CLIENTE: codusur ? Number(codusur) : undefined,
            NOME_RESPONSAVEL: nomeResponsavel || undefined
          };
          
          // Atualiza a lista geral para mover o card
          setClientes(prev => prev.map(c => c.CODCLI === cliente.CODCLI ? updatedCliente : c));
          
          // Abre o modal com o cliente atualizado
          setSelectedCliente(updatedCliente);
          return;
       } catch (error) {
          console.error("Erro ao iniciar contato automático:", error);
          // Em caso de erro, abre o modal mesmo assim? Ou mostra erro?
          // Vamos abrir o modal com o cliente original para o usuário tentar lá dentro se quiser
       }
    }
    
    setSelectedCliente(cliente);
  };

  const content = (
    <div className={`bg-light ${embedded ? 'h-100 d-flex flex-column' : 'modal-content'}`}>
      {/* Header Modal */}
      {!embedded && (
        <div className="modal-header py-2 px-3 border-bottom bg-white shadow-sm" style={{ height: '50px' }}>
          <h5 className="modal-title fs-6 fw-bold flex-grow-1">Gestão de Clientes sem Venda</h5>
          <div className="d-flex gap-3 align-items-center">
             {loading && <div className="spinner-border spinner-border-sm text-primary" />}
             <button 
              type="button" 
              className="btn-close" 
              onClick={onClose} 
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}
      
      {/* Corpo Kanban */}
      <div className={`${embedded ? 'flex-grow-1' : 'modal-body'} p-0 overflow-hidden d-flex flex-column`}>
        {error && (
          <div className="alert alert-danger m-3 flex-shrink-0">
            {error}
          </div>
        )}

        <div className="d-flex flex-row h-100 overflow-x-auto">
          <KanbanColumn 
            title="Clientes sem atendimento" 
            colorClass="danger" 
            items={semAtendimento} 
            onContactar={handleCardContact}
          />
          <KanbanColumn 
            title="Em atendimento" 
            colorClass="warning" 
            items={emAtendimento} 
            onContactar={handleCardContact}
            enableMyItemsFilter={true}
            currentUserId={currentUserId}
          />
          <KanbanColumn 
            title="Finalizados" 
            colorClass="success" 
            items={finalizados} 
            onContactar={handleCardContact}
            enableMyItemsFilter={true}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="h-100 d-flex flex-column position-relative">
        {content}
        {selectedCliente && (
          <ContactarClienteModal 
            cliente={selectedCliente} 
            onClose={fecharContactar} 
          />
        )}
        <ToastContainer position="top-center" className="p-3" style={{ zIndex: 1060 }}>
          <Toast onClose={() => setShowAccessDeniedToast(false)} show={showAccessDeniedToast} delay={4000} autohide bg="danger">
            <Toast.Header>
              <strong className="me-auto">Acesso Negado</strong>
            </Toast.Header>
            <Toast.Body className="text-white">
              Você só pode acessar clientes sob sua responsabilidade.
            </Toast.Body>
          </Toast>
        </ToastContainer>
      </div>
    );
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", ...style }}>
      <div className="modal-dialog modal-fullscreen">
        {content}
      </div>

      {selectedCliente && (
        <ContactarClienteModal 
          cliente={selectedCliente} 
          onClose={fecharContactar} 
        />
      )}

      <ToastContainer position="top-center" className="p-3" style={{ zIndex: 1060 }}>
        <Toast onClose={() => setShowAccessDeniedToast(false)} show={showAccessDeniedToast} delay={4000} autohide bg="danger">
          <Toast.Header>
            <strong className="me-auto">Acesso Negado</strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            Você só pode acessar clientes sob sua responsabilidade.
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export default ClientesSemVendaModal;
