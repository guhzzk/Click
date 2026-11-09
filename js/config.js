/* ==========================================================
   Corteza Barbearia — configuração e dados do site
   Edite este arquivo para mudar contato, Pix, preços e contas.
   ========================================================== */

const CONFIG = {
  // Número do WhatsApp com DDI + DDD, só números. Ex.: '5521987654321'
  // Enquanto estiver vazio, o WhatsApp abre para escolher o contato.
  whatsapp: '',
  // Chave Pix da barbearia (CPF, CNPJ, e-mail, telefone +55... ou chave aleatória).
  // Enquanto estiver vazia, o Pix funciona em modo demonstração.
  pixKey: '',
  pixName: 'CORTEZA BARBEARIA', // até 25 caracteres, sem acento
  pixCity: 'ARAUCARIA',         // até 15 caracteres, sem acento

  // MODO DEMONSTRAÇÃO — liga as simulações usadas para apresentar o upgrade:
  // confirmação automática do Pix, próximo sábado lotado com fila de espera
  // e assistente de IA no painel. Nada disso tem integração real ainda.
  // Coloque false antes de abrir o site para clientes de verdade.
  // (A confirmação automática do Pix nunca roda se houver chave Pix real.)
  demoMode: true,
  pixAutoConfirmMs: 5000, // tempo até o "webhook" confirmar o Pix na demonstração
  barber: 'Guilherme',
  address: 'R. Mieceslau Jasiocha, 66 - Thomaz Coelho, Araucária - PR, 83707-200',
  // Opcional: coordenadas exatas da porta (deixam a rota do Maps/Waze mais precisa).
  // Ex.: { lat: -22.8370, lng: -43.3270 }. Com null, a rota usa o endereço acima.
  coords: null,
  timezone: 'America/Sao_Paulo',
  slotMinutes: 30,
  minAdvanceMinutes: 15, // antecedência mínima para agendar no mesmo dia
  bookingDays: 21,
  // Dia da semana (0 = domingo) -> [abre, fecha] em horas
  hours: { 2: [10, 20], 3: [10, 20], 4: [10, 20], 5: [10, 20], 6: [9, 20] },
};

/* ----------------------------------------------------------
   CONTAS DE DEMONSTRAÇÃO
   Atenção: o site é estático (GitHub Pages), então estas contas
   ficam visíveis no código. Servem só para apresentar o sistema.
   ---------------------------------------------------------- */
const USERS = [
  {
    user: 'cliente1', email: 'cliente1@corteza.com', password: 'cliente1',
    name: 'Cliente 1', phone: '(41) 90000-0001', role: 'cliente',
  },
  {
    user: 'barbeiro1', email: 'barbeiro1@corteza.com', password: 'barbeiro1',
    name: 'Guilherme', phone: '', role: 'barbeiro',
  },
];

/* ----------------------------------------------------------
   SERVIÇOS — price: null => "sob consulta"
   ---------------------------------------------------------- */
const IMG = 'images/barbearia/';

const SERVICES = {
  avulsos: [
    { id: 'corte', name: 'Corte', price: 40, art: IMG + 'servicos/corte-avulso.webp' },
    { id: 'barba', name: 'Barba', price: 35, art: IMG + 'servicos/barba-avulso.webp' },
    { id: 'sobrancelha', name: 'Sobrancelha', price: 15, art: IMG + 'servicos/sobrancelha-avulso.webp' },
    { id: 'cavanhaque', name: 'Cavanhaque', price: null },
    { id: 'hidratacao', name: 'Hidratação', price: null },
    { id: 'limpeza', name: 'Limpeza de pele', price: null },
    { id: 'ozonio', name: 'Hidratação com ozonioterapia', price: null },
    { id: 'depilacao', name: 'Depilação com cera — nariz e orelhas', price: null },
    { id: 'pintura', name: 'Pintura', price: null },
  ],
  combos: [
    { id: 'c-corte-sobrancelha', name: 'Corte + Sobrancelha', price: 55, art: IMG + 'servicos/combo-corte-sobrancelha.webp' },
    { id: 'c-corte-barba', name: 'Corte + Barba', price: 75, art: IMG + 'servicos/combo-corte-barba.webp' },
    { id: 'c-barba-sobrancelha', name: 'Barba + Sobrancelha', price: 50, art: IMG + 'servicos/combo-barba-sobrancelha.webp' },
    { id: 'c-completo', name: 'Corte + Barba + Sobrancelha', price: 90, art: IMG + 'servicos/combo-corte-barba-sobrancelha.webp' },
  ],
  quimicas: [
    { id: 'nevou', name: 'Nevou', price: null },
  ],
};
const TAB_LABEL = { avulsos: 'Avulso', combos: 'Combo', quimicas: 'Química' };

