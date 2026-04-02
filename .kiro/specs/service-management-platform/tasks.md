# Plano de Implementação: Plataforma de Gerenciamento de Serviços Multi-Tenant

## Visão Geral

Implementação incremental da plataforma SaaS multi-tenant usando Node.js/TypeScript, PostgreSQL local, Prisma ORM, Express, e frontend React. O desenvolvimento segue a ordem: infraestrutura → backend API → frontend → deploy GCP. Testes são executados a cada etapa com Vitest e fast-check.

## Tarefas

- [x] 1. Configurar estrutura do projeto e dependências
  - [x] 1.1 Inicializar monorepo com backend e frontend
    - Criar diretório raiz com `package.json` workspace (npm workspaces ou turborepo)
    - Criar `packages/backend` com TypeScript, Express, Prisma, bcrypt, jsonwebtoken, zod, multer
    - Criar `packages/frontend` com React + Vite + TypeScript
    - Configurar `tsconfig.json` para ambos os pacotes
    - Configurar ESLint e Prettier
    - _Requisitos: 18.1_

  - [x] 1.2 Configurar Prisma e schema do banco de dados
    - Criar schema Prisma com todos os modelos: Tenant, User, Company, Location, Service, Client, Vehicle, InventoryItem, StockMovement, Bill, Appointment
    - Definir enums: Role (OWNER, ADMIN, EMPLOYEE), ItemType (USO, VENDA), MovementType (ENTRADA, SAIDA_USO, SAIDA_VENDA), BillStatus (PENDENTE, PAGO, ATRASADO), AppointmentStatus (AGENDADO, CONFIRMADO, EM_ANDAMENTO, CONCLUIDO, CANCELADO)
    - Configurar índices em tenant_id, slug, email, placa, data_hora
    - Criar migration inicial e aplicar no PostgreSQL local
    - _Requisitos: 19.2, 19.3_

  - [x] 1.3 Configurar ambiente de testes
    - Configurar Vitest com suporte a TypeScript
    - Configurar fast-check para testes baseados em propriedades
    - Criar helpers de teste: factory functions para gerar dados de teste, setup/teardown de banco de teste
    - _Requisitos: N/A (infraestrutura de testes)_

- [x] 2. Implementar AuthService (Registro e Login)
  - [x] 2.1 Implementar endpoint POST /auth/register
    - Validar entrada com zod (email, senha >= 8 chars, nome, idade >= 18, celular formato brasileiro)
    - Verificar unicidade de email, retornar 409 se duplicado
    - Hash de senha com bcrypt (salt rounds 12)
    - Criar usuário com role OWNER e tenant_id NULL
    - Gerar JWT com user_id, tenant_id: null, role, expiração 24h
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Escrever teste de propriedade para registro (Propriedade 9)
    - **Propriedade 9: Registro Produz JWT com Tenant NULL**
    - Para qualquer dados de registro válidos, o JWT retornado deve conter user_id válido, role OWNER e tenant_id NULL
    - **Valida: Requisitos 1.1, 1.6**

  - [ ]* 2.3 Escrever teste de propriedade para unicidade de email (Propriedade 12)
    - **Propriedade 12: Unicidade Global de Email de Usuário**
    - Para qualquer par de registros com mesmo email, o segundo deve falhar com 409
    - **Valida: Requisitos 1.2**

  - [ ]* 2.4 Escrever teste de propriedade para senha (Propriedade 10)
    - **Propriedade 10: Senha Nunca Armazenada em Texto Plano**
    - Para qualquer senha fornecida, o hash armazenado deve ser diferente da senha original e deve ser um hash bcrypt válido
    - **Valida: Requisitos 1.5**

  - [ ]* 2.5 Escrever teste de propriedade para validação de formatos (Propriedade 17)
    - **Propriedade 17: Validação de Formatos de Entrada**
    - Para qualquer entrada inválida (email malformado, senha curta, idade < 18, celular fora do formato), o registro deve ser rejeitado
    - **Valida: Requisitos 1.3, 1.4, 17.1, 17.2**

  - [x] 2.6 Implementar endpoint POST /auth/login
    - Validar email e senha
    - Verificar credenciais com bcrypt.compare
    - Retornar JWT com user_id, tenant_id e role, ou erro 401
    - _Requisitos: 2.1, 2.2_

  - [x] 2.7 Implementar endpoint POST /auth/refresh
    - Validar refresh token
    - Emitir novo JWT com mesmos claims e nova expiração
    - _Requisitos: 2.3, 2.4, 2.5_

