# Bugfix Requirements Document

## Introduction

Auditoria de prontidão para produção do monorepo (backend Express/Prisma + frontend React/Vite). O sistema roda em desenvolvimento no GCP mas possui múltiplos problemas de segurança, configuração e confiabilidade que impedem um deploy seguro em produção. Os bugs identificados abrangem: credenciais hardcoded, JWT sem rotação, ausência de logging estruturado, Docker sem hardening, CORS permissivo, falta de graceful shutdown, e ausência de variáveis de ambiente obrigatórias para produção.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o backend é iniciado sem a variável JWT_SECRET definida THEN o sistema usa um fallback hardcoded `'dev-secret-key-change-in-production'`, permitindo que qualquer pessoa que conheça esse valor forje tokens JWT válidos

1.2 WHEN o docker-compose.yml é usado em produção THEN o sistema expõe credenciais do banco de dados em texto plano (`postgres:postgres`) e um JWT_SECRET inseguro (`local-dev-secret-change-in-production`) diretamente no arquivo de configuração

1.3 WHEN o backend recebe uma requisição e ocorre um erro interno THEN o sistema loga o erro com `console.error` sem estrutura, sem correlation ID, sem timestamp padronizado e sem nível de severidade, tornando impossível diagnosticar problemas em produção

1.4 WHEN o processo Node.js recebe um sinal SIGTERM/SIGINT (ex: durante redeploy no GCP) THEN o sistema encerra abruptamente sem fechar conexões HTTP ativas nem desconectar o Prisma Client do banco de dados, causando potencial perda de dados e conexões órfãs

1.5 WHEN o frontend é buildado para produção no Docker THEN o nginx serve a aplicação sem headers de segurança (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, Content-Security-Policy), sem compressão gzip, e sem cache headers para assets estáticos

1.6 WHEN o backend Docker container roda em produção THEN o processo Node.js executa como root dentro do container, violando o princípio de menor privilégio e aumentando a superfície de ataque

1.7 WHEN o backend inicia THEN o PrismaClient é instanciado sem configuração de connection pool (pool size, timeout), sem logging de queries lentas, e sem tratamento de erros de conexão, podendo esgotar conexões do banco sob carga

1.8 WHEN o endpoint `/health` é chamado THEN o sistema retorna `{ status: 'ok' }` sem verificar a conectividade real com o banco de dados, fazendo com que o load balancer do GCP considere o serviço saudável mesmo quando o banco está inacessível

1.9 WHEN o root `.gitignore` é avaliado THEN ele contém apenas `node_modules`, sem excluir arquivos `.env`, `dist/`, `uploads/`, ou outros artefatos sensíveis/gerados, arriscando commit acidental de segredos no repositório

1.10 WHEN o dashboard `/dashboard/stats` é chamado THEN o sistema carrega TODOS os appointments e bills do tenant sem paginação nem filtro de data eficiente, executando múltiplas queries pesadas e cálculos em memória que degradam performance com o crescimento dos dados

1.11 WHEN o backend processa uploads de imagem THEN o sistema não valida o conteúdo real do arquivo (magic bytes), confiando apenas no campo `mimetype` do header HTTP que pode ser falsificado, permitindo upload de arquivos maliciosos disfarçados de imagens

1.12 WHEN o slug gerado para um tenant colide com um existente THEN o sistema gera um sufixo aleatório de 4 caracteres com `Math.random()`, que não é criptograficamente seguro e tem alta probabilidade de colisão em escala

### Expected Behavior (Correct)

2.1 WHEN o backend é iniciado sem a variável JWT_SECRET definida THEN o sistema SHALL recusar iniciar e lançar um erro fatal indicando que JWT_SECRET é obrigatório, prevenindo execução com segredo inseguro

2.2 WHEN o sistema é configurado para produção THEN o docker-compose SHALL usar variáveis de ambiente externas (via `.env` file ou secrets manager) para DATABASE_URL, JWT_SECRET e outras credenciais, sem valores hardcoded no arquivo de composição

