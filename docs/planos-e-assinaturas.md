# Planos e assinaturas CARE

Estrutura comercial da plataforma: o que o cliente paga, o que o profissional
recebe e o que fica na CARE, em cada produto.

Os exemplos usam três profissionais fictícios, mantidos ao longo de todo o
documento para que os números sejam comparáveis:

| Profissional | Serviço | Sessão |
|---|---|---|
| **Marta** | Análise reichiana | €55 |
| **Rui** | Somatic Experiencing® | €70 |
| **Inês** | Supervisão reichiana | €85 |

---

## Arquitetura em dois andares

| Andar | Produto | Quem define o preço | Onde aparece |
|---|---|---|---|
| **1** | Essencial | CARE | Home, anúncios, SEO |
| **2** | Acompanhamento | Deriva do profissional | Perfil e fluxo de agendamento |

O Essencial é o número único que o marketing usa quando alguém pergunta "quanto
custa a CARE?". O Acompanhamento não é produto de prateleira: aparece depois de
a pessoa já ter escolhido com quem quer estar.

---

## 1. Essencial

Conteúdo da CARE — biblioteca de aulas curtas de autorregulação e um encontro
aberto por mês. Não envolve profissionais e não desconta sessões.

| | Cliente paga | Profissional recebe | CARE fica com |
|---|---|---|---|
| Mensal | €14,00 | — | €14,00 |
| Trimestral | €38,00 (€12,67/mês) | — | €12,67/mês |
| Anual | €140,00 (€11,67/mês) | — | €11,67/mês |

É o único produto onde o anual se empurra com força, e onde a convenção de
mercado ("dois meses grátis") se aplica sem custo.

---

## 2. Consultas avulsas

O cliente paga sempre o preço do profissional. O que varia é apenas quanto a
CARE retém, consoante o plano de quem atende.

### Marta — €55/sessão

| Plano da Marta | Comissão | Cliente paga | Marta recebe | CARE |
|---|---|---|---|---|
| Sem plano | 35% | €55,00 | €35,75 | €19,25 |
| Mensal | 25% | €55,00 | €41,25 | €13,75 |
| Trimestral | 22% | €55,00 | €42,90 | €12,10 |
| Anual | 18% | €55,00 | **€45,10** | €9,90 |

### Rui — €70/sessão

| Plano do Rui | Comissão | Cliente paga | Rui recebe | CARE |
|---|---|---|---|---|
| Sem plano | 35% | €70,00 | €45,50 | €24,50 |
| Mensal | 25% | €70,00 | €52,50 | €17,50 |
| Trimestral | 22% | €70,00 | €54,60 | €15,40 |
| Anual | 18% | €70,00 | **€57,40** | €12,60 |

---

## 3. Acompanhamento

Vendido como **"Quinzenal com a Marta"** — nunca como crédito. O crédito existe
por dentro do sistema, para permitir trocar de profissional, recuperar sessões
falhadas e usar sobras em grupos, mas não aparece na montra.

**Fórmula** — com `C` = crédito mensal = nº de sessões × preço da sessão:

| | Valor |
|---|---|
| Cliente paga — 1 sessão/mês | 1,00 × C (sem desconto) |
| Cliente paga — 2 ou 4 sessões/mês | 0,90 × C |
| Cliente paga — 2 ou 4 sessões, faturado ao trimestre | 0,87 × C por mês |
| **Profissional recebe** | **(1 − comissão) × C, em qualquer periodicidade** |
| CARE fica com | a diferença |

O desconto começa nas duas sessões. Uma sessão por mês é uma marcação
permanente, não um plano: paga-se preço normal e o que se ganha é a vaga
garantida e a carteira.

**Não existe Acompanhamento anual.** A terapia tem fins naturais, e um contrato
de doze meses põe a receita da CARE contra o interesse clínico do cliente.

### Com a Marta (€55), estando ela no plano anual

| Cadência | Desconto | Cliente paga/mês | Marta recebe/mês | CARE/mês |
|---|---|---|---|---|
| Mensal — 1 sessão | — | **€55,00** | €45,10 | €9,90 |
| Quinzenal — 2 sessões | −10% | **€99,00** | €90,20 | €8,80 |
| Semanal — 4 sessões | −10% | **€198,00** | €180,40 | €17,60 |

### Com o Rui (€70), estando ele no plano anual

| Cadência | Desconto | Cliente paga/mês | Rui recebe/mês | CARE/mês |
|---|---|---|---|---|
| Mensal — 1 sessão | — | **€70,00** | €57,40 | €12,60 |
| Quinzenal — 2 sessões | −10% | **€126,00** | €114,80 | €11,20 |
| Semanal — 4 sessões | −10% | **€252,00** | €229,60 | €22,40 |

### Faturação trimestral (−13%)

