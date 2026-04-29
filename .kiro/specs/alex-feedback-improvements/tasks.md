# Plano de Implementação: Melhorias de Feedback do Alex

## Visão Geral

Implementação incremental das 9 melhorias solicitadas pelo Alex, ordenadas por dependência: alterações de schema primeiro, depois rotas, migração de dados, testes e limpeza final. Todas as mudanças seguem os padrões estruturais do design — sem workarounds. Todos os testes usam dados sintéticos via factories.

## Tarefas

- [x] 1. Alterações no schema Prisma e migração de banco de dados
  - [x] 1.1 Atualizar o schema Prisma com novos models e campos
    - Criar model `AppointmentService` com campos: id, appointment_id, service_id, created_at, unique constraint [appointment_id, service_id], índices e `@@map("appointment_services")`
    - Criar model `VehicleOwnershipHistory` com campos: id, vehicle_id, client_id, started_at, ended_at (nullable), created_at, índices e `@@map("vehicle_ownership_history")`
    - Adicionar campo `vehicle_id` (String?, FK → Vehicle) ao model Appointment
    - Adicionar campo `quilometragem` (Int?) ao model Appointment
    - Tornar campo `service_id` nullable no model Appointment (era obrigatório)
    - Adicionar campo `quilometragem` (Int?) ao model Vehicle
    - Adicionar campo `cor` (String?) ao model Vehicle
    - Adicionar relações: `appointmentServices` em Appointment, `vehicle` em Appointment, `appointmentServices` em Service, `ownershipHistory` em Vehicle, `appointments` em Vehicle, `ownershipHistory` em Client
    - _Requisitos: 2.1, 5.1, 6.1, 7.1, 8.1, 9.1_

  - [x] 1.2 Gerar e aplicar a migração Prisma
    - Executar `npx prisma migrate dev --name alex_feedback_improvements` para gerar o SQL de migração
    - Verificar que o SQL gerado corresponde ao design (novas tabelas, novos campos, FK constraints, índices)
    - Regenerar o Prisma Client
    - _Requisitos: 2.1, 5.1, 6.1, 7.1, 8.1, 9.1_

- [x] 2. Atualizar schemas Zod de validação
  - [x] 2.1 Atualizar schemas de Appointment (`packages/backend/src/schemas/appointment.ts`)
    - Adicionar `service_ids: z.array(z.string().uuid()).min(1).optional()` ao createAppointmentSchema e updateAppointmentSchema
    - Adicionar `vehicle_id: z.string().uuid().nullable().optional()` a ambos os schemas
    - Adicionar `quilometragem: z.number().int().min(0).nullable().optional()` a ambos os schemas
    - _Requisitos: 2.2, 2.3, 6.1, 7.1, 8.1, 8.5_

  - [x] 2.2 Atualizar schemas de Vehicle (`packages/backend/src/schemas/vehicle.ts`)
    - Adicionar `quilometragem: z.number().int().min(0).nullable().optional()` ao createVehicleSchema e updateVehicleSchema
    - Adicionar `cor: z.string().min(1).nullable().optional()` ao createVehicleSchema e updateVehicleSchema
    - Adicionar `client_id: z.string().uuid().optional()` ao createVehicleSchema (para POST /vehicles top-level)
    - _Requisitos: 7.1, 7.3, 9.1, 9.3, 4.5_

  - [x] 2.3 Criar schema de transferência de veículo (`packages/backend/src/schemas/vehicleTransfer.ts`)
    - Criar `vehicleTransferSchema` com `client_id: z.string().uuid('client_id inválido')`
    - _Requisitos: 5.2_

