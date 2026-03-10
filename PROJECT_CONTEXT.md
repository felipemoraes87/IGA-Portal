# PROJECT_CONTEXT.md

Contexto tecnico consolidado do projeto `iga-portal` para novas sessoes de coding.

## 1) Objetivo do Sistema

Portal de Identity Governance and Administration (IGA) para:

- solicitar acessos (single ou mirror)
- aprovar/rejeitar por gestor/admin
- executar provisao via n8n (webhook assinado)
- manter rastreabilidade com auditoria
- sincronizar dados de um orquestrador legado (CSV -> tabelas espelho -> portal)
- suportar operacao conectada direto ao banco legado existente (sem etapa CSV)
- receber provisionamento de identidades via SCIM 2.0 (Keycloak -> portal)

## 2) Arquitetura Geral

### 2.1 Frontend + Backend no mesmo app

- Next.js App Router (`app/`)
- UI e API routes no mesmo projeto
- Autenticacao e autorizacao no servidor (cookies + DB)

### 2.2 Banco de dados

- PostgreSQL
- Prisma como ORM
- Modelo inclui dominio IGA + tabelas espelho do orquestrador (`Orchestrator*`)
- Entidades SCIM adicionadas: `UserScimGroup`, `UserProvisioningEvent`, `ScimSettings`

### 2.3 Integracoes

- Keycloak para SSO OIDC Authorization Code
- SCIM 2.0 inbound no portal (`/api/scim/v2/*`)
- n8n para execucao de grant de acesso (HMAC)
- exportacao de logs para SIEM/bucket (Splunk HEC e AWS S3)
- configuracao operacional de campanha UAR com persistencia e auditoria

## 3) Componentes Chave

### 3.1 Autenticacao

Arquivo: `lib/auth.ts`

- sessao em cookie `iga_session` (httpOnly)
- token assinado por HMAC (`SESSION_SECRET`)
- hash do token persistido em `Session`
- expira em 8h

Arquivo: `lib/keycloak.ts`

- monta URLs OIDC
- gera/valida `state`
- troca `code` por token
- busca `userinfo`
- extrai `groups` quando presentes no token

Arquivo: `app/api/auth/callback/route.ts`

- valida state do cookie
- provisiona usuario local quando necessario
- sincroniza groups do token para `UserScimGroup` quando claim `groups` existe
- recalcula role por regra consolidada
- cria sessao local e redireciona para `/`

### 3.2 RBAC

Arquivos: `lib/rbac.ts`, `lib/scim.ts`, `lib/scim-provisioning.ts`

Hierarquia:

- USER = 1
- MANAGER = 2
- ADMIN = 3

Resolucao de papel (precedencia):

- `ADMIN` se usuario possui grupo `sr-security-cybersec-iam`
- `MANAGER` se possui liderados diretos ativos
- `USER` caso contrario

Observacao:

- admin pode acumular contexto de manager no menu (ex.: `Time`) quando possui diretos

### 3.3 SCIM Inbound (Provisionamento)

Arquivos:

- `app/api/scim/v2/ServiceProviderConfig/route.ts`
- `app/api/scim/v2/ResourceTypes/route.ts`
- `app/api/scim/v2/Schemas/route.ts`
- `app/api/scim/v2/Users/route.ts`
- `app/api/scim/v2/Users/[id]/route.ts`
- `lib/scim.ts`
- `lib/scim-response.ts`
- `lib/scim-provisioning.ts`

Comportamento:

- chave principal de correlacao: `externalId`
- fallback de correlacao por email quando necessario
- groups recebidos persistidos em `UserScimGroup`
- eventos de provisionamento persistidos em `UserProvisioningEvent`
- `DELETE` SCIM implementado como soft delete (`active=false`)
- role recalculada apos create/update/patch/delete

### 3.4 SCIM 2.0 Settings (Admin)

Arquivos:

- `app/admin/scim/page.tsx`
- `components/scim-settings-client.tsx`
- `app/api/admin/scim/settings/route.ts`
- `app/api/admin/scim/test/route.ts`
- `app/api/admin/scim/audit/route.ts`
- `lib/scim-settings.ts`
- `lib/secret-crypto.ts`

Capacidades MVP:

- configuracao por `tenant/environment`
- auth types: `bearer_token`, `oauth2`, `api_key`
- persistencia de mapeamentos de atributos/grupos e flags de sync/retry/seguranca
- teste de conexao (`GET {baseUrl}/ServiceProviderConfig`)
- validacao de schema (`GET {baseUrl}/Schemas`)
- auditoria paginada (`SCIM_SETTINGS_UPDATED`, `SCIM_TEST_CONNECTION`, `SCIM_VALIDATE_SCHEMA`)
- segredos cifrados em repouso e retornados mascarados

### 3.5 Solicitar Acesso

Arquivo: `app/api/requests/route.ts`

Suporta:

- `requestType=SINGLE`: permissao unica ou lista
- `requestType=MIRROR`: espelha acessos DIRECT de outro usuario

Regras:

- valida se ator pode gerenciar target (`canManageUser`)
- manager/admin podem auto-aprovar (`RUNNING` direto)
- user comum gera `PENDING_APPROVAL` para gestor
- cria `idempotencyKey` por request
- escreve auditoria

### 3.6 Aprovar/Rejeitar

Arquivos:

- `app/api/requests/[id]/approve/route.ts`
- `app/api/requests/[id]/reject/route.ts`

Fluxo approve:

- exige `MANAGER` minimo
- valida ownership do approver (ou ADMIN)
- transiciona para `RUNNING`
- cria approval record
- dispara n8n
- em falha de webhook marca `FAILED`

Fluxo reject:

- transiciona para `REJECTED`
- cria approval record com comentario
- escreve auditoria

### 3.7 Operacoes Admin

Arquivo: `app/api/admin/operation/route.ts`

Acoes:

- `MANAGE_SR_FOR_USER` (`GRANT` ou `REVOKE`)
- `RECON_BR`
- `RECON_SR`
- `CREATE_APPROVAL_DELEGATION`

Objetivo:

- reconciliar estado entre snapshots/orquestrador e modelos do portal
- reduzir drift de papel/permissao
- permitir concessao/revogacao manual auditada de SR `DIRECT`

### 3.8 UAR (Campaign Settings)

Arquivos:

- `app/admin/uar/page.tsx`
- `components/uar-settings-client.tsx`
- `app/api/admin/uar/settings/route.ts`
- `lib/uar-settings.ts`

Capacidades:

- configuracao persistida por tenant (`UarSettings`)
- parametros de revisao para:
  - `Sistema`
  - `SR`
  - `BR`
  - `acesso direto`
- janelas operacionais:
  - lookback de revisoes recentes
  - warning window
  - grace period de atraso
  - antecedencia de notificacao a owners
- flags de politica:
  - auto revogacao de vencidos
  - justificativa obrigatoria na renovacao
- auditoria reforcada em `UAR_SETTINGS_UPDATED` com `before`, `after` e `changedFields`

### 3.9 Topbar (Busca, Alertas e Configuracoes)

Arquivo: `components/app-shell-client.tsx`

Capacidades:

- busca global com dropdown no header
- sino com alertas priorizados por severidade (`critical`, `warning`, `info`)
- menu da engrenagem com acoes e preferencias MVP

Busca global:

- endpoint: `GET /api/search/global?q=...`
- resultados por tipo: `USER`, `BR`, `SYSTEM`, `SR`
- navegacao direta para telas de destino conforme papel (USER/MANAGER/ADMIN)

Preferencias MVP:

- modo compacto
- reduzir animacoes
- persistencia em `localStorage`

### 3.10 Admin Logs e Exportacao Externa

Arquivos:

- `app/admin/logs/page.tsx`
- `components/log-export-client.tsx`
- `app/api/admin/logs/export/settings/route.ts`
- `app/api/admin/logs/export/run/route.ts`
- `lib/log-export.ts`
- `lib/log-export-settings.ts`

Capacidades:

- consulta de `AuditLog` com filtros operacionais
- pagina com tabela paginada e detalhes JSON por evento
- filtros rapidos para eventos de configuracao:
  - `UAR Settings`
  - `SCIM Settings`
  - `Export Settings`
- configuracao de destino de exportacao:
  - `SPLUNK_HEC`
  - `AWS_S3`
- execucao manual de exportacao por janela de tempo (`from/to`)
- status da ultima exportacao (at/status/message)
- auditoria:
  - `LOG_EXPORT_SETTINGS_UPDATED`
  - `LOG_EXPORT_EXECUTED`

## 4) Modelo de Dados (Prisma)

Entidades de dominio principal:

- `User`, `Session`
- `System`, `Permission`
- `BusinessRole`, `BusinessRolePermission`, `UserBusinessRole`
- `UserPermissionAssignment` (source `DIRECT` ou `BR`)
- `AccessRequest`, `AccessApproval`, `AccessExecution`
- `AuditLog`
- `LogExportSettings`
- `UarSettings`
- `UserScimGroup`, `UserProvisioningEvent`, `ScimSettings`

Estados importantes:

- `AccessRequestStatus`: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `RUNNING`, `SUCCESS`, `FAILED`
- `ExecutionStatus`: `RUNNING`, `SUCCESS`, `FAILED`

Tabelas espelho do orquestrador:

- `OrchestratorAssignment`
- `OrchestratorBusinessRole`
- `OrchestratorOrganizational*`
- `OrchestratorSnapshot*`
- `OrchestratorSoftware`
- `OrchestratorSystemRole`
- `OrchestratorSystemBusinessRole`
- `OrchestratorUser`

## 5) Fluxos Criticos

### 5.1 Login SSO

1. `/api/auth/login` redireciona para Keycloak com state
2. callback valida state
3. usuario local e provisionado/atualizado
4. groups do token sao sincronizados quando claim existe
5. role e recalculada por grupos + diretos
6. sessao local criada
7. auditoria `LOGIN_SSO`

### 5.2 Request -> Approval -> Execution

1. request criada
2. pendente ou running (auto-approve)
3. approve/reject pelo manager/admin
4. approve envia para n8n com assinatura HMAC
5. execucao evolui para success/failed (com base em webhook/erro)

### 5.3 SCIM Inbound

1. Keycloak chama `/api/scim/v2/Users` (POST/PUT/PATCH/DELETE)
2. payload e validado/normalizado
3. usuario e criado/atualizado por `externalId` (ou email)
4. grupos SCIM sao persistidos
5. role e recalculada
6. evento de provisionamento e auditavel

### 5.4 Sync de Orquestrador

1. `scripts/load-orchestrator-data.ps1` carrega CSVs para tabelas espelho
2. `scripts/sync-orchestrator-to-portal.ps1` executa SQL de reconciliacao
3. SQL (`sync-orchestrator-to-portal.sql`) atualiza Users, Systems, Permissions, BR links, Assignments
4. arquivo de apoio gerado para analise de gestores: `data/managers_recalculated.csv`

Modo banco legado direto:

1. `scripts/validate-legacy-schema.ps1` valida tabelas/colunas obrigatorias
2. `scripts/sync-orchestrator-direct.ps1` roda preflight + sync sem carga CSV

## 6) Seguranca e Confiabilidade

Implementado:

- sessao assinada e armazenada por hash
- OIDC state validation
- RBAC server-side
- auditoria de eventos sensiveis
- idempotencia em requests/execution
- validacao de payload com zod
- SCIM bearer auth para endpoints `/api/scim/v2/*`
- criptografia de segredos em SCIM Settings

Pontos de atencao:

- `APP_URL` deve ser URL real de acesso; evitar `0.0.0.0` para callback/redirect
- `SESSION_SECRET` fraco em dev reduz seguranca da sessao e dos segredos cifrados
- cookies `secure` so em producao (`NODE_ENV=production`)
- webhook n8n deve validar `X-Signature`

## 7) Mapa de Rotas

UI:

- `app/login/page.tsx`
- `app/my-access/page.tsx`
- `app/my-requests/page.tsx`
- `app/request/new/page.tsx`
- `app/manager/...`
- `app/admin/page.tsx` (dashboard admin fora do subnav de Administracao)
- `app/admin/logs/page.tsx`
- `app/admin/scim/page.tsx`
- `app/admin/user-management/page.tsx`

API:

- auth: `app/api/auth/*`
- requests: `app/api/requests/*`
- manager: `app/api/manager/*`
- admin: `app/api/admin/*`
- search global: `app/api/search/global/route.ts`
- scim inbound: `app/api/scim/v2/*`
- user extras: `app/api/users/[id]/additional-accesses/route.ts`

## 8) Navegacao e UX Admin

- Sidebar admin prioriza `Dashboard Admin` como item dedicado
- `Administracao` abre o conjunto de paginas de operacao/cadastro
- `Logs` fica disponivel em `Management` para operacao e auditoria
- `User Management` fica como item dedicado no fim do menu
- Subnav de Administracao inicia por `Operacao` e inclui `SCIM`

## 9) Testes e Qualidade

Testes locais relevantes (fora node_modules):

- `app/api/requests/route.test.ts`
- `app/api/admin/operation/route.test.ts`
- `lib/rbac.test.ts`
- `lib/utils.test.ts`
- `lib/validation.test.ts`