- [x] 3. Implementar Middleware Multi-Tenant
  - [x] 3.1 Implementar middleware de autenticação e contexto de tenant
    - Extrair Bearer token do header Authorization
    - Validar assinatura e expiração do JWT
    - Injetar user_id, tenant_id e role no request context
    - Se tenant_id é NULL e rota não é de setup, retornar 403 "Configure sua empresa primeiro"
    - Retornar 401 para tokens inválidos ou ausentes
    - _Requisitos: 3.1, 3.2, 3.3_

  - [x] 3.2 Implementar helper de filtragem por tenant_id
    - Criar função utilitária que adiciona filtro tenant_id a todas as queries Prisma
    - Criar função validateTenantAccess para verificar acesso a recursos
    - _Requisitos: 3.4, 3.5_

  - [ ]* 3.3 Escrever teste de propriedade para isolamento multi-tenant (Propriedade 1)
    - **Propriedade 1: Isolamento Multi-Tenant**
    - Para qualquer recurso com tenant_id diferente do contexto da requisição, o acesso deve ser negado
    - **Valida: Requisitos 3.4, 3.5**

- [x] 4. Checkpoint - Verificar autenticação e middleware
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 5. Implementar CompanyService (Empresa e Lojas)
  - [x] 5.1 Implementar função generateSlug
    - Converter nome para lowercase, substituir espaços por hífens, remover caracteres especiais, converter acentos para ASCII
    - Verificar unicidade no banco, adicionar sufixo aleatório se necessário
    - _Requisitos: 4.2, 4.4_

  - [ ]* 5.2 Escrever testes de propriedade para slug (Propriedades 4 e 5)
    - **Propriedade 4: Unicidade de Slug** - Para qualquer conjunto de nomes de empresa, todos os slugs gerados devem ser únicos
    - **Propriedade 5: Formato de Slug** - Para qualquer nome, o slug deve estar em lowercase, sem caracteres especiais, com acentos convertidos
    - **Valida: Requisitos 4.2, 4.4**

  - [x] 5.3 Implementar endpoint POST /companies (criar empresa)
    - Criar Tenant com slug único
    - Criar Company vinculada ao tenant
    - Criar Location primária com endereço fornecido
    - Atualizar user.tenant_id
    - Emitir novo JWT com tenant_id
    - _Requisitos: 4.1, 4.3, 4.6_

  - [x] 5.4 Implementar endpoints de lojas (CRUD /companies/:id/locations)
    - POST: criar localização vinculada ao tenant
    - GET: listar lojas do tenant
    - PUT: atualizar endereço
    - DELETE: excluir localização (impedir exclusão da primária)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.5 Escrever teste de propriedade para localização primária (Propriedade 8)
    - **Propriedade 8: Empresa Tem Localização Primária**
    - Para qualquer empresa, deve existir pelo menos uma localização com is_primary = TRUE
    - **Valida: Requisitos 4.6, 5.5**

  - [x] 5.6 Implementar endpoint PUT /companies/:id (atualizar empresa)
    - Persistir alterações mantendo tenant_id original
    - _Requisitos: 4.5_

- [x] 6. Implementar ServiceService (Serviços)
  - [x] 6.1 Implementar CRUD de serviços (/services)
    - POST: criar serviço com tenant_id, duração padrão 60 min se não especificada, status ativo
    - GET: listar serviços do tenant
    - PUT: atualizar serviço
    - DELETE: excluir serviço
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Escrever teste de propriedade para duração padrão (Propriedade 16)
    - **Propriedade 16: Duração Padrão de Serviço**
    - Para qualquer serviço criado sem duração, duracao_minutos deve ser 60
    - **Valida: Requisitos 6.5**

