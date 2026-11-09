/* ==========================================================
   "Banco de dados" local dos agendamentos
   Fica salvo no navegador (localStorage). Como o site é estático,
   cada aparelho tem a sua própria agenda.
   ========================================================== */

const DB = (() => {
  const KEY = 'corteza_agenda_v1';

  const load = () => store(KEY) || [];
  const save = (list) => store(KEY, list);

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

    /** Horário ocupado por outro agendamento ativo ou bloqueio? */
    isTaken(date, time, ignoreId) {
      return load().some((b) => b.date === date && b.time === time && b.status !== 'cancelado' && b.id !== ignoreId);
    },

    forUser(email) {
      return this.all().filter((b) => b.userEmail === email);
    },
  };
})();
