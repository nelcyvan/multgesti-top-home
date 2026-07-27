import React, { useState } from "react";
import type { DuplicataAbertaRow } from "../../services/gestpro/DuplicatasEmAbertoMesAtual";
import { enviarComprovante } from "../../services/gestpro/UploadComprovante";

type EnviarComprovanteModalProps = {
  duplicata: DuplicataAbertaRow;
  onClose: () => void;
};

const EnviarComprovanteModal: React.FC<EnviarComprovanteModalProps> = ({ duplicata, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(f);
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async () => {
    if (!file) {
      setError('Selecione uma imagem para enviar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await enviarComprovante({
        NUMPED: duplicata.NUMPED,
        CODCLI: duplicata.CODCLI,
        CODUSUR: duplicata.CODUSUR,
        NOME: duplicata.NOME,
      }, file);
      setSuccess('Comprovante enviado com sucesso.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar comprovante');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Enviar Comprovante • Pedido {duplicata.NUMPED}</h5>
            <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && (<div className="alert alert-danger mb-2">{error}</div>)}
            {success && (<div className="alert alert-success mb-2">{success}</div>)}

            <div className="mb-3">
              <label className="form-label">Selecione a foto do comprovante</label>
              <input type="file" accept="image/*" className="form-control" onChange={onFileChange} />
            </div>

            <div className="mb-2">
              <small className="text-muted">Cliente: {duplicata.CLIENTE} • CODCLI: {duplicata.CODCLI} • RCA: {duplicata.NOME}</small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-gestpro" onClick={onClose} disabled={submitting}>Fechar</button>
            <button type="button" className="btn btn-primary btn-gestpro" onClick={onSubmit} disabled={submitting || !file}>
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnviarComprovanteModal;