# Documento de Requisitos: Plataforma de Gerenciamento de Serviços Multi-Tenant

## Introdução

Este documento define os requisitos para a Plataforma de Gerenciamento de Serviços Multi-Tenant, um SaaS que permite a proprietários de estabelecimentos de serviços gerenciar empresas, lojas, serviços, clientes, veículos, estoque, contas financeiras e agendamentos. O sistema possui um painel administrativo e uma página pública para visitantes agendarem serviços. A separação multi-tenant é feita por isolamento lógico no banco de dados.

## Glossário

- **Sistema**: A Plataforma de Gerenciamento de Serviços Multi-Tenant como um todo
- **AuthService**: Componente responsável por registro, login e emissão de tokens JWT
- **CompanyService**: Componente responsável pelo CRUD de empresas e lojas
- **ServiceService**: Componente responsável pelo CRUD de serviços oferecidos
- **ClientService**: Componente responsável pelo CRUD de clientes
- **VehicleService**: Componente responsável pelo CRUD de veículos vinculados a clientes
- **InventoryService**: Componente responsável pelo controle de estoque e movimentações
- **BillService**: Componente responsável pelo controle de contas a pagar
- **AppointmentService**: Componente responsável pelo gerenciamento de agendamentos
- **PublicPageService**: Componente responsável por servir dados públicos do estabelecimento
- **Middleware_Multi_Tenant**: Componente que intercepta requisições e injeta o contexto do tenant
- **Proprietário**: Usuário dono do estabelecimento que administra o sistema
- **Visitante**: Pessoa não autenticada que acessa a página pública do estabelecimento
- **Tenant**: Entidade lógica que representa uma empresa isolada no sistema
- **Slug**: Identificador textual único derivado do nome da empresa, usado na URL pública
- **JWT**: JSON Web Token usado para autenticação stateless
- **Movimentação**: Registro de entrada ou saída de item no estoque
- **Agendamento_Ativo**: Agendamento com status diferente de CANCELADO e CONCLUIDO

## Requisitos

### Requisito 1: Registro de Proprietário

**User Story:** Como proprietário, quero me registrar na plataforma, para que eu possa criar minha conta e configurar meu estabelecimento.

#### Critérios de Aceitação

1. WHEN um proprietário submete dados de registro válidos (email, senha, nome, idade, celular) THEN o AuthService SHALL criar o usuário com role OWNER e retornar um JWT contendo user_id
2. WHEN um proprietário tenta registrar com um email já existente THEN o AuthService SHALL rejeitar o registro com erro 409 e mensagem "Email já cadastrado"
3. WHEN um proprietário submete uma senha com menos de 8 caracteres THEN o AuthService SHALL rejeitar o registro com erro de validação
4. WHEN um proprietário submete idade inferior a 18 THEN o AuthService SHALL rejeitar o registro com erro de validação
5. THE AuthService SHALL armazenar senhas usando hash bcrypt com salt rounds de 12
6. WHEN um novo proprietário é registrado THEN o AuthService SHALL emitir um JWT com tenant_id NULL até que a empresa seja configurada

### Requisito 2: Login e Autenticação

**User Story:** Como proprietário, quero fazer login na plataforma, para que eu possa acessar o painel administrativo do meu estabelecimento.

#### Critérios de Aceitação

1. WHEN um proprietário submete email e senha válidos THEN o AuthService SHALL retornar um JWT com user_id, tenant_id e role
2. WHEN um proprietário submete credenciais inválidas THEN o AuthService SHALL retornar erro 401
3. WHEN um JWT expira THEN o AuthService SHALL permitir renovação via refresh token
4. WHEN um JWT é apresentado em uma requisição THEN o AuthService SHALL validar a assinatura e a expiração do token
5. THE AuthService SHALL emitir tokens JWT com expiração de 24 horas

### Requisito 3: Middleware Multi-Tenant

