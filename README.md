# Corteza Barbearia

Landing page da **Corteza Barbearia** (R. Mieceslau Jasiocha, 66 · Thomaz Coelho).
Site estático: abra o `index.html` ou publique com o GitHub Pages.

## Funções
- Status "Aberto agora / Fechado" calculado pelo horário de Brasília
- Serviços avulsos, combos e químicas; planos Club Corteza; produtos El Guapo
- Agendamento em 4 passos com redirecionamento automático para o WhatsApp
- Pix com QR Code e copia e cola gerados no próprio site
- Login de demonstração com área do cliente e painel do barbeiro
- Animações: reveal ao rolar, transição entre etapas, cards com borda em degradê

## Contas de demonstração
| Conta | Usuário / e-mail | Senha |
|---|---|---|
| Cliente | `cliente1` / cliente1@corteza.com | `cliente1` |
| Barbeiro | `barbeiro1` / barbeiro1@corteza.com | `barbeiro1` |

- **Cliente:** vê e cancela os próprios agendamentos; nome e WhatsApp já vêm preenchidos.
- **Barbeiro:** vê a agenda (hoje, próximos, todos, cancelados), cria agendamentos,
  bloqueia intervalos de horário (ex.: 10:00 às 11:00) e marca atendimentos como
  concluídos informando o valor recebido. A aba **Renda** mostra o faturamento
  dia a dia, semana a semana e mês a mês (com botão para gerar dados de exemplo).

> ⚠️ É um modo de demonstração. O site não tem servidor, então as contas ficam no
> código e os agendamentos ficam salvos **só no navegador de cada aparelho**.
> Para o barbeiro ver no celular dele o que o cliente agendou no celular do cliente,
> é preciso ligar o site a um backend (ex.: Firebase ou Supabase).

## Antes de publicar
Edite `js/config.js`:

```js
const CONFIG = {
  whatsapp: '5521XXXXXXXXX', // número da barbearia
  pixKey: 'sua-chave-pix',   // chave Pix
  ...
};
```

Sem esses dados, o WhatsApp abre para escolher o contato e o Pix fica em modo de demonstração.
Preços, serviços, planos, produtos e contas também ficam em `js/config.js`.

## Estrutura
```
index.html        página
style.css         estilos e animações
js/config.js      configuração e dados (edite aqui)
js/utils.js       funções de apoio (datas, WhatsApp, modais)
js/db.js          agenda salva no navegador
js/site.js        seções, carrinho e animações
js/booking.js     agendamento e Pix
js/auth.js        login e área do cliente
js/panel.js       painel do barbeiro
js/main.js        inicialização
vendor/qrcode.js  gerador de QR Code (MIT)
```
