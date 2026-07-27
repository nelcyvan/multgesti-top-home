import React from 'react';
import { atualizarStatusEspecial } from '../../services/gestlog/MarcarVisualizacao';
import type { PedidoDetalhe } from './modals/VisualizarPedidoModal';

interface MessageState {
  show: boolean;
  title: string;
  content: string;
  isError?: boolean;
}

interface ValidarCepModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  onStatusUpdated?: () => void;
  onAddressUpdated?: (addressData: any) => void;
}

const ValidarCepModal: React.FC<ValidarCepModalProps> = ({ show, onClose, pedido, onStatusUpdated, onAddressUpdated }) => {
  // Tabs: 'cep' or 'logradouro'
  const [activeTab, setActiveTab] = React.useState<'cep' | 'logradouro'>('cep');

  // Search Inputs
  const [searchCep, setSearchCep] = React.useState('');
  const [searchNumberCep, setSearchNumberCep] = React.useState('');
  const [searchLogradouro, setSearchLogradouro] = React.useState('');
  const [searchCidade, setSearchCidade] = React.useState('');
  const [searchUF, setSearchUF] = React.useState('');

  // Result/Final Values
  const [cepValue, setCepValue] = React.useState('');
  const [locationValue, setLocationValue] = React.useState('');
  const [numeroValue, setNumeroValue] = React.useState('');
  const [complementoValue, setComplementoValue] = React.useState('');
  const [bairroValue, setBairroValue] = React.useState('');
  const [cidadeValue, setCidadeValue] = React.useState('');
  const [ufValue, setUfValue] = React.useState('');

  // States
  const [loading, setLoading] = React.useState(false); // For saving
  const [loadingSearch, setLoadingSearch] = React.useState(false); // For searching
  const [isValidated, setIsValidated] = React.useState(false); // If true, search was successful
  const [showConfirmLocationModal, setShowConfirmLocationModal] = React.useState(false);
  const [messageModal, setMessageModal] = React.useState<MessageState>({ show: false, title: '', content: '' });

  // Reset when modal opens
  React.useEffect(() => {
    if (show) {
      setActiveTab('cep');
      setSearchCep('');
      setSearchNumberCep('');
      setSearchLogradouro('');
      setSearchCidade('');
      setSearchUF('');
      resetResult();
      setLoading(false);
      setLoadingSearch(false);
      setShowConfirmLocationModal(false);
    }
  }, [show]);

  const resetResult = () => {
    setCepValue('');
    setLocationValue('');
    setNumeroValue('');
    setComplementoValue('');
    setBairroValue('');
    setCidadeValue('');
    setUfValue('');
    setIsValidated(false);
  };

  // Reset validation when inputs change (forces re-validation)
  React.useEffect(() => {
    if (isValidated) setIsValidated(false);
  }, [searchCep, searchNumberCep, searchLogradouro, searchCidade, searchUF]);

  const handleBuscarPorCep = async () => {
    const cepClean = searchCep.replace(/\D/g, '');
    if (cepClean.length !== 8) {
       setMessageModal({ show: true, title: 'Atenção', content: 'Digite um CEP válido (8 dígitos).', isError: true });
       return;
    }
    if (!searchNumberCep.trim()) {
       setMessageModal({ show: true, title: 'Atenção', content: 'Digite o número para validar.', isError: true });
       return;
    }

    setLoadingSearch(true);
    resetResult(); // Clear previous results

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
      const data = await res.json();
      
      if (data.erro) {
        setMessageModal({ show: true, title: 'Atenção', content: 'CEP não encontrado.', isError: true });
      } else {
        // Populate result
        setCepValue(searchCep); // Or data.cep
        setLocationValue(data.logradouro);
        setBairroValue(data.bairro);
        setCidadeValue(data.localidade);
        setUfValue(data.uf);
        setNumeroValue(searchNumberCep); // From input
        // Complemento stays empty for user to fill
        setIsValidated(true);
      }
    } catch (error) {
       setMessageModal({ show: true, title: 'Erro', content: 'Erro ao buscar CEP.', isError: true });
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleBuscarPorLogradouro = async () => {
    // Check mandatory fields
    if (!searchLogradouro.trim() || !searchCidade.trim() || !searchUF.trim()) {
        setMessageModal({ show: true, title: 'Atenção', content: 'Preencha Código, Cidade e UF.', isError: true });
        return;
    }

    // Validate Plus Code format
    const codeRegex = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}$/i;
    if (!codeRegex.test(searchLogradouro.trim())) {
        setMessageModal({ show: true, title: 'Atenção', content: 'Código inválido. Formato esperado: XXXXX+XXX', isError: true });
        return;
    }

    if (searchUF.trim().length !== 2) {
        setMessageModal({ show: true, title: 'Atenção', content: 'UF deve ter 2 letras.', isError: true });
        return;
    }

    setLoadingSearch(true);
    resetResult();

    const code = searchLogradouro.trim();
    const city = searchCidade.trim();
    const uf = searchUF.trim();

    // Construct query for Nominatim
    const searchQuery = `${code}, ${city} - ${uf}, Brasil`;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1`, {
            headers: { 'User-Agent': 'MultGestLog/1.0' }
        });
        const data = await res.json();

        if (data && data.length > 0) {
            const result = data[0];
            const addr = result.address;

            const logradouro = addr.road || addr.pedestrian || addr.footway || addr.path || code;
            const bairro = addr.suburb || addr.neighbourhood || addr.residential || '';
            const cidadeResult = addr.city || addr.town || addr.village || addr.municipality || addr.county || city;
            const estado = addr.state || uf;
            const cep = addr.postcode || '';
            const numero = addr.house_number || '';

            setLocationValue(logradouro);
            setBairroValue(bairro);
            setCidadeValue(cidadeResult);
            setUfValue(estado);
            setCepValue(cep);
            setNumeroValue(numero || 'S/N');
            
            setIsValidated(true);
            setMessageModal({ show: true, title: 'Sucesso', content: `Plus Code validado: ${logradouro}, ${cidadeResult} - ${estado}`, isError: false });
        } else {
            // Fallback with manual values
            setLocationValue(code);
            setBairroValue(''); 
            setCidadeValue(city);
            setUfValue(uf);
            setCepValue('');
            setNumeroValue('S/N');
            
            setIsValidated(true);
            setMessageModal({ show: true, title: 'Sucesso', content: `Plus Code validado: ${code}, ${city} - ${uf}`, isError: false });
        }
    } catch (error) {
        setMessageModal({ show: true, title: 'Erro', content: 'Erro ao buscar endereço.', isError: true });
    } finally {
        setLoadingSearch(false);
    }
  };

  const handleSaveLocation = () => {
    if (!isValidated) return;
    
    // Check mandatory fields
    if (!locationValue || !locationValue.trim()) {
      setMessageModal({ show: true, title: 'Atenção', content: 'Endereço inválido.', isError: true });
      return;
    }
    
    if (activeTab === 'cep' && (!numeroValue || !numeroValue.trim())) {
      setMessageModal({ show: true, title: 'Atenção', content: 'O campo Número é obrigatório.', isError: true });
      return;
    }
    
    setShowConfirmLocationModal(true);
  };

  const executeSaveLocation = async () => {
    setLoading(true);
    try {
      // Build Full Address String for Location Value if needed, or just use parts
      // Existing logic used JSON in obsEntrega3
      
      let fullAddress = '';
      let finalBairro = bairroValue;
      let finalCep = cepValue;

      if (activeTab === 'logradouro') {
        // If via Logradouro/Plus Code
        fullAddress = `${locationValue}`;
        if (cidadeValue && ufValue) fullAddress += ` - ${cidadeValue} - ${ufValue}`;
        
        finalBairro = ''; // No neighborhood for Plus Code
        finalCep = '';    // No CEP for Plus Code
      } else {
        // Via CEP
        fullAddress = `${locationValue}, ${numeroValue} - ${bairroValue}, ${cidadeValue} - ${ufValue}`;
      }
      
      const dataObj = { 
        address: locationValue, 
        number: numeroValue, 
        complement: complementoValue, 
        cep: finalCep,
        bairro: finalBairro,
        city: cidadeValue,
        uf: ufValue,
        full: fullAddress
      };
      
      const newObs = JSON.stringify(dataObj);
      
      const res = await fetch('/api/gestlog/atualizar-obs-entrega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numped: Number(pedido.pedido), obsEntrega3: newObs })
      });
      if (!res.ok) throw new Error('Falha ao salvar localização');
      
      const usuario = (() => {
        try {
          const raw = localStorage.getItem('usuarioLogado');
          if (!raw) return 'APP';
          const obj = JSON.parse(raw);
          const nome = (obj?.usuario ?? '').toString().trim();
          return nome || 'APP';
        } catch { return 'APP'; }
      })();
      
      await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 18, usuario });
      
      if (onAddressUpdated) {
        onAddressUpdated({
            logradouro: locationValue,
            numero: numeroValue,
            complemento: complementoValue,
            cep: finalCep,
            bairro: finalBairro,
            cidade: cidadeValue,
            uf: ufValue
        });
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Validar CEP e Observação</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body py-3" style={{ fontSize: '0.8rem' }}>
              
              {/* Tabs */}
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'cep' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('cep')}
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    Por CEP + Número
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'logradouro' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('logradouro')}
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    Por Plus Code
                  </button>
                </li>
              </ul>

              {/* Tab Content: CEP */}
              {activeTab === 'cep' && (
                <div className="row gx-2 mb-3">
                  <div className="col-5">
                    <label className="form-label small mb-1">CEP</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ex: 00000-000"
                      value={searchCep}
                      onChange={(e) => setSearchCep(e.target.value)}
                    />
                  </div>
                  <div className="col-3">
                    <label className="form-label small mb-1">Número</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ex: 123"
                      value={searchNumberCep}
                      onChange={(e) => setSearchNumberCep(e.target.value)}
                    />
                  </div>
                  <div className="col-4 d-flex align-items-end">
                    <button 
                        className="btn btn-primary btn-sm w-100" 
                        onClick={handleBuscarPorCep}
                        disabled={loadingSearch || !searchCep.trim() || !searchNumberCep.trim()}
                    >
                        {loadingSearch ? '...' : 'Validar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content: Logradouro */}
              {activeTab === 'logradouro' && (
                <div className="mb-3">
                   <div className="row g-2">
                       <div className="col-4">
                           <label className="form-label small mb-1">Código (Plus Code)*</label>
                           <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="ex: 3GHX+952"
                            value={searchLogradouro}
                            onChange={(e) => setSearchLogradouro(e.target.value)}
                           />
                       </div>
                       <div className="col-5">
                           <label className="form-label small mb-1">Cidade*</label>
                           <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="ex: Eusébio"
                            value={searchCidade}
                            onChange={(e) => setSearchCidade(e.target.value)}
                           />
                       </div>
                       <div className="col-3">
                           <label className="form-label small mb-1">UF*</label>
                           <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="ex: CE"
                            maxLength={2}
                            value={searchUF}
                            onChange={(e) => setSearchUF(e.target.value.toUpperCase())}
                           />
                       </div>
                       
                       <div className="col-12 d-flex justify-content-end mt-2">
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={handleBuscarPorLogradouro}
                            disabled={loadingSearch || !searchLogradouro.trim() || !searchCidade.trim() || !searchUF.trim()}
                          >
                             {loadingSearch ? 'Validando...' : 'Validar'}
                          </button>
                       </div>
                   </div>
                </div>
              )}

              {/* Result Section (Visible only if validated) */}
              {isValidated && (
                <div className="card bg-light border-0 p-2 mt-3">
                  <h6 className="small fw-bold mb-2">Resultado da Validação:</h6>
                  <div className="row gx-2">
                    <div className="col-12 mb-2">
                      <label className="form-label small mb-0 text-muted">Plus Code / Logradouro</label>
                      <input type="text" className="form-control form-control-sm" value={locationValue} readOnly />
                    </div>
                    {activeTab === 'cep' && (
                        <>
                            <div className="col-4 mb-2">
                              <label className="form-label small mb-0 text-muted">Número</label>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                value={numeroValue} 
                                onChange={(e) => setNumeroValue(e.target.value)}
                              />
                            </div>
                            <div className="col-8 mb-2">
                              <label className="form-label small mb-0 text-muted">Complemento</label>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                value={complementoValue} 
                                onChange={(e) => setComplementoValue(e.target.value)}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="col-5 mb-2">
                               <label className="form-label small mb-0 text-muted">Bairro</label>
                               <input type="text" className="form-control form-control-sm" value={bairroValue} readOnly />
                            </div>
                        </>
                    )}
                    <div className={`${activeTab === 'cep' ? 'col-5' : 'col-12'} mb-2`}>
                       <label className="form-label small mb-0 text-muted">Cidade/UF</label>
                       <input type="text" className="form-control form-control-sm" value={`${cidadeValue} - ${ufValue}`} readOnly />
                    </div>
                    {activeTab === 'cep' && (
                        <div className="col-2 mb-2">
                           <label className="form-label small mb-0 text-muted">CEP</label>
                           <input type="text" className="form-control form-control-sm" value={cepValue} readOnly />
                        </div>
                    )}
                  </div>
                </div>
              )}

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
                className="btn btn-success btn-sm py-1 px-2 ms-2"
                onClick={handleSaveLocation}
                disabled={loading || !isValidated}
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
              >
                {loading ? 'Salvando...' : 'Adicionar ao mapa de separação'}
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
                  <p>Confira os dados antes de salvar:</p>
                  <div className="card p-2 bg-light">
                    {activeTab === 'logradouro' ? (
                        <div><strong>Endereço:</strong> {locationValue}, {cidadeValue} - {ufValue}</div>
                    ) : (
                        <div><strong>Endereço:</strong> {locationValue}</div>
                    )}
                    
                    {activeTab === 'cep' && (
                        <>
                            <div><strong>Número:</strong> {numeroValue}</div>
                            <div><strong>Complemento:</strong> {complementoValue}</div>
                        </>
                    )}
                    {activeTab === 'cep' && (
                        <>
                            <div><strong>Bairro:</strong> {bairroValue}</div>
                            <div><strong>Cidade:</strong> {cidadeValue} - {ufValue}</div>
                            <div><strong>CEP:</strong> {cepValue}</div>
                        </>
                    )}
                  </div>
                  <p className="mt-3 mb-0">Deseja adicionar ao mapa de separação?</p>
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

export default ValidarCepModal;
