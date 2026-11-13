# Barbería Premium

Sistema web de gestión para Barbería Premium. Mantiene las páginas, funciones y estética original (negro + dorado) y utiliza **Supabase PostgreSQL** como base de datos, sin MAMP ni MySQL.

## Requisitos
- Node.js 18 o superior.
- Una cuenta/proyecto de Supabase.

## 1. Crear las tablas en Supabase
1. Entrá a tu proyecto en Supabase.
2. Abrí **SQL Editor → New query**.
3. Abrí `database/schema.supabase.sql`, copiá todo el contenido y ejecutalo con **Run**.
4. El script crea las tablas `usuarios`, `servicios`, `reservas`, `opiniones`, `galeria` y `promociones`, además de los tres servicios iniciales.

## 2. Configurar la conexión
1. En Supabase abrí **Project Settings → Database → Connection string → URI**.
2. Copiá la URI y reemplazá `[YOUR-PASSWORD]` por la contraseña de la base de datos.
3. En la carpeta del proyecto duplicá `.env.example` y llamá a la copia `.env`.
4. Pegá la URI completa en `DATABASE_URL`. No compartas este archivo ni subas `.env` a GitHub.

> Usá la cadena de conexión de PostgreSQL de Supabase, no la URL pública del proyecto ni la anon key.

## 3. Instalar y ejecutar
Desde la carpeta `Barberia-Premium` abrí una terminal:

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. Para comprobar la conexión visitá `http://localhost:3000/api/db-test`; debe responder que la conexión con Supabase está funcionando.

## 4. Crear el administrador
1. Registrá tu cuenta desde `registro.html`.
2. En Supabase → SQL Editor ejecutá, reemplazando el correo por el que registraste:

```sql
update public.usuarios
set rol = 'admin'
where email = 'TU_CORREO';
```

3. Cerrá sesión e iniciá sesión nuevamente para entrar al panel de administración.

## Notas
- Las páginas HTML, imágenes, rutas de API y funcionalidades de reservas, servicios, promociones, galería y opiniones se mantienen.
- El backend se conecta a PostgreSQL mediante el adaptador `pg` y la cadena privada `DATABASE_URL`.
- Nunca publiques `.env` ni la contraseña de tu base de datos.