- [x] 3. Criar função utilitária de filtro de data padrão
  - [x] 3.1 Criar `getDefaultDateRange` em `packages/backend/src/lib/dateFilter.ts`
    - Implementar função que retorna `{ start: Date, end: Date }` com intervalo de ±30 dias a partir da data atual
    - `start` = data atual - 30 dias, início do dia (00:00:00.000)
    - `end` = data atual + 30 dias, fim do dia (23:59:59.999)
    - Exportar a função para uso nos routers
    - _Requisitos: 1.1, 1.2_

  - [ ]* 3.2 Escrever teste de propriedade para filtro de data padrão
    - **Property 1: Filtro de data padrão produz intervalo correto de ±30 dias**
    - **Valida: Requisitos 1.1, 1.2**
    - Usar fast-check para gerar datas aleatórias como "agora", verificar que o intervalo calculado tem exatamente 30 dias antes e 30 dias depois

  - [ ]* 3.3 Escrever teste de propriedade para filtros explícitos
    - **Property 2: Filtros explícitos retornam apenas registros dentro do intervalo fornecido**
    - **Valida: Requisitos 1.3, 1.4**
    - Usar fast-check para gerar intervalos [start, end] e conjuntos de datas, verificar que apenas registros dentro do intervalo são retornados

- [x] 4. Atualizar router de Agendamentos (`packages/backend/src/routes/appointments.ts`)
  - [x] 4.1 Atualizar GET /appointments com filtro de data padrão e includes
    - Importar `getDefaultDateRange` de `../lib/dateFilter`
    - Quando `start` e `end` não forem fornecidos, aplicar filtro padrão de ±30 dias em `data_hora`
    - Quando `start` e/ou `end` forem fornecidos, usar os valores explícitos
    - Adicionar include de `appointmentServices` com dados do serviço na resposta
    - Adicionar include de `vehicle` na resposta
    - Incluir campo `quilometragem` na resposta
    - _Requisitos: 1.1, 1.3, 2.5, 6.3, 8.4_

  - [x] 4.2 Atualizar POST /appointments para suportar múltiplos serviços e veículo
    - Aceitar `service_ids` (array) como alternativa ao legado `service_id`
    - Quando `service_ids` presente: criar registros `AppointmentService` em transação (prisma.$transaction)
    - Validar que todos os service_ids pertencem ao mesmo tenant
    - Aceitar `vehicle_id` opcional e validar que pertence ao mesmo tenant
    - Aceitar `quilometragem` opcional e validar que requer `vehicle_id` (retornar 400 se quilometragem sem vehicle_id)
    - Manter compatibilidade com `service_id` legado (quando `service_ids` não fornecido, usar `service_id`)
    - Retornar appointment com serviços vinculados na resposta
    - _Requisitos: 2.2, 2.3, 2.6, 2.7, 6.2, 6.5, 8.2, 8.5_

  - [x] 4.3 Atualizar PUT /appointments para suportar múltiplos serviços e veículo
    - Aceitar `service_ids` para substituir serviços vinculados (delete + create em transação)
    - Aceitar `vehicle_id` e `quilometragem` com mesmas validações do POST
    - _Requisitos: 2.4, 6.4, 8.2_

  - [x] 4.4 Atualizar PATCH /appointments/:id/status para atualizar quilometragem ao concluir
    - Quando status muda para `CONCLUIDO` e o agendamento tem `vehicle_id` + `quilometragem`:
      - Buscar quilometragem atual do veículo
      - Se quilometragem do agendamento > quilometragem do veículo, atualizar veículo
    - Usar transação para garantir atomicidade
    - _Requisitos: 8.3_

- [x] 5. Atualizar router de Contas (`packages/backend/src/routes/bills.ts`)
  - [x] 5.1 Atualizar GET /bills com filtro de data padrão
    - Importar `getDefaultDateRange` de `../lib/dateFilter`
    - Quando `start` e `end` não forem fornecidos, aplicar filtro padrão de ±30 dias em `data_vencimento`
    - Quando `start` e/ou `end` forem fornecidos, usar os valores explícitos (comportamento atual mantido)
    - _Requisitos: 1.2, 1.4_

