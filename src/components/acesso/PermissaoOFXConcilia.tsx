// /home/multgesti/src/components/acesso/PermissaoOFXConcilia.tsx
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { verificarPermissaoOFXConcilia } from "../../services/acesso/PermissaoOFXConcilia";

import { appUrl } from "../../utils/appUrl";
interface UsuarioLocalStorage {
  nome?: string;
  usuario?: string;
  matricula?: string;
}

const PermissaoOFXConcilia: React.FC = () => {
  const [mensagem, setMensagem] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const dados = localStorage.getItem("usuarioLogado");
    if (!dados) { setErro("Nenhum usuário logado."); setLoading(false); return; }
    const usuario: UsuarioLocalStorage = JSON.parse(dados);

    const codigoDoUsuario = usuario.matricula || "";
    const nomeDoUsuario = usuario.usuario || usuario.nome || "Usuário";

    if (!codigoDoUsuario) { setErro("Código do usuário não encontrado."); setLoading(false); return; }

    (async () => {
      try {
        const resp = await verificarPermissaoOFXConcilia(codigoDoUsuario);
        if (resp.permitido) {
          setMensagem(`Usuário: ${nomeDoUsuario}, código: ${codigoDoUsuario} tem permissão a pagina OFX-Concilia`);
          // Redireciona automaticamente para a página de OFX-Concilia
          window.location.href = appUrl("/ofxconcilia");
        } else {
          setErro(resp.message || "Usuário sem permissão para OFX-Concilia.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Falha ao validar permissão.";
        setErro(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container py-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: 600 }}>
        <h4 className="fw-semibold text-primary mb-3">Validação de Permissão - OFX-Concilia</h4>
        {loading && <div className="alert alert-info">Validando permissão...</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}
        {mensagem && <div className="alert alert-success">{mensagem}</div>}
        <div className="mt-4 d-flex justify-content-between">
          <a className="btn btn-outline-secondary" href={appUrl("/dashboard")}>Voltar</a>
          {/* Se houver permissão, o redirecionamento já ocorreu automaticamente */}
        </div>
      </div>
    </div>
  );
};

export default PermissaoOFXConcilia;