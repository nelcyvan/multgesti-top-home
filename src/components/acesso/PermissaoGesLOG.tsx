// /home/multgesti/src/components/acesso/PermissaoGesLOG.tsx
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { verificarPermissaoGestLOG } from "../../services/acesso/PermissaoGestLOG";

interface UsuarioLocalStorage {
  nome?: string;
  usuario?: string; // nome de login
  matricula?: string; // código do usuário (assumindo)
  codusur?: number | string | null; // identificador oficial usado nas permissões
}

const PermissaoGesLOG: React.FC = () => {
  const [mensagem, setMensagem] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const dados = localStorage.getItem("usuarioLogado");
    if (!dados) {
      setErro("Nenhum usuário logado.");
      setLoading(false);
      return;
    }

    const usuario: UsuarioLocalStorage = JSON.parse(dados);

    // Preferir CODUSUR; fallback para matrícula
    const codigoDoUsuario =
      usuario.codusur !== undefined && usuario.codusur !== null
        ? String(usuario.codusur)
        : usuario.matricula || "";

    const nomeDoUsuario = usuario.usuario || usuario.nome || "Usuário";

    if (!codigoDoUsuario) {
      setErro("Identificador do usuário (CODUSUR) não encontrado.");
      setLoading(false);
      return;
    }

    const validar = async () => {
      try {
        const resp = await verificarPermissaoGestLOG(codigoDoUsuario);
        if (resp.permitido) {
          setMensagem(
            `Usuário: ${nomeDoUsuario}, código: ${codigoDoUsuario} tem permissão a pagina GestLOG`
          );
          // Redireciona automaticamente para a página de GestLOG
          window.location.href = "/gestlog";
        } else {
          setErro(resp.message || "Usuário sem permissão para GestLOG.");
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
        <h4 className="fw-semibold text-primary mb-3">Validação de Permissão - GestLOG</h4>

        {loading && <div className="alert alert-info">Validando permissão...</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}
        {mensagem && <div className="alert alert-success">{mensagem}</div>}

        <div className="mt-4 d-flex justify-content-between">
          <a className="btn btn-outline-secondary" href="/dashboard">Voltar</a>
        </div>
      </div>
    </div>
  );
};

export default PermissaoGesLOG;