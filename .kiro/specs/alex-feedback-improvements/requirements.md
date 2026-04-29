# Documento de Requisitos — Melhorias de Feedback do Alex

## Introdução

Este documento especifica as melhorias solicitadas pelo usuário Alex para a plataforma de gestão de oficina mecânica. As melhorias abrangem seis áreas: filtros de data padrão, múltiplos serviços por agendamento (com migração de dados), veículos como seção independente, quilometragem em veículos, quilometragem em agendamentos e campo de cor em veículos. Itens de roadmap futuro (portal do cliente, lembretes de manutenção, checklist de entrada/saída, avaliação pós-serviço, relatório PDF do veículo) estão fora do escopo.

## Glossário

- **Sistema**: A aplicação backend Express + TypeScript + Prisma que gerencia a oficina
- **Agendamento**: Registro de um serviço agendado para um cliente/visitante (model `Appointment`)
- **Serviço**: Tipo de serviço oferecido pela oficina (model `Service`)
- **Veículo**: Veículo cadastrado no sistema, vinculado a um cliente (model `Vehicle`)
- **Cliente**: Pessoa física cadastrada como cliente da oficina (model `Client`)
- **Conta**: Conta a pagar registrada no sistema (model `Bill`)
- **Tenant**: Estabelecimento/oficina isolado no sistema multi-tenant
- **AppointmentService**: Tabela de junção many-to-many entre Agendamento e Serviço
- **Filtro_de_Data**: Parâmetros de query `start` e `end` usados para filtrar registros por período
- **Quilometragem**: Valor numérico inteiro representando a quilometragem do veículo em km
- **Notas**: Campo de texto livre no Agendamento usado para observações adicionais
- **Transferência_de_Propriedade**: Operação de alterar o client_id de um Veículo, mantendo histórico

---

## Requisitos

### Requisito 1: Filtros de Data Padrão

**User Story:** Como usuário da oficina, eu quero que as listagens com filtro de data tenham um período padrão de 30 dias passados + 30 dias futuros, para que eu veja dados relevantes sem precisar configurar filtros manualmente.

#### Critérios de Aceitação

1. WHEN o endpoint GET /appointments é chamado sem os parâmetros `start` e `end`, THE Sistema SHALL aplicar um filtro padrão de data_hora >= (data atual - 30 dias) AND data_hora <= (data atual + 30 dias).
2. WHEN o endpoint GET /bills é chamado sem os parâmetros `start` e `end`, THE Sistema SHALL aplicar um filtro padrão de data_vencimento >= (data atual - 30 dias) AND data_vencimento <= (data atual + 30 dias).
3. WHEN o endpoint GET /appointments é chamado com os parâmetros `start` e/ou `end` explícitos, THE Sistema SHALL usar os valores fornecidos em vez dos valores padrão.
4. WHEN o endpoint GET /bills é chamado com os parâmetros `start` e/ou `end` explícitos, THE Sistema SHALL usar os valores fornecidos em vez dos valores padrão.

---

### Requisito 2: Múltiplos Serviços por Agendamento

**User Story:** Como usuário da oficina, eu quero vincular múltiplos serviços a um único agendamento, para que eu possa registrar todos os serviços realizados em uma mesma visita.

#### Critérios de Aceitação

1. THE Sistema SHALL manter uma tabela AppointmentService com os campos: id, appointment_id (FK para Appointment), service_id (FK para Service) e created_at.
2. WHEN um Agendamento é criado com um array `service_ids`, THE Sistema SHALL criar registros AppointmentService para cada serviço informado.
3. WHEN um Agendamento é criado, THE Sistema SHALL exigir pelo menos um service_id no array `service_ids`.
4. WHEN um Agendamento é atualizado com um novo array `service_ids`, THE Sistema SHALL substituir todos os registros AppointmentService existentes pelos novos serviços informados.
5. WHEN o endpoint GET /appointments é chamado, THE Sistema SHALL incluir a lista de serviços vinculados via AppointmentService na resposta de cada agendamento.
6. THE Sistema SHALL manter o campo `service_id` existente no model Appointment durante o período de migração, marcando-o como opcional (nullable).
7. WHEN um Agendamento é criado sem o campo legado `service_id` mas com `service_ids`, THE Sistema SHALL usar apenas a tabela AppointmentService para registrar os serviços.

