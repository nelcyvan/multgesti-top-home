import React, { useEffect, useRef, useState } from "react";

type InventarioProdutoRow = {
  ID_INVENTARIO?: number;
  FILIAL?: string;
  NOME_INVENTARIO?: string;
  LOCAL_CONTAGEM?: string;
  NOME_USUARIO?: string;
  RESPONSAVEL?: string;
  DATA?: string | Date;
  DATA_ENCERRAMENTO?: string | Date | null;
  ID_PRODUTO?: number;
  CODPROD?: number;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  QT_CONTADA?: number;
  DATA_HORA_PRIMEIRA_CONTAGEM?: string | Date | null;
  DATA_HORA_ULTIMA_CONTAGEM?: string | Date | null;
  DATA_HORA_PRIMEIRA_TRATATIVA?: string | Date | null;
  DATA_HORA_ULTIMA_TRATATIVA?: string | Date | null;
  ADD_PED_REPOS?: string | null;
  ID_PED_REPOS?: number | null;
};

type ProdutoPendenteRow = {
  ID_PRODUTO?: number;
  CODPROD?: number;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  CODUSUR_ENVIO_CONTAGEM?: number;
  NOME_USUARIO_ENVIO_CONTAGEM?: string;
  QT_CONTADA?: number;
  DATA_HORA_PRIMEIRA_CONTAGEM?: string;
  DATA_HORA_ULTIMA_CONTAGEM?: string;
  DATA_HORA_PRIMEIRA_TRATATIVA?: string;
  DATA_HORA_ULTIMA_TRATATIVA?: string;
  LOGS_ENVIO_CONTAGENS?: string;
};

type InventarioAgrupado = {
  idInventario: number;
  filial: string;
  nomeInventario: string;
  localContagem: string;
  nomeUsuario: string;
  responsavel: string;
  data: string | Date | undefined;
  dataEncerramento?: string | Date | null;
  produtos: Array<{
    idProduto: number;
    codProd: number | undefined;
    descricao: string | undefined;
    codAuxiliar: string | undefined;
    qtContada: number | undefined;
    primeiraContagem: string | Date | null | undefined;
    ultimaContagem: string | Date | null | undefined;
    primeiraTratativa: string | Date | null | undefined;
    ultimaTratativa: string | Date | null | undefined;
    addPedRepos?: string | null;
    idPedRepos?: number | null;
  }>;
};

type EstoqueMovRow = {
  QTEST?: number;
  QTESTGER?: number;
  QTRESERV?: number;
  QTPENDENTE?: number;
  AVARIA?: number;
  QT_BLOQUEADO?: number;
  DISPONIVEL?: number;
  DTMOVLOG?: string | Date | null;
  QT?: number;
  CODOPER?: string | null;
  QTAVARIA?: number;
};

type ContagensPorProdutoRow = {
  ID_INVENTARIO?: number;
  NOME_INVENTARIO?: string;
  LOCAL_CONTAGEM?: string;
  NOME_USUARIO?: string;
  FILIAL?: string;
  DATA?: string | Date | null;
  DATA_ENCERRAMENTO?: string | Date | null;
  RESPONSAVEL?: string;
  QT_CONTADA?: number;
};

const resolveBaseApi = (): string => {
  const env = import.meta.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
};

interface AjusteEstoqueModalProps {
  onClose: () => void;
  codUsuario?: string | number | null;
  codFilial?: string;
  nomeUsuario?: string | null;
}