- [x] 6. Checkpoint — Verificar compilação e testes existentes
  - Executar `npx tsc --noEmit` para verificar que não há erros de tipo
  - Executar testes existentes para garantir que nada quebrou
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar novos endpoints de Veículos (`packages/backend/src/routes/vehicles.ts`)
  - [x] 7.1 Implementar GET /vehicles (listagem top-level com paginação cursor)
    - Adicionar rota `GET /vehicles` com paginação baseada em cursor (mesmo padrão de clients.ts)
    - Incluir dados do cliente proprietário via include
    - Incluir campos `quilometragem` e `cor` na resposta
    - Suportar parâmetro `search` para busca por placa, marca ou modelo (case-insensitive, parcial) usando `OR` + `contains` + `mode: 'insensitive'`
    - _Requisitos: 4.1, 4.6, 7.4, 9.4_

  - [x] 7.2 Implementar GET /vehicles/:vehicleId (detalhe com histórico)
    - Retornar veículo com dados do cliente proprietário
    - Incluir histórico de proprietários (`ownershipHistory`) ordenado por `started_at desc`
    - Incluir campos `quilometragem` e `cor`
    - Validar que veículo pertence ao tenant
    - _Requisitos: 4.2, 5.4, 7.4, 9.4_

  - [x] 7.3 Implementar POST /vehicles (criação top-level)
    - Aceitar `client_id` no body da requisição
    - Validar que o cliente pertence ao mesmo tenant
    - Aceitar campos `quilometragem` e `cor` opcionais
    - Retornar 404 se cliente não encontrado ou de outro tenant
    - _Requisitos: 4.4, 4.5, 7.2, 9.2_

  - [x] 7.4 Implementar PATCH /vehicles/:vehicleId/transfer (transferência de propriedade)
    - Validar schema com `vehicleTransferSchema`
    - Buscar veículo e validar tenant
    - Buscar novo cliente e validar tenant (404 se não encontrado)
    - Validar que novo client_id ≠ client_id atual (400 se igual)
    - Em transação: encerrar propriedade anterior (set ended_at), criar novo registro de histórico, atualizar client_id do veículo
    - _Requisitos: 5.2, 5.3, 5.5, 5.6_

  - [x] 7.5 Atualizar PUT /vehicles/:vehicleId para incluir novos campos
    - Aceitar `quilometragem` e `cor` no update
    - _Requisitos: 7.3, 9.3_

  - [x] 7.6 Atualizar POST /clients/:clientId/vehicles para incluir novos campos
    - Aceitar `quilometragem` e `cor` na criação via endpoint aninhado
    - Manter comportamento existente inalterado
    - _Requisitos: 4.3, 7.2, 9.2_

  - [x] 7.7 Registrar novos endpoints no index.ts
    - Garantir que as novas rotas GET /vehicles, GET /vehicles/:vehicleId, POST /vehicles e PATCH /vehicles/:vehicleId/transfer estão acessíveis
    - Verificar que não há conflito de rotas com os endpoints existentes de vehicles
    - _Requisitos: 4.1, 4.2, 4.5, 5.2_

- [x] 8. Atualizar factories e helpers de teste
  - [x] 8.1 Atualizar `createAppointment` em factories.ts
    - Adicionar parâmetros opcionais: `vehicleId`, `quilometragem`
    - Tornar `serviceId` opcional (nullable) para suportar novo schema
    - Adicionar factory `createAppointmentService` para criar registros na tabela de junção
    - Todos os dados devem ser sintéticos — NUNCA usar dados reais
    - _Requisitos: 2.1, 6.1, 8.1_

  - [x] 8.2 Atualizar `createVehicle` em factories.ts
    - Adicionar parâmetros opcionais: `quilometragem`, `cor`
    - Adicionar factory `createVehicleOwnershipHistory` para criar registros de histórico
    - Todos os dados devem ser sintéticos — NUNCA usar dados reais
    - _Requisitos: 5.1, 7.1, 9.1_

  - [x] 8.3 Atualizar `cleanDatabase` em setup.ts
    - Adicionar tabelas `appointment_services` e `vehicle_ownership_history` na ordem correta de deleção (antes de appointments e vehicles)
    - _Requisitos: 2.1, 5.1_

