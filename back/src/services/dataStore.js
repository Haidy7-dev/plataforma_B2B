const nowIso = () => new Date().toISOString()

export const dataStore = {
  inventory: [],
  services: [],
  quotations: [],
  invoices: [],
  incidents: [
    { id: 'inc-1', type: 'mock', message: 'Ejemplo de incidente (mock)', createdAt: nowIso() }
  ],
  upcomingEvents: [
    { id: 'ev-1', name: 'Evento Demo', date: '2026-07-10', location: 'Salon A' }
  ],
  preparationList: [
    { id: 'prep-1', eventId: 'ev-1', item: 'Sillas', qty: 50, status: 'Pendiente' }
  ],

  logistics: {
    routes: [
      {
        id: 'r-1',
        code: 'RUTA-001',
        origin: 'CDMX - Centro',
        destination: 'CDMX - Norte',
        driver: 'Carlos Méndez',
        vehicle: 'TRK-102',
        status: 'en curso',
        etaMinutes: 35,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        timeline: [
          { at: nowIso(), label: 'Ruta creada', status: 'pendiente' },
          { at: nowIso(), label: 'Salida de almacén', status: 'en curso' }
        ]
      },
      {
        id: 'r-2',
        code: 'RUTA-002',
        origin: 'CDMX - Norte',
        destination: 'Toluca',
        driver: 'Ana Ruiz',
        vehicle: 'VAN-021',
        status: 'pendiente',
        etaMinutes: 80,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        timeline: [{ at: nowIso(), label: 'Ruta creada', status: 'pendiente' }]
      }
    ],

    orders: [
      {
        id: 'ord-1',
        customerName: 'Hotel Reforma',
        customerPhone: '555-111-2233',
        customerAddress: 'Av. Reforma 100, CDMX',
        routeId: 'r-1',
        status: 'enviado',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        history: [
          { at: nowIso(), status: 'recibido', note: 'Pedido recibido por sistema' },
          { at: nowIso(), status: 'preparado', note: 'Pedido preparado en almacén' },
          { at: nowIso(), status: 'enviado', note: 'Pedido en tránsito' }
        ]
      },
      {
        id: 'ord-2',
        customerName: 'Corporativo Delta',
        customerPhone: '555-888-1010',
        customerAddress: 'Insurgentes Sur 1220, CDMX',
        routeId: 'r-2',
        status: 'preparado',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        history: [
          { at: nowIso(), status: 'recibido', note: 'Pedido recibido por sistema' },
          { at: nowIso(), status: 'preparado', note: 'En espera de salida' }
        ]
      }
    ],

    inventory: [
      {
        id: 'inv-1',
        sku: 'SKU-CHAIR-001',
        nombre_producto: 'Silla plegable',
        categoria: 'Mobiliario',
        descripcion: 'Silla plegable metálica',
        stock: 120,
        stock_minimo: 30,
        precio: 35.5,
        proveedor: 'Proveedor Norte',
        ubicacion: 'A1-03',
        estado: 'activo',
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'inv-2',
        sku: 'SKU-TABLE-004',
        nombre_producto: 'Mesa redonda',
        categoria: 'Mobiliario',
        descripcion: 'Mesa redonda 1.5m',
        stock: 18,
        stock_minimo: 20,
        precio: 120,
        proveedor: 'Muebles MX',
        ubicacion: 'B2-01',
        estado: 'activo',
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],

    inventoryMovements: [
      { id: 'mov-1', sku: 'SKU-CHAIR-001', type: 'entrada', qty: 50, note: 'Compra mensual', at: nowIso() },
      { id: 'mov-2', sku: 'SKU-TABLE-004', type: 'salida', qty: 12, note: 'Evento corporativo', at: nowIso() }
    ],

    tickets: [
      {
        id: 'tic-1',
        title: 'Retraso en Ruta RUTA-001',
        description: 'Tráfico intenso en autopista',
        priority: 'alta',
        status: 'en proceso',
        assignedTo: 'Supervisor Turno A',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        comments: [{ id: 'c-1', author: 'Sistema', text: 'Incidencia detectada automáticamente', at: nowIso() }]
      }
    ],

    history: [
      { id: 'h-1', module: 'rutas', action: 'Ruta creada', user: 'logistica_demo', at: nowIso(), details: 'RUTA-001' },
      { id: 'h-2', module: 'inventario', action: 'Salida inventario', user: 'logistica_demo', at: nowIso(), details: 'SKU-TABLE-004 x12' }
    ]
  }
}