Disponível apenas no quinzenal e no semanal. O profissional recebe exatamente o
mesmo — o desconto sai inteiro da CARE.

| | Cliente paga/mês | Profissional recebe/mês | CARE/mês |
|---|---|---|---|
| Quinzenal com a Marta | €95,70 | €90,20 | €5,50 |
| Semanal com a Marta | €191,40 | €180,40 | €11,00 |
| Quinzenal com o Rui | €121,80 | €114,80 | €7,00 |
| Semanal com o Rui | €243,60 | €229,60 | €14,00 |

### O que o plano do profissional muda

Quinzenal com a Marta — o cliente paga **sempre €99**:

| Plano da Marta | Comissão | Marta recebe | CARE |
|---|---|---|---|
| Sem plano | 35% | €71,50 | **€27,50** |
| Mensal | 25% | €82,50 | €16,50 |
| Trimestral | 22% | €85,80 | €13,20 |
| Anual | 18% | **€90,20** | €8,80 |

É a tabela mais persuasiva da estrutura: a Marta ganha **€18,70 a mais por mês
em cada cliente de assinatura** só por estar no plano anual. Um cliente e meio
paga o plano inteiro.

### Nota sobre o mensal

Como não há desconto a financiar, a CARE fica com mais no mensal (€9,90) do que
no quinzenal (€8,80), apesar de metade das sessões. Não é erro. São produtos
para necessidades diferentes, e o semanal continua a ser de longe o melhor para
a CARE.

---

## 4. Planos dos profissionais

| | Sem plano | Mensal | Trimestral | **Anual** |
|---|---|---|---|---|
| **Custo** | €0 | €35/mês | €87 (€29/mês) | **€276 (€23/mês)** |
| **Comissão** | 35% | 25% | 22% | **18%** |
| Aceitar clientes de assinatura | ✓ | ✓ | ✓ | ✓ |
| Encontro CARE bimestral | ✓ | ✓ | ✓ | ✓ |
| Vagas recorrentes garantidas | ✓ | ✓ | ✓ | ✓ |
| Pagamento elegível ao fim de | 30 dias | 21 dias | 14 dias | **7 dias** |
| Consultoria de caso | — | — | mediante disponibilidade | **1× a cada 3 meses, garantida + prioridade na agenda** |

Entre o trimestral e o anual, a diferença na consultoria não é a frequência — é
a **certeza**. Quem tem o anual sabe que vai ter; quem tem o trimestral tenta.
Num serviço de capacidade escassa, a garantia é o bem real.

### Quanto a Marta leva para casa, já descontada a mensalidade

| Plano | 7 sessões (€385) | 14 sessões (€770) |
|---|---|---|
| Sem plano | €250,25 | €500,50 |
| Mensal | €253,75 *(+€3,50)* | €542,50 *(+€42,00)* |
| Trimestral | €271,30 *(+€21,05)* | €571,60 *(+€71,10)* |
| **Anual** | **€292,70** *(+€42,45)* | **€608,40** *(+€107,90)* |

O mensal quase não compensa a 7 sessões — é propositado. Serve para
experimentar, não para ficar. O ponto de viragem do mensal está em ~€350
faturados por mês; o trimestral e o anual compensam sempre a quem tenciona
ficar, e a diferença cresce com o volume.

### O número honesto

Com o mesmo volume, a CARE ganha **menos** com um profissional no anual do que
sem plano: às 7 sessões, €134,75 sem plano contra €92,30 no anual. O profissional
no anual precisa de faturar cerca de €620/mês em vez de €385 para a CARE ficar
igual.

A escada de comissões é, portanto, **um instrumento de retenção e crescimento,
não de margem**. Se as vantagens não gerarem volume, é só um desconto.

---

## 5. Capacidade da consultoria de caso

### O que uma consultoria custa em tempo

| | Tempo |
|---|---|
| Leitura prévia do caso | 15 min |
| Conversa | 50 min |
| Registo e encaminhamentos | 10 min |
| **Custo real** | **~1h15** |

### Horas por mês, consoante o tamanho da rede

| Profissionais no anual | A cada 3 meses | A cada 2 meses |
|---|---|---|
| 5 | 2,1 h/mês | 3,1 h/mês |
| 10 | 4,2 h/mês | 6,3 h/mês |
| 20 | 8,3 h/mês | 12,5 h/mês |
| 30 | 12,5 h/mês | 18,8 h/mês |
| 40 | **16,7 h/mês** | 25,0 h/mês |
| 60 | 25,0 h/mês | **37,5 h/mês** |

Acrescer ~25% para o que os profissionais do trimestral consumirem.

| Carga | Leitura |
|---|---|
| Até ~8 h/mês | Confortável a par de tudo o resto |
| 8–16 h/mês | Sustentável com agenda fixa |
| Acima de 24 h/mês | Deixa de ser benefício e passa a ser um emprego |

