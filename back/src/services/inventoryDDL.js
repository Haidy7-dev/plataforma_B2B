export const inventoryDDL = `
-- INVENTARIO (ADMIN multiempresa)
-- Crea tablas nuevas si no existen.

CREATE TABLE IF NOT EXISTS inventory_items (
  id_item BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_empresa INT NOT NULL,

  tipo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  espacio VARCHAR(150) NOT NULL,
  estado VARCHAR(50) NOT NULL,
  descripcion TEXT,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_item (
    id_empresa, tipo, nombre, espacio, estado
  ),

  INDEX idx_empresa_tipo (id_empresa, tipo),
  INDEX idx_empresa_nombre (id_empresa, nombre)
);

CREATE TABLE IF NOT EXISTS inventory_imports (
  id_import BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_empresa INT NOT NULL,

  original_filename VARCHAR(255),

  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,

  status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_import_rows (
  id_import_row BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_import BIGINT NOT NULL,

  row_number INT NOT NULL,
  raw_json TEXT,

  error_message TEXT,
  created_item_id BIGINT NULL,
  updated_item_id BIGINT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_import_row (id_import, row_number),
  CONSTRAINT fk_inventory_import_rows_import
    FOREIGN KEY (id_import) REFERENCES inventory_imports(id_import)
    ON DELETE CASCADE
);
`;