- [x] 7. Implementar ClientService (Clientes)
  - [x] 7.1 Implementar CRUD de clientes (/clients)
    - POST: criar cliente com tenant_id, validar unicidade de celular e email por tenant
    - GET: listar clientes paginados (cursor-based) do tenant
    - GET /:id: buscar cliente por ID com verificação de tenant
    - PUT: atualizar cliente
    - DELETE: excluir cliente
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 19.1_

  - [ ]* 7.2 Escrever teste de propriedade para unicidade por tenant (Propriedade 11)
    - **Propriedade 11: Unicidade por Tenant**
    - Para qualquer tenant, não devem existir dois clientes com mesmo celular ou email, nem dois veículos com mesma placa
    - **Valida: Requisitos 7.2, 7.3, 8.2**

- [x] 8. Implementar VehicleService (Veículos)
  - [x] 8.1 Implementar CRUD de veículos (/clients/:clientId/vehicles)
    - POST: criar veículo vinculado ao cliente e tenant, validar unicidade de placa por tenant, validar ano (1900 a ano_atual+1)
    - GET: listar veículos do cliente no tenant
    - PUT: atualizar veículo
    - DELETE: excluir veículo
    - _Requisitos: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Checkpoint - Verificar CRUD de entidades base
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 10. Implementar InventoryService (Estoque e Movimentações)
  - [x] 10.1 Implementar CRUD de itens de estoque (/inventory)
    - POST: criar item com tipo USO ou VENDA, quantidade_inicial, vinculado ao tenant
    - GET: listar itens paginados com filtro opcional por tipo
    - GET /summary: retornar resumo de estoque do tenant
    - PUT: atualizar item
    - DELETE: excluir item
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.2 Implementar endpoint POST /inventory/:id/movements (movimentação de estoque)
    - Validar tipo de movimentação conforme tipo do item (SAIDA_VENDA só para VENDA, SAIDA_USO só para USO)
    - Verificar estoque suficiente para saídas, retornar 422 se insuficiente
    - Registrar movimentação e atualizar quantidade em transação atômica
    - Emitir alerta se quantidade_atual <= quantidade_minima
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 9.5_

  - [ ]* 10.3 Escrever teste de propriedade para consistência de estoque (Propriedade 2)
    - **Propriedade 2: Consistência de Estoque**
    - Para qualquer sequência de movimentações, quantidade_atual = SUM(entradas) - SUM(saídas) e >= 0
    - **Valida: Requisitos 10.1, 10.2, 10.3, 10.4, 10.8**

  - [ ]* 10.4 Escrever teste de propriedade para integridade de tipo (Propriedade 6)
    - **Propriedade 6: Integridade de Tipo de Estoque**
    - SAIDA_VENDA só aceita itens VENDA, SAIDA_USO só aceita itens USO
    - **Valida: Requisitos 10.5, 10.6**

  - [ ]* 10.5 Escrever teste de propriedade para alerta de estoque baixo (Propriedade 19)
    - **Propriedade 19: Alerta de Estoque Baixo**
    - Quando quantidade_atual <= quantidade_minima após movimentação, alerta deve ser emitido
    - **Valida: Requisitos 9.5**

- [x] 11. Implementar BillService (Contas a Pagar)
  - [x] 11.1 Implementar CRUD de contas (/bills)
    - POST: criar conta com status PENDENTE vinculada ao tenant
    - GET: listar contas paginadas com filtros opcionais
    - PUT: atualizar conta
    - PATCH /:id/pay: marcar como PAGO com data_pagamento
    - DELETE: excluir conta
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 11.2 Escrever teste de propriedade para ciclo de vida de conta (Propriedade 15)
    - **Propriedade 15: Ciclo de Vida de Conta**
    - Status inicial PENDENTE; ao marcar como paga, status = PAGO e data_pagamento preenchida
    - **Valida: Requisitos 11.1, 11.2**