---

### Requisito 3: Migração de Serviços das Notas

**User Story:** Como usuário da oficina, eu quero que os serviços adicionais que foram registrados no campo de notas sejam migrados automaticamente para a nova estrutura de múltiplos serviços, para que o histórico fique correto.

#### Critérios de Aceitação

1. WHEN o script de migração é executado, THE Sistema SHALL percorrer todos os Agendamentos que possuem o campo `notas` preenchido, dentro de cada Tenant.
2. WHEN o script de migração processa um Agendamento, THE Sistema SHALL comparar o texto do campo `notas` com os nomes dos Serviços cadastrados no mesmo Tenant, usando correspondência case-insensitive.
3. WHEN o script de migração encontra correspondência entre texto nas notas e um nome de Serviço, THE Sistema SHALL criar um registro AppointmentService vinculando o Agendamento ao Serviço encontrado.
4. WHEN o script de migração encontra correspondência, THE Sistema SHALL remover o texto correspondente do campo `notas`, preservando o restante do conteúdo.
5. WHEN o script de migração processa um Agendamento que já possui `service_id`, THE Sistema SHALL criar um registro AppointmentService para o serviço do campo `service_id` antes de processar as notas.
6. IF o script de migração não encontrar correspondência em um Agendamento, THEN THE Sistema SHALL manter o campo `notas` inalterado para esse Agendamento.
7. THE Sistema SHALL registrar em log a quantidade de Agendamentos processados, correspondências encontradas e registros AppointmentService criados ao final da migração.

---

### Requisito 4: Veículos como Seção Independente

**User Story:** Como usuário da oficina, eu quero acessar veículos como uma seção independente (não apenas aninhada em clientes), para que eu possa buscar e gerenciar veículos diretamente.

#### Critérios de Aceitação

1. THE Sistema SHALL expor o endpoint GET /vehicles que retorna todos os veículos do Tenant com paginação baseada em cursor.
2. THE Sistema SHALL expor o endpoint GET /vehicles/:vehicleId que retorna um veículo específico do Tenant, incluindo os dados do cliente proprietário.
3. THE Sistema SHALL manter os endpoints existentes GET /clients/:clientId/vehicles e POST /clients/:clientId/vehicles funcionando sem alteração.
4. WHEN um Veículo é criado, THE Sistema SHALL exigir um client_id válido pertencente ao mesmo Tenant.
5. THE Sistema SHALL expor o endpoint POST /vehicles que cria um veículo com client_id informado no body.
6. WHEN o endpoint GET /vehicles é chamado com o parâmetro de query `search`, THE Sistema SHALL filtrar veículos por placa, marca ou modelo usando correspondência parcial case-insensitive.

---

### Requisito 5: Transferência de Propriedade de Veículo

**User Story:** Como usuário da oficina, eu quero transferir a propriedade de um veículo para outro cliente, mantendo o histórico de proprietários anteriores, para que eu possa rastrear o histórico completo do veículo.

#### Critérios de Aceitação

1. THE Sistema SHALL manter uma tabela VehicleOwnershipHistory com os campos: id, vehicle_id (FK para Vehicle), client_id (FK para Client), started_at (DateTime) e ended_at (DateTime nullable).
2. WHEN o endpoint PATCH /vehicles/:vehicleId/transfer é chamado com um novo client_id, THE Sistema SHALL atualizar o client_id do Veículo para o novo cliente.
3. WHEN uma transferência de propriedade é realizada, THE Sistema SHALL registrar o encerramento da propriedade anterior (preenchendo ended_at) e criar um novo registro de propriedade com started_at igual à data atual.
4. WHEN o endpoint GET /vehicles/:vehicleId é chamado, THE Sistema SHALL incluir o histórico de proprietários na resposta.
5. IF o novo client_id informado na transferência não pertencer ao mesmo Tenant, THEN THE Sistema SHALL retornar erro 404 com mensagem "Cliente não encontrado".
6. IF o novo client_id for igual ao client_id atual do Veículo, THEN THE Sistema SHALL retornar erro 400 com mensagem "Veículo já pertence a este cliente".

