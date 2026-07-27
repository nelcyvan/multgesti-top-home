-- Coluna para indicar produto sem etiqueta na auditoria (S/N)
ALTER TABLE GESTPRO_AUDITORIA_PRODUTOS ADD SEM_ETIQUETA VARCHAR2(1) DEFAULT 'N';
