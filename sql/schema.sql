-- Paniko v0.4.0 — MySQL 8.0.16+; crea la base de datos con scripts/init-db.js.
-- La API normaliza g/kg y ml/l antes de almacenar cantidades en la unidad del ingrediente.
CREATE TABLE IF NOT EXISTS ingredients (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  unit ENUM('g','kg','ml','l','pieza') NOT NULL,
  cost_per_unit DECIMAL(14,4) NOT NULL DEFAULT 0,
  stock DECIMAL(16,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ingredient_name_unit (name, unit),
  CONSTRAINT ck_ing_cost CHECK (cost_per_unit >= 0),
  CONSTRAINT ck_ing_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recipes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  base_yield INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_recipe_yield CHECK (base_yield > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recipe_items (
  recipe_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  quantity DECIMAL(16,6) NOT NULL,
  PRIMARY KEY(recipe_id,ingredient_id),
  CONSTRAINT fk_ri_recipe FOREIGN KEY(recipe_id) REFERENCES recipes(id),
  CONSTRAINT fk_ri_ing FOREIGN KEY(ingredient_id) REFERENCES ingredients(id),
  CONSTRAINT ck_ri_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS production_batches (
  id CHAR(36) NOT NULL PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  recipe_name VARCHAR(100) NOT NULL,
  desired_yield INT NOT NULL,
  estimated_total_cost DECIMAL(16,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_recipe FOREIGN KEY(recipe_id) REFERENCES recipes(id),
  CONSTRAINT ck_batch_qty CHECK (desired_yield > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  ingredient_id CHAR(36) NOT NULL,
  movement_type ENUM('entrada','salida') NOT NULL,
  quantity DECIMAL(16,6) NOT NULL,
  stock_before DECIMAL(16,6) NOT NULL,
  stock_after DECIMAL(16,6) NOT NULL,
  reason VARCHAR(150) NOT NULL,
  batch_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_movements_date (created_at),
  INDEX ix_movements_ingredient (ingredient_id),
  CONSTRAINT fk_mv_ing FOREIGN KEY(ingredient_id) REFERENCES ingredients(id),
  CONSTRAINT fk_mv_batch FOREIGN KEY(batch_id) REFERENCES production_batches(id),
  CONSTRAINT ck_mv_qty CHECK (quantity > 0),
  CONSTRAINT ck_mv_stock CHECK (stock_before >= 0 AND stock_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS production_batch_items (
  batch_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  quantity DECIMAL(16,6) NOT NULL,
  unit_cost DECIMAL(14,4) NOT NULL,
  estimated_cost DECIMAL(16,2) NOT NULL,
  PRIMARY KEY(batch_id,ingredient_id),
  CONSTRAINT fk_bi_batch FOREIGN KEY(batch_id) REFERENCES production_batches(id),
  CONSTRAINT fk_bi_ing FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
