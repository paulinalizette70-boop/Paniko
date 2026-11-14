-- Formatos que comparten una única receta de masa, sin duplicar su fórmula.
-- Se aplica después de que existan recipes, ingredients, finished_products y production_batches.
CREATE TABLE IF NOT EXISTS dough_recipe_yields (
  recipe_id CHAR(36) NOT NULL PRIMARY KEY,
  reference_dough_grams INT NOT NULL,
  CONSTRAINT fk_dry_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  CONSTRAINT ck_dry_positive CHECK (reference_dough_grams > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dough_product_formats (
  product_id CHAR(36) NOT NULL PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  dough_grams_per_piece INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_dpf_product FOREIGN KEY (product_id) REFERENCES finished_products(id),
  CONSTRAINT fk_dpf_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  CONSTRAINT ck_dpf_grams CHECK (dough_grams_per_piece > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dough_product_extras (
  product_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  quantity_per_piece DECIMAL(16,6) NOT NULL,
  PRIMARY KEY (product_id,ingredient_id),
  CONSTRAINT fk_dpe_format FOREIGN KEY (product_id) REFERENCES dough_product_formats(product_id),
  CONSTRAINT fk_dpe_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  CONSTRAINT ck_dpe_qty CHECK (quantity_per_piece > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS production_batch_formats (
  batch_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  pieces INT NOT NULL,
  dough_grams_per_piece INT NOT NULL,
  dough_total_grams INT NOT NULL,
  PRIMARY KEY(batch_id,product_id),
  CONSTRAINT fk_pbf_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id),
  CONSTRAINT fk_pbf_product FOREIGN KEY (product_id) REFERENCES finished_products(id),
  CONSTRAINT ck_pbf_qty CHECK (pieces > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
