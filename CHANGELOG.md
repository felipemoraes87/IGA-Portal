# Changelog

Todas as mudancas relevantes deste repositorio devem ser registradas aqui.

## [v0.1.0] - 2026-03-10

### Resumo

Primeira release versionada do `IGA Portal` com base funcional local para operacao IAM, auditoria, ownership, busca global e administracao.

### Principais entregas

- topbar funcional com busca global, alertas e menu de configuracoes
- observabilidade administrativa com `Admin > Logs` e exportacao para SIEM/Bucket
- ownership views para `Meus Sistemas`, `Minhas SRs` e `Minhas BRs`
- `UAR` com configuracao operacional persistida e auditada
- operacoes IAM com grant/revoke manual de SR e reconciliacao

### UX / UI

- cards operacionais em `Meu Time`
- painel lateral em `Minhas BRs`
- melhoria de hover/descricao de SR em detalhes de BR
- remocao de IDs tecnicos desnecessarios em telas de ownership
- reorganizacao de menu `Management`

### Administracao / IAM

- `Admin > Operacao` com:
  - `MANAGE_SR_FOR_USER` (`GRANT` / `REVOKE`)
  - `RECON_BR`
  - `RECON_SR`
  - criacao de delegacao temporaria
- `Admin > UAR` com parametros de campanha para IAM
- auditoria reforcada de alteracoes em `UAR`

### Integracoes / Provisionamento

- SSO com Keycloak
- SCIM 2.0 inbound no portal
- execucao via n8n com webhook HMAC
- exportacao de logs para:
  - Splunk HEC
  - AWS S3

### Auditoria / Logs / Compliance

- `Admin > Logs` com filtros por texto, acao, entidade, ator e periodo
- filtros rapidos para:
  - `UAR Settings`
  - `SCIM Settings`
  - `Export Settings`
- eventos relevantes auditados em `AuditLog`

### Banco / Migracoes

- `20260309120000_add_log_export_settings`
- `20260309164432_add_log_export_settings`
- `20260310113000_add_uar_settings`

### Validacao executada

- `npm run lint`
- `npx prisma migrate deploy`
- `npx prisma generate`
- validacao manual de rotas administrativas e login local

[v0.1.0]: https://github.com/felipemoraes87/IGA-Portal/releases/tag/v0.1.0