Comandos:

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run quality:sonar`

## 10) Convenios de Trabalho para Novas Sessoes

Antes de alterar codigo:

1. validar se Postgres + Keycloak estao ativos
2. validar `.env` (especialmente APP_URL e credenciais Keycloak)
3. rodar `npm run prisma:generate`

Ao alterar API/fluxo:

1. atualizar testes afetados
2. revisar impacto de RBAC
3. adicionar/ajustar auditoria
4. revisar idempotencia e estados de request

Ao alterar sync de orquestrador:

1. validar SQL em ambiente local primeiro
2. proteger contra duplicidade de links
3. garantir filtros `is_current`
4. manter compatibilidade com modo CSV e modo legado direto

## 11) Troubleshooting Rapido

### Login quebra no callback

- checar callback URL no Keycloak
- checar cookie/state
- checar `APP_URL`
- se redirecionar para `0.0.0.0`, corrigir `APP_URL` e as Redirect URIs do client

### `Forbidden` inesperado

- validar role no usuario local (`User.role`)
- validar grupos sincronizados em `UserScimGroup`
- validar relacao manager -> report

### Request fica `FAILED`

- inspecionar conectividade n8n
- validar assinatura HMAC
- revisar logs de `AccessExecution.errorMessage`

### Dados de acesso incoerentes

- recarregar CSV + sync SQL
- revisar duplicidades no snapshot

## 12) Backlog Tecnico Recomendado

1. webhook de callback do n8n para fechar ciclo SUCCESS de forma robusta
2. exportacao agendada/recorrente de logs (hoje apenas execucao manual)
3. rate-limit e headers de seguranca adicionais nas API routes
4. estrategia de refresh/revogacao de sessao por dispositivo
5. testes de integracao para auth callback, SCIM e approvals
6. suporte completo a auto-rotacao de token SCIM (hoje apenas flag MVP)
7. destinos adicionais de SIEM (ex.: Elastic/OpenSearch)

## 13) Checklist de Saida (quando concluir uma task)

1. `npm run build`
2. `npm run test`
3. validar fluxos principais (login, request, approve/reject, SCIM)
4. atualizar README/PROJECT_CONTEXT se comportamento mudou

## 14) Atualizacoes Relevantes (2026-03-05)

### 14.1 SSO e Keycloak

- Callback SSO estabilizado com tratamento defensivo para ausencia de tabelas legadas no fluxo de provisionamento.
- Mapper OIDC de `groups` adicionado no client `iga-portal` (claim em id/access/userinfo token), requisito para sincronismo de grupos no callback.
- Carga definitiva de usuarios do IGA para Keycloak executada no realm `iga`.
- Reset de senha em lote concluido para todos os usuarios do realm com `temporary=true`.

### 14.2 RBAC e regras de role

- Modelo efetivo continua com roles concomitantes em `user_role_assignments`.
- `User.role` segue papel efetivo por precedencia `ADMIN > MANAGER > USER`.
- Grupo `sr-security-cybersec-iam` mantido como gatilho de `ADMIN`.
- Recomputacao operacional usada para refletir mudancas de grupo no Keycloak imediatamente no portal.

### 14.3 Sync e integridade de dados

- `sync-orchestrator-to-portal.sql` recebeu correcoes estruturais:
  - fallback de email para evitar quebra por `User_email_key`;
  - correcao de CTE de `system_roles` (`owner_id`);
  - populacao de `UserPermissionAssignment` tambem via `snapshot_user_entitlements_detailed`;
  - classificacao de `source` como `BR` quando entitlement vier de pacote (`pacote_id`);
  - heranca de owner de sistema para SR sem owner explicito.
- Tabelas SCIM ausentes foram adicionadas por migration para restaurar callback/recompute:
  - `UserScimGroup`
  - `UserProvisioningEvent`
- Migration complementar aplicada para alinhar coluna `User.externalId`.

### 14.4 Consolidacao de identidade canonica

- Executada consolidacao de duplicidades entre usuarios locais `cmm...` e usuarios canonicos `OR-...`.
- Referencias relacionais migradas para IDs canonicos.
- Resultado esperado: hierarquia de gestores/liderados e ownership coerentes com base legado.

### 14.5 Novas capacidades de ownership (UI)

- Novas paginas:
  - `/my-systems`
  - `/my-srs`
  - `/my-brs`
- Drill-downs:
  - `/my-systems/[id]`
  - `/my-srs/[id]`
  - `/my-brs/[id]`
- Menu lateral passou a exibir entradas de ownership de forma contextual.
- `Minhas SRs` considera ownership direto da SR e ownership indireto via sistema.

### 14.6 Dados de homologacao para aprovacao de manager

- Criadas SRs de teste com owner no Ikeda.
- Inseridas solicitacoes `PENDING_APPROVAL` para validar fila de aprovacao dependente do gestor.

## 15) Atualizacoes Relevantes (2026-03-06)

### 15.1 Navegacao e estrutura de menu

- Sidebar reorganizado para separar melhor os blocos de uso pessoal, ownership e management.
- Removida dependencia de submenu superior dentro de administracao quando o contexto ja esta no sidebar.
- Ajustes de rotulacao e ordem visual para reduzir ambiguidade (ex.: `Meu Time`, prioridade visual de `BR` antes de `SR`).

### 15.2 Ownership UX (BR/SR)

- Fluxo de detalhes de SR dentro de `Minhas BRs` ajustado para painel lateral na mesma pagina, evitando abrir nova aba/janela.
- Em detalhe de BR, identificador tecnico de SR removido da grade principal e substituido por nome mais amigavel.
- Interacao por clique em SR padronizada para foco em contexto operacional do owner.

### 15.3 Descricoes de System Roles

- Campo `description` incorporado ao uso funcional das SRs no portal.
- Descricoes geradas em portugues corporativo simples, a partir de heuristica sobre `technical_name` + sistema vinculado.
- Padrao adotado:
  - frase unica;
  - inicio com `Concede` ou `Permite`;
  - foco em autenticacao/aprovacao/leitura/admin quando indicado pelo nome tecnico;
  - sem inferir privilegios nao evidenciados.
- Exibicao de descricao aplicada em paginas de SR e tooltip em listas de acesso.

### 15.4 Regras de exibicao em Meus Acessos

- Origem normalizada para `BR` ou `Adicional`.
- Regra de expiracao aplicada na UI:
  - acessos originados de `BR`: sem expiracao exibivel (`-`);
  - acessos `Adicional`: data derivada da solicitacao associada.

### 15.5 Solicitacao de acesso e escala organizacional

- Em `Nova solicitacao`, habilitada selecao de qualquer usuario da organizacao como alvo.
- Busca na lista de pessoas habilitada para cenarios de alto volume.
- Em acessos adicionais, paginacao padrao de sistemas definida para 10 por pagina.

### 15.6 Delegacao temporaria de aprovacoes

- Direcionamento funcional definido para delegacao temporaria em aprovacoes (ferias, viagens, afastamentos).
- Necessidade de compliance considerada com trilha de auditoria e escopo temporal da delegacao.
- Fluxo administrativo para IAM previsto em `Admin > Operation` para delegacoes excepcionais quando o titular estiver indisponivel.

### 15.7 Runtime e estabilidade local

- Incidentes de lock do Next (`.next/dev/lock`) e conflito de multiplas instancias tratados operacionalmente.
- Procedimento efetivo:
  1. encerrar processos `node` orfaos;
  2. iniciar unica instancia `npm run dev` no `iga-portal`;
  3. validar `localhost:3000` com redirect para `/login`.

## 16) Atualizacoes Relevantes (2026-03-09)

### 16.1 Manager KPIs e Meu Time

- Adicionados cards de contexto no topo de `Meu Time` com foco em gestao:
  - liderados ativos
  - cobertura de BR
  - acessos adicionais (excecoes)
  - total de excecoes
  - acessos criticos
- Cards com nota contextual por hover no titulo.

### 16.2 Ownership UX (BR/SR/Sistemas)

- `Minhas BRs` passou a usar painel lateral (split view) no clique da BR.
- Painel lateral inclui resumo e CTA para abrir pagina completa da BR.
- Em detalhe da BR, hover de SR simplificado para tooltip sem expansao inline.
- Em `Meus Sistemas`, removido ID tecnico da listagem principal.

### 16.3 Header funcional (Busca, Alertas, Engrenagem)

- Busca global implementada no campo do topo com debounce e dropdown.
- Sino passou a consumir alertas reais (antes era apenas visual).
- Engrenagem recebeu menu MVP com:
  - acoes rapidas
  - preferencias de UI
  - atalhos contextuais (incluindo atalhos admin)

### 16.4 Logs administrativos e exportacao SIEM/Bucket

- Nova pagina `Admin > Logs` com filtros por:
  - texto
  - acao
  - entidade
  - ator
  - periodo
- Exportacao de logs implementada com configuracao segura e execucao manual para:
  - Splunk HEC
  - AWS S3 (NDJSON)
- Credenciais da exportacao armazenadas criptografadas.
- Estado da ultima exportacao persistido na configuracao.

## 17) Atualizacoes Relevantes (2026-03-10)

### 17.1 UAR com parametros persistidos

- `Admin > UAR` passou a ter uma secao de configuracao operacional para IAM.
- Novo modelo Prisma: `UarSettings`.
- Parametros disponiveis:
  - periodicidade de revisao de `Sistema`, `SR`, `BR` e `acesso direto`
  - `reviewLookbackDays`
  - `reviewWarningWindowDays`
  - `overdueGraceDays`
  - `notifyOwnersBeforeDays`
  - `autoRevokeOnOverdue`
  - `requireJustificationOnRenewal`
- As metricas e tabelas operacionais de `UAR` agora usam esses parametros em tempo real.

### 17.2 Auditoria reforcada de configuracao

- Alteracoes de `UAR` passaram a registrar evento `UAR_SETTINGS_UPDATED` com:
  - `before`
  - `after`
  - `changedFields`
  - `changedAt`
- `Admin > Logs` recebeu atalho rapido para filtrar eventos de `UAR Settings`.

### 17.3 Operacoes IAM: Grant/Revoke de SR

- O fluxo antes chamado de `ADD_SR_TO_USER` foi substituido por `MANAGE_SR_FOR_USER`.
- A operacao agora aceita:
  - `GRANT`
  - `REVOKE`
- Eventos de auditoria separados:
  - `ADMIN_OPERATION_GRANT_SR_TO_USER`
  - `ADMIN_OPERATION_REVOKE_SR_FROM_USER`
