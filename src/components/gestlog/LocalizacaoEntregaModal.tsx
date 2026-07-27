import React from 'react';
import { atualizarStatusEspecial, atualizarStatusPedido } from '../../services/gestlog/MarcarVisualizacao';
import type { PedidoDetalhe } from './modals/VisualizarPedidoModal';

interface MessageState {
  show: boolean;
  title: string;
  content: string;
  isError?: boolean;
}

interface LocalizacaoEntregaModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  onStatusUpdated?: () => void;
  autoUpdateStatus18?: boolean;
}

const LocalizacaoEntregaModal: React.FC<LocalizacaoEntregaModalProps> = ({ show, onClose, pedido, onStatusUpdated, autoUpdateStatus18 }) => {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [loadingCep, setLoadingCep] = React.useState<boolean>(false);
  const [loadingPlusCode, setLoadingPlusCode] = React.useState<boolean>(false);
  const [cepValue, setCepValue] = React.useState<string>('');
  const [locationValue, setLocationValue] = React.useState<string>('');
  const [numeroValue, setNumeroValue] = React.useState<string>('');
  const [complementoValue, setComplementoValue] = React.useState<string>('');
  const [useCadastroAddress, setUseCadastroAddress] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<'cep' | 'logradouro'>('cep');
  const [showConfirmLocationModal, setShowConfirmLocationModal] = React.useState<boolean>(false);
  const [messageModal, setMessageModal] = React.useState<MessageState>({ show: false, title: '', content: '' });
  
  // States for structured Logradouro validation
  const [searchCode, setSearchCode] = React.useState('');
  const [searchCity, setSearchCity] = React.useState('');
  const [searchUF, setSearchUF] = React.useState('');
  
  // Novos estados para validação e alerta
  const [isAddressValid, setIsAddressValid] = React.useState<boolean>(false);
  const [validationMessage, setValidationMessage] = React.useState<{ text: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  // Limpar validação ao trocar de aba
  React.useEffect(() => {
    setIsAddressValid(false);
    setValidationMessage(null);
    // Limpar campos ao trocar de aba se desejar, ou manter o estado. 
    // Por enquanto, mantemos os valores, mas invalidamos o status.
  }, [activeTab]);

  const handleBuscarCep = async () => {
    if (!cepValue || cepValue.length < 8) {
      setValidationMessage({ text: 'Digite um CEP válido (8 dígitos)', type: 'warning' });
      return;
    }
    if (!numeroValue || !numeroValue.trim()) {
        setValidationMessage({ text: 'O campo Número é obrigatório.', type: 'warning' });
        return;
    }

    const cepLimpo = cepValue.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setValidationMessage({ text: 'CEP deve conter 8 dígitos numéricos', type: 'warning' });
      return;
    }
    
    setLoadingCep(true);
    setValidationMessage({ text: 'Buscando CEP...', type: 'warning' });
    setIsAddressValid(false);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setValidationMessage({ text: 'CEP não encontrado.', type: 'danger' });
        setIsAddressValid(false);
      } else {
        // Validação simplificada: Apenas CEP é validado na API, o número é aceito conforme digitado
        const enderecoCompleto = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        setLocationValue(enderecoCompleto);
        setValidationMessage({ text: `Endereço encontrado: ${enderecoCompleto}`, type: 'success' });
        setIsAddressValid(true);
      }
    } catch {
      setValidationMessage({ text: 'Erro ao buscar o CEP. Verifique sua conexão.', type: 'danger' });
      setIsAddressValid(false);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleValidarLogradouro = async () => {
    if (!searchCode.trim() || !searchCity.trim() || !searchUF.trim()) {
      setValidationMessage({ text: 'Preencha Código, Cidade e UF.', type: 'warning' });
      setIsAddressValid(false);
      return;
    }

    const codeRegex = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}$/i;
    if (!codeRegex.test(searchCode.trim())) {
        setValidationMessage({ text: 'Código inválido. Formato esperado: XXXXX+XXX', type: 'warning' });
        setIsAddressValid(false);
        return;
    }

    if (searchUF.trim().length !== 2) {
        setValidationMessage({ text: 'UF deve ter 2 letras.', type: 'warning' });
        setIsAddressValid(false);
        return;
    }

    setLoadingPlusCode(true);
    setValidationMessage({ text: 'Validando Plus Code...', type: 'warning' });
    setIsAddressValid(false);

    try {
      const searchQuery = `${searchCode.trim()}, ${searchCity.trim()} - ${searchUF.trim()}, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1`, {
        headers: { 'User-Agent': 'MultGestLog/1.0' }
      });
      const data = await res.json();

      if (data && data.length > 0) {
        // Encontrado - Validar se realmente corresponde à cidade/estado solicitados se possível, 
        // mas o retorno já indica que existe algo nessa query.
        const fullAddress = `${searchCode.trim()}, ${searchCity.trim()} - ${searchUF.trim().toUpperCase()}`;
        setLocationValue(fullAddress);
        setValidationMessage({ text: `Plus Code validado: ${fullAddress}`, type: 'success' });
        setIsAddressValid(true);
      } else {
        // Se não encontrar no mapa, mas o formato for válido, permite salvar
        const fullAddress = `${searchCode.trim()}, ${searchCity.trim()} - ${searchUF.trim().toUpperCase()}`;
        setLocationValue(fullAddress);
        setValidationMessage({ text: `Plus Code validado: ${fullAddress}`, type: 'warning' });
        setIsAddressValid(true);
      }
    } catch (error) {
      // Se der erro na requisição, permite salvar se o formato estiver correto
      const fullAddress = `${searchCode.trim()}, ${searchCity.trim()} - ${searchUF.trim().toUpperCase()}`;
      setLocationValue(fullAddress);
      setValidationMessage({ text: `Plus Code validado (offline): ${fullAddress}`, type: 'warning' });
      setIsAddressValid(true);
    } finally {
      setLoadingPlusCode(false);
    }
  };

  const handleSaveLocation = () => {
    if (!useCadastroAddress) {
      if (!isAddressValid) {
        setMessageModal({ show: true, title: 'Atenção', content: 'Por favor, realize a validação do endereço antes de salvar.', isError: true });
        return;
      }
      if (!locationValue || !locationValue.trim()) {
        setMessageModal({ show: true, title: 'Atenção', content: 'O campo Endereço é obrigatório.', isError: true });
        return;
      }
      
      // Se a busca for por CEP, exige número
      if (activeTab === 'cep') {
        if (!numeroValue || !numeroValue.trim()) {
          setMessageModal({ show: true, title: 'Atenção', content: 'O campo Número é obrigatório.', isError: true });
          return;
        }
      }
      // Se for por logradouro, não exige número nem complemento
    }
    setShowConfirmLocationModal(true);
  };

  const executeSaveLocation = async () => {
    setLoading(true);
    try {
      let newObs = '';
      if (useCadastroAddress) {
        newObs = 'Entregar no Endereço de Cadastro';
      } else {
        if (locationValue || numeroValue || complementoValue) {
          const data = { address: locationValue, number: numeroValue, complement: complementoValue, cep: cepValue };
          newObs = JSON.stringify(data);
        }
      }

      const usuario = (() => {
        try {
          const raw = localStorage.getItem('usuarioLogado');
          if (!raw) return 'APP';
          const obj = JSON.parse(raw);
          const nome = (obj?.usuario ?? '').toString().trim();
          return nome || 'APP';
        } catch { return 'APP'; }
      })();

      const res = await fetch('/api/gestlog/atualizar-obs-entrega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numped: Number(pedido.pedido), obsEntrega3: newObs, usuario })
      });
      if (!res.ok) throw new Error('Falha ao salvar localização');
      
      // Log para verificação da lógica
      // Priorizamos pedido.log2Real se existir, depois statusPedido, e por fim pedido.posicao (convertido para numérico)
      let currentStatus = Number(pedido.statusPedido);
      if (pedido.log2Real) {
         const lr = Number(pedido.log2Real);
         if (Number.isFinite(lr)) currentStatus = lr;
      } else if (pedido.posicao) {
        const p = Number(pedido.posicao);
        if (Number.isFinite(p)) currentStatus = p;
      }

      console.log('Verificando atualização de status [LocalizacaoEntregaModal]:', {
        rawStatusPedido: pedido.statusPedido,
        rawPosicao: pedido.posicao,
        rawLog2Real: pedido.log2Real,
        resolvedStatus: currentStatus,
        autoUpdateStatus18,
        willUpdate: (currentStatus === 14 && autoUpdateStatus18 === true)
      });


      // Se o status for 14 (Pegar Localização) e a flag autoUpdateStatus18 estiver ativa, atualiza para 18 (Localização Inserida)
      // Se for diferente de 14, não faz nada com o status
      if (currentStatus === 14 && autoUpdateStatus18 === true) {
          try {
              // Atualiza status padrão
              await atualizarStatusPedido({
                  numped: Number(pedido.pedido),
                  status: 18,
                  usuario: usuario
              });
              // Atualiza status especial
              await atualizarStatusEspecial({
                  numped: Number(pedido.pedido),
                  status: 18,
                  usuario: usuario
              });
          } catch (errStatus) {
              console.error('Erro ao atualizar status para 18:', errStatus);
              // Não bloqueia o fluxo de sucesso da localização, apenas loga o erro
          }
      }

      onStatusUpdated?.();
      setShowConfirmLocationModal(false);
      onClose();
    } catch {
      setMessageModal({ show: true, title: 'Erro', content: 'Erro ao salvar localização', isError: true });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;
  return (
    <>
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3200 }}></div>
      <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 3210 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '800px', width: '90%' }}>
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Localização de Entrega</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body py-3" style={{ fontSize: '0.8rem' }}>
              
              {/* Informações do Cliente e Status (LOG2) para verificação */}
              <div className="alert alert-info py-2 mb-3">
                 <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Cliente:</strong> {pedido.codCli} - {pedido.cliente}
                    </div>
                    <div>
                        <strong>Status (LOG2):</strong> {pedido.log2Real || pedido.statusPedido || 'N/A'}
                    </div>
                 </div>
                 {pedido.enderEnt && (
                     <div className="mt-1 small text-muted">
                        <strong>Endereço Atual:</strong> {pedido.enderEnt}, {pedido.numeroEnt} - {pedido.bairroEnt}, {pedido.municEnt}
                     </div>
                 )}
              </div>

              <div className="row gx-3">
                <div className="col-8">
                  {/* Tabs Navigation */}
                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button 
                        className={`nav-link py-1 px-2 small ${activeTab === 'cep' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cep')}
                        type="button"
                      >
                        CEP + Número
                      </button>
                    </li>
                    <li className="nav-item">
                      <button 
                        className={`nav-link py-1 px-2 small ${activeTab === 'logradouro' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logradouro')}
                        type="button"
                      >
                        Plus Code
                      </button>
                    </li>
                  </ul>

                  {/* Tab Content */}
                  <div className="tab-content">
                    {activeTab === 'cep' && (
                      <div className="mb-3 border p-2 rounded bg-light">
                        <label className="form-label small fw-bold mb-1">Busca por CEP + Número</label>
                        <div className="row g-2 align-items-end">
                          <div className="col-5">
                            <label htmlFor="cepInput" className="form-label small mb-0">CEP*</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              id="cepInput"
                              placeholder="Ex: 00000-000"
                              value={cepValue}
                              onChange={(e) => {
                                setCepValue(e.target.value);
                                setIsAddressValid(false);
                                setValidationMessage(null);
                              }}
                              disabled={useCadastroAddress}
                            />
                          </div>
                          <div className="col-4">
                            <label htmlFor="numeroInput" className="form-label small mb-0">Número*</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              id="numeroInput"
                              value={numeroValue}
                              onChange={(e) => setNumeroValue(e.target.value)}
                              placeholder="Ex: 123"
                              disabled={useCadastroAddress}
                            />
                          </div>
                          <div className="col-3">
                            <button
                              className="btn btn-primary btn-sm w-100"
                              type="button"
                              onClick={handleBuscarCep}
                              disabled={loadingCep || useCadastroAddress || !cepValue || !numeroValue}
                              style={{ fontSize: '0.7rem' }}
                            >
                              {loadingCep ? '...' : 'Validar'}
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                            <label htmlFor="complementoInput" className="form-label small mb-0">Complemento</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              id="complementoInput"
                              value={complementoValue}
                              onChange={(e) => setComplementoValue(e.target.value)}
                              placeholder="Apto 101, Bloco B..."
                              disabled={useCadastroAddress}
                            />
                        </div>
                        {validationMessage && (
                          <div className={`alert alert-${validationMessage.type} p-1 mt-2 mb-0 small text-center`} role="alert">
                            {validationMessage.text}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'logradouro' && (
                      <div className="mb-3 border p-2 rounded bg-light">
                        <label className="form-label small fw-bold mb-1">Validação por Plus Code</label>
                        <div className="row g-2">
                          <div className="col-4">
                            <label className="form-label small mb-0">Código*</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="ex: 3GHX+952"
                              value={searchCode}
                              onChange={(e) => {
                                setSearchCode(e.target.value);
                                setIsAddressValid(false);
                                setValidationMessage(null);
                              }}
                              disabled={useCadastroAddress}
                            />
                          </div>
                          <div className="col-5">
                            <label className="form-label small mb-0">Cidade*</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="ex: Eusébio"
                              value={searchCity}
                              onChange={(e) => {
                                setSearchCity(e.target.value);
                                setIsAddressValid(false);
                                setValidationMessage(null);
                              }}
                              disabled={useCadastroAddress}
                            />
                          </div>
                          <div className="col-3">
                            <label className="form-label small mb-0">UF*</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="ex: CE"
                              maxLength={2}
                              value={searchUF}
                              onChange={(e) => {
                                setSearchUF(e.target.value.toUpperCase());
                                setIsAddressValid(false);
                                setValidationMessage(null);
                              }}
                              disabled={useCadastroAddress}
                            />
                          </div>
                          <div className="col-12 text-end mt-1">
                            <button
                              className="btn btn-primary btn-sm"
                              type="button"
                              onClick={handleValidarLogradouro}
                              disabled={loadingPlusCode || useCadastroAddress || !searchCode.trim() || !searchCity.trim() || !searchUF.trim()}
                              style={{ fontSize: '0.7rem' }}
                            >
                              {loadingPlusCode ? '...' : 'Validar'}
                            </button>
                          </div>
                        </div>
                        {validationMessage && (
                          <div className={`alert alert-${validationMessage.type} p-1 mt-2 mb-0 small text-center`} role="alert">
                            {validationMessage.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-4">
                  <div className="p-2 border rounded h-100 d-flex flex-column justify-content-start align-items-end text-end">
                    <div className="mb-2" style={{ fontSize: '0.8rem' }}>Entregar no Endereço de Cadastro</div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="switchEnderecoCadastro"
                        checked={useCadastroAddress}
                        onChange={(e) => setUseCadastroAddress(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-1">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                onClick={onClose}
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2 ms-2"
                onClick={handleSaveLocation}
                disabled={loading || (!useCadastroAddress && !isAddressValid)}
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
              >
                {loading ? 'Salvando...' : 'Salvar Localização'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirmLocationModal && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3300 }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 3310 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar Endereço</h5>
                  <button type="button" className="btn-close" onClick={() => setShowConfirmLocationModal(false)}></button>
                </div>
                <div className="modal-body py-3" style={{ fontSize: '0.8rem' }}>
                  {useCadastroAddress ? (
                    <>
                      <p>Será enviado: Entregar no Endereço de Cadastro</p>
                    </>
                  ) : (
                    <>
                      <p>Confira os dados antes de salvar:</p>
                      <div className="card p-2 bg-light">
                        {activeTab === 'cep' ? (
                            <>
                                <div><strong>CEP:</strong> {cepValue || '-'}</div>
                                <div><strong>Endereço:</strong> {locationValue || '-'}</div>
                                <div><strong>Número:</strong> {numeroValue || '-'}</div>
                                <div><strong>Complemento:</strong> {complementoValue || '-'}</div>
                            </>
                        ) : (
                            <div><strong>Endereço:</strong> {locationValue || '-'}</div>
                        )}
                      </div>
                    </>
                  )}
                  <p className="mt-3 mb-0">Deseja confirmar?</p>
                </div>
                <div className="modal-footer py-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    onClick={() => setShowConfirmLocationModal(false)}
                    style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-1 px-2 ms-2"
                    onClick={executeSaveLocation}
                    disabled={loading}
                    style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  >
                    {loading ? 'Salvando...' : 'Sim'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {messageModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3400 }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 3410 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className={`modal-header py-2 ${messageModal.isError ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{messageModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-center py-4">
                  <p className="mb-0" style={{ fontSize: '0.95rem' }}>{messageModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  >
                    Fechar
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

export default LocalizacaoEntregaModal;