- [x] 9. Checkpoint — Verificar compilação e testes existentes
  - Executar `npx tsc --noEmit` para verificar que não há erros de tipo
  - Executar testes existentes para garantir que nada quebrou com as mudanças de factory/setup
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Escrever testes unitários para novos endpoints e funcionalidades
  - [x] 10.1 Escrever testes para filtro de data padrão em agendamentos
    - Testar GET /appointments sem parâmetros aplica filtro padrão ±30 dias
    - Testar GET /appointments com start e end explícitos usa valores fornecidos
    - Testar GET /appointments com apenas start ou apenas end
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 1.1, 1.3_

  - [x] 10.2 Escrever testes para filtro de data padrão em contas
    - Testar GET /bills sem parâmetros aplica filtro padrão ±30 dias
    - Testar GET /bills com start e end explícitos usa valores fornecidos
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 1.2, 1.4_

  - [x] 10.3 Escrever testes para múltiplos serviços por agendamento
    - Testar POST /appointments com service_ids (1 serviço, 3 serviços)
    - Testar PUT /appointments com service_ids substitui serviços existentes
    - Testar que service_ids vazio é rejeitado
    - Testar compatibilidade com service_id legado
    - Testar que GET /appointments inclui serviços vinculados
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 10.4 Escrever testes para endpoints top-level de veículos
    - Testar GET /vehicles com paginação cursor
    - Testar GET /vehicles com search por placa, marca, modelo
    - Testar GET /vehicles/:vehicleId com dados do cliente e histórico
    - Testar POST /vehicles com client_id válido
    - Testar POST /vehicles com client_id de outro tenant (404)
    - Testar que endpoints aninhados existentes continuam funcionando
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 10.5 Escrever testes para transferência de propriedade (`packages/backend/src/__tests__/vehicle-transfer.test.ts`)
    - Testar PATCH /vehicles/:vehicleId/transfer com transferência válida
    - Testar que histórico é criado corretamente (ended_at no anterior, started_at no novo)
    - Testar transferência para mesmo cliente retorna 400
    - Testar transferência para cliente de outro tenant retorna 404
    - Testar múltiplas transferências sequenciais e verificar histórico completo
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 10.6 Escrever testes para vínculo veículo-agendamento e quilometragem
    - Testar POST /appointments com vehicle_id válido
    - Testar POST /appointments com vehicle_id de outro tenant (400)
    - Testar POST /appointments com quilometragem sem vehicle_id (400)
    - Testar PATCH /appointments/:id/status para CONCLUIDO atualiza quilometragem do veículo (quando maior)
    - Testar PATCH /appointments/:id/status para CONCLUIDO NÃO atualiza quilometragem (quando menor ou igual)
    - Testar que GET /appointments inclui dados do veículo e quilometragem
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 6.2, 6.3, 6.5, 8.2, 8.3, 8.4, 8.5_

  - [x] 10.7 Escrever testes para campos cor e quilometragem em veículos
    - Testar criação de veículo com quilometragem e cor
    - Testar atualização de quilometragem (valor válido, valor negativo rejeitado)
    - Testar atualização de cor (string válida, string vazia rejeitada, null aceito)
    - Testar que GET /vehicles inclui quilometragem e cor
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 7.2, 7.3, 7.4, 9.2, 9.3, 9.4_