- [x] 12. Implementar AppointmentService (Agendamentos)
  - [x] 12.1 Implementar endpoint POST /appointments (agendamento interno)
    - Criar agendamento com status AGENDADO vinculado ao tenant
    - Verificar conflito de horário na mesma localização (excluir CANCELADO e CONCLUIDO)
    - Retornar 409 se horário indisponível
    - _Requisitos: 12.1, 12.2, 12.6_

  - [x] 12.2 Implementar endpoints de gerenciamento de agendamentos
    - PUT: atualizar agendamento com verificação de conflito
    - PATCH /:id/cancel: cancelar agendamento (status CANCELADO)
    - GET: listar agendamentos por período do tenant
    - _Requisitos: 12.3, 12.4, 12.5_

  - [ ]* 12.3 Escrever teste de propriedade para conflito de agendamento (Propriedade 3)
    - **Propriedade 3: Sem Conflito de Agendamento**
    - Para qualquer par de agendamentos ativos na mesma localização, os intervalos de tempo não devem se sobrepor
    - **Valida: Requisitos 12.2, 13.2**

- [x] 13. Implementar endpoints públicos (Página Pública e Agendamento)
  - [x] 13.1 Implementar GET /public/:slug/profile (perfil público)
    - Resolver tenant pelo slug, retornar nome, logo, descrição
    - Retornar 404 se slug não encontrado
    - _Requisitos: 15.1, 15.4_

  - [x] 13.2 Implementar GET /public/:slug/services (serviços públicos)
    - Retornar apenas serviços ativos do tenant
    - _Requisitos: 15.2_

  - [ ]* 13.3 Escrever teste de propriedade para serviços públicos (Propriedade 14)
    - **Propriedade 14: Serviços Públicos São Apenas Ativos**
    - Todos os serviços retornados na listagem pública devem ter ativo = TRUE
    - **Valida: Requisitos 15.2**

  - [x] 13.4 Implementar GET /public/:slug/whatsapp (link WhatsApp)
    - Retornar link wa.me/{celular} do proprietário
    - _Requisitos: 15.3_

  - [ ]* 13.5 Escrever teste de propriedade para link WhatsApp (Propriedade 18)
    - **Propriedade 18: Link WhatsApp Correto**
    - O link retornado deve seguir formato wa.me/{celular} com celular do proprietário
    - **Valida: Requisitos 15.3**

  - [x] 13.6 Implementar GET /public/:slug/slots (horários disponíveis)
    - Gerar slots entre 08:00-18:00 respeitando duração do serviço
    - Excluir horários com agendamentos ativos
    - Retornar slots ordenados cronologicamente
    - Validar data futura e serviço ativo
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 13.7 Escrever teste de propriedade para horários disponíveis (Propriedade 13)
    - **Propriedade 13: Horários Disponíveis Válidos**
    - Todos os slots devem estar entre 08:00-18:00, sem conflito com agendamentos ativos, ordenados cronologicamente
    - **Valida: Requisitos 14.1, 14.2, 14.5**

  - [x] 13.8 Implementar POST /public/:slug/appointments (agendamento público)
    - Resolver tenant pelo slug
    - Validar serviço ativo, data futura, conflito de horário
    - Criar agendamento com client_id NULL, nome_visitante e celular_visitante preenchidos
    - Usar localização primária do tenant
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 13.9 Escrever teste de propriedade para agendamento público (Propriedade 7)
    - **Propriedade 7: Agendamento Público Válido**
    - Para agendamentos com client_id NULL, nome_visitante e celular_visitante devem ser não-nulos, e location_id deve ser a localização primária
    - **Valida: Requisitos 13.5, 13.6**

- [x] 14. Implementar Upload de Imagens
  - [x] 14.1 Implementar endpoint POST /upload (upload de imagens)
    - Validar tipo MIME (apenas JPEG) e tamanho (máx 5MB) no backend
    - Em desenvolvimento local: salvar em diretório local e retornar URL
    - Preparar abstração para trocar por Cloud Storage no deploy
    - _Requisitos: 16.1, 16.2, 16.3, 16.4_

- [x] 15. Implementar Segurança e Rate Limiting
  - [x] 15.1 Configurar CORS, rate limiting e segurança
    - Configurar CORS para origens autorizadas
    - Aplicar rate limiting nos endpoints públicos (login, registro, agendamento) com express-rate-limit
    - Garantir que todas as queries usam Prisma (parametrizadas por padrão)
    - _Requisitos: 18.1, 18.2, 18.3_

