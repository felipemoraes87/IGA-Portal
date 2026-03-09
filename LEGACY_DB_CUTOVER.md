# Legacy DB Cutover Plan

Plano para conectar o IGA Portal a um banco legado existente (com as tabelas na nomenclatura dos CSV), mantendo as tabelas adicionais do portal.

## 1) Premissas

- As tabelas legado ja existem no banco (`users`, `system_roles`, `business_roles`, `assignment`, etc.).
- O portal continua usando tabelas proprias (`User`, `Session`, `AccessRequest`, `AuditLog`, `ScimSettings`, etc.).
- O sync continua sendo executado por `scripts/sync-orchestrator-to-portal.sql`.

## 2) Preflight de contrato

Executar validacao antes do primeiro sync:

```powershell
.\scripts\validate-legacy-schema.ps1
```

Esse passo valida existencia de tabelas/colunas obrigatorias da fonte legado.

## 3) Modo de operacao sem CSV

No ambiente integrado, nao execute carga CSV. Execute apenas:

```powershell
.\scripts\sync-orchestrator-direct.ps1
```

Esse comando roda:
1. preflight do esquema legado
2. sync para tabelas de dominio do portal

## 4) Baseline de migracoes

- Nao aplicar `prisma migrate dev` para recriar/alterar tabelas da fonte legado.
- Migracoes devem considerar apenas entidades do portal.
- Se possivel, evoluir para separacao de schemas:
  - `legacy` (somente leitura operacional)
  - `portal` (escrita do produto)

## 5) Ordem de cutover

1. Backup do banco atual.
2. Configurar `DATABASE_URL` para o banco integrado.
3. Rodar `npm run prisma:generate`.
4. Rodar `.\scripts\validate-legacy-schema.ps1`.
5. Rodar `.\scripts\sync-orchestrator-direct.ps1`.
6. Validar fluxos: login, request, approve/reject, SCIM.
7. Publicar monitoramento e auditoria.

## 6) Rollback

1. Reverter `DATABASE_URL` para banco anterior.
2. Reiniciar app.
3. Reprocessar sync no ambiente antigo, se necessario.

