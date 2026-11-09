# Corteza Barbearia

Landing page da **Corteza Barbearia** (R. Mieceslau Jasiocha, 66 · Thomaz Coelho).
Site estático: abra o `index.html` ou publique com o GitHub Pages.

## Funções
- Status "Aberto agora / Fechado" calculado pelo horário de Brasília
- Serviços avulsos, combos e químicas com botão de adicionar
- Planos Club Corteza (ONE, BLACK, 2x e Anual)
- Produtos El Guapo com reserva para retirar no atendimento
- Agendamento em 4 passos (serviços → data e hora → dados → pagamento)
- Redirecionamento automático para o WhatsApp com a mensagem pronta
- Pagamento por Pix com QR Code e copia e cola gerados no próprio site
- Mapa, tabela de horários, perguntas frequentes e botão flutuante do WhatsApp

## Antes de publicar
Edite o início do arquivo `script.js`:

```js
const CONFIG = {
  whatsapp: '5521XXXXXXXXX', // número da barbearia
  pixKey: 'sua-chave-pix',   // chave Pix
  ...
};
```

Sem esses dados, o WhatsApp abre para escolher o contato e o Pix fica em modo de demonstração.
Os preços e serviços ficam em `SERVICES`, `PLANS` e `PRODUCTS` no mesmo arquivo.