- [x] 16. Checkpoint - Backend completo
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 17. Implementar Frontend - Autenticação e Setup
  - [x] 17.1 Configurar roteamento, estado global e cliente HTTP
    - Configurar React Router com rotas protegidas e públicas
    - Configurar Axios/fetch com interceptor para JWT
    - Criar contexto de autenticação (AuthContext) com login, logout, registro
    - _Requisitos: 2.1, 2.2_

  - [x] 17.2 Implementar páginas de registro e login
    - Formulário de registro com validação (email, senha, nome, idade, celular)
    - Formulário de login com email e senha
    - Redirecionamento para setup de empresa se tenant_id é NULL
    - _Requisitos: 1.1, 2.1_

  - [x] 17.3 Implementar página de configuração de empresa
    - Formulário com nome, descrição, endereço, upload de logo
    - Após criação, atualizar token no contexto e redirecionar ao painel
    - _Requisitos: 4.1, 4.3_

- [x] 18. Implementar Frontend - Painel Administrativo
  - [x] 18.1 Implementar CRUD de lojas no painel
    - Listagem, criação, edição e exclusão de lojas
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [x] 18.2 Implementar CRUD de serviços no painel
    - Listagem, criação, edição e exclusão de serviços com upload de foto
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

  - [x] 18.3 Implementar CRUD de clientes e veículos no painel
    - Listagem paginada de clientes, criação, edição, exclusão
    - Listagem de veículos por cliente, criação, edição, exclusão
    - _Requisitos: 7.1, 7.4, 8.1, 8.4_

  - [x] 18.4 Implementar gerenciamento de estoque no painel
    - Listagem de itens com filtro por tipo, criação, edição
    - Formulário de movimentação (entrada/saída)
    - Exibição de resumo de estoque e alertas de estoque baixo
    - _Requisitos: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3_

  - [x] 18.5 Implementar gerenciamento de contas a pagar no painel
    - Listagem com filtros, criação, edição, marcar como paga, exclusão
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 18.6 Implementar calendário de agendamentos no painel
    - Visualização de agendamentos por período (calendário)
    - Criação de agendamento com seleção de cliente, serviço e localização
    - Atualização de status e cancelamento
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 19. Implementar Frontend - Página Pública
  - [x] 19.1 Implementar página pública do estabelecimento
    - Exibir perfil público (nome, logo, descrição) via slug
    - Listar serviços ativos
    - Botão de WhatsApp com link wa.me
    - Página 404 para slug inexistente
    - _Requisitos: 15.1, 15.2, 15.3, 15.4_

  - [x] 19.2 Implementar fluxo de agendamento público
    - Seleção de serviço e data
    - Exibição de horários disponíveis
    - Formulário com nome e celular do visitante
    - Confirmação do agendamento
    - _Requisitos: 13.1, 13.4, 14.1, 14.2_

- [x] 20. Checkpoint - Frontend completo
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [ ] 21. Preparar e executar deploy no GCP
  - [ ] 21.1 Criar Dockerfiles para backend e frontend
    - Dockerfile multi-stage para backend (Node.js + Prisma)
    - Dockerfile multi-stage para frontend (build React + nginx)
    - Criar docker-compose.yml para teste local com PostgreSQL
    - _Requisitos: 18.4_

  - [ ] 21.2 Configurar Cloud SQL e Cloud Storage
    - Criar instância Cloud SQL PostgreSQL via CLI
    - Executar migrações Prisma no Cloud SQL
    - Criar bucket Cloud Storage para imagens
    - Atualizar código de upload para usar Cloud Storage SDK
    - _Requisitos: 16.1, 19.4_

  - [ ] 21.3 Deploy no Cloud Run
    - Build e push das imagens Docker para Artifact Registry
    - Deploy backend no Cloud Run com variáveis de ambiente (DB_URL, JWT_SECRET, GCS_BUCKET)
    - Deploy frontend no Cloud Run
    - Configurar HTTPS (automático no Cloud Run)
    - Configurar CORS para domínio de produção
    - _Requisitos: 18.2, 18.4_

- [ ] 22. Checkpoint final - Verificar deploy e testes end-to-end
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e casos de borda
- O desenvolvimento local usa PostgreSQL local; Cloud SQL é configurado apenas no deploy