const AjusteEstoqueModal: React.FC<AjusteEstoqueModalProps> = ({ onClose, codUsuario, codFilial, nomeUsuario }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string>('');
  const [inventarios, setInventarios] = useState<InventarioAgrupado[]>([]);
  const [produtosPendentes, setProdutosPendentes] = useState<ProdutoPendenteRow[]>([]);
  const [invAvancadoId, setInvAvancadoId] = useState<number | null>(null);
  const [inventariosFiltro, setInventariosFiltro] = useState<string>('');
  const [invProdutosFiltro, setInvProdutosFiltro] = useState<Record<number, string>>({});
  const [showInvDoc, setShowInvDoc] = useState<boolean>(false);
  const [invDocHtml, setInvDocHtml] = useState<string>('');
  const [invDocTitulo, setInvDocTitulo] = useState<string>('');
  const invDocIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [activeTab, setActiveTab] = useState<'avulsos' | 'pendentes'>('avulsos');
  const [avulsosDateFrom, setAvulsosDateFrom] = useState<string>('');
  const [avulsosDateTo, setAvulsosDateTo] = useState<string>('');
  const [pendentesDateFrom, setPendentesDateFrom] = useState<string>('');
  const [pendentesDateTo, setPendentesDateTo] = useState<string>('');
  const [showResumo, setShowResumo] = useState<boolean>(false);
  const [selInv, setSelInv] = useState<InventarioAgrupado | null>(null);
  const [selProd, setSelProd] = useState<InventarioAgrupado['produtos'][number] | null>(null);
  const [estoqueMovLoading, setEstoqueMovLoading] = useState<boolean>(false);
  const [estoqueMovErro, setEstoqueMovErro] = useState<string>('');
  const [estoqueMov, setEstoqueMov] = useState<EstoqueMovRow[]>([]);
  const [ajusteMsg, setAjusteMsg] = useState<string>('');
  const [ajusteOk, setAjusteOk] = useState<boolean | null>(null);
  const [showAvisoRotina, setShowAvisoRotina] = useState<boolean>(false);
  const entryOps = new Set(['E', 'ED', 'ET']);
  const exitOps = new Set(['S', 'SD', 'ST']);
  const [showModalNada, setShowModalNada] = useState<boolean>(false);
  const [showModalDesbloqAvaria, setShowModalDesbloqAvaria] = useState<boolean>(false);
  const [showModalDesbloqBloq, setShowModalDesbloqBloq] = useState<boolean>(false);
  const [showModalConfirmAjuste, setShowModalConfirmAjuste] = useState<boolean>(false);
  const [disponivelCorretoCalc, setDisponivelCorretoCalc] = useState<number | null>(null);
  const [showModalBloquearAvaria, setShowModalBloquearAvaria] = useState<boolean>(false);
  const [qtBloquearAvaria, setQtBloquearAvaria] = useState<number | null>(null);

  const [showModalRecontarConfirm, setShowModalRecontarConfirm] = useState<boolean>(false);
  const [invRecontarSel, setInvRecontarSel] = useState<InventarioAgrupado | null>(null);
  const [recontarLoading, setRecontarLoading] = useState<boolean>(false);
  const [recontarMsg, setRecontarMsg] = useState<string>('');
  const [recontarOk, setRecontarOk] = useState<boolean | null>(null);
  
  const [outrasContagensLoading, setOutrasContagensLoading] = useState<boolean>(false);
  const [outrasContagensErro, setOutrasContagensErro] = useState<string>('');
  const [outrasContagens, setOutrasContagens] = useState<ContagensPorProdutoRow[]>([]);
  const [finalizarHabilitado, setFinalizarHabilitado] = useState<boolean>(false);
  const [showModalPendenciasTratativas, setShowModalPendenciasTratativas] = useState<boolean>(false);
  const [showModalLogs, setShowModalLogs] = useState<boolean>(false);
  const [logsConteudo, setLogsConteudo] = useState<string>('');

  // Adicionar Produto
  const [showModalAddProd, setShowModalAddProd] = useState<boolean>(false);
  const [addProdSearch, setAddProdSearch] = useState('');
  const [addProdLoading, setAddProdLoading] = useState(false);
  const [addProdResults, setAddProdResults] = useState<any[]>([]);
  const [addProdError, setAddProdError] = useState('');
  const [addProdInv, setAddProdInv] = useState<InventarioAgrupado | null>(null);

  // P/Comprar
  const [showModalParaComprar, setShowModalParaComprar] = useState<boolean>(false);
  const [comprarInv, setComprarInv] = useState<InventarioAgrupado | null>(null);
  const [comprarProd, setComprarProd] = useState<InventarioAgrupado['produtos'][number] | null>(null);
  const [comprarPedidos, setComprarPedidos] = useState<any[]>([]);
  const [comprarPedidosLoading, setComprarPedidosLoading] = useState<boolean>(false);
  const [comprarPedidosErro, setComprarPedidosErro] = useState<string>('');
  const [comprarPedidoSelecionadoId, setComprarPedidoSelecionadoId] = useState<number | null>(null);
  const [comprarQt, setComprarQt] = useState<string>('');
  const [comprarSaving, setComprarSaving] = useState<boolean>(false);
  const [comprarMsg, setComprarMsg] = useState<string>('');
  const [comprarOk, setComprarOk] = useState<boolean | null>(null);

  const resolveNomeUsuarioCriacao = (): string => {
    const fromProp = String(nomeUsuario ?? '').trim();
    if (fromProp) return fromProp;
    try {
      const raw = localStorage.getItem('usuarioLogado') || '';
      if (!raw) return String(codUsuario ?? '').trim() || 'APP';
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const nome =
        String(obj?.usuario ?? '').trim() ||
        String(obj?.nome ?? '').trim() ||
        String(obj?.NOME ?? '').trim() ||
        String(obj?.login ?? '').trim();
      return nome || String(codUsuario ?? '').trim() || 'APP';
    } catch {
      return String(codUsuario ?? '').trim() || 'APP';
    }
  };

  const carregarPedidosParaComprar = async () => {
    setComprarPedidosLoading(true);
    setComprarPedidosErro('');
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/reposicao/pedidos?status=ABERTO`);
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(json?.message || 'Erro ao listar pedidos de reposição'));
      }
      const rows = Array.isArray(json?.rows) ? json.rows : [];
      setComprarPedidos(
        rows.filter((p: any) => String(p?.STATUSPEDIDO ?? '').trim().toUpperCase() === 'ABERTO')
      );
    } catch (e) {
      setComprarPedidos([]);
      setComprarPedidosErro(e instanceof Error ? e.message : 'Erro ao listar pedidos de reposição');
    } finally {
      setComprarPedidosLoading(false);
    }
  };

  const abrirParaComprar = (inv: InventarioAgrupado, p: InventarioAgrupado['produtos'][number]) => {
    setComprarInv(inv);
    setComprarProd(p);
    setComprarPedidoSelecionadoId(null);
    setComprarPedidos([]);
    setComprarPedidosErro('');
    setComprarQt('');
    setComprarSaving(false);
    setComprarMsg('');
    setComprarOk(null);
    setShowModalParaComprar(true);
    void carregarPedidosParaComprar();
  };

  const fecharParaComprar = () => {
    setShowModalParaComprar(false);
    setComprarInv(null);
    setComprarProd(null);
    setComprarPedidos([]);
    setComprarPedidosErro('');
    setComprarPedidoSelecionadoId(null);
    setComprarQt('');
    setComprarSaving(false);
    setComprarMsg('');
    setComprarOk(null);
  };

  const comprarPedidoSelecionado = comprarPedidos.find((p) => Number(p?.ID) === Number(comprarPedidoSelecionadoId)) ?? null;
  const comprarQtNum = Number(String(comprarQt || '').replace(',', '.'));
  const comprarPodeAdicionar =
    Number.isFinite(Number(comprarPedidoSelecionadoId)) &&
    String(comprarPedidoSelecionado?.STATUSPEDIDO ?? '').trim().toUpperCase() === 'ABERTO' &&
    Number.isFinite(comprarQtNum) &&
    comprarQtNum > 0 &&
    !comprarSaving;

  const adicionarProdutoNoPedidoReposicao = async () => {
    if (!comprarProd || !comprarInv || !comprarPedidoSelecionado) return;
    const idPedido = Number(comprarPedidoSelecionado.ID);
    const codProd = Number(comprarProd.codProd);
    const codFornec = Number(comprarPedidoSelecionado.CODFORNEC);
    const qtReposicao = Number(String(comprarQt || '').replace(',', '.'));
    const usuarioCriacao = resolveNomeUsuarioCriacao();

    if (!Number.isFinite(idPedido)) {
      setComprarMsg('Selecione um pedido.');
      setComprarOk(false);
      return;
    }
    if (String(comprarPedidoSelecionado.STATUSPEDIDO ?? '').trim().toUpperCase() !== 'ABERTO') {
      setComprarMsg('Selecione um pedido ABERTO.');
      setComprarOk(false);
      return;
    }
    if (!Number.isFinite(codProd)) {
      setComprarMsg('Produto inválido.');
      setComprarOk(false);
      return;
    }
    if (!Number.isFinite(codFornec)) {
      setComprarMsg('Fornecedor do pedido selecionado inválido.');
      setComprarOk(false);
      return;
    }
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) {
      setComprarMsg('Informe uma quantidade válida.');
      setComprarOk(false);
      return;
    }

    setComprarSaving(true);
    setComprarMsg('');
    setComprarOk(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codProd,
          codAuxiliar: comprarProd.codAuxiliar ?? null,
          codFornec,
          qtReposicao,
          usuarioCriacao,
          idInventario: comprarInv.idInventario,
          idProduto: comprarProd.idProduto,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || 'Erro ao adicionar item no pedido'));
      }
      setComprarQt('');
      setComprarMsg('Item adicionado com sucesso.');
      setComprarOk(true);

      const idInv = Number(comprarInv.idInventario);
      const idProd = Number(comprarProd.idProduto);
      if (Number.isFinite(idInv) && Number.isFinite(idProd)) {
        setInventarios((prev) =>
          prev.map((inv) => {
            if (Number(inv.idInventario) !== idInv) return inv;
            return {
              ...inv,
              produtos: inv.produtos.map((p) =>
                Number(p.idProduto) === idProd
                  ? { ...p, addPedRepos: 'S', idPedRepos: idPedido }
                  : p
              ),
            };
          })
        );
        setComprarProd((prev) => (prev ? { ...prev, addPedRepos: 'S', idPedRepos: idPedido } : prev));
      }

      await carregarPedidosParaComprar();
    } catch (e) {
      setComprarMsg(e instanceof Error ? e.message : 'Erro ao adicionar item no pedido');
      setComprarOk(false);
    } finally {
      setComprarSaving(false);
    }
  };

  const abrirAddProduto = (inv: InventarioAgrupado) => {
    setAddProdInv(inv);
    setAddProdSearch('');
    setAddProdResults([]);
    setAddProdError('');
    setShowModalAddProd(true);
  };

  const buscarProdutosParaAdicionar = async () => {
    if (!addProdSearch.trim() || !addProdInv) return;
    setAddProdLoading(true);
    setAddProdError('');
    setAddProdResults([]);
    try {
      const baseApi = resolveBaseApi();
      const codFilial = addProdInv.filial;
      const q = encodeURIComponent(addProdSearch);
      const url = `${baseApi}/gestmkt/buscar-produto?q=${q}&codFilial=${codFilial}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Erro ao buscar produtos');
      setAddProdResults(json.rows || []);
      if ((json.rows || []).length === 0) setAddProdError('Nenhum produto encontrado.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro na busca';
      setAddProdError(msg);
    } finally {
      setAddProdLoading(false);
    }
  };

  const [showModalConfirmAddProd, setShowModalConfirmAddProd] = useState(false);
  const [prodParaAdicionar, setProdParaAdicionar] = useState<any>(null);

  const selecionarProdutoParaAdicionar = (prod: any) => {
    setProdParaAdicionar(prod);
    setShowModalConfirmAddProd(true);
  };

  const confirmarAddProdutoSim = async () => {
    if (!addProdInv || !prodParaAdicionar) return;
    
    setShowModalConfirmAddProd(false);
    setAddProdLoading(true);
    
    const codAux = prodParaAdicionar.CODAUXILIAR || '';
    if (!codAux) {
        setAddProdError('Produto sem código auxiliar (barras). Não é possível adicionar.');
        setAddProdLoading(false);
        setProdParaAdicionar(null);
        return;
    }

    try {
      const baseApi = resolveBaseApi();
      const url = `${baseApi}/gestpro/inventario/avulso/produto`;
      
      const body = {
        idInventario: addProdInv.idInventario,
        codProd: prodParaAdicionar.CODPROD,
        descricao: prodParaAdicionar.DESCRICAO,
        codAuxiliar: codAux,
        novaQuantidadeContada: 0
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.message || 'Erro ao adicionar produto.');
      }

      await executarBusca();
      fecharAddProduto();
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao adicionar produto';
      setAddProdError(msg);
    } finally {
      setAddProdLoading(false);
      setProdParaAdicionar(null);
    }
  };

  const fecharAddProduto = () => {
    setShowModalAddProd(false);
    setAddProdInv(null);
  };

  // Novo Inventário
  const [showNovoInventarioModal, setShowNovoInventarioModal] = useState<boolean>(false);
  const [novoInvNome, setNovoInvNome] = useState('');
  const [novoInvLocal, setNovoInvLocal] = useState('');
  const [novoInvFilial, setNovoInvFilial] = useState('');
  const [novoInvResponsavel, setNovoInvResponsavel] = useState('');
  const [novoInvUsuarioBusca, setNovoInvUsuarioBusca] = useState('');
  const [novoInvUsuarios, setNovoInvUsuarios] = useState<Array<{CODUSUR: number, NOME: string}>>([]);
  const [novoInvSelUsuario, setNovoInvSelUsuario] = useState<{CODUSUR: number, NOME: string} | null>(null);
  const [novoInvLoading, setNovoInvLoading] = useState(false);
  const [novoInvMsg, setNovoInvMsg] = useState('');

  const buscarUsuarios = async () => {
    if (!novoInvUsuarioBusca.trim()) return;
    setNovoInvLoading(true);
    setNovoInvMsg('');
    try {
      const baseApi = resolveBaseApi();
      const url = `${baseApi}/gestpro/usuarios?termo=${encodeURIComponent(novoInvUsuarioBusca)}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Erro ao buscar usuários');
      setNovoInvUsuarios(json.rows || []);
      if ((json.rows || []).length === 0) setNovoInvMsg('Nenhum usuário encontrado.');
    } catch (e) {
      setNovoInvMsg('Erro na busca de usuários');
    } finally {
      setNovoInvLoading(false);
    }
  };

  const abrirNovoInventario = () => {
    setNovoInvNome('');
    setNovoInvLocal('');
    setNovoInvFilial('');
    setNovoInvResponsavel('');
    setNovoInvUsuarioBusca('');
    setNovoInvUsuarios([]);
    setNovoInvSelUsuario(null);
    setNovoInvMsg('');
    setShowNovoInventarioModal(true);
  };

  const salvarNovoInventario = async () => {
    if (!novoInvNome || !novoInvLocal || !novoInvFilial || !novoInvResponsavel || !novoInvSelUsuario) {
      setNovoInvMsg('Preencha todos os campos obrigatórios.');
      return;
    }
    setNovoInvLoading(true);
    setNovoInvMsg('');
    try {
      const baseApi = resolveBaseApi();
      const url = `${baseApi}/gestpro/inventario/avulso`;
      const body = {
        nomeInventario: novoInvNome,
        localContagem: novoInvLocal,
        codusur: novoInvSelUsuario.CODUSUR,
        nomeUsuario: novoInvSelUsuario.NOME,
        filial: novoInvFilial,
        responsavel: novoInvResponsavel
      };
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Erro ao criar inventário');
      
      alert('Inventário criado com sucesso!');
      setShowNovoInventarioModal(false);
      executarBusca();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar inventário';
      setNovoInvMsg(msg);
    } finally {
      setNovoInvLoading(false);
    }
  };


  const executarBusca = async (opts?: { dataInicio?: string; dataFim?: string }) => {
    const baseApi = resolveBaseApi();
    setErro('');
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      // o backend suporta filtrar por usuário em outras rotas; se necessário, enviamos quando informado
      // mantém compatibilidade caso endpoint passe a aceitar opcionalmente codigoDoUsuario
      if (typeof (String as any) !== 'undefined') {
        const cod = (typeof codUsuario === 'number' || typeof codUsuario === 'string') ? String(codUsuario).trim() : '';
        if (cod) qp.set('codigoDoUsuario', cod);
      }

      const dataInicio = typeof opts?.dataInicio === 'string'
        ? opts.dataInicio
        : (activeTab === 'pendentes' ? pendentesDateFrom : avulsosDateFrom);
      const dataFim = typeof opts?.dataFim === 'string'
        ? opts.dataFim
        : (activeTab === 'pendentes' ? pendentesDateTo : avulsosDateTo);
      if (!dataInicio || !dataFim) {
        throw new Error('Informe as datas De e Até para pesquisar');
      }
      if (dataInicio) qp.set('dataInicio', dataInicio);
      if (dataFim) qp.set('dataFim', dataFim);

      const primaryUrl = qp.toString()
        ? `${baseApi}/gestpro/inventario/avulso/usuario/ajusteEstoque?${qp.toString()}`
        : `${baseApi}/gestpro/inventario/avulso/usuario/ajusteEstoque`;
      const primaryResp = await fetch(primaryUrl);
      const ct1 = primaryResp.headers.get('content-type') || '';
      const isJson1 = ct1.toLowerCase().includes('application/json');
      let dataJson: { 
        rows?: InventarioProdutoRow[]; 
        avulsos?: InventarioProdutoRow[];
        pendentes?: ProdutoPendenteRow[];
        message?: string 
      } | null = null;
      let dataText: string | null = null;
      if (isJson1) {
        dataJson = await primaryResp.json();
      } else {
        dataText = await primaryResp.text();
      }
      if (!primaryResp.ok || !isJson1) {
        const fallbackUrl = qp.toString()
          ? `${baseApi}/gestpro/inventario/avulso/usuario/ajusteEstoque?${qp.toString()}`
          : `${baseApi}/gestpro/inventario/avulso/usuario/ajusteEstoque`;
        const fbResp = await fetch(fallbackUrl);
        const ct2 = fbResp.headers.get('content-type') || '';
        const isJson2 = ct2.toLowerCase().includes('application/json');
        dataJson = null;
        dataText = null;
        if (isJson2) {
          dataJson = await fbResp.json();
        } else {
          dataText = await fbResp.text();
        }
        if (!fbResp.ok || !isJson2) {
          const message = isJson2 ? String(dataJson?.message || 'Falha ao buscar inventários avulsos') : String(dataText || 'Falha ao buscar inventários avulsos');
          throw new Error(message);
        }
      }
      
      const lista = Array.isArray(dataJson?.avulsos) 
          ? (dataJson?.avulsos ?? []) 
          : (Array.isArray(dataJson?.rows) ? (dataJson?.rows ?? []) : []);
      const listaPendentes = Array.isArray(dataJson?.pendentes) ? (dataJson?.pendentes ?? []) : [];
      setProdutosPendentes(listaPendentes);

      const arr = Array.isArray(lista) ? lista : [];
      const grouped: Record<number, InventarioAgrupado> = {};
      for (const r of arr) {
        const id = Number(r.ID_INVENTARIO ?? 0);
        if (!grouped[id]) {
          grouped[id] = {
            idInventario: id,
            filial: String(r.FILIAL ?? ''),
            nomeInventario: String(r.NOME_INVENTARIO ?? ''),
            localContagem: String(r.LOCAL_CONTAGEM ?? ''),
            nomeUsuario: String(r.NOME_USUARIO ?? ''),
            responsavel: String(r.RESPONSAVEL ?? ''),
            data: r.DATA,
            dataEncerramento: r.DATA_ENCERRAMENTO ?? null,
            produtos: [],
          };
        }
        grouped[id].produtos.push({
          idProduto: Number(r.ID_PRODUTO ?? 0),
          codProd: r.CODPROD,
          descricao: r.DESCRICAO,
          codAuxiliar: r.CODAUXILIAR,
          qtContada: r.QT_CONTADA,
          primeiraContagem: r.DATA_HORA_PRIMEIRA_CONTAGEM,
          ultimaContagem: r.DATA_HORA_ULTIMA_CONTAGEM,
          primeiraTratativa: r.DATA_HORA_PRIMEIRA_TRATATIVA,
          ultimaTratativa: r.DATA_HORA_ULTIMA_TRATATIVA,
          addPedRepos: r.ADD_PED_REPOS != null ? String(r.ADD_PED_REPOS) : null,
          idPedRepos: r.ID_PED_REPOS != null && Number.isFinite(Number(r.ID_PED_REPOS)) ? Number(r.ID_PED_REPOS) : null,
        });
      }
      const listaAgrupada = Object.values(grouped)
        .sort((a, b) => a.idInventario - b.idInventario)
        .map((inv) => ({
          ...inv,
          produtos: inv.produtos.sort((a, b) => a.idProduto - b.idProduto),
        }));
      setInventarios(listaAgrupada);
      if (listaAgrupada.length === 0) {
        setErro('Nenhum inventário avulso em aberto');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na consulta';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invAvancadoId === null) return;
    const existe = inventarios.some((i) => i.idInventario === invAvancadoId);
    if (!existe) setInvAvancadoId(null);
  }, [inventarios, invAvancadoId]);

  const invAvancadoSel = invAvancadoId === null ? null : (inventarios.find((i) => i.idInventario === invAvancadoId) ?? null);

  useEffect(() => {
    setInvProdutosFiltro((prev) => {
      const ids = new Set(inventarios.map((i) => i.idInventario));
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const id = Number(k);
        if (Number.isFinite(id) && ids.has(id)) next[id] = v;
      }
      return next;
    });
  }, [inventarios]);

  useEffect(() => {
    if (!invAvancadoSel) setShowInvDoc(false);
  }, [invAvancadoSel]);

  const toYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const from = toYmd(firstDay);
    const to = toYmd(lastDay);
    setAvulsosDateFrom((v) => v || from);
    setAvulsosDateTo((v) => v || to);
    setPendentesDateFrom((v) => v || from);
    setPendentesDateTo((v) => v || to);
  }, []);

  const normalizeForSearch = (v: unknown): string => {
    return String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  const getInventariosFiltrados = () => {
    const filtro = String(inventariosFiltro ?? '');
    const filtroNorm = normalizeForSearch(filtro);
    const lista = filtroNorm
      ? inventarios.filter((inv) => {
        const produtosStr = inv.produtos
          .map((p) => `${p.idProduto} ${p.codProd ?? ''} ${p.descricao ?? ''} ${p.codAuxiliar ?? ''}`)
          .join(' ');
        const hay = normalizeForSearch([
          inv.idInventario,
          inv.filial,
          inv.nomeInventario,
          inv.localContagem,
          inv.nomeUsuario,
          inv.responsavel,
          inv.data,
          inv.dataEncerramento,
          produtosStr,
        ].join(' '));
        return hay.includes(filtroNorm);
      })
      : inventarios;
    return { filtro, lista };
  };

  const getProdutosFiltrados = (inv: InventarioAgrupado) => {
    const filtro = String(invProdutosFiltro[inv.idInventario] ?? '');
    const filtroNorm = normalizeForSearch(filtro);
    const produtos = filtroNorm
      ? inv.produtos.filter((p) => {
        const hay = normalizeForSearch([
          p.idProduto,
          p.codProd,
          p.descricao,
          p.codAuxiliar,
          p.qtContada,
          p.primeiraContagem,
          p.ultimaContagem,
          p.primeiraTratativa,
          p.ultimaTratativa,
          p.addPedRepos,
          p.idPedRepos,
        ].join(' '));
        return hay.includes(filtroNorm);
      })
      : inv.produtos;
    return { filtro, produtos };
  };

  const escapeHtml = (value: unknown): string => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const gerarDocumentoInventario = (inv: InventarioAgrupado) => {
    const { filtro, produtos } = getProdutosFiltrados(inv);
    const geradoEm = new Date().toLocaleString('pt-BR');
    const titulo = `Inventário ${inv.idInventario} - ${inv.nomeInventario || 'Inventário'}`;
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
    .title { font-size: 16px; font-weight: 700; margin: 0 0 8px 0; }
    .meta { display: flex; gap: 18px; flex-wrap: wrap; margin: 0 0 10px 0; }
    .meta div { white-space: nowrap; }
    .muted { color: #555; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cfcfcf; padding: 4px 6px; vertical-align: top; }
    th { background: #f2f2f2; font-weight: 700; }
    .nowrap { white-space: nowrap; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="title">${escapeHtml(titulo)}</div>
  <div class="meta muted">
    <div><strong>ID:</strong> ${escapeHtml(inv.idInventario)}</div>
    <div><strong>Filial:</strong> ${escapeHtml(inv.filial)}</div>
    <div><strong>Local:</strong> ${escapeHtml(inv.localContagem)}</div>
    <div><strong>Usuário:</strong> ${escapeHtml(inv.nomeUsuario)}</div>
    <div><strong>Responsável:</strong> ${escapeHtml(inv.responsavel)}</div>
    <div><strong>Data:</strong> ${escapeHtml(inv.data || '')}</div>
    <div><strong>Encerrado:</strong> ${escapeHtml(inv.dataEncerramento ? String(inv.dataEncerramento) : 'Em andamento')}</div>
    <div><strong>Gerado em:</strong> ${escapeHtml(geradoEm)}</div>
    ${filtro.trim() ? `<div><strong>Filtro:</strong> ${escapeHtml(filtro)}</div>` : ''}
    <div><strong>Total linhas:</strong> ${escapeHtml(produtos.length)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 6%;">Id</th>
        <th style="width: 7%;">Cód.</th>
        <th style="width: 55%;">Descrição</th>
        <th style="width: 22%;">Barras</th>
        <th style="width: 10%;">Qt</th>
      </tr>
    </thead>
    <tbody>
      ${produtos.length === 0
        ? `<tr><td colspan="5">Sem produtos</td></tr>`
        : produtos.map((p) => `
          <tr>
            <td class="nowrap">${escapeHtml(p.idProduto)}</td>
            <td class="nowrap">${escapeHtml(p.codProd ?? '')}</td>
            <td class="truncate" title="${escapeHtml(p.descricao ?? '')}">${escapeHtml(p.descricao ?? '')}</td>
            <td class="truncate" title="${escapeHtml(p.codAuxiliar ?? '')}">${escapeHtml(p.codAuxiliar ?? '')}</td>
            <td class="nowrap">${escapeHtml(p.qtContada ?? '')}</td>
          </tr>
        `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    setInvDocTitulo(titulo);
    setInvDocHtml(html);
    setShowInvDoc(true);
  };

  const renderInventarioCard = (inv: InventarioAgrupado, fullscreen: boolean) => {
    const isEncerrado = inv.dataEncerramento && String(inv.dataEncerramento).trim() !== '';
    const cardStyle: React.CSSProperties = {
      backgroundColor: isEncerrado ? 'rgba(25, 135, 84, 0.15)' : 'rgba(255, 165, 0, 0.15)',
    };

    const { filtro, produtos: produtosFiltrados } = getProdutosFiltrados(inv);

    const tableBoxStyle: React.CSSProperties = fullscreen
      ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }
      : { maxHeight: '240px', overflowY: 'auto' };

    return (
      <div
        key={inv.idInventario}
        className={`card border-0 ${fullscreen ? 'h-100 d-flex flex-column' : 'mb-1'}`}
        style={{ ...cardStyle, ...(fullscreen ? { minHeight: 0, overflow: 'hidden' } : {}) }}
      >
        <div className={`card-body ${fullscreen ? 'd-flex flex-column flex-grow-1 py-2' : 'py-2 px-2'}`} style={fullscreen ? { minHeight: 0, overflow: 'hidden' } : undefined}>
          <div className={`d-flex justify-content-between align-items-start gap-2 flex-shrink-0 ${fullscreen ? 'mb-2' : 'mb-0'}`}>
            <div>
              <strong>
                <i className="bi bi-box-seam me-1"></i>
                {inv.nomeInventario || 'Inventário'}
              </strong>
              <div
                className="text-muted d-flex gap-3 flex-wrap"
                style={{ fontSize: '0.7rem', lineHeight: fullscreen ? undefined : 1.15 }}
              >
                <span><i className="bi bi-hash me-1"></i>ID {inv.idInventario}</span>
                <span><i className="bi bi-shop me-1"></i>Filial {inv.filial}</span>
                <span><i className="bi bi-geo-alt me-1"></i>Local {inv.localContagem}</span>
                {!fullscreen && (
                  <span><i className="bi bi-box-seam me-1"></i>{inv.produtos.length} produto{inv.produtos.length === 1 ? '' : 's'}</span>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', lineHeight: fullscreen ? undefined : 1.15 }} className="mt-1">
                <div><i className="bi bi-person me-1"></i>Usuário: {inv.nomeUsuario}</div>
                <div><i className="bi bi-person-gear me-1"></i>Responsável: {inv.responsavel}</div>
                <div><i className="bi bi-calendar-event me-1"></i>Data: {String(inv.data || '')}</div>
                <div><i className="bi bi-flag me-1"></i>Encerrado: {isEncerrado ? String(inv.dataEncerramento) : 'Em andamento'}</div>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap align-items-start justify-content-end flex-shrink-0">
              {!isEncerrado ? (
                <button type="button" className="btn btn-primary btn-gestpro btn-sm py-1 px-2" style={{ fontSize: '0.7rem', lineHeight: 1.1 }} onClick={() => abrirAddProduto(inv)}>
                  <i className="bi bi-plus-circle me-1"></i>
                  Adicionar Produto
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-outline-warning btn-gestpro btn-sm py-1 px-2" style={{ fontSize: '0.7rem', lineHeight: 1.1 }} onClick={() => abrirRecontar(inv)}>
                    <i className="bi bi-arrow-counterclockwise me-1"></i>
                    Recontar
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-gestpro btn-sm py-1 px-2"
                    style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                    onClick={() => {
                      const todosComTratativas = inv.produtos.every((pp) => {
                        const p1 = String(pp.primeiraTratativa ?? '').trim();
                        const pU = String(pp.ultimaTratativa ?? '').trim();
                        return p1 !== '' && pU !== '';
                      });
                      if (!todosComTratativas) {
                        setShowModalPendenciasTratativas(true);
                        return;
                      }
                      alert('Inventário pode ser finalizado. Todas as tratativas estão preenchidas.');
                    }}
                  >
                    <i className="bi bi-check2-circle me-1"></i>
                    Finalizar
                  </button>
                </>
              )}
              {!fullscreen && (
                <button
                  type="button"
                  className="btn btn-outline-dark btn-gestpro btn-sm py-1 px-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={() => setInvAvancadoId(inv.idInventario)}
                >
                  <i className="bi bi-arrows-fullscreen me-1"></i>
                  Avançado
                </button>
              )}
            </div>
          </div>
          {fullscreen && (
            <>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1 w-100 flex-shrink-0">
            {filtro.trim() !== '' ? (
              <div className="text-muted me-auto" style={{ fontSize: '0.7rem' }}>
                {produtosFiltrados.length}/{inv.produtos.length}
              </div>
            ) : (
              <div className="me-auto" />
            )}
            <div className="input-group input-group-sm" style={{ maxWidth: fullscreen ? 220 : 180 }}>
              <span className="input-group-text" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-funnel me-1"></i>
                Filtro
              </span>
              <input
                type="text"
                className="form-control"
                value={filtro}
                onChange={(e) => setInvProdutosFiltro((prev) => ({ ...prev, [inv.idInventario]: e.target.value }))}
                placeholder="Código, descrição, barras, id..."
                style={{ fontSize: '0.72rem' }}
              />
              {filtro.trim() !== '' && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setInvProdutosFiltro((prev) => ({ ...prev, [inv.idInventario]: '' }))}
                  style={{ fontSize: '0.7rem' }}
                  title="Limpar filtro"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>
          <div
            className="mt-1 table-responsive"
            style={{
              ...tableBoxStyle,
              scrollbarGutter: 'stable',
              paddingRight: fullscreen ? 12 : 0,
            }}
          >
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.72rem", width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th className="text-center" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-hash me-1"></i>Id</th>
                  <th className="text-center" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-upc me-1"></i>Cód.</th>
                  <th className="text-start" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-card-text me-1"></i>Descrição</th>
                  <th className="text-start" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-upc-scan me-1"></i>Barras</th>
                  <th className="text-center" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-123 me-1"></i>Qt</th>
                  <th className="text-center" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-tools me-1"></i>1ª T.</th>
                  <th className="text-center" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-tools me-1"></i>Últ. T.</th>
                  <th className="text-center text-nowrap" style={{ backgroundColor: '#f8f9fa' }}><i className="bi bi-cart-check me-1"></i>Ped. Rep.</th>
                  <th className="text-center text-nowrap" style={{ backgroundColor: '#f8f9fa', paddingRight: '1.75rem' }}><i className="bi bi-gear me-1"></i>Ações</th>
                </tr>
              </thead>
              <tbody>
                {inv.produtos.length === 0 ? (
                  <tr><td colSpan={9}>Sem produtos</td></tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr><td colSpan={9}>Nenhum produto encontrado para o filtro.</td></tr>
                ) : (
                  produtosFiltrados.map((p) => {
                    const temPedRepos = String(p.addPedRepos ?? '').trim().toUpperCase() === 'S' || (p.idPedRepos != null && Number.isFinite(Number(p.idPedRepos)));
                    return (
                    <tr key={`${inv.idInventario}-${p.idProduto}`}>
                      <td className="text-center">{String(p.idProduto)}</td>
                      <td className="text-center">{String(p.codProd ?? '')}</td>
                      <td className="text-start text-truncate">{String(p.descricao ?? '')}</td>
                      <td className="text-start text-truncate">{String(p.codAuxiliar ?? '')}</td>
                      <td className="text-center">{String(p.qtContada ?? '')}</td>
                      <td className="text-center" title={String(p.primeiraTratativa ?? '')}><div className="text-truncate">{String(p.primeiraTratativa ?? '')}</div></td>
                      <td className="text-center" title={String(p.ultimaTratativa ?? '')}><div className="text-truncate">{String(p.ultimaTratativa ?? '')}</div></td>
                      <td className="text-center">
                        {temPedRepos ? (
                          <span className="badge bg-success" title="Já adicionado em pedido de reposição" style={{ fontSize: '0.65rem' }}>
                            {String(p.idPedRepos ?? '-')}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="text-center" style={{ whiteSpace: 'nowrap', paddingRight: '1.75rem' }}>
                        <div className="d-inline-flex align-items-center gap-1 flex-nowrap justify-content-center pe-1">
                          {isEncerrado && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-0 px-1"
                              style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                              onClick={() => abrirResumo(inv, p)}
                            >
                              <i className="bi bi-tools me-1"></i>
                              Tratar
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success py-0 px-1"
                            style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                            title="Enviar para compra"
                            onClick={() => abrirParaComprar(inv, p)}
                          >
                            <i className="bi bi-cart-plus me-1"></i>
                            P/Comprar
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const abrirResumo = async (inv: InventarioAgrupado, p: InventarioAgrupado['produtos'][number]) => {
    setSelInv(inv);
    setSelProd(p);
    setShowResumo(true);
    setEstoqueMovErro('');
    setEstoqueMov([]);
    setAjusteMsg('');
    setAjusteOk(null);
    setOutrasContagensErro('');
    setOutrasContagens([]);
    setFinalizarHabilitado(false);
    const codFilialStr = String(inv.filial ?? '').trim();
    const codProdStr = String(p.codProd ?? '').trim();
    const dataHoraInicioStr = String(p.primeiraContagem ?? '').trim();
    if (!codFilialStr || !codProdStr || !dataHoraInicioStr) {
      setEstoqueMovErro('Parâmetros para consulta ausentes');
      return;
    }
    setEstoqueMovLoading(true);
    setOutrasContagensLoading(true);
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams();
      params.set('codFilial', codFilialStr);
      params.set('codProduto', codProdStr);
      params.set('dataHoraInicio', dataHoraInicioStr);
      const url = `${baseApi}/gestpro/estoque-e-movimentos?${params.toString()}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) {
        const msg = String(json?.message ?? 'Falha ao buscar estoque/movimentos');
        throw new Error(msg);
      }
      const rows = Array.isArray(json?.rows) ? (json.rows as unknown as EstoqueMovRow[]) : [];
      setEstoqueMov(rows);
      if (rows.length > 0) {
        const entradas = rows.reduce((acc, m) => acc + (entryOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
        const saidas = rows.reduce((acc, m) => acc + (exitOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
        const qtContada = Number(p.qtContada ?? 0);
        const disponivelCorreto = qtContada + entradas - saidas;
        const disponivelSistema = Number(rows[0]?.DISPONIVEL ?? 0);
        const diff = disponivelCorreto - disponivelSistema;
        const jaTemPrimeiraTrat = String(p.primeiraTratativa ?? '').trim() !== '';
        setFinalizarHabilitado(diff === 0 && !jaTemPrimeiraTrat);
      } else {
        setFinalizarHabilitado(false);
      }

      const params2 = new URLSearchParams();
      params2.set('codProduto', codProdStr);
      params2.set('idInventario', String(inv.idInventario));
      const url2 = `${baseApi}/gestpro/inventario/avulso/contagens-por-produto?${params2.toString()}`;
      const resp2 = await fetch(url2);
      const json2 = await resp2.json();
      if (!resp2.ok) {
        const msg2 = String(json2?.message ?? 'Falha ao buscar contagens por produto');
        throw new Error(msg2);
      }
      const rows2 = Array.isArray(json2?.rows) ? (json2.rows as unknown as ContagensPorProdutoRow[]) : [];
      setOutrasContagens(rows2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na consulta de estoque/movimentos';
      setEstoqueMovErro(msg);
      setOutrasContagensErro(msg);
    } finally {
      setEstoqueMovLoading(false);
      setOutrasContagensLoading(false);
    }
  };

  const sincronizarResumo = async () => {
    if (!selInv || !selProd) return;
    setEstoqueMovErro('');
    setAjusteMsg('');
    setAjusteOk(null);
    setShowAvisoRotina(false);
    setShowModalNada(false);
    setShowModalDesbloqAvaria(false);
    setShowModalDesbloqBloq(false);
    setShowModalConfirmAjuste(false);
    setEstoqueMov([]);
    setOutrasContagensErro('');
    setOutrasContagens([]);
    setFinalizarHabilitado(false);
    const codFilialStr = String(selInv.filial ?? '').trim();
    const codProdStr = String(selProd.codProd ?? '').trim();
    const dataHoraInicioStr = String(selProd.primeiraContagem ?? '').trim();
    if (!codFilialStr || !codProdStr || !dataHoraInicioStr) {
      setEstoqueMovErro('Parâmetros para consulta ausentes');
      return;
    }
    setEstoqueMovLoading(true);
    setOutrasContagensLoading(true);
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams();
      params.set('codFilial', codFilialStr);
      params.set('codProduto', codProdStr);
      params.set('dataHoraInicio', dataHoraInicioStr);
      const url = `${baseApi}/gestpro/estoque-e-movimentos?${params.toString()}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) {
        const msg = String(json?.message ?? 'Falha ao buscar estoque/movimentos');
        throw new Error(msg);
      }
      const rows = Array.isArray(json?.rows) ? (json.rows as unknown as EstoqueMovRow[]) : [];
      setEstoqueMov(rows);
      if (rows.length > 0) {
        const entradas = rows.reduce((acc, m) => acc + (entryOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
        const saidas = rows.reduce((acc, m) => acc + (exitOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
        const qtContada = Number(selProd?.qtContada ?? 0);
        const disponivelCorreto = qtContada + entradas - saidas;
        const disponivelSistema = Number(rows[0]?.DISPONIVEL ?? 0);
        const diff = disponivelCorreto - disponivelSistema;
        const jaTemPrimeiraTrat = String(selProd?.primeiraTratativa ?? '').trim() !== '';
        setFinalizarHabilitado(diff === 0 && !jaTemPrimeiraTrat);
      } else {
        setFinalizarHabilitado(false);
      }

      const params2 = new URLSearchParams();
      params2.set('codProduto', codProdStr);
      params2.set('idInventario', String(selInv.idInventario));
      const url2 = `${baseApi}/gestpro/inventario/avulso/contagens-por-produto?${params2.toString()}`;
      const resp2 = await fetch(url2);
      const json2 = await resp2.json();
      if (!resp2.ok) {
        const msg2 = String(json2?.message ?? 'Falha ao buscar contagens por produto');
        throw new Error(msg2);
      }
      const rows2 = Array.isArray(json2?.rows) ? (json2.rows as unknown as ContagensPorProdutoRow[]) : [];
      setOutrasContagens(rows2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na consulta de estoque/movimentos';
      setEstoqueMovErro(msg);
      setOutrasContagensErro(msg);
    } finally {
      setEstoqueMovLoading(false);
      setOutrasContagensLoading(false);
    }
  };

  const onAjustar = () => {
    setAjusteMsg('');
    setAjusteOk(null);
    setFinalizarHabilitado(false);
    const r = estoqueMov[0];
    if (!r) {
      setAjusteMsg('Dados de estoque indisponíveis');
      setAjusteOk(false);
      return;
    }
    const qtest = Number(r.QTEST);
    const qtestger = Number(r.QTESTGER);
    if (!Number.isFinite(qtest) || !Number.isFinite(qtestger)) {
      setAjusteMsg('Valores inválidos para comparação');
      setAjusteOk(false);
      return;
    }
    if (qtest === qtestger) {
      setAjusteMsg('');
      setAjusteOk(null);
      const entradas = estoqueMov.reduce((acc, m) => acc + (entryOps.has(String(m.CODOPER || '')) && Number(m.QTAVARIA || 0) === 0 ? Number(m.QT || 0) : 0), 0);
      const saidas = estoqueMov.reduce((acc, m) => acc + (exitOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
      const qtContada = Number(selProd?.qtContada ?? 0);
      const disponivelCorreto = qtContada + entradas - saidas;
      setDisponivelCorretoCalc(disponivelCorreto);
      const disponivelSistema = Number(r.DISPONIVEL ?? 0);
      const diff = disponivelCorreto - disponivelSistema;
      if (diff < 0) {
        setQtBloquearAvaria(Math.abs(diff));
        setShowModalBloquearAvaria(true);
        return;
      }
      if (diff === 0) {
        setShowModalNada(true);
        const jaTemPrimeiraTrat = String(selProd?.primeiraTratativa ?? '').trim() !== '';
        setFinalizarHabilitado(!jaTemPrimeiraTrat);
        return;
      }
      const avaria = Number(r.AVARIA ?? 0);
      if (avaria > 0) {
        setShowModalDesbloqAvaria(true);
        return;
      }
      const bloqueado = Number(r.QT_BLOQUEADO ?? 0);
      if (bloqueado > 0) {
        setShowModalDesbloqBloq(true);
        return;
      }
      setShowModalConfirmAjuste(true);
    } else {
      setAjusteMsg('Qt. Est. e Qt. Est. Ger. diferentes.');
      setAjusteOk(false);
      setFinalizarHabilitado(false);
      setShowAvisoRotina(true);
    }
  };

  const confirmarAjusteSim = () => {
    setShowModalConfirmAjuste(false);
    setAjusteMsg('Ajuste confirmado.');
    setAjusteOk(true);
  };

  const fecharResumo = () => {
    setShowResumo(false);
    setSelInv(null);
    setSelProd(null);
  };

  const finalizarResumo = async () => {
    if (!selInv || !selProd) return;
    try {
      const baseApi = resolveBaseApi();
      const url = `${baseApi}/gestpro/inventario/avulso/marcar-primeira-tratativa`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idInventario: selInv.idInventario, idCodProduto: selProd.idProduto }),
      });
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data = isJson ? await resp.json() : await resp.text();
      if (!resp.ok || !isJson) {
        const message = isJson ? String((data as any)?.message || 'Falha ao finalizar tratativa') : String(data || 'Falha ao finalizar tratativa');
        throw new Error(message);
      }
      fecharResumo();
      await executarBusca();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao finalizar tratativa';
      setAjusteMsg(msg);
      setAjusteOk(false);
    }
  };

  const abrirRecontar = (inv: InventarioAgrupado) => {
    setInvRecontarSel(inv);
    setRecontarMsg('');
    setRecontarOk(null);
    setShowModalRecontarConfirm(true);
  };

  const confirmarRecontarSim = async () => {
    if (!invRecontarSel) return;
    setRecontarLoading(true);
    setRecontarMsg('');
    setRecontarOk(null);
    try {
      const baseApi = resolveBaseApi();
      const url = `${baseApi}/gestpro/inventario/avulso/reabrir`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idInventario: invRecontarSel.idInventario }),
      });
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data = isJson ? await resp.json() : await resp.text();
      if (!resp.ok || !isJson) {
        const message = isJson ? String((data as any)?.message || 'Falha ao reabrir inventário') : String(data || 'Falha ao reabrir inventário');
        throw new Error(message);
      }
      setInventarios((prev) => prev.map((i) => i.idInventario === invRecontarSel.idInventario ? { ...i, dataEncerramento: null } : i));
      setRecontarOk(true);
      setRecontarMsg('Inventário reaberto para recontagem.');
      setShowModalRecontarConfirm(false);
      setInvRecontarSel(null);
      await executarBusca();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao reabrir inventário avulso';
      setRecontarOk(false);
      setRecontarMsg(msg);
    } finally {
      setRecontarLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3298, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3303 }}>
        <div className="modal-dialog modal-fullscreen" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2 d-flex align-items-center">
              <h5 className="modal-title me-3" style={{ fontSize: "0.9rem" }}>Ajuste de Estoque</h5>
              <button type="button" className="btn-close ms-auto" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body p-0 d-flex flex-column" style={{ fontSize: "0.75rem", overflow: "hidden" }}>
              <div className="px-2 pt-2 pb-2 border-bottom bg-white flex-shrink-0">
                <div className="d-flex flex-wrap align-items-end gap-2">
                  <div className="nav nav-pills">
                    <button
                      type="button"
                      className={`nav-link py-1 ${activeTab === 'avulsos' ? 'active' : ''}`}
                      onClick={() => setActiveTab('avulsos')}
                    >
                      <i className="bi bi-clipboard2-check me-1"></i>
                      Inventários Avulsos
                    </button>
                    <button
                      type="button"
                      className={`nav-link py-1 ${activeTab === 'pendentes' ? 'active' : ''}`}
                      onClick={() => setActiveTab('pendentes')}
                    >
                      <i className="bi bi-clipboard2-pulse me-1"></i>
                      Inventários de Produtos Pendentes
                    </button>
                  </div>
                  <div className="d-flex align-items-end gap-2 ms-auto">
                    <div className="d-flex flex-column">
                      <label className="form-label mb-1" style={{ fontSize: "0.7rem" }}>
                        <i className="bi bi-calendar-event me-1"></i>
                        De
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={activeTab === 'pendentes' ? pendentesDateFrom : avulsosDateFrom}
                        onChange={(e) => activeTab === 'pendentes' ? setPendentesDateFrom(e.target.value) : setAvulsosDateFrom(e.target.value)}
                        style={{ minWidth: 150 }}
                      />
                    </div>
                    <div className="d-flex flex-column">
                      <label className="form-label mb-1" style={{ fontSize: "0.7rem" }}>
                        <i className="bi bi-calendar-check me-1"></i>
                        Até
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={activeTab === 'pendentes' ? pendentesDateTo : avulsosDateTo}
                        onChange={(e) => activeTab === 'pendentes' ? setPendentesDateTo(e.target.value) : setAvulsosDateTo(e.target.value)}
                        style={{ minWidth: 150 }}
                      />
                    </div>
                    <div className="d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2"
                        style={{ fontSize: "0.7rem", height: 31, lineHeight: 1.1 }}
                        onClick={() => {
                          if (activeTab === 'pendentes') {
                            setPendentesDateFrom('');
                            setPendentesDateTo('');
                          } else {
                            setAvulsosDateFrom('');
                            setAvulsosDateTo('');
                          }
                        }}
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        Limpar
                      </button>
                    </div>
                    <div className="d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm px-2"
                        style={{ fontSize: "0.7rem", height: 31, lineHeight: 1.1 }}
                        disabled={
                          loading ||
                          (activeTab === 'pendentes'
                            ? !(pendentesDateFrom && pendentesDateTo)
                            : !(avulsosDateFrom && avulsosDateTo))
                        }
                        onClick={() => executarBusca()}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        {loading ? 'Pesquisando...' : 'Pesquisar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="container-fluid flex-grow-1 p-0" style={{ overflow: "hidden" }}>
                <div className="row h-100 g-0">
                  {activeTab === 'avulsos' ? (
                    <div className="col-12 h-100 d-flex flex-column">
                      <div className="border-bottom bg-light">
                        <div className="p-2 d-flex align-items-center gap-2">
                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <h6 className="m-0 fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
                              <i className="bi bi-clipboard2-check me-1"></i>
                              Inventários Avulsos
                            </h6>
                            <button className="btn btn-sm btn-success py-0 px-2" onClick={abrirNovoInventario} style={{ fontSize: "0.7rem" }}>
                              <i className="bi bi-plus-lg me-1"></i>
                              Novo
                            </button>
                          </div>
                          {(() => {
                            const { filtro, lista } = getInventariosFiltrados();
                            return (
                              <div className="d-flex align-items-center gap-2 ms-auto flex-grow-1 justify-content-end">
                                {filtro.trim() !== '' && (
                                  <div className="text-muted" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                    {lista.length}/{inventarios.length}
                                  </div>
                                )}
                                <div className="input-group input-group-sm" style={{ width: '100%', maxWidth: 280 }}>
                                  <span className="input-group-text" style={{ fontSize: '0.7rem' }}>
                                    <i className="bi bi-funnel me-1"></i>
                                    Filtro
                                  </span>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={filtro}
                                    onChange={(e) => setInventariosFiltro(e.target.value)}
                                    placeholder="ID, filial, nome, produto..."
                                    style={{ fontSize: '0.72rem' }}
                                  />
                                  {filtro.trim() !== '' && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary"
                                      onClick={() => setInventariosFiltro('')}
                                      style={{ fontSize: '0.7rem' }}
                                      title="Limpar filtro"
                                    >
                                      <i className="bi bi-x-lg"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {erro && (
                        <div className="alert alert-danger py-2 m-2 flex-shrink-0" role="alert" style={{ fontSize: "0.75rem" }}>{erro}</div>
                      )}

                      <div className="flex-grow-1 p-2" style={{ overflowY: "auto" }}>
                        {loading ? (
                          <div>Carregando...</div>
                        ) : inventarios.length === 0 ? (
                          <div>Nenhum inventário listado</div>
                        ) : (
                          (() => {
                            const { filtro, lista } = getInventariosFiltrados();
                            if (filtro.trim() !== '' && lista.length === 0) {
                              return <div>Nenhum inventário encontrado para o filtro.</div>;
                            }
                            return lista.map((inv) => renderInventarioCard(inv, false));
                          })()
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="col-12 h-100 d-flex flex-column bg-light">
                      <div className="border-bottom bg-white">
                        <div className="p-2 d-flex justify-content-between align-items-center">
                          <h6 className="m-0 fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-clipboard2-pulse me-1"></i>
                            Inventários de Produtos Pendentes
                          </h6>
                        </div>
                      </div>
                      <div className="flex-grow-1 p-2" style={{ overflowY: "auto" }}>
                        {loading ? (
                          <div>Carregando...</div>
                        ) : produtosPendentes.length === 0 ? (
                          <div>Nenhum produto pendente</div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.72rem", width: "100%" }}>
                              <thead>
                                <tr>
                                  <th><i className="bi bi-upc me-1"></i>Cód.</th>
                                  <th><i className="bi bi-card-text me-1"></i>Descrição</th>
                                  <th><i className="bi bi-upc-scan me-1"></i>Barras</th>
                                  <th><i className="bi bi-123 me-1"></i>Qt</th>
                                  <th><i className="bi bi-person me-1"></i>Usuário</th>
                                  <th><i className="bi bi-stopwatch me-1"></i>1ª Cont.</th>
                                  <th><i className="bi bi-clock me-1"></i>Últ. Cont.</th>
                                  <th><i className="bi bi-tools me-1"></i>1ª Trat.</th>
                                  <th><i className="bi bi-tools me-1"></i>Últ. Trat.</th>
                                  <th className="text-center"><i className="bi bi-gear me-1"></i>Ação</th>
                                </tr>
                              </thead>
                              <tbody>
                                {produtosPendentes.map((p, idx) => {
                                  const temUltimaCont = !!p.DATA_HORA_ULTIMA_CONTAGEM;
                                  return (
                                    <tr key={idx}>
                                      <td>{p.CODPROD}</td>
                                      <td className="text-truncate" style={{ maxWidth: '150px' }} title={p.DESCRICAO}>{p.DESCRICAO}</td>
                                      <td>{p.CODAUXILIAR}</td>
                                      <td>{p.QT_CONTADA}</td>
                                      <td title={`Cód: ${p.CODUSUR_ENVIO_CONTAGEM}`}>{p.NOME_USUARIO_ENVIO_CONTAGEM}</td>
                                      <td className="text-nowrap">{p.DATA_HORA_PRIMEIRA_CONTAGEM}</td>
                                      <td className="text-nowrap">{p.DATA_HORA_ULTIMA_CONTAGEM}</td>
                                      <td className="text-nowrap">{p.DATA_HORA_PRIMEIRA_TRATATIVA}</td>
                                      <td className="text-nowrap">{p.DATA_HORA_ULTIMA_TRATATIVA}</td>
                                      <td className="text-center">
                                        <div className="d-flex gap-1 justify-content-center">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-info py-0 px-2"
                                            style={{ fontSize: '0.7rem', width: '75px' }}
                                            onClick={() => {
                                              setLogsConteudo(p.LOGS_ENVIO_CONTAGENS || 'Sem logs disponíveis');
                                              setShowModalLogs(true);
                                            }}
                                          >
                                            <i className="bi bi-journal-text me-1"></i>
                                            Logs
                                          </button>
                                          <button
                                            className="btn btn-sm btn-outline-primary py-0 px-2"
                                            style={{ fontSize: '0.7rem', width: '85px' }}
                                            disabled={!temUltimaCont}
                                            onClick={() => {
                                              const fakeInv: InventarioAgrupado = {
                                                idInventario: 0,
                                                filial: codFilial || '',
                                                nomeInventario: 'PENDENTE',
                                                localContagem: '',
                                                nomeUsuario: p.NOME_USUARIO_ENVIO_CONTAGEM || '',
                                                responsavel: '',
                                                data: p.DATA_HORA_PRIMEIRA_CONTAGEM,
                                                produtos: []
                                              };
                                              const fakeProd: InventarioAgrupado['produtos'][number] = {
                                                idProduto: p.ID_PRODUTO || 0,
                                                codProd: p.CODPROD,
                                                descricao: p.DESCRICAO,
                                                codAuxiliar: p.CODAUXILIAR,
                                                qtContada: p.QT_CONTADA,
                                                primeiraContagem: p.DATA_HORA_PRIMEIRA_CONTAGEM,
                                                ultimaContagem: p.DATA_HORA_ULTIMA_CONTAGEM,
                                                primeiraTratativa: p.DATA_HORA_PRIMEIRA_TRATATIVA,
                                                ultimaTratativa: p.DATA_HORA_ULTIMA_TRATATIVA,
                                                addPedRepos: null,
                                                idPedRepos: null,
                                              };
                                              abrirResumo(fakeInv, fakeProd);
                                            }}
                                          >
                                            <i className="bi bi-tools me-1"></i>
                                            Tratar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showModalLogs && (
              <>
                <div className="modal-backdrop fade show" style={{ zIndex: 3320, backgroundColor: "rgba(0,0,0,0.35)" }} />
                <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3322 }}>
                  <div className="modal-dialog modal-dialog-centered" role="document">
                    <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                      <div className="modal-header py-2">
                        <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Logs de Envio</h5>
                        <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalLogs(false)} />
                      </div>
                      <div className="modal-body py-3" style={{ fontSize: "0.8rem", maxHeight: '60vh', overflowY: 'auto' }}>
                        {logsConteudo.split(' | ').map((linha, idx) => (
                          <div key={idx} className="mb-1 border-bottom pb-1">
                            {linha}
                          </div>
                        ))}
                      </div>
                      <div className="modal-footer py-2">
                        <button type="button" className="btn btn-secondary btn-gestpro" onClick={() => setShowModalLogs(false)}>Fechar</button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {invAvancadoSel && (
              <>
                <div className="modal-backdrop fade show" style={{ zIndex: 3304, backgroundColor: "rgba(0,0,0,0.35)" }} />
                <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3305, overflowX: "hidden" }}>
                  <div className="modal-dialog modal-fullscreen" role="document">
                    <div className="modal-content d-flex flex-column" style={{ fontSize: "0.75rem", overflowX: "hidden" }}>
                      <div className="modal-header py-2 d-flex align-items-center flex-wrap gap-2">
                        <div className="me-auto">
                          <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                            <i className="bi bi-arrows-fullscreen me-1"></i>
                            Inventário Avançado
                          </h5>
                          <div className="text-muted text-break" style={{ fontSize: "0.75rem" }}>
                            <span className="me-3"><i className="bi bi-hash me-1"></i>ID {String(invAvancadoSel.idInventario)}</span>
                            <span className="me-3"><i className="bi bi-shop me-1"></i>Filial {String(invAvancadoSel.filial)}</span>
                            <span><i className="bi bi-box-seam me-1"></i>{String(invAvancadoSel.nomeInventario || 'Inventário')}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => gerarDocumentoInventario(invAvancadoSel)}
                        >
                          <i className="bi bi-file-earmark-text me-1"></i>
                          Documento
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={() => setInvAvancadoId(null)}>
                          <i className="bi bi-x-circle me-1"></i>
                          Fechar
                        </button>
                      </div>
                      <div className="modal-body p-2 d-flex flex-column" style={{ overflow: "hidden", minHeight: 0, flex: 1 }}>
                        {renderInventarioCard(invAvancadoSel, true)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {showInvDoc && (
              <>
                <div className="modal-backdrop fade show" style={{ zIndex: 3311, backgroundColor: "rgba(0,0,0,0.35)" }} />
                <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3312, overflowX: "hidden" }}>
                  <div className="modal-dialog modal-fullscreen" role="document">
                    <div className="modal-content d-flex flex-column" style={{ fontSize: "0.75rem", overflowX: "hidden" }}>
                      <div className="modal-header py-2 d-flex align-items-center flex-wrap gap-2">
                        <div className="me-auto">
                          <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                            <i className="bi bi-file-earmark-text me-1"></i>
                            Documento
                          </h5>
                          <div className="text-muted text-break" style={{ fontSize: "0.75rem" }}>
                            {String(invDocTitulo || '')}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => {
                            const cw = invDocIframeRef.current?.contentWindow;
                            if (!cw) return;
                            cw.focus();
                            cw.print();
                          }}
                        >
                          <i className="bi bi-printer me-1"></i>
                          Imprimir
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={() => setShowInvDoc(false)}>
                          <i className="bi bi-x-circle me-1"></i>
                          Fechar
                        </button>
                      </div>
                      <div className="modal-body p-0 flex-grow-1" style={{ overflow: "hidden" }}>
                        <iframe
                          ref={invDocIframeRef}
                          title="Documento do inventário"
                          srcDoc={invDocHtml}
                          style={{ width: '100%', height: '100%', border: 0 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {showResumo && (
              <>
                <div className="modal-backdrop fade show" style={{ zIndex: 3306, backgroundColor: "rgba(0,0,0,0.35)" }} />
                <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3310, overflowX: "hidden" }}>
                  <div className="modal-dialog modal-fullscreen" role="document">
                    <div className="modal-content d-flex flex-column" style={{ fontSize: "0.75rem", overflowX: "hidden" }}>
                      <div className="modal-header py-2 d-flex align-items-center flex-wrap gap-2">
                        <div className="me-auto">
                          <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                            <i className="bi bi-clipboard2-data me-1"></i>
                            Resumo do Produto
                          </h5>
                          {selProd && selInv && (
                            <div className="text-muted text-break" style={{ fontSize: "0.75rem" }}>
                              <span className="me-3"><i className="bi bi-upc me-1"></i>{String(selProd.codProd ?? '')}</span>
                              <span className="me-3"><i className="bi bi-shop me-1"></i>Filial {String(selInv.filial ?? '')}</span>
                              <span><i className="bi bi-stopwatch me-1"></i>{String(selProd.primeiraContagem ?? '')}</span>
                            </div>
                          )}
                        </div>
                        <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={sincronizarResumo} disabled={estoqueMovLoading}>
                          <i className="bi bi-arrow-repeat me-1"></i>
                          Atualizar
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={fecharResumo}>
                          <i className="bi bi-x-circle me-1"></i>
                          Fechar
                        </button>
                      </div>
                      <div className="modal-body p-2 d-flex flex-column" style={{ fontSize: "0.75rem", lineHeight: 1.1, minHeight: 0, overflow: "hidden" }}>
                        <div className="container-fluid p-0 flex-grow-1" style={{ minHeight: 0, overflow: "hidden" }}>
                          <div className="row g-2 h-100" style={{ minHeight: 0 }}>
                            <div className="col-12 col-lg-6 d-flex flex-column" style={{ minHeight: 0 }}>
                              <div className="flex-grow-1" style={{ minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                                <div className="row g-2">
                                  <div className="col-12 col-xl-6">
                                    <div className="card border-0 bg-light">
                                      <div className="card-body py-2">
                                        <div className="fw-bold mb-1">
                                          <i className="bi bi-box-seam me-1"></i>
                                          Produto
                                        </div>
                                        <div className="d-flex flex-column gap-1 text-break">
                                          <div><i className="bi bi-hash me-1"></i>ID: {String(selProd?.idProduto ?? '')}</div>
                                          <div><i className="bi bi-upc me-1"></i>Código: {String(selProd?.codProd ?? '')}</div>
                                          <div><i className="bi bi-upc-scan me-1"></i>Barras: {String(selProd?.codAuxiliar ?? '')}</div>
                                          <div><i className="bi bi-card-text me-1"></i>Descrição: {String(selProd?.descricao ?? '')}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-12 col-xl-6">
                                    <div className="card border-0 bg-light">
                                      <div className="card-body py-2">
                                        <div className="fw-bold mb-1">
                                          <i className="bi bi-clipboard2-check me-1"></i>
                                          Inventário
                                        </div>
                                        <div className="d-flex flex-column gap-1 text-break">
                                          <div><i className="bi bi-box me-1"></i>Nome: {String(selInv?.nomeInventario ?? '')}</div>
                                          <div><i className="bi bi-hash me-1"></i>ID: {String(selInv?.idInventario ?? '')}</div>
                                          <div><i className="bi bi-shop me-1"></i>Filial: {String(selInv?.filial ?? '')}</div>
                                          <div><i className="bi bi-geo-alt me-1"></i>Local: {String(selInv?.localContagem ?? '')}</div>
                                          <div><i className="bi bi-person me-1"></i>Usuário: {String(selInv?.nomeUsuario ?? '')}</div>
                                          <div><i className="bi bi-person-gear me-1"></i>Responsável: {String(selInv?.responsavel ?? '')}</div>
                                          <div><i className="bi bi-calendar-event me-1"></i>Data: {String(selInv?.data ?? '')}</div>
                                          <div><i className="bi bi-flag me-1"></i>Encerrado: {String(selInv?.dataEncerramento ?? '')}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="card border-0 bg-light mt-2">
                                  <div className="card-body py-2">
                                    <div className="fw-bold mb-1">
                                      <i className="bi bi-clipboard2-pulse me-1"></i>
                                      Contagens e Tratativas
                                    </div>
                                    <div className="row g-2">
                                      <div className="col-12 col-md-6">
                                        <div><i className="bi bi-123 me-1"></i>Qtd contada: {String(selProd?.qtContada ?? '')}</div>
                                        <div><i className="bi bi-stopwatch me-1"></i>1ª Contagem: {String(selProd?.primeiraContagem ?? '')}</div>
                                        <div><i className="bi bi-clock me-1"></i>Últ. Contagem: {String(selProd?.ultimaContagem ?? '')}</div>
                                      </div>
                                      <div className="col-12 col-md-6">
                                        <div><i className="bi bi-tools me-1"></i>1ª Tratativa: {String(selProd?.primeiraTratativa ?? '')}</div>
                                        <div><i className="bi bi-tools me-1"></i>Últ. Tratativa: {String(selProd?.ultimaTratativa ?? '')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-2">
                                  {outrasContagensLoading ? (
                                    <div><i className="bi bi-search me-1"></i>Consultando outros inventários...</div>
                                  ) : outrasContagensErro ? (
                                    <div className="text-danger"><i className="bi bi-exclamation-triangle me-1"></i>{outrasContagensErro}</div>
                                  ) : (
                                    <div className="card border-0 bg-light">
                                      <div className="card-body py-2">
                                        <div className="fw-bold mb-1">
                                          <i className="bi bi-collection me-1"></i>
                                          Outros Inventários
                                        </div>
                                        <div className="table-responsive" style={{ maxHeight: 220, overflowY: "auto" }}>
                                          <table className="table table-sm table-hover align-middle" style={{ fontSize: "0.72rem", width: "100%", tableLayout: "fixed" }}>
                                            <thead>
                                              <tr>
                                                <th style={{ width: '12%' }}><i className="bi bi-hash me-1"></i>ID</th>
                                                <th style={{ width: '24%' }}><i className="bi bi-box me-1"></i>Inventário</th>
                                                <th style={{ width: '10%' }}><i className="bi bi-shop me-1"></i>Filial</th>
                                                <th style={{ width: '18%' }}><i className="bi bi-geo-alt me-1"></i>Local</th>
                                                <th style={{ width: '20%' }}><i className="bi bi-person me-1"></i>Usuário</th>
                                                <th style={{ width: '8%' }}><i className="bi bi-123 me-1"></i>Qt</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {outrasContagens.length === 0 ? (
                                                <tr><td colSpan={6}>Produto não está em outros inventários</td></tr>
                                              ) : (
                                                outrasContagens.map((r, idx) => (
                                                  <tr key={`oc-${idx}`}>
                                                    <td>{String(r.ID_INVENTARIO ?? '')}</td>
                                                    <td className="text-truncate">{String(r.NOME_INVENTARIO ?? '')}</td>
                                                    <td>{String(r.FILIAL ?? '')}</td>
                                                    <td className="text-truncate">{String(r.LOCAL_CONTAGEM ?? '')}</td>
                                                    <td className="text-truncate">{String(r.NOME_USUARIO ?? '')}</td>
                                                    <td>{String(r.QT_CONTADA ?? '')}</td>
                                                  </tr>
                                                ))
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="col-12 col-lg-6 d-flex flex-column" style={{ minHeight: 0 }}>
                              <div className="flex-grow-1" style={{ minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                                {estoqueMovLoading ? (
                                  <div><i className="bi bi-hourglass-split me-1"></i>Consultando estoque e movimentos...</div>
                                ) : estoqueMovErro ? (
                                  <div className="text-danger"><i className="bi bi-exclamation-triangle me-1"></i>{estoqueMovErro}</div>
                                ) : (
                                  <>
                                    {estoqueMov.length > 0 && (
                                      <div className="card border-0 bg-light mb-2">
                                        <div className="card-body py-2">
                                          <div className="fw-bold mb-1">
                                            <i className="bi bi-boxes me-1"></i>
                                            Estoque Atual
                                          </div>
                                          <div className="row g-2">
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-box-seam me-1"></i>Estoque</div>
                                                  <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.QTEST ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-building me-1"></i>Gerêncial</div>
                                                  <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.QTESTGER ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-lock me-1"></i>Reservado</div>
                                                  <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.QTRESERV ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-hourglass me-1"></i>Pendente</div>
                                                  <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.QTPENDENTE ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-exclamation-triangle me-1"></i>Avaria</div>
                                                  <div className="fw-semibold text-danger" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.AVARIA ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-slash-circle me-1"></i>Bloqueado</div>
                                                  <div className="fw-semibold text-warning" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.QT_BLOQUEADO ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-6 col-md-3 col-lg-3">
                                              <div className="card border-0 shadow-sm h-100">
                                                <div className="card-body py-2 px-2">
                                                  <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-check-circle me-1"></i>Disponível</div>
                                                  <div className="fw-semibold text-success" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(estoqueMov[0]?.DISPONIVEL ?? '')}</div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="card border-0 bg-light mb-2">
                                      <div className="card-body py-2">
                                        <div className="fw-bold mb-1">
                                          <i className="bi bi-arrow-left-right me-1"></i>
                                          Movimentos
                                        </div>
                                        <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
                                          <table className="table table-sm table-hover align-middle" style={{ fontSize: "0.72rem", width: "100%", tableLayout: "fixed" }}>
                                            <thead>
                                              <tr>
                                                <th style={{ width: '32%' }}><i className="bi bi-calendar-event me-1"></i>Dt. Movimentação</th>
                                                <th style={{ width: '18%' }}><i className="bi bi-123 me-1"></i>Qt. Movimentação</th>
                                                <th style={{ width: '18%' }}><i className="bi bi-arrows-left-right me-1"></i>Tipo Movimentação</th>
                                                <th style={{ width: '12%' }}><i className="bi bi-exclamation-triangle me-1"></i>Qt. Avaria</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {estoqueMov.length === 0 ? (
                                                <tr><td colSpan={4}>Sem movimentos</td></tr>
                                              ) : (
                                                estoqueMov.map((m, idx) => (
                                                  <tr key={`mov-${idx}`}>
                                                    <td className="text-truncate">{String(m.DTMOVLOG ?? '')}</td>
                                                    <td>{String(m.QT ?? '')}</td>
                                                    <td>{String(m.CODOPER ?? '')}</td>
                                                    <td className={Number(m.QTAVARIA || 0) !== 0 ? 'text-danger' : ''}>{String(m.QTAVARIA ?? '')}</td>
                                                  </tr>
                                                ))
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </div>

                                    {(() => {
                                      const entradas = estoqueMov.reduce((acc, m) => acc + (entryOps.has(String(m.CODOPER || '')) && Number(m.QTAVARIA || 0) === 0 ? Number(m.QT || 0) : 0), 0);
                                      const saidas = estoqueMov.reduce((acc, m) => acc + (exitOps.has(String(m.CODOPER || '')) ? Number(m.QT || 0) : 0), 0);
                                      const qtContada = Number(selProd?.qtContada ?? 0);
                                      const disponivelCorreto = qtContada + entradas - saidas;
                                      const disponivelSistema = Number(estoqueMov[0]?.DISPONIVEL ?? 0);
                                      const diff = disponivelCorreto - disponivelSistema;
                                      return (
                                        <div className="card border-0 bg-light">
                                          <div className="card-body py-2">
                                            <div className="fw-bold mb-1">
                                              <i className="bi bi-calculator me-1"></i>
                                              Cálculo — Disponível (pós 1ª contagem)
                                            </div>
                                            <div className="row g-2">
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-123 me-1"></i>Qtd contada</div>
                                                    <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(qtContada)}</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-box-arrow-in-down me-1"></i>Entradas</div>
                                                    <div className="fw-semibold text-success" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(entradas)}</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-box-arrow-up-right me-1"></i>Saídas</div>
                                                    <div className="fw-semibold text-danger" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(saidas)}</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}>
                                                      <i className="bi bi-check2-square me-1"></i>
                                                      Disponível correto
                                                    </div>
                                                    <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(disponivelCorreto)}</div>
                                                    <div className="text-muted" style={{ fontSize: "0.65rem" }}>contada + entradas - saídas</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-pc-display me-1"></i>Disponível (sistema)</div>
                                                    <div className="fw-semibold" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(disponivelSistema)}</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="col-6 col-md-4 col-lg-4">
                                                <div className="card border-0 shadow-sm h-100">
                                                  <div className="card-body py-2 px-2">
                                                    <div className="text-muted text-uppercase" style={{ fontSize: "0.65rem" }}><i className="bi bi-plus-slash-minus me-1"></i>Diferença</div>
                                                    <div className={`fw-semibold ${diff === 0 ? '' : diff > 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>{String(diff)}</div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}

                                {ajusteMsg && (
                                  <div className={`alert ${ajusteOk ? 'alert-success' : 'alert-danger'} mt-2 py-2`} style={{ fontSize: '0.75rem' }}>
                                    <i className={`bi ${ajusteOk ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-1`}></i>
                                    {ajusteMsg}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
                        <button type="button" className="btn btn-success btn-gestpro me-2" disabled={!finalizarHabilitado} onClick={finalizarResumo}>
                          <i className="bi bi-check2-circle me-1"></i>
                          Finalizar
                        </button>
                        <button type="button" className="btn btn-outline-primary btn-gestpro me-2" disabled={estoqueMovLoading || estoqueMov.length === 0} onClick={onAjustar}>
                          <i className="bi bi-wrench-adjustable-circle me-1"></i>
                          Ajustar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {showAvisoRotina && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '520px', width: '520px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Aviso
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowAvisoRotina(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-info-circle me-1"></i>
                          Rodar a rotina 1436 nos últimos 30 dias.
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowAvisoRotina(false)}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showModalNada && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '520px', width: '520px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-info-circle me-1"></i>
                            Aviso
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalNada(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-check-circle me-1"></i>
                          Nenhum ajuste necessário. Diferença igual a 0.
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowModalNada(false)}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showModalDesbloqAvaria && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '520px', width: '520px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-exclamation-octagon me-1"></i>
                            Ação necessária
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalDesbloqAvaria(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Existe quantidade em Avaria. Desbloqueie a quantidade antes de ajustar.
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowModalDesbloqAvaria(false)}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showModalDesbloqBloq && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '520px', width: '520px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-exclamation-octagon me-1"></i>
                            Ação necessária
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalDesbloqBloq(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-slash-circle me-1"></i>
                          Existe quantidade em Bloqueado. Desbloqueie a quantidade antes de ajustar.
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowModalDesbloqBloq(false)}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showModalConfirmAjuste && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '560px', width: '560px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-question-circle me-1"></i>
                            Confirmar ajuste
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalConfirmAjuste(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-wrench-adjustable-circle me-1"></i>
                          Deseja ajustar o estoque do produto <i className="bi bi-upc me-1"></i>{String(selProd?.codProd ?? '')}, na filial <i className="bi bi-shop me-1"></i>{String(selInv?.filial ?? '')}, para Disponível correto <i className="bi bi-check2-square me-1"></i>{String(disponivelCorretoCalc ?? '')}?
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-secondary btn-gestpro" onClick={() => setShowModalConfirmAjuste(false)}>
                            <i className="bi bi-x-circle me-1"></i>
                            Não
                          </button>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={confirmarAjusteSim}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Sim
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showModalBloquearAvaria && (
                  <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '560px', width: '560px' }}>
                      <div className="modal-content" style={{ fontSize: '0.75rem' }}>
                        <div className="modal-header py-2">
                          <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-exclamation-octagon me-1"></i>
                            Ação necessária
                          </h5>
                          <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalBloquearAvaria(false)} />
                        </div>
                        <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Diferença negativa. Bloqueie <i className="bi bi-123 me-1"></i>{String(qtBloquearAvaria ?? '')} em Avaria para alinhar o disponível.
                        </div>
                        <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                          <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowModalBloquearAvaria(false)}>
                            <i className="bi bi-check2-circle me-1"></i>
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {showModalRecontarConfirm && (
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '560px', width: '560px' }}>
            <div className="modal-content" style={{ fontSize: '0.75rem' }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Recontagem</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalRecontarConfirm(false)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                Deseja realmente voltar o inventário {String(invRecontarSel?.idInventario ?? '')} para recontagem?
                {recontarMsg && (
                  <div className={`alert ${recontarOk ? 'alert-success' : 'alert-danger'} mt-2 py-2`} style={{ fontSize: '0.75rem' }}>
                    {recontarMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                <button type="button" className="btn btn-secondary btn-gestpro" onClick={() => setShowModalRecontarConfirm(false)} disabled={recontarLoading}>Não</button>
                <button type="button" className="btn btn-primary btn-gestpro" onClick={confirmarRecontarSim} disabled={recontarLoading}>Sim</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModalPendenciasTratativas && (
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3312, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '520px', width: '520px' }}>
            <div className="modal-content" style={{ fontSize: '0.75rem' }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Aviso</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalPendenciasTratativas(false)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                Existem produtos sem 1ª/Últ. Tratativa preenchidas.
              </div>
              <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                <button type="button" className="btn btn-primary btn-gestpro" onClick={() => setShowModalPendenciasTratativas(false)}>Ok</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNovoInventarioModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3315, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3320 }}>
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                    <i className="bi bi-clipboard2-plus me-1"></i>
                    Novo Inventário Avulso
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowNovoInventarioModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.8rem" }}>
                  <div className="mb-2">
                    <label className="form-label mb-0">
                      <i className="bi bi-card-text me-1"></i>
                      Nome do Inventário *
                    </label>
                    <input type="text" className="form-control form-control-sm" value={novoInvNome} onChange={e => setNovoInvNome(e.target.value)} />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label mb-0">
                        <i className="bi bi-shop me-1"></i>
                        Filial *
                      </label>
                      <input type="text" className="form-control form-control-sm" value={novoInvFilial} onChange={e => setNovoInvFilial(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label mb-0">
                        <i className="bi bi-geo-alt me-1"></i>
                        Local Contagem *
                      </label>
                      <input type="text" className="form-control form-control-sm" value={novoInvLocal} onChange={e => setNovoInvLocal(e.target.value)} />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-0">
                      <i className="bi bi-person-gear me-1"></i>
                      Responsável *
                    </label>
                    <input type="text" className="form-control form-control-sm" value={novoInvResponsavel} onChange={e => setNovoInvResponsavel(e.target.value)} />
                  </div>
                  
                  <div className="mb-2">
                    <label className="form-label mb-0">
                      <i className="bi bi-person-search me-1"></i>
                      Usuário (Pesquisa por Nome/Cód) *
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={novoInvUsuarioBusca} 
                        onChange={e => setNovoInvUsuarioBusca(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && buscarUsuarios()}
                        placeholder="Digite nome ou código..."
                      />
                      <button className="btn btn-outline-secondary" type="button" onClick={buscarUsuarios} disabled={novoInvLoading}>
                        {novoInvLoading ? '...' : (
                          <>
                            <i className="bi bi-search me-1"></i>
                            Buscar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {novoInvUsuarios.length > 0 && (
                      <div className="list-group mb-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {novoInvUsuarios.map(u => (
                          <button 
                            key={u.CODUSUR} 
                            type="button" 
                            className={`list-group-item list-group-item-action py-1 px-2 ${novoInvSelUsuario?.CODUSUR === u.CODUSUR ? 'active' : ''}`}
                            onClick={() => setNovoInvSelUsuario(u)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {u.CODUSUR} - {u.NOME}
                          </button>
                        ))}
                      </div>
                  )}
                  
                  {novoInvSelUsuario && (
                    <div className="alert alert-info py-1 px-2 mb-2" style={{ fontSize: '0.75rem' }}>
                      <strong>
                        <i className="bi bi-check-circle me-1"></i>
                        Selecionado:
                      </strong> {novoInvSelUsuario.CODUSUR} - {novoInvSelUsuario.NOME}
                    </div>
                  )}

                  {novoInvMsg && <div className="text-danger mb-2">{novoInvMsg}</div>}
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNovoInventarioModal(false)}>
                    <i className="bi bi-x-circle me-1"></i>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={salvarNovoInventario} disabled={novoInvLoading}>
                    <i className="bi bi-check2-square me-1"></i>
                    Criar Inventário
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showModalConfirmAddProd && (
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3330, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '400px', width: '400px' }}>
            <div className="modal-content" style={{ fontSize: '0.75rem' }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar adição</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowModalConfirmAddProd(false)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                Deseja realmente adicionar o produto?<br/>
                <strong>{prodParaAdicionar?.DESCRICAO}</strong>
              </div>
              <div className="modal-footer py-2" style={{ fontSize: '0.75rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModalConfirmAddProd(false)}>Não</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={confirmarAddProdutoSim}>Sim</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalAddProd && (
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: 'block', zIndex: 3320, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content" style={{ fontSize: '0.75rem' }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                  Adicionar Produto — {addProdInv?.nomeInventario} (ID: {addProdInv?.idInventario})
                </h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={fecharAddProduto} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.75rem' }}>
                  <div className="input-group input-group-sm mb-3">
                      <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Pesquisar por código, descrição ou código auxiliar..." 
                          value={addProdSearch}
                          onChange={(e) => setAddProdSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && buscarProdutosParaAdicionar()}
                          autoFocus
                      />
                      <button 
                          className="btn btn-primary" 
                          type="button" 
                          onClick={buscarProdutosParaAdicionar}
                          disabled={addProdLoading}
                      >
                          {addProdLoading ? 'Buscando...' : 'Buscar'}
                      </button>
                  </div>

                  {addProdError && <div className="alert alert-danger py-2">{addProdError}</div>}

                  <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="table table-sm table-hover table-bordered mb-0">
                          <thead className="table-light sticky-top">
                              <tr>
                                  <th>Cód.</th>
                                  <th>Descrição</th>
                                  <th>Marca</th>
                                  <th className="text-end">Estoque</th>
                                  <th className="text-center" style={{ width: '80px' }}>Ação</th>
                              </tr>
                          </thead>
                          <tbody>
                              {addProdResults.map((prod) => (
                                  <tr key={prod.CODPROD}>
                                      <td>{prod.CODPROD}</td>
                                      <td>
                                          {prod.DESCRICAO}
                                          {prod.CODAUXILIAR && <div className="text-muted small">Aux: {prod.CODAUXILIAR}</div>}
                                      </td>
                                      <td>{prod.MARCA}</td>
                                      <td className="text-end">{prod.DISPONIVEL}</td>
                                      <td className="text-center">
                                          <button 
                                              className="btn btn-sm btn-success p-0 px-2" 
                                              onClick={() => selecionarProdutoParaAdicionar(prod)}
                                              title="Adicionar ao inventário"
                                              disabled={addProdLoading}
                                          >
                                              +
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {!addProdLoading && addProdResults.length === 0 && !addProdError && (
                                  <tr>
                                      <td colSpan={5} className="text-center text-muted py-3">
                                          Use a busca para encontrar produtos.
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={fecharAddProduto}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalParaComprar && comprarProd && comprarInv && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3320, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3322, overflowX: "hidden" }}>
            <div className="modal-dialog modal-fullscreen" role="document">
              <div className="modal-content d-flex flex-column" style={{ fontSize: '0.75rem', overflowX: 'hidden' }}>
                <div className="modal-header py-2 d-flex align-items-center flex-wrap gap-2">
                  <div className="me-auto">
                    <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>
                      <i className="bi bi-cart-plus me-1"></i>
                      P/Comprar — Resumo
                    </h5>
                    <div className="text-muted text-break" style={{ fontSize: '0.75rem' }}>
                      <span className="me-3"><i className="bi bi-upc me-1"></i>{String(comprarProd.codProd ?? '')}</span>
                      <span className="me-3"><i className="bi bi-shop me-1"></i>Filial {String(comprarInv.filial ?? '')}</span>
                      <span><i className="bi bi-card-text me-1"></i>{String(comprarProd.descricao ?? '')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => void carregarPedidosParaComprar()}
                    disabled={comprarPedidosLoading}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i>
                    Atualizar
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={fecharParaComprar}>
                    <i className="bi bi-x-circle me-1"></i>
                    Fechar
                  </button>
                </div>
                <div className="modal-body p-2 d-flex flex-column" style={{ fontSize: '0.8rem', lineHeight: 1.3, minHeight: 0, overflow: 'hidden', height: '100%' }}>
                  <div className="row g-2 flex-grow-1" style={{ minHeight: 0, height: '100%' }}>
                    <div className="col-12 col-lg-7 d-flex flex-column gap-2" style={{ minHeight: 0, overflow: 'hidden' }}>
                      <div className="card border-0 bg-light">
                        <div className="card-body py-2">
                          <div className="fw-bold mb-1"><i className="bi bi-box-seam me-1"></i>Produto</div>
                          <div className="d-flex flex-column gap-1 text-break">
                            <div><i className="bi bi-hash me-1"></i>ID: {String(comprarProd.idProduto ?? '')}</div>
                            <div><i className="bi bi-upc me-1"></i>Código: {String(comprarProd.codProd ?? '')}</div>
                            <div><i className="bi bi-upc-scan me-1"></i>Barras: {String(comprarProd.codAuxiliar ?? '')}</div>
                            <div><i className="bi bi-card-text me-1"></i>Descrição: {String(comprarProd.descricao ?? '')}</div>
                            <div><i className="bi bi-123 me-1"></i>Qtd contada: {String(comprarProd.qtContada ?? '')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="card border-0 bg-light">
                        <div className="card-body py-2">
                          <div className="fw-bold mb-1"><i className="bi bi-clipboard2-check me-1"></i>Inventário</div>
                          <div className="d-flex flex-column gap-1 text-break">
                            <div><i className="bi bi-box me-1"></i>Nome: {String(comprarInv.nomeInventario ?? '')}</div>
                            <div><i className="bi bi-hash me-1"></i>ID: {String(comprarInv.idInventario ?? '')}</div>
                            <div><i className="bi bi-shop me-1"></i>Filial: {String(comprarInv.filial ?? '')}</div>
                            <div><i className="bi bi-geo-alt me-1"></i>Local: {String(comprarInv.localContagem ?? '')}</div>
                            <div><i className="bi bi-person me-1"></i>Usuário: {String(comprarInv.nomeUsuario ?? '')}</div>
                            <div><i className="bi bi-person-gear me-1"></i>Responsável: {String(comprarInv.responsavel ?? '')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="card border-0 bg-light">
                        <div className="card-body py-2">
                          <div className="fw-bold mb-1"><i className="bi bi-stopwatch me-1"></i>Contagens</div>
                          <div className="d-flex flex-column gap-1 text-break">
                            <div><i className="bi bi-stopwatch me-1"></i>1ª Contagem: {String(comprarProd.primeiraContagem ?? '')}</div>
                            <div><i className="bi bi-clock me-1"></i>Últ. Contagem: {String(comprarProd.ultimaContagem ?? '')}</div>
                            <div><i className="bi bi-tools me-1"></i>1ª Tratativa: {String(comprarProd.primeiraTratativa ?? '')}</div>
                            <div><i className="bi bi-tools me-1"></i>Últ. Tratativa: {String(comprarProd.ultimaTratativa ?? '')}</div>
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const temPedRepos =
                          String(comprarProd.addPedRepos ?? '').trim().toUpperCase() === 'S' ||
                          (comprarProd.idPedRepos != null && Number.isFinite(Number(comprarProd.idPedRepos)));
                        if (!temPedRepos) return null;
                        const pedVinculado =
                          comprarPedidos.find((p) => Number(p?.ID) === Number(comprarProd.idPedRepos)) ?? null;
                        return (
                          <div
                            className="card border-0"
                            style={{ backgroundColor: 'rgba(25, 135, 84, 0.15)' }}
                          >
                            <div className="card-body py-2">
                              <div className="fw-bold mb-1 text-success">
                                <i className="bi bi-cart-check me-1"></i>
                                Já adicionado em Pedido de Reposição
                              </div>
                              <div className="d-flex flex-column gap-1 text-break">
                                <div>
                                  <i className="bi bi-hash me-1"></i>
                                  ID Pedido: {String(comprarProd.idPedRepos ?? '-')}
                                </div>
                                {pedVinculado && (
                                  <>
                                    <div>
                                      <i className="bi bi-receipt me-1"></i>
                                      Nº Pedido: {String(pedVinculado.NUMPEDREPOSICAO ?? '-')}
                                    </div>
                                    <div>
                                      <i className="bi bi-truck me-1"></i>
                                      Fornecedor: {String(pedVinculado.FORNECEDOR ?? pedVinculado.CODFORNEC ?? '-')}
                                    </div>
                                    <div>
                                      <i className="bi bi-flag me-1"></i>
                                      Status: {String(pedVinculado.STATUSPEDIDO ?? '-')}
                                    </div>
                                  </>
                                )}
                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  Este produto já foi enviado para compra neste inventário.
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="col-12 col-lg-5 d-flex flex-column" style={{ minHeight: 0, height: '100%' }}>
                      <div className="card border-0 bg-light h-100 d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
                        <div className="card-header border-0 bg-transparent py-2 d-flex align-items-center justify-content-between">
                          <div className="fw-bold">
                            <i className="bi bi-cart3 me-1"></i>
                            Pedidos de Reposição
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {comprarPedidosLoading ? 'Carregando...' : `Total: ${comprarPedidos.length}`}
                          </div>
                        </div>

                        <div className="card-body pt-0 flex-grow-1" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                          {comprarPedidosLoading ? (
                            <div className="d-flex align-items-center px-1 py-3 text-muted">
                              <span className="spinner-border spinner-border-sm me-2" role="status" />
                              Carregando pedidos...
                            </div>
                          ) : comprarPedidos.length === 0 ? (
                            <div className="px-1 py-3 text-muted">
                              Nenhum pedido de reposição encontrado.
                            </div>
                          ) : (
                            <div className="d-flex flex-column gap-2">
                              {comprarPedidos.map((p, idx) => {
                                const id = Number(p?.ID);
                                const selected = comprarPedidoSelecionadoId != null && Number.isFinite(id) && id === comprarPedidoSelecionadoId;
                                const status = String(p?.STATUSPEDIDO ?? '').trim().toUpperCase();
                                const isAberto = status === 'ABERTO';
                                return (
                                  <div
                                    key={`${p?.ID ?? 'ped'}-${idx}`}
                                    className={`card shadow-sm ${selected ? 'border-primary' : 'border-0'}`}
                                    style={{
                                      cursor: isAberto ? 'pointer' : 'not-allowed',
                                      opacity: isAberto ? 1 : 0.65,
                                      backgroundColor: selected
                                        ? 'rgba(13, 110, 253, 0.08)'
                                        : isAberto
                                          ? 'rgba(25, 135, 84, 0.08)'
                                          : 'rgba(108, 117, 125, 0.08)',
                                    }}
                                    onClick={() => {
                                      if (!isAberto || !Number.isFinite(id)) return;
                                      setComprarPedidoSelecionadoId(id);
                                      setComprarMsg('');
                                      setComprarOk(null);
                                    }}
                                    title={isAberto ? 'Selecionar pedido' : 'Disponível apenas para pedidos ABERTOS'}
                                  >
                                    <div className="card-body py-2 px-2 d-flex flex-column gap-1" style={{ fontSize: '0.75rem' }}>
                                      <div className="d-flex justify-content-between align-items-start gap-1">
                                        <div className="fw-bold text-truncate">
                                          <i className="bi bi-hash me-1"></i>
                                          {String(p?.NUMPEDREPOSICAO ?? '-')}
                                        </div>
                                        <span className={`badge ${isAberto ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                                          {String(p?.STATUSPEDIDO ?? '-')}
                                        </span>
                                      </div>
                                      <div className="text-truncate" title={String(p?.FORNECEDOR ?? '')}>
                                        <i className="bi bi-truck me-1"></i>
                                        {String(p?.FORNECEDOR ?? p?.CODFORNEC ?? '-')}
                                      </div>
                                      <div className="text-muted">
                                        <i className="bi bi-calendar-event me-1"></i>
                                        {String(p?.DATACRIACAO ?? '-')}
                                      </div>
                                      <div className="text-muted text-truncate" title={String(p?.USUARIOCRIACAO ?? '')}>
                                        <i className="bi bi-person me-1"></i>
                                        {String(p?.USUARIOCRIACAO ?? '-')}
                                      </div>
                                      <div className="d-flex justify-content-between">
                                        <span><i className="bi bi-list-ul me-1"></i>Itens: {String(p?.QTITENS ?? 0)}</span>
                                        <span><i className="bi bi-123 me-1"></i>Qtd: {String(p?.QTTOTAL ?? 0)}</span>
                                      </div>
                                      {String(p?.OBSERVACAO ?? '').trim() !== '' && (
                                        <div className="text-muted text-truncate" title={String(p?.OBSERVACAO ?? '')}>
                                          <i className="bi bi-chat-left-text me-1"></i>
                                          {String(p?.OBSERVACAO)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="card-footer border-0 bg-transparent" style={{ padding: '1rem 0.75rem' }}>
                          <div className="d-flex flex-wrap align-items-end gap-2">
                            <div style={{ width: 140 }}>
                              <label className="form-label mb-1" style={{ fontSize: '0.72rem' }}>
                                <i className="bi bi-123 me-1"></i>
                                Qtd a comprar
                              </label>
                              <input
                                className="form-control form-control-sm"
                                value={comprarQt}
                                onChange={(e) => {
                                  setComprarQt(e.target.value);
                                  setComprarMsg('');
                                  setComprarOk(null);
                                }}
                                inputMode="decimal"
                                placeholder="Ex: 10"
                                disabled={comprarSaving}
                              />
                            </div>
                            <div className="flex-grow-1" style={{ minWidth: 160 }}>
                              <label className="form-label mb-1" style={{ fontSize: '0.72rem' }}>
                                <i className="bi bi-clipboard-check me-1"></i>
                                Pedido destino
                              </label>
                              <div className="form-control form-control-sm bg-white text-truncate" style={{ fontSize: '0.75rem' }}>
                                {comprarPedidoSelecionado
                                  ? `${String(comprarPedidoSelecionado.NUMPEDREPOSICAO ?? '-')} — ${String(comprarPedidoSelecionado.FORNECEDOR ?? comprarPedidoSelecionado.CODFORNEC ?? '-')}`
                                  : 'Selecione um pedido aberto na lista'}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              style={{ fontSize: '0.75rem' }}
                              disabled={!comprarPodeAdicionar}
                              onClick={() => void adicionarProdutoNoPedidoReposicao()}
                              title={!comprarPodeAdicionar ? 'Selecione um pedido aberto e informe a quantidade' : 'Adicionar ao pedido'}
                            >
                              <i className="bi bi-cart-plus me-1"></i>
                              {comprarSaving ? 'Adicionando...' : 'Adicionar'}
                            </button>
                          </div>
                          {comprarMsg && (
                            <div className={`alert ${comprarOk ? 'alert-success' : 'alert-danger'} py-1 px-2 mt-2 mb-0`} style={{ fontSize: '0.75rem' }}>
                              {comprarMsg}
                            </div>
                          )}
                          {comprarPedidosErro && (
                            <div className="alert alert-danger py-1 px-2 mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              {comprarPedidosErro}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AjusteEstoqueModal;
