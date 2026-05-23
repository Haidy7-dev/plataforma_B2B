export function createInvoicePdfData(quotation) {
  return {
    title: 'Factura',
    client: quotation?.client,
    space: quotation?.space,
    lines: quotation?.lines || [],
    total: quotation?.total || '0.00'
  }
}

