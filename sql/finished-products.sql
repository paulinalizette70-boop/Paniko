-- Inventario de productos terminados. Se ejecuta sin eliminar información existente.
CREATE TABLE IF NOT EXISTS finished_product_categories (
 id VARCHAR(60) PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 sort_order INT NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finished_products (
 id CHAR(36) NOT NULL PRIMARY KEY,
 name VARCHAR(150) NOT NULL UNIQUE,
 category_id VARCHAR(60) NULL,
 source_product_key CHAR(64) NULL UNIQUE,
 operational_recipe_id CHAR(36) NULL,
 unit ENUM('pieza') NOT NULL DEFAULT 'pieza',
 stock INT NOT NULL DEFAULT 0,
 min_stock INT NULL,
 sale_price DECIMAL(14,2) NULL,
 unit_cost DECIMAL(14,2) NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_fp_category FOREIGN KEY(category_id) REFERENCES finished_product_categories(id),
 CONSTRAINT fk_fp_recipe FOREIGN KEY(operational_recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
 CONSTRAINT ck_fp_stock CHECK (stock >= 0),
 CONSTRAINT ck_fp_min CHECK (min_stock IS NULL OR min_stock >= 0),
 CONSTRAINT ck_fp_price CHECK (sale_price IS NULL OR sale_price >= 0),
 CONSTRAINT ck_fp_unit_cost CHECK (unit_cost IS NULL OR unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finished_product_movements (
 id CHAR(36) NOT NULL PRIMARY KEY,
 product_id CHAR(36) NOT NULL,
 movement_type ENUM('produccion','produccion_manual','venta','merma','ajuste_entrada','ajuste_salida') NOT NULL,
 quantity INT NOT NULL,
 stock_before INT NOT NULL,
 stock_after INT NOT NULL,
 reason VARCHAR(150) NOT NULL,
 batch_id CHAR(36) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_fpm_product_date (product_id, created_at),
 INDEX ix_fpm_date (created_at),
 INDEX ix_fpm_batch (batch_id),
 CONSTRAINT fk_fpm_product FOREIGN KEY(product_id) REFERENCES finished_products(id),
 CONSTRAINT fk_fpm_batch FOREIGN KEY(batch_id) REFERENCES production_batches(id),
 CONSTRAINT ck_fpm_quantity CHECK (quantity > 0),
 CONSTRAINT ck_fpm_nonnegative CHECK (stock_before >= 0 AND stock_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO finished_product_categories (id,name,sort_order) VALUES
 ('masa_madre','Pan de masa madre',10),
 ('brioche','Pan de brioche',20),
 ('laminada','Bollería laminada',30),
 ('galletas','Galletas',40),
 ('postres','Pasteles y panqués',50);
