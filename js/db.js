/* ==========================================================
   "Banco de dados" local dos agendamentos
   Fica salvo no navegador (localStorage). Como o site é estático,
   cada aparelho tem a sua própria agenda.
   ========================================================== */

const DB = (() => {
  const KEY = 'corteza_agenda_v1';

  // Cache em memória: evita reler/parsear o localStorage a cada consulta
  let cache = null;
  const load = () => cache || (cache = store(KEY) || []);
  const save = (list) => { cache = list; store(KEY, list); };
  // Outra aba do navegador mudou a agenda: descarta o cache
  window.addEventListener('storage', (e) => { if (e.key === KEY) cache = null; });

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return {
    /** Todos os agendamentos, ordenados por data e hora */
    all() {
      return load().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    },

    get(id) { return load().find((b) => b.id === id) || null; },

    /** Cria um agendamento. kind: 'agendamento' | 'bloqueio' */
    add(data) {
      const list = load();
      const item = { id: uid(), kind: 'agendamento', status: 'agendado', createdAt: new Date().toISOString(), ...data };
      list.push(item);
      save(list);
      return item;
    },

    update(id, patch) {
      const list = load();
      const i = list.findIndex((b) => b.id === id);
      if (i < 0) return null;
      list[i] = { ...list[i], ...patch };
      save(list);
      return list[i];
    },

    /** Horário ocupado por outro agendamento ativo ou bloqueio?
        Bloqueios com endTime ocupam todo o intervalo [time, endTime). */
    isTaken(date, time, ignoreId) {
      return load().some((b) => b.date === date && b.status !== 'cancelado' && b.id !== ignoreId
        && (b.endTime ? time >= b.time && time < b.endTime : b.time === time));
    },

    /** Marca como concluído e registra o valor recebido no faturamento */
    complete(id, amount, method) {
      return this.update(id, {
        status: 'concluido',
        amount: Math.max(0, Number(amount) || 0),
        method: method || null,
        paidDate: nowLocal().iso, // dia em que o dinheiro entrou
        completedAt: new Date().toISOString(),
      });
    },

    /** Desfaz a conclusão (remove o valor do faturamento) */
    reopen(id) {
      return this.update(id, { status: 'agendado', amount: null, method: null, paidDate: null, completedAt: null });
    },

    /** Entradas de faturamento: { date, amount } dos atendimentos concluídos */
    revenue() {
      return load()
        .filter((b) => b.status === 'concluido' && b.kind === 'agendamento' && b.amount > 0)
        .map((b) => ({ date: b.paidDate || b.date, amount: b.amount }));
    },

    /** Insere vários registros de uma vez (usado nos dados de exemplo) */
    addMany(items) {
      const list = load();
      items.forEach((d) => list.push({ id: uid(), kind: 'agendamento', status: 'agendado', createdAt: new Date().toISOString(), ...d }));
      save(list);
    },

    removeWhere(fn) {
      save(load().filter((b) => !fn(b)));
    },

    forUser(email) {
      return this.all().filter((b) => b.userEmail === email);
    },
  };
})();