**User Story:** Como proprietário, quero que meus dados estejam isolados de outros estabelecimentos, para que nenhum outro usuário acesse informações do meu negócio.

#### Critérios de Aceitação

1. WHEN uma requisição autenticada é recebida THEN o Middleware_Multi_Tenant SHALL extrair user_id, tenant_id e role do JWT e injetar no contexto da requisição
2. WHEN um token JWT é inválido ou ausente THEN o Middleware_Multi_Tenant SHALL retornar erro 401
3. WHEN um token JWT possui tenant_id NULL e a rota não é de configuração de empresa THEN o Middleware_Multi_Tenant SHALL retornar erro 403 com mensagem "Configure sua empresa primeiro"
4. THE Sistema SHALL filtrar todos os recursos por tenant_id, garantindo que nenhum recurso de um tenant seja acessível por outro tenant
5. WHEN um usuário tenta acessar um recurso com tenant_id diferente do seu THEN o Sistema SHALL retornar erro 403 "Acesso negado"

### Requisito 4: Configuração de Empresa

**User Story:** Como proprietário, quero configurar minha empresa com nome, logo e endereço, para que meu estabelecimento esteja visível na plataforma.

#### Critérios de Aceitação

1. WHEN um proprietário submete dados da empresa (nome, logo_url, descrição, endereço) THEN o CompanyService SHALL criar um Tenant com slug único, a empresa vinculada e uma localização primária
2. WHEN um slug gerado a partir do nome já existe THEN o CompanyService SHALL adicionar um sufixo aleatório para garantir unicidade
3. WHEN a empresa é criada THEN o AuthService SHALL emitir um novo JWT contendo o tenant_id recém-criado
4. THE CompanyService SHALL gerar slugs em lowercase, substituindo espaços por hífens, removendo caracteres especiais e convertendo acentos para ASCII
5. WHEN um proprietário atualiza dados da empresa THEN o CompanyService SHALL persistir as alterações mantendo o tenant_id original
6. THE CompanyService SHALL garantir que cada tenant possua exatamente uma empresa vinculada

### Requisito 5: Gerenciamento de Lojas

**User Story:** Como proprietário, quero gerenciar múltiplas lojas do meu estabelecimento, para que eu possa organizar meus pontos de atendimento.

#### Critérios de Aceitação

1. WHEN um proprietário adiciona uma loja THEN o CompanyService SHALL criar a localização vinculada ao tenant e à empresa
2. WHEN um proprietário lista lojas THEN o CompanyService SHALL retornar apenas lojas do tenant do proprietário
3. WHEN um proprietário atualiza uma loja THEN o CompanyService SHALL persistir as alterações do endereço
4. WHEN um proprietário remove uma loja THEN o CompanyService SHALL excluir a localização do sistema
5. THE CompanyService SHALL garantir que toda empresa possua pelo menos uma localização com is_primary TRUE

### Requisito 6: Gerenciamento de Serviços

**User Story:** Como proprietário, quero cadastrar os serviços que meu estabelecimento oferece, para que clientes e visitantes possam visualizá-los.

#### Critérios de Aceitação

1. WHEN um proprietário cria um serviço (nome, descrição, foto_url, duração) THEN o ServiceService SHALL criar o serviço vinculado ao tenant com status ativo
2. WHEN um proprietário atualiza um serviço THEN o ServiceService SHALL persistir as alterações
3. WHEN um proprietário lista serviços THEN o ServiceService SHALL retornar apenas serviços do tenant do proprietário
4. WHEN um proprietário exclui um serviço THEN o ServiceService SHALL remover o serviço do sistema
5. THE ServiceService SHALL definir duração padrão de 60 minutos quando não especificada

### Requisito 7: Gerenciamento de Clientes

**User Story:** Como proprietário, quero cadastrar e gerenciar meus clientes, para que eu possa manter um histórico de atendimentos.

#### Critérios de Aceitação

