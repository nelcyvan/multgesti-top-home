// home/multgesti/src/components/acesso/Login.tsx
import React, { useState } from "react";
import { loginUsuario } from "../../services/acesso/Login";
import "bootstrap/dist/css/bootstrap.min.css";
import { useHistory } from "react-router-dom"; // <- v5

const LoginComponent: React.FC = () => {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const history = useHistory(); // <- hook v5

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      const result = await loginUsuario(usuario, senha);

      // Salva dados do usuário
      localStorage.setItem("usuarioLogado", JSON.stringify(result));

      setSucesso(result.message);
      console.log("Usuário logado:", result);

      // Redireciona para dashboard
      history.push("/dashboard");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Falha ao efetuar login";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleLogin}
      className="p-4 rounded shadow bg-white"
      style={{
        minWidth: 320,
        maxWidth: 380,
        margin: "auto",
        fontFamily: "'Poppins', sans-serif",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <h4 className="text-center mb-4 fw-semibold text-primary">
        Multgest-i
      </h4>

      <div className="mb-3">
        <label className="form-label fw-medium">Usuário</label>
        <input
          type="text"
          className="form-control form-control-lg"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Digite seu usuário"
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label fw-medium">Senha</label>
        <input
          type={mostrarSenha ? "text" : "password"}
          className="form-control form-control-lg"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Digite sua senha"
          required
        />
      </div>

      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="mostrarSenhaSwitch"
          checked={mostrarSenha}
          onChange={() => setMostrarSenha(!mostrarSenha)}
        />
        <label className="form-check-label" htmlFor="mostrarSenhaSwitch">
          Mostrar senha
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary w-100 py-2 fw-semibold"
        disabled={loading}
      >
        {loading ? "Entrando..." : "Login"}
      </button>

      {erro && <div className="alert alert-danger mt-3">{erro}</div>}
      {sucesso && <div className="alert alert-success mt-3">{sucesso}</div>}

      <div
        className="text-center mt-4"
        style={{ fontSize: 13, color: "#777", letterSpacing: "0.5px" }}
      >
        © 2025 GestFácil
      </div>
    </form>
  );
};

export default LoginComponent;
