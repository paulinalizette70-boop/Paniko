'use strict';
// Estado de CUIDADOS, nunca diagnóstico de fermentación ni garantía para hornear.
// Archivo compartido por la interfaz y las pruebas locales (sin dependencias).
(function attachStarterStatus(root) {
  function evaluate(starter, now = Date.now()) {
    const active = Boolean(starter?.active);
    const linked = Boolean(starter?.inventoryLinked);
    const cold = starter?.location === 'refrigerador';
    const hours = Number(starter?.feedEveryHours);
    const fed = starter?.lastFedAt ? new Date(starter.lastFedAt).getTime() : NaN;
    const currentTime = now instanceof Date ? now.getTime() : Number(now);
    const hasSchedule = Number.isFinite(fed) && Number.isFinite(currentTime) &&
      Number.isInteger(hours) && hours >= 1 && hours <= 336;
    const nextAt = hasSchedule ? fed + hours * 3600000 : null;
    const elapsedHours = hasSchedule ? Math.max(0, (currentTime - fed) / 3600000) : null;
    const remainingHours = hasSchedule ? (nextAt - currentTime) / 3600000 : null;
    const progress = hasSchedule ? Math.min(100, Math.max(0, elapsedHours / hours * 100)) : 0;
    let code, label, note;
    if (!active) {
      code = 'paused'; label = 'Seguimiento pausado'; note = 'Este cultivo no tiene avisos activos.';
    } else if (!linked) {
      code = 'unlinked'; label = 'Conectar a Inventario'; note = 'Vincula masa madre, harina y agua para registrar alimentaciones.';
    } else if (!hasSchedule) {
      code = 'unfed'; label = 'Primera alimentación pendiente'; note = 'Registra una alimentación para calcular la próxima revisión.';
    } else if (remainingHours <= 0) {
      code = 'overdue'; label = 'Revisión atrasada'; note = cold ? 'Toca revisar tu masa madre refrigerada.' : 'Ya llegó la hora programada de revisar o alimentar.';
    } else if (remainingHours <= hours * 0.2) {
      code = 'soon'; label = 'Próxima a revisar'; note = 'Está por llegar la siguiente revisión programada.';
    } else if (cold) {
      code = 'cold'; label = 'En refrigeración'; note = 'Cultivo refrigerado dentro de su intervalo de revisión.';
    } else {
      code = 'ontrack'; label = 'Cuidados al día'; note = 'Cultivo dentro del intervalo de revisión configurado.';
    }
    return {code,label,note,nextAt,elapsedHours,remainingHours,progress,cold,hasSchedule,
      requiresAttention:active && ['unlinked','unfed','soon','overdue'].includes(code)};
  }
  function formatRemaining(remainingHours) {
    if (remainingHours === null || !Number.isFinite(remainingHours)) return 'Sin horario todavía';
    if (remainingHours <= 0) {
      const delay = Math.ceil(-remainingHours);
      return delay === 0 ? 'La revisión toca ahora' : `Retraso de ${delay} h`;
    }
    if (remainingHours < 1) return `Faltan ${Math.max(1,Math.ceil(remainingHours * 60))} min`;
    return `Faltan ${Math.ceil(remainingHours)} h`;
  }
  const api = {evaluate,formatRemaining};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.PanikoStarterStatus = api;
})(typeof window === 'object' ? window : null);