---

### Requisito 6: Vínculo de Veículo ao Agendamento

**User Story:** Como usuário da oficina, eu quero vincular um veículo a cada agendamento, para que eu possa rastrear quais serviços foram realizados em cada veículo.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar o campo `vehicle_id` (FK para Vehicle, opcional/nullable) ao model Appointment.
2. WHEN um Agendamento é criado com `vehicle_id`, THE Sistema SHALL validar que o Veículo pertence ao mesmo Tenant.
3. WHEN o endpoint GET /appointments é chamado, THE Sistema SHALL incluir os dados do veículo vinculado na resposta de cada agendamento.
4. WHEN um Agendamento é atualizado com um novo `vehicle_id`, THE Sistema SHALL validar que o Veículo pertence ao mesmo Tenant.
5. IF o `vehicle_id` informado não pertencer ao mesmo Tenant, THEN THE Sistema SHALL retornar erro 400 com mensagem "Veículo não encontrado neste estabelecimento".

---

### Requisito 7: Quilometragem no Veículo

**User Story:** Como usuário da oficina, eu quero registrar a quilometragem atual de cada veículo, para que eu possa acompanhar o uso do veículo ao longo do tempo.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar o campo `quilometragem` (inteiro, opcional/nullable) ao model Vehicle.
2. WHEN um Veículo é criado com o campo `quilometragem`, THE Sistema SHALL armazenar o valor informado.
3. WHEN um Veículo é atualizado com o campo `quilometragem`, THE Sistema SHALL validar que o valor é um inteiro não-negativo.
4. WHEN o endpoint GET /vehicles ou GET /vehicles/:vehicleId é chamado, THE Sistema SHALL incluir o campo `quilometragem` na resposta.

---

### Requisito 8: Quilometragem no Agendamento

**User Story:** Como usuário da oficina, eu quero registrar a quilometragem do veículo no momento de cada agendamento, para que eu tenha um histórico de quilometragem por serviço realizado.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar o campo `quilometragem` (inteiro, opcional/nullable) ao model Appointment.
2. WHEN um Agendamento é criado com `quilometragem`, THE Sistema SHALL armazenar o valor informado.
3. WHEN um Agendamento com `vehicle_id` e `quilometragem` é concluído (status alterado para CONCLUIDO), THE Sistema SHALL atualizar o campo `quilometragem` do Veículo vinculado com o valor registrado no Agendamento, caso o valor do Agendamento seja maior que o valor atual do Veículo.
4. WHEN o endpoint GET /appointments é chamado, THE Sistema SHALL incluir o campo `quilometragem` na resposta de cada agendamento.
5. IF um Agendamento é criado com `quilometragem` mas sem `vehicle_id`, THEN THE Sistema SHALL retornar erro 400 com mensagem "quilometragem requer vehicle_id".

---

### Requisito 9: Campo de Cor no Veículo

**User Story:** Como usuário da oficina, eu quero registrar a cor de cada veículo, para facilitar a identificação visual do veículo.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar o campo `cor` (string, opcional/nullable) ao model Vehicle.
2. WHEN um Veículo é criado com o campo `cor`, THE Sistema SHALL armazenar o valor informado.
3. WHEN um Veículo é atualizado com o campo `cor`, THE Sistema SHALL aceitar qualquer string não-vazia ou null.
4. WHEN o endpoint GET /vehicles ou GET /vehicles/:vehicleId é chamado, THE Sistema SHALL incluir o campo `cor` na resposta.
