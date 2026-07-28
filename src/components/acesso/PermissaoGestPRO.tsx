// /home/multgesti/src/components/acesso/PermissaoGestPRO.tsx
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { verificarPermissaoGestPRO } from "../../services/acesso/PermissaoGestPRO";

import { appUrl } from "../../utils/appUrl";
interface UsuarioLocalStorage {
  nome?: string;
  usuario?: string;
  matricula?: string;
}

const PermissaoGestPRO: React.FC = () => {
  const [mensagem, setMensagem] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const history = useHistory();

  useEffect(() => {
    const dados = localStorage.getItem("usuarioLogado");
    if (!dados) { setErro("Nenhum usuário logado."); setLoading(false); return; }
    const usuario: UsuarioLocalStorage = JSON.parse(dados);

    const codigoDoUsuario = usuario.matricula || "";
    const nomeDoUsuario = usuario.usuario || usuario.nome || "Usuário";

    if (!codigoDoUsuario) { setErro("Código do usuário não encontrado."); setLoading(false); return; }

    (async () => {
      try {
        const resp = await verificarPermissaoGestPRO(codigoDoUsuario);
        if (resp.permitido) {
          setMensagem(`Usuário: ${nomeDoUsuario}, código: ${codigoDoUsuario} tem permissão a pagina GestPRO`);
          // Redireciona automaticamente para a página GestPRO
          history.replace("/gestpro");
        } else {
          setErro(resp.message || "Usuário sem permissão para GestPRO.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Falha ao validar permissão.";
        setErro(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [history]);

  return (
    <div className="container py-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: 600 }}>
        <h4 className="fw-semibold text-primary mb-3">Validação de Permissão - GestPRO</h4>
        {loading && <div className="alert alert-info">Validando permissão...</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}
        {mensagem && <div className="alert alert-success">{mensagem}</div>}
        <div className="mt-4 d-flex justify-content-between">
          <a className="btn btn-outline-secondary" href={appUrl("/dashboard")}>Voltar</a>
          {mensagem && <button className="btn btn-primary" onClick={() => history.replace("/gestpro")}>Ir para GestPRO</button>}
        </div>
      </div>
    </div>
  );
};

export default PermissaoGestPRO;