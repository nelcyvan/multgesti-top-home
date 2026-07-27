CREATE TABLE GESTLOG_MOTORISTAS (
    ID                 NUMBER(10)        PRIMARY KEY,
    NOME               VARCHAR2(150)     NOT NULL,
    CPF                VARCHAR2(14),
    CNH                VARCHAR2(20),
    TELEFONE           VARCHAR2(20),
    DATA_CRIACAO       DATE              DEFAULT SYSDATE,
    CODUSUR_CRIACAO    NUMBER(10)
);