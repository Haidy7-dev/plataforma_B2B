export const dataStore = {
  inventory: [],
  services: [],
  quotations: [],
  invoices: [],
  incidents: [
    { id: 'inc-1', type: 'mock', message: 'Ejemplo de incidente (mock)', createdAt: new Date().toISOString() }
  ],
  upcomingEvents: [
    { id: 'ev-1', name: 'Evento Demo', date: '2026-07-10', location: 'Salon A' }
  ],
  preparationList: [
    { id: 'prep-1', eventId: 'ev-1', item: 'Sillas', qty: 50, status: 'Pendiente' }
  ]
}