2.3 WHEN o backend processa uma requisição e ocorre um erro THEN o sistema SHALL usar logging estruturado (JSON) com campos padronizados: timestamp, level, message, requestId/correlationId, e stack trace quando aplicável

2.4 WHEN o processo Node.js recebe SIGTERM/SIGINT THEN o sistema SHALL executar graceful shutdown: parar de aceitar novas conexões, aguardar requisições em andamento (com timeout), desconectar o Prisma Client, e então encerrar o processo com código de saída apropriado

2.5 WHEN o frontend é servido pelo nginx em produção THEN o servidor SHALL incluir headers de segurança (X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Strict-Transport-Security com max-age adequado), habilitar compressão gzip para text/html/css/js, e configurar cache headers para assets com hash no nome

2.6 WHEN o backend Docker container roda THEN o processo Node.js SHALL executar como um usuário não-root dedicado (ex: `node`), com o Dockerfile usando a instrução `USER` após a instalação de dependências

2.7 WHEN o PrismaClient é instanciado THEN o sistema SHALL configurar connection pool com limites adequados, timeout de conexão, e logging de queries que excedam um threshold de tempo configurável

2.8 WHEN o endpoint `/health` é chamado THEN o sistema SHALL verificar a conectividade com o banco de dados (ex: `SELECT 1`) e retornar status unhealthy com código HTTP 503 se o banco estiver inacessível

2.9 WHEN o root `.gitignore` é avaliado THEN ele SHALL excluir `.env*`, `dist/`, `uploads/`, `*.log`, e outros artefatos sensíveis/gerados para prevenir commits acidentais

2.10 WHEN o dashboard `/dashboard/stats` é chamado THEN o sistema SHALL usar queries otimizadas com agregações no banco de dados (COUNT, SUM com WHERE) em vez de carregar todos os registros em memória

2.11 WHEN o backend processa uploads de imagem THEN o sistema SHALL validar os magic bytes do arquivo para confirmar que o conteúdo é realmente JPEG ou PNG, rejeitando arquivos com mimetype falsificado

2.12 WHEN o slug gerado para um tenant colide THEN o sistema SHALL usar `crypto.randomBytes()` ou `crypto.randomUUID()` para gerar sufixos únicos, e implementar retry com verificação de unicidade

### Unchanged Behavior (Regression Prevention)

3.1 WHEN um usuário faz login com credenciais válidas THEN o sistema SHALL CONTINUE TO retornar um JWT válido e os dados do usuário

3.2 WHEN um usuário autenticado acessa rotas protegidas com token válido THEN o sistema SHALL CONTINUE TO autorizar o acesso e injetar o contexto do tenant corretamente

3.3 WHEN um visitante público acessa `/public/:slug/profile` com um slug válido THEN o sistema SHALL CONTINUE TO retornar os dados da empresa sem autenticação

3.4 WHEN um usuário cria um agendamento sem conflito de horário THEN o sistema SHALL CONTINUE TO criar o agendamento com status AGENDADO

3.5 WHEN um usuário faz upload de uma imagem JPEG ou PNG válida com menos de 5MB THEN o sistema SHALL CONTINUE TO salvar o arquivo e retornar a URL

3.6 WHEN um usuário cria uma movimentação de estoque com quantidade válida THEN o sistema SHALL CONTINUE TO atualizar o estoque atomicamente e registrar a movimentação

3.7 WHEN o frontend faz requisições autenticadas à API THEN o sistema SHALL CONTINUE TO incluir o token Bearer no header Authorization e tratar erros 401 com redirect para login

3.8 WHEN o sistema é buildado com Docker THEN os containers SHALL CONTINUE TO usar multi-stage build com imagem Alpine para manter o tamanho reduzido

3.9 WHEN as migrations do Prisma são executadas no deploy THEN o sistema SHALL CONTINUE TO aplicar migrations pendentes antes de iniciar o servidor

3.10 WHEN o rate limiter está ativo THEN o sistema SHALL CONTINUE TO limitar tentativas de login a 10 por 15 minutos e agendamentos públicos a 5 por 15 minutos
