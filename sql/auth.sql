-- Tablas vacías: no contienen ni publican recetas.
CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  role ENUM('admin','operador') NOT NULL DEFAULT 'operador',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_session_user FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
