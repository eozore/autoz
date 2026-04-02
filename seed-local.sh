#!/bin/bash
# Seed script for LOCAL environment
# Usage: bash seed-local.sh

set -e

API="http://localhost:3000"
EMAIL="victorzore94@gmail.com"
PASS="Zore@zgarage94"

echo "=== Seed LOCAL ==="
echo "API: $API"

# 1. Login
echo ">> Login..."
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERRO: Falha no login. Resposta: $LOGIN"
  exit 1
fi
echo "   Token obtido."

AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

# Get company info for location_id
echo ">> Buscando empresa..."
COMPANY=$(curl -s -H "$AUTH" "$API/companies/me")
LOCATION_ID=$(echo "$COMPANY" | python3 -c "import sys,json;print(json.load(sys.stdin)['locations'][0]['id'])")
echo "   Location: $LOCATION_ID"

# 2. Create 30 services
echo ">> Criando 30 serviços..."
SERVICES_NAMES=(
  "Troca de Óleo" "Alinhamento" "Balanceamento" "Revisão Completa" "Troca de Pastilhas de Freio"
  "Troca de Filtro de Ar" "Higienização de Ar Condicionado" "Polimento" "Cristalização" "Lavagem Completa"
  "Troca de Correia Dentada" "Diagnóstico Eletrônico" "Troca de Bateria" "Reparo de Suspensão" "Troca de Amortecedores"
  "Funilaria Leve" "Pintura Parcial" "Troca de Pneus" "Cambagem" "Troca de Velas"
  "Limpeza de Bicos Injetores" "Troca de Embreagem" "Reparo de Câmbio" "Troca de Radiador" "Reparo Elétrico"
  "Instalação de Som" "Envelopamento" "Martelinho de Ouro" "Troca de Escapamento" "Revisão de Freios"
)
SERVICES_PRICES=(150 80 70 350 200 60 120 250 300 90 450 100 280 380 400 500 480 320 85 95 180 490 470 350 220 300 450 280 250 160)
SERVICE_IDS=()