1. WHEN um proprietário cria um cliente (nome, email, celular, data_nascimento) THEN o ClientService SHALL criar o cliente vinculado ao tenant
2. WHEN um proprietário tenta criar um cliente com celular já existente no mesmo tenant THEN o ClientService SHALL rejeitar com erro de duplicidade
3. WHEN um proprietário tenta criar um cliente com email já existente no mesmo tenant THEN o ClientService SHALL rejeitar com erro de duplicidade
4. WHEN um proprietário lista clientes THEN o ClientService SHALL retornar resultados paginados apenas do tenant do proprietário
5. WHEN um proprietário busca um cliente por ID THEN o ClientService SHALL retornar o cliente apenas se pertencer ao tenant do proprietário

### Requisito 8: Gerenciamento de Veículos

**User Story:** Como proprietário, quero cadastrar veículos vinculados aos meus clientes, para que eu possa rastrear serviços realizados em cada veículo.

#### Critérios de Aceitação

1. WHEN um proprietário cria um veículo (marca, modelo, ano, placa) vinculado a um cliente THEN o VehicleService SHALL criar o veículo vinculado ao tenant e ao cliente
2. WHEN um proprietário tenta criar um veículo com placa já existente no mesmo tenant THEN o VehicleService SHALL rejeitar com erro de duplicidade
3. WHEN um proprietário submete um ano fora do intervalo 1900 até ano_atual + 1 THEN o VehicleService SHALL rejeitar com erro de validação
4. WHEN um proprietário lista veículos de um cliente THEN o VehicleService SHALL retornar apenas veículos do tenant do proprietário

### Requisito 9: Gerenciamento de Estoque

**User Story:** Como proprietário, quero controlar meu estoque de itens de uso interno e peças para venda, para que eu saiba o que tenho disponível e quando preciso repor.

#### Critérios de Aceitação

1. WHEN um proprietário cria um item de estoque (nome, custo, valor_venda, tipo, quantidade_inicial) THEN o InventoryService SHALL criar o item com tipo USO ou VENDA vinculado ao tenant
2. WHEN um proprietário lista itens de estoque THEN o InventoryService SHALL retornar resultados paginados apenas do tenant do proprietário, com filtro opcional por tipo
3. WHEN um proprietário consulta o resumo de estoque THEN o InventoryService SHALL retornar o sumário de todos os itens do tenant
4. WHEN um proprietário atualiza um item de estoque THEN o InventoryService SHALL persistir as alterações
5. WHEN a quantidade_atual de um item atinge ou fica abaixo da quantidade_minima THEN o InventoryService SHALL emitir um alerta de estoque baixo

### Requisito 10: Movimentação de Estoque

**User Story:** Como proprietário, quero registrar entradas e saídas de estoque, para que o saldo dos meus itens esteja sempre atualizado.

#### Critérios de Aceitação

1. WHEN um proprietário registra uma movimentação de ENTRADA THEN o InventoryService SHALL incrementar a quantidade_atual do item pela quantidade informada
2. WHEN um proprietário registra uma movimentação de SAIDA_USO em um item do tipo USO THEN o InventoryService SHALL decrementar a quantidade_atual do item pela quantidade informada
3. WHEN um proprietário registra uma movimentação de SAIDA_VENDA em um item do tipo VENDA THEN o InventoryService SHALL decrementar a quantidade_atual do item pela quantidade informada
4. WHEN um proprietário tenta registrar uma saída com quantidade maior que o estoque disponível THEN o InventoryService SHALL rejeitar com erro 422 "Estoque insuficiente"
5. WHEN um proprietário tenta registrar SAIDA_VENDA em um item do tipo USO THEN o InventoryService SHALL rejeitar a movimentação
6. WHEN um proprietário tenta registrar SAIDA_USO em um item do tipo VENDA THEN o InventoryService SHALL rejeitar a movimentação
7. THE InventoryService SHALL registrar a movimentação e atualizar o estoque em uma transação atômica
8. THE InventoryService SHALL manter a invariante: quantidade_atual = SUM(entradas) - SUM(saídas) para todo item