- [x] 11. Checkpoint — Verificar que todos os testes unitários passam
  - Executar suite completa de testes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implementar script de migração de notas (`packages/backend/scripts/migrate-notes-services.ts`)
  - [x] 12.1 Criar script de migração idempotente
    - Percorrer todos os tenants
    - Para cada tenant, buscar serviços cadastrados e criar Map de nome_lower → service_id
    - Para cada agendamento com `notas` preenchido:
      - Se tem `service_id` legado e NÃO tem AppointmentService para esse serviço, criar registro
      - Comparar texto das notas com nomes de serviços (case-insensitive)
      - Criar AppointmentService para correspondências encontradas (evitar duplicatas via upsert ou check)
      - Remover texto correspondente das notas, limpar separadores órfãos
    - O script DEVE ser idempotente: executar múltiplas vezes produz o mesmo resultado
    - Registrar em log estatísticas detalhadas: total de tenants, agendamentos processados, correspondências encontradas, registros criados, registros já existentes (skip)
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 12.2 Escrever testes para o script de migração (`packages/backend/src/__tests__/migration-notes.test.ts`)
    - Testar migração com notas contendo 1 serviço
    - Testar migração com notas contendo múltiplos serviços
    - Testar migração com notas sem correspondência (notas inalteradas)
    - Testar correspondência case-insensitive
    - Testar idempotência: executar 2x produz mesmo resultado
    - Testar que service_id legado é migrado para AppointmentService
    - Testar logging de estatísticas
    - Usar dados sintéticos via factories — NUNCA dados reais
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 13. Escrever testes de propriedade (PBT)
  - [ ]* 13.1 Escrever teste de propriedade para contagem de serviços vinculados
    - **Property 3: Invariante de contagem de serviços vinculados ao agendamento**
    - **Valida: Requisitos 2.2, 2.4, 2.5**
    - Gerar arrays de UUIDs de tamanho 1-10, criar agendamento com service_ids, verificar que exatamente N registros AppointmentService existem

  - [ ]* 13.2 Escrever teste de propriedade para correspondência de notas
    - **Property 4: Correspondência de serviços nas notas é case-insensitive e remove texto correspondente**
    - **Valida: Requisitos 3.2, 3.4, 3.6**
    - Gerar textos com nomes de serviços em cases variados, verificar remoção e correspondência

  - [ ]* 13.3 Escrever teste de propriedade para paginação cursor de veículos
    - **Property 5: Paginação cursor de veículos retorna todos os itens sem duplicatas**
    - **Valida: Requisitos 4.1**
    - Gerar conjuntos de 0-20 veículos, paginar com tamanhos variados, verificar completude sem duplicatas

  - [ ]* 13.4 Escrever teste de propriedade para busca de veículos
    - **Property 6: Busca de veículos retorna apenas resultados correspondentes**
    - **Valida: Requisitos 4.6**
    - Gerar termos de busca e veículos com dados variados, verificar que todos os resultados contêm o termo

  - [ ]* 13.5 Escrever teste de propriedade para isolamento de tenant
    - **Property 7: Isolamento de tenant em referências cruzadas**
    - **Valida: Requisitos 4.4, 6.2, 6.4, 6.5**
    - Gerar operações com IDs de tenants diferentes, verificar rejeição

  - [ ]* 13.6 Escrever teste de propriedade para transferência de propriedade
    - **Property 8: Transferência de propriedade atualiza veículo e registra histórico**
    - **Valida: Requisitos 5.2, 5.3**
    - Gerar sequências de transferências, verificar histórico e estado final do veículo

  - [ ]* 13.7 Escrever teste de propriedade para validação de campos de veículo
    - **Property 9: Validação de campos de veículo (quilometragem e cor)**
    - **Valida: Requisitos 7.3, 9.3**
    - Gerar valores inteiros (positivos, negativos, zero) e strings (vazias, não-vazias, null), verificar aceitação/rejeição

  - [ ]* 13.8 Escrever teste de propriedade para atualização de quilometragem ao concluir
    - **Property 10: Atualização de quilometragem ao concluir agendamento preserva o máximo**
    - **Valida: Requisitos 8.3**
    - Gerar pares (Q, V) de quilometragens, verificar que resultado é max(Q, V)

- [x] 14. Checkpoint final — Verificar que todos os testes passam
  - Executar suite completa de testes (unitários + propriedade)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Limpeza e verificação de produção
  - [x] 15.1 Remover código morto e imports não utilizados
    - Verificar todos os arquivos modificados por imports não utilizados
    - Remover serviços, funções ou tipos que foram substituídos e não são mais referenciados
    - Verificar que não há serviços duplicados ou código redundante
    - _Requisitos: Instrução do usuário — limpeza obrigatória_

  - [x] 15.2 Verificar que não há scaffolding temporário de teste persistindo
    - Revisar arquivos de teste para garantir que não há mocks globais ou configurações temporárias que não deveriam persistir
    - Verificar que factories e helpers estão limpos e consistentes
    - _Requisitos: Instrução do usuário — limpeza obrigatória_

  - [x] 15.3 Verificar integridade do repositório
    - Executar `npx tsc --noEmit` para confirmar zero erros de tipo
    - Executar linter (`npx eslint packages/backend/src`) para confirmar zero warnings/errors
    - Executar suite completa de testes uma última vez
    - Verificar que o schema Prisma está sincronizado (`npx prisma validate`)
    - Confirmar que o repositório está limpo e pronto para produção
    - _Requisitos: Instrução do usuário — verificação final obrigatória_

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e edge cases
- **TODOS os testes usam dados sintéticos via factories — NUNCA dados reais de produção**
- **O script de migração de notas DEVE ser idempotente e logar estatísticas detalhadas**
- **Nenhum workaround ("puxadinho") — todas as mudanças seguem os padrões estruturais do design**
