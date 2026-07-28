// /home/multgesti/src/components/acesso/PermissaoGestMKT.tsx
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { verificarPermissaoGestMKT } from "../../services/acesso/PermissaoGestMKT";

import { appUrl } from "../../utils/appUrl";
interface UsuarioLocalStorage {
  nome?: string;
  usuario?: string;
  matricula?: string;
}

const PermissaoGestMKT: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    const validar = async () => {
      try {
        const usuarioStr = localStorage.getItem("usuarioLogado");
        if (!usuarioStr) throw new Error("Usuário não encontrado no localStorage.");
        const usuario: UsuarioLocalStorage = JSON.parse(usuarioStr);
        const codigoUsuario = usuario.matricula || usuario.usuario || "";
        if (!codigoUsuario) throw new Error("Código do usuário inválido.");

        const resp = await verificarPermissaoGestMKT(String(codigoUsuario));
        if (resp.permitido) {
          setMensagem(
            `Usuário: ${usuario.usuario || usuario.nome || "-"}, código: ${String(codigoUsuario)} tem permissão a página GestMKT`
          );
          // Redireciona automaticamente para a página de GestMKT
          window.location.href = appUrl("/gestmkt");
        } else {
          setErro(resp.message || "Usuário sem permissão para GestMKT.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Falha ao validar permissão.";
        setErro(msg);
      } finally {
        setLoading(false);
      }
    };
    validar();
  }, []);

  return (
    <div className="container py-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: 600 }}>
        <h4 className="fw-semibold text-primary mb-3">Validação de Permissão - GestMKT</h4>
        {loading && <div className="alert alert-info">Validando permissão...</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}
        {mensagem && <div className="alert alert-success">{mensagem}</div>}
        <div className="mt-4 d-flex justify-content-between">
          <a className="btn btn-outline-secondary" href={appUrl("/dashboard")}>Voltar</a>
        </div>
      </div>
    </div>
  );
};

export default PermissaoGestMKT;