### Agenda recomendada para já

**Uma tarde fixa por semana, 3 slots de 50 minutos** (ex.: quarta-feira, 14h/15h/16h).

| | |
|---|---|
| Slots disponíveis | ~12/mês |
| Tempo total da fundadora | ~15 h/mês |
| Suporta (a cada 3 meses) | ~27 profissionais no anual, com folga para o trimestral |

**Mecanismo de prioridade:** a agenda do mês seguinte abre no dia 1. Quem tem
plano anual marca a partir do dia 1; quem tem trimestral marca a partir do dia
8, com o que sobrar.

**Salvaguardas:** 48 h de antecedência para cancelar, e o caso enviado por
escrito na marcação — sem isso os 15 minutos de preparação não existem.

### Quando deixa de dar

Por volta dos **40 profissionais no anual**, uma pessoa só não chega. A saída é
transformar isto num **painel rotativo**, com profissionais séniores da própria
rede a dar consultoria. Por isso o benefício deve chamar-se desde já
**"consultoria da CARE"**, e não "consultoria com a fundadora" — para que essa
transição não pareça uma perda.

---

## 6. Regras que sustentam a estrutura

1. O plano do cliente nunca altera o que o profissional recebe.
2. O plano do profissional nunca altera o que o cliente paga.
3. O Essencial não desconta sessões.
4. O desconto do Acompanhamento começa nas duas sessões por mês.
5. Não existe Acompanhamento anual.
6. Aceitar clientes de assinatura está disponível em todos os planos, incluindo
   sem plano.
7. O preço fica bloqueado durante o período contratado; alteração só na
   renovação, com aviso prévio.
8. O crédito transita enquanto a assinatura estiver ativa e caduca 90 dias após
   o cancelamento.
9. Sobra de crédito pode ser completada em dinheiro para marcar mais uma sessão.
10. Uma assinatura pode ter várias linhas (vários profissionais); a carteira é
    da assinatura, não da linha.
11. O encontro bimestral é aberto a todos os profissionais, sem exceção.
12. Nenhuma vantagem comercial pode influenciar o que o cliente vê ao escolher
    um profissional.

A regra 12 é a razão pela qual não existe "destaque na listagem" em nenhum
plano. Visibilidade paga distorceria a escolha clínica.

---

## 7. Implicações técnicas

### Modelo de dados

| Entidade | Guarda |
|---|---|
| `Plan` | Cadência e tipo de produto |
| `Subscription` | Faturação: periodicidade, renovação, estado. Uma por cliente |
| `SubscriptionLine` | Profissional, cadência, **preço e comissão congelados**, vaga garantida |
| `CreditWallet` | Saldo em euros, histórico, caducidade. Pertence à `Subscription` |

`SubscriptionLine` guarda o preço e a comissão **com que foi assinada** — valor
congelado, nunca uma referência viva ao `ProfessionalService`. Sem isso, a regra
7 parte-se sozinha.

O `ProfessionalService` ganha um booleano de aceitação de assinaturas.

As três cadências mapeiam no `RecurrenceFrequency` que já existe: `MONTHLY`,
`BIWEEKLY`, `WEEKLY`.

### Prestador de pagamento

**Stripe Connect (contas Express ou Custom)** para o lado euro. Verificado:

| Requisito | Como |
|---|---|
| Pagamento dividido | Destination / separate charges |
| Retenção configurável por profissional | `settlement_timing.delay_days_override`, até 31 dias, por conta ligada |
| Lotes semanais | `interval: "weekly"` com `weekly_payout_days` |

A escada de 30/21/14/7 dias mapeia diretamente no `delay_days_override`. Todos
os profissionais são pagos no mesmo lote semanal — o que varia é quando a sessão
fica elegível, não a frequência dos lotes.

**Condição:** a retenção configurável exige que a plataforma assuma
responsabilidade por fraude e disputas. É a CARE que absorve um estorno se o
cliente contestar depois de o profissional já ter sido pago. É esse o custo real
dos 7 dias.

**Brasil:** os pagamentos transfronteiriços da Stripe Connect servem apenas
EUA, Reino Unido, EEE, Canadá e Suíça. O Brasil **não é destino suportado**.
Opções: entidade brasileira com PSP local, ou Payoneer/Wise para pagamentos em
BRL com liquidação via PIX enquanto o volume for pequeno.

Isto espelha o que o modelo de dados já assume: `price` e `priceBRL` são campos
separados que nunca se convertem. Dois circuitos comerciais independentes — euro
entra e sai em euro, real entra e sai em real.

### Em aberto

- Valor dos planos em real, definido à parte (nunca convertido).
- Escolha e integração do prestador de pagamento — não existe nenhum no código.
