-- El catálogo privado se guarda en tablas SOLO de staging y NO se publica por HTTP.
-- NO usar datos reales en este archivo de esquema.
CREATE TABLE IF NOT EXISTS private_catalog_recipes (
  catalog_id VARCHAR(100) NOT NULL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  review_status VARCHAR(40) NOT NULL,
  raw_data JSON NOT NULL,
  source_hash CHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS private_catalog_products (
  product_key CHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  source_recipe_id VARCHAR(100) NOT NULL,
  raw_data JSON NOT NULL,
  source_hash CHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS private_catalog_fillings (
  filling_key CHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  filling_kind ENUM('comercial','elaborado') NOT NULL,
  raw_data JSON NOT NULL,
  source_hash CHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS private_catalog_imports (
  source_hash CHAR(64) NOT NULL PRIMARY KEY,
  recipe_count INT NOT NULL,
  product_count INT NOT NULL,
  filling_count INT NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
