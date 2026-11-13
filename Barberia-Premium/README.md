# Barbería Premium

Proyecto web con Node.js, Express y MySQL.

## Requisitos
- Node.js 18 o superior
- MySQL 8 o compatible

## Preparar la base de datos
1. Abrí MySQL Workbench o phpMyAdmin.
2. Ejecutá el archivo `database/schema.mysql.sql` completo. Crea `barberia_premium`, sus tablas y los servicios iniciales.
3. Copiá `.env.example` como `.env` y completá los datos de conexión de tu MySQL. No compartas el archivo `.env`.

## Instalar y ejecutar
Desde la carpeta `Barberia-Premium` abrí una terminal y ejecutá:

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

## Comprobar la conexión
Abrí `http://localhost:3000/api/db-test`. Si está todo bien, debe responder `Conexión con MySQL exitosa`.

## Flujo para probar
1. Entrá en `registro.html` y creá una cuenta.
2. Entrá en `inicioSesion.html` con el correo y contraseña creados.
3. Elegí un servicio y solicitá un turno en `reservas.html`.
4. Consultá el turno en `misReserva.html`.

La conexión real depende de que MySQL esté instalado/encendido y de que los datos de `.env` coincidan con tu equipo. No se incluye ninguna contraseña ni credencial privada.