### Requisito 11: Gerenciamento de Contas a Pagar

**User Story:** Como proprietário, quero controlar minhas contas a pagar, para que eu possa gerenciar as finanças do meu estabelecimento.

#### Critérios de Aceitação

1. WHEN um proprietário cria uma conta (descrição, valor, data_vencimento) THEN o BillService SHALL criar a conta com status PENDENTE vinculada ao tenant
2. WHEN um proprietário marca uma conta como paga THEN o BillService SHALL atualizar o status para PAGO e registrar a data_pagamento
3. WHEN um proprietário lista contas THEN o BillService SHALL retornar resultados paginados apenas do tenant do proprietário, com filtros opcionais
4. WHEN um proprietário atualiza uma conta THEN o BillService SHALL persistir as alterações
5. WHEN um proprietário exclui uma conta THEN o BillService SHALL remover a conta do sistema

### Requisito 12: Agendamento Interno

**User Story:** Como proprietário, quero agendar serviços para meus clientes pelo painel administrativo, para que eu possa organizar minha agenda de atendimentos.

#### Critérios de Aceitação

1. WHEN um proprietário cria um agendamento (client_id, service_id, location_id, data_hora, notas) THEN o AppointmentService SHALL criar o agendamento com status AGENDADO vinculado ao tenant
2. WHEN um proprietário tenta criar um agendamento em horário que conflita com outro agendamento ativo na mesma localização THEN o AppointmentService SHALL rejeitar com erro 409 "Horário indisponível"
3. WHEN um proprietário atualiza um agendamento THEN o AppointmentService SHALL persistir as alterações verificando conflitos de horário
4. WHEN um proprietário cancela um agendamento THEN o AppointmentService SHALL atualizar o status para CANCELADO
5. WHEN um proprietário lista agendamentos por período THEN o AppointmentService SHALL retornar apenas agendamentos do tenant do proprietário dentro do intervalo especificado
6. THE AppointmentService SHALL suportar os status: AGENDADO, CONFIRMADO, EM_ANDAMENTO, CONCLUIDO, CANCELADO

### Requisito 13: Agendamento Público

**User Story:** Como visitante, quero agendar um serviço pela página pública do estabelecimento, para que eu possa marcar um atendimento sem precisar ligar ou ir ao local.

#### Critérios de Aceitação

1. WHEN um visitante submete um agendamento público (nome, celular, service_id, data_hora) via slug THEN o AppointmentService SHALL resolver o tenant pelo slug e criar o agendamento com status AGENDADO
2. WHEN um visitante tenta agendar em horário que conflita com outro agendamento ativo THEN o AppointmentService SHALL rejeitar com erro "Horário indisponível"
3. WHEN um visitante tenta agendar um serviço inativo THEN o AppointmentService SHALL rejeitar com erro "Serviço não disponível"
4. WHEN um visitante tenta agendar com data_hora no passado THEN o AppointmentService SHALL rejeitar com erro de validação
5. WHEN um agendamento público é criado THEN o AppointmentService SHALL armazenar nome_visitante e celular_visitante com client_id NULL
6. THE AppointmentService SHALL utilizar a localização primária do tenant para agendamentos públicos

### Requisito 14: Listagem de Horários Disponíveis

**User Story:** Como visitante, quero ver os horários disponíveis para um serviço em uma data específica, para que eu possa escolher o melhor horário para mim.

#### Critérios de Aceitação

1. WHEN um visitante consulta horários disponíveis para um serviço em uma data THEN o AppointmentService SHALL retornar slots de tempo livres entre 08:00 e 18:00, respeitando a duração do serviço
2. WHEN existem agendamentos ativos em determinados horários THEN o AppointmentService SHALL excluir esses horários da lista de slots disponíveis
3. WHEN um visitante consulta horários para uma data passada THEN o AppointmentService SHALL rejeitar com erro de validação
4. WHEN um visitante consulta horários para um serviço inativo THEN o AppointmentService SHALL retornar erro "Serviço não disponível"
5. THE AppointmentService SHALL retornar os slots ordenados cronologicamente