for i in $(seq 0 29); do
  NOME="${SERVICES_NAMES[$i]}"
  VALOR="${SERVICES_PRICES[$i]}"
  DUR=$((30 + RANDOM % 91))
  RES=$(curl -s -X POST "$API/services" -H "$AUTH" -H "$CT" \
    -d "{\"nome\":\"$NOME\",\"duracao_minutos\":$DUR,\"valor\":$VALOR}")
  SID=$(echo "$RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  SERVICE_IDS+=("$SID")
  echo "   [$((i+1))/30] $NOME - R$$VALOR (id: $SID)"
done

# 3. Create 30 clients
echo ">> Criando 30 clientes..."
FIRST_NAMES=("João" "Maria" "Pedro" "Ana" "Carlos" "Fernanda" "Lucas" "Juliana" "Rafael" "Camila" "Bruno" "Larissa" "Diego" "Patrícia" "Thiago" "Beatriz" "Gustavo" "Amanda" "Felipe" "Vanessa" "Rodrigo" "Isabela" "Marcelo" "Letícia" "André" "Gabriela" "Eduardo" "Natália" "Vinícius" "Renata")
LAST_NAMES=("Silva" "Santos" "Oliveira" "Souza" "Pereira" "Costa" "Ferreira" "Almeida" "Nascimento" "Lima" "Araújo" "Ribeiro" "Carvalho" "Gomes" "Martins" "Rocha" "Barbosa" "Moreira" "Dias" "Teixeira" "Mendes" "Cardoso" "Correia" "Nunes" "Vieira" "Monteiro" "Pinto" "Lopes" "Freitas" "Ramos")
CLIENT_IDS=()

for i in $(seq 0 29); do
  NOME="${FIRST_NAMES[$i]} ${LAST_NAMES[$i]}"
  DDD=$((11 + RANDOM % 79))
  NUM=$((900000000 + RANDOM % 99999999))
  CELULAR="+55${DDD}${NUM}"
  RES=$(curl -s -X POST "$API/clients" -H "$AUTH" -H "$CT" \
    -d "{\"nome\":\"$NOME\",\"celular\":\"$CELULAR\"}")
  CID=$(echo "$RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  CLIENT_IDS+=("$CID")
  echo "   [$((i+1))/30] $NOME ($CELULAR)"
done

# 4. Create 50 inventory items (25 USO + 25 VENDA)
echo ">> Criando 50 itens de estoque..."
USO_NAMES=("Desengraxante" "Estopa" "Lixa 120" "Lixa 220" "Fita Crepe" "Massa Plástica" "Primer" "Thinner" "Graxa" "Fluido de Freio" "Óleo Lubrificante" "Silicone Spray" "Limpa Contato" "Pano Microfibra" "Detergente Automotivo" "Cera Líquida" "Removedor de Chuva Ácida" "Cola Estrutural" "Selante PU" "Verniz Automotivo" "Tinta Base" "Catalisador" "Endurecedor" "Fita Isolante" "Abraçadeira Nylon")
VENDA_NAMES=("Filtro de Óleo" "Filtro de Ar" "Filtro de Combustível" "Pastilha de Freio Dianteira" "Pastilha de Freio Traseira" "Correia Dentada" "Vela de Ignição" "Bobina de Ignição" "Amortecedor Dianteiro" "Amortecedor Traseiro" "Bateria 60Ah" "Palheta Limpador" "Lâmpada H4" "Lâmpada H7" "Fusível 10A" "Óleo Motor 5W30" "Óleo Motor 10W40" "Fluido Direção Hidráulica" "Aditivo Radiador" "Correia Alternador" "Tensor Correia" "Junta Cabeçote" "Bomba d'Água" "Disco de Freio" "Rolamento Roda")

for i in $(seq 0 24); do
  NOME="${USO_NAMES[$i]}"
  CUSTO=$((5 + RANDOM % 46))
  VENDA=$((CUSTO + 10 + RANDOM % 30))
  QTD=$((5 + RANDOM % 46))
  MIN=$((2 + RANDOM % 8))
  curl -s -X POST "$API/inventory" -H "$AUTH" -H "$CT" \
    -d "{\"nome\":\"$NOME\",\"tipo\":\"USO\",\"custo\":$CUSTO,\"valor_venda\":$VENDA,\"quantidade_inicial\":$QTD,\"quantidade_minima\":$MIN}" > /dev/null
  echo "   [USO $((i+1))/25] $NOME"
done

for i in $(seq 0 24); do
  NOME="${VENDA_NAMES[$i]}"
  CUSTO=$((20 + RANDOM % 181))
  VENDA=$((CUSTO + 30 + RANDOM % 100))
  QTD=$((3 + RANDOM % 23))
  MIN=$((1 + RANDOM % 5))
  curl -s -X POST "$API/inventory" -H "$AUTH" -H "$CT" \
    -d "{\"nome\":\"$NOME\",\"tipo\":\"VENDA\",\"custo\":$CUSTO,\"valor_venda\":$VENDA,\"quantidade_inicial\":$QTD,\"quantidade_minima\":$MIN}" > /dev/null
  echo "   [VENDA $((i+1))/25] $NOME"
done

# 5. Create 30 bills
echo ">> Criando 30 contas..."
BILL_DESCS=("Aluguel" "Energia Elétrica" "Água" "Internet" "Telefone" "Seguro" "IPTU" "Contador" "Material de Limpeza" "Café e Suprimentos" "Manutenção Equipamentos" "Software Gestão" "Publicidade Google" "Publicidade Instagram" "Uniforme Funcionários" "Combustível" "Estacionamento" "Licença Ambiental" "Alvará" "Treinamento" "Frete Peças" "Descarte Resíduos" "Segurança" "Jardinagem" "Pintura Fachada" "Reparo Hidráulico" "Ar Condicionado" "Dedetização" "Consultoria" "Impostos")

TODAY_EPOCH=$(date +%s)

for i in $(seq 0 29); do
  DESC="${BILL_DESCS[$i]}"
  VALOR=$((100 + RANDOM % 1901))

  if [ $i -lt 10 ]; then
    DAYS_AGO=$((1 + RANDOM % 30))
    VENC_EPOCH=$((TODAY_EPOCH - DAYS_AGO * 86400))
    VENC=$(date -r $VENC_EPOCH +%Y-%m-%d 2>/dev/null || date -d "@$VENC_EPOCH" +%Y-%m-%d)
    STATUS="PAGO"
    curl -s -X POST "$API/bills" -H "$AUTH" -H "$CT" \
      -d "{\"descricao\":\"$DESC\",\"valor\":$VALOR,\"data_vencimento\":\"$VENC\",\"status\":\"$STATUS\"}" > /dev/null
  elif [ $i -lt 20 ]; then
    DAYS_AHEAD=$((1 + RANDOM % 60))
    VENC_EPOCH=$((TODAY_EPOCH + DAYS_AHEAD * 86400))
    VENC=$(date -r $VENC_EPOCH +%Y-%m-%d 2>/dev/null || date -d "@$VENC_EPOCH" +%Y-%m-%d)
    STATUS="PENDENTE"
    curl -s -X POST "$API/bills" -H "$AUTH" -H "$CT" \
      -d "{\"descricao\":\"$DESC\",\"valor\":$VALOR,\"data_vencimento\":\"$VENC\",\"status\":\"$STATUS\"}" > /dev/null
  else
    DAYS_AGO=$((1 + RANDOM % 30))
    VENC_EPOCH=$((TODAY_EPOCH - DAYS_AGO * 86400))
    VENC=$(date -r $VENC_EPOCH +%Y-%m-%d 2>/dev/null || date -d "@$VENC_EPOCH" +%Y-%m-%d)
    STATUS="PENDENTE"
    curl -s -X POST "$API/bills" -H "$AUTH" -H "$CT" \
      -d "{\"descricao\":\"$DESC\",\"valor\":$VALOR,\"data_vencimento\":\"$VENC\",\"status\":\"$STATUS\"}" > /dev/null
  fi
  echo "   [$((i+1))/30] $DESC - R$$VALOR ($STATUS)"
done

# 6. Create 30 appointments
echo ">> Criando 30 agendamentos..."
FORMAS=("A_VISTA" "PARCELADO")

for i in $(seq 0 29); do
  SVC_IDX=$((RANDOM % 30))
  SVC_ID="${SERVICE_IDS[$SVC_IDX]}"
  CLI_IDX=$((RANDOM % 30))
  CLI_ID="${CLIENT_IDS[$CLI_IDX]}"
  VALOR="${SERVICES_PRICES[$SVC_IDX]}"
  DESCONTO=$((RANDOM % (VALOR / 5 + 1)))
  FORMA="${FORMAS[$((RANDOM % 2))]}"
  DUR=$((30 + RANDOM % 91))
  HOUR=$((8 + RANDOM % 10))
  MIN=$(( (RANDOM % 4) * 15 ))

  if [ $i -lt 10 ]; then
    DAYS_AGO=$((1 + RANDOM % 30))
    APPT_EPOCH=$((TODAY_EPOCH - DAYS_AGO * 86400))
    APPT_DATE=$(date -r $APPT_EPOCH +%Y-%m-%d 2>/dev/null || date -d "@$APPT_EPOCH" +%Y-%m-%d)
    APPT_DT="${APPT_DATE}T$(printf '%02d' $HOUR):$(printf '%02d' $MIN):00.000Z"
    STATUS_NOTE="CONCLUIDO"
  elif [ $i -lt 15 ]; then
    APPT_DATE=$(date +%Y-%m-%d)
    APPT_DT="${APPT_DATE}T$(printf '%02d' $HOUR):$(printf '%02d' $MIN):00.000Z"
    STATUS_NOTE="AGENDADO (hoje)"
  else
    DAYS_AHEAD=$((1 + RANDOM % 30))
    APPT_EPOCH=$((TODAY_EPOCH + DAYS_AHEAD * 86400))
    APPT_DATE=$(date -r $APPT_EPOCH +%Y-%m-%d 2>/dev/null || date -d "@$APPT_EPOCH" +%Y-%m-%d)
    APPT_DT="${APPT_DATE}T$(printf '%02d' $HOUR):$(printf '%02d' $MIN):00.000Z"
    STATUS_NOTE="AGENDADO (futuro)"
  fi

  RES=$(curl -s -X POST "$API/appointments" -H "$AUTH" -H "$CT" \
    -d "{\"client_id\":\"$CLI_ID\",\"service_id\":\"$SVC_ID\",\"location_id\":\"$LOCATION_ID\",\"data_hora\":\"$APPT_DT\",\"duracao_minutos\":$DUR,\"valor_servico\":$VALOR,\"desconto\":$DESCONTO,\"forma_pagamento\":\"$FORMA\"}")
  AID=$(echo "$RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ $i -lt 10 ] && [ -n "$AID" ]; then
    curl -s -X PATCH "$API/appointments/$AID/status" -H "$AUTH" -H "$CT" -d '{"status":"CONFIRMADO"}' > /dev/null
    curl -s -X PATCH "$API/appointments/$AID/status" -H "$AUTH" -H "$CT" -d '{"status":"EM_ANDAMENTO"}' > /dev/null
    curl -s -X PATCH "$API/appointments/$AID/status" -H "$AUTH" -H "$CT" -d '{"status":"CONCLUIDO"}' > /dev/null
  fi

  echo "   [$((i+1))/30] ${SERVICES_NAMES[$SVC_IDX]} - R$$VALOR ($STATUS_NOTE)"
done

echo ""
echo "=== Seed concluído com sucesso! ==="
echo "  30 serviços, 30 clientes, 50 itens estoque, 30 contas, 30 agendamentos"
