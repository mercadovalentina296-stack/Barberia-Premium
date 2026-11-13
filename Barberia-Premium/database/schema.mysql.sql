-- Base de datos MySQL para Barbería Premium
CREATE DATABASE IF NOT EXISTS barberia_premium
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barberia_premium;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  telefono VARCHAR(30) NULL,
  password_hash VARCHAR(200) NOT NULL,
  rol ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  duracion INT UNSIGNED NOT NULL DEFAULT 30,
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  servicio_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  estado ENUM('pendiente','confirmada','cancelada') NOT NULL DEFAULT 'pendiente',
  observaciones TEXT NULL,
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  horario_activo DATETIME GENERATED ALWAYS AS (CASE WHEN estado IN ('pendiente','confirmada') THEN TIMESTAMP(fecha, hora) ELSE NULL END) STORED,
  CONSTRAINT fk_reservas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_reservas_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id),
  UNIQUE KEY uq_reserva_horario_activo (horario_activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS opiniones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  puntuacion TINYINT UNSIGNED NOT NULL,
  comentario TEXT NOT NULL,
  aprobada TINYINT(1) NOT NULL DEFAULT 0,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_opiniones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS galeria (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(160) NOT NULL,
  imagen VARCHAR(500) NOT NULL,
  descripcion TEXT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promociones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(160) NOT NULL,
  descripcion TEXT NULL,
  descuento DECIMAL(5,2) NOT NULL DEFAULT 0,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO servicios (nombre, descripcion, precio, duracion, activo)
SELECT 'Corte clásico', 'Corte tradicional y prolijo.', 5000, 30, 1
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Corte clásico');
INSERT INTO servicios (nombre, descripcion, precio, duracion, activo)
SELECT 'Barba', 'Perfilado y arreglo de barba.', 3000, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Barba');
INSERT INTO servicios (nombre, descripcion, precio, duracion, activo)
SELECT 'Corte + barba', 'Servicio completo de corte y barba.', 7000, 50, 1
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Corte + barba');