### Requisito 15: Página Pública do Estabelecimento

**User Story:** Como visitante, quero acessar a página pública de um estabelecimento, para que eu possa ver os serviços oferecidos e entrar em contato.

#### Critérios de Aceitação

1. WHEN um visitante acessa a página pública via slug THEN o PublicPageService SHALL retornar o perfil público do estabelecimento (nome, logo, descrição)
2. WHEN um visitante lista serviços públicos via slug THEN o PublicPageService SHALL retornar apenas serviços ativos do estabelecimento
3. WHEN um visitante solicita o link do WhatsApp via slug THEN o PublicPageService SHALL retornar o link wa.me com o celular do proprietário
4. WHEN um visitante acessa um slug inexistente THEN o PublicPageService SHALL retornar erro 404 "Estabelecimento não encontrado"

### Requisito 16: Upload de Imagens

**User Story:** Como proprietário, quero fazer upload de imagens (logo, fotos de serviços), para que meu estabelecimento tenha uma apresentação visual adequada.

#### Critérios de Aceitação

1. WHEN um proprietário faz upload de uma imagem JPEG com até 5MB THEN o Sistema SHALL armazenar a imagem no Cloud Storage e retornar a URL
2. WHEN um proprietário tenta fazer upload de um arquivo que não é JPEG THEN o Sistema SHALL rejeitar com erro 400 "Formato inválido"
3. WHEN um proprietário tenta fazer upload de um arquivo maior que 5MB THEN o Sistema SHALL rejeitar com erro 400 "Arquivo excede tamanho máximo de 5MB"
4. THE Sistema SHALL validar tipo MIME e tamanho no backend, independente de validações do frontend

### Requisito 17: Validação de Dados

**User Story:** Como proprietário, quero que o sistema valide os dados que eu insiro, para que informações incorretas não sejam armazenadas.

#### Critérios de Aceitação

1. THE Sistema SHALL validar que emails seguem formato válido de email
2. THE Sistema SHALL validar que celulares seguem o formato brasileiro (+55...)
3. THE Sistema SHALL validar que campos obrigatórios (nome de cliente, nome de empresa, descrição de conta) estejam preenchidos
4. THE Sistema SHALL validar que valores monetários (custo, valor_venda, valor de conta) possuam precisão de até 2 casas decimais
5. THE Sistema SHALL validar que quantidades de estoque sejam inteiros positivos

### Requisito 18: Segurança

**User Story:** Como proprietário, quero que o sistema proteja meus dados e os dados dos meus clientes, para que informações sensíveis estejam seguras.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar exclusivamente queries parametrizadas para prevenir SQL injection
2. THE Sistema SHALL configurar CORS para aceitar apenas origens autorizadas
3. THE Sistema SHALL aplicar rate limiting nos endpoints públicos (login, registro, agendamento)
4. THE Sistema SHALL exigir HTTPS em ambiente de produção
5. THE Sistema SHALL utilizar chave secreta rotacionada para assinatura de JWT

### Requisito 19: Performance e Paginação

**User Story:** Como proprietário, quero que o sistema responda de forma eficiente, para que eu possa gerenciar meu negócio sem atrasos.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar paginação cursor-based em todas as listagens
2. THE Sistema SHALL manter índices de banco de dados em tenant_id, slug, email, placa e data_hora
3. THE Sistema SHALL filtrar todas as queries por tenant_id como critério primário
4. THE Sistema SHALL servir imagens diretamente do Cloud Storage, sem passar pelo backend
5. WHERE cache estiver habilitado, o Sistema SHALL cachear dados públicos (perfil, serviços) com TTL de 5 minutos