/* ----------------------------------------------------------
   PLANOS CLUB CORTEZA
   ---------------------------------------------------------- */
const PLANS = {
  one: [
    { id: 'one-corte', what: 'Corte', price: 79.90, desc: 'Plano para manter o visual em dia.', art: IMG + 'planos/plano-corte.webp' },
    { id: 'one-corte-sob', what: 'Corte + Sobrancelha', price: 99.90, desc: 'Plano para corte com acabamento mais completo.', art: IMG + 'planos/plano-corte-sobrancelha.webp' },
    { id: 'one-corte-barba', what: 'Corte + Barba', price: 129.90, desc: 'Plano para manter cabelo e barba alinhados.', art: IMG + 'planos/plano-corte-barba.webp' },
    { id: 'one-completo', what: 'Corte + Barba + Sobrancelha', price: 159.90, desc: 'Plano completo para quem quer cuidado total.', art: IMG + 'planos/plano-corte-barba-sobrancelha.webp' },
  ],
  black: [
    { id: 'black-corte', what: 'Somente corte', price: null, desc: 'Ilimitado* no corte.' },
    { id: 'black-corte-sob', what: 'Corte & Sobrancelha', price: null, desc: 'Ilimitado* em corte e sobrancelha.' },
    { id: 'black-corte-barba', what: 'Corte & Barba', price: null, desc: 'Ilimitado* em corte e barba.' },
    { id: 'black-completo', what: 'Corte & Barba & Sobrancelha', price: null, desc: 'O pacote completo do Club Black.' },
  ],
  outros: [
    { id: 'club-2x', club: 'CLUB 2X', what: 'Somente corte', price: null, desc: 'Dois cortes garantidos no plano.' },
    { id: 'anual', club: 'ANUAL', what: 'Plano anual', price: null, desc: 'Seu visual garantido o ano inteiro.' },
  ],
};
const PLAN_META = {
  one: { club: 'clubcorteza', name: 'ONE', meta: 'Ilimitado* · Seg e Ter' },
  black: { club: 'clubcorteza', name: 'BLACK', meta: 'Ilimitado*' },
  outros: { club: 'clubcorteza', name: '', meta: 'Consulte condições' },
};

/* ----------------------------------------------------------
   PRODUTOS EL GUAPO
   ---------------------------------------------------------- */
const PRODUCTS = [
  { id: 'p-oleo', name: 'Óleo para barba', sub: 'Nutre e finaliza', price: 55, img: IMG + 'oleo-para-barba.webp', desc: 'Ajuda a nutrir os fios, reduzir o ressecamento e dar acabamento à barba.' },
  { id: 'p-balm', name: 'Balm para barba', sub: 'Hidrata e alinha', price: 60, img: IMG + 'balm-para-barba.webp', desc: 'Ajuda a hidratar, amaciar e alinhar a barba no cuidado do dia a dia.' },
  { id: 'p-brilho', name: 'Cera brilho', sub: 'Efeito molhado', price: 65, img: IMG + 'cera-brilho.webp', desc: 'Ajuda a alinhar o penteado com definição e acabamento brilhante.' },
  { id: 'p-matte', name: 'Cera matte', sub: 'Efeito seco', price: 65, img: IMG + 'cera-matte.webp', desc: 'Modela com firmeza e mantém o penteado com acabamento seco e natural.' },
];
