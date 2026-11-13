require("dotenv").config();
const db = require("./database");
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const {promisify} = require("util");
const scrypt = promisify(crypto.scrypt);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "API de Barbería Premium funcionando" });
});

// Las rutas conectadas a Supabase se agregan en la siguiente etapa.
app.get("/api", (_req, res) => {
  res.json({ message: "API de Barbería Premium" });
});
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS conectado");

        res.json({
            ok: true,
            message: "Conexión con MySQL exitosa",
            data: rows
        });

    } catch (error) {
        console.error("Error de MySQL:", error);

        res.status(500).json({
            ok: false,
            message: "Error al conectar con MySQL",
            error: error.message
        });
    }
});
app.get("/api/servicios", async (req, res) => {
  try {
    const [servicios] = await db.query(
      "SELECT * FROM servicios WHERE activo = 1"
    );

    res.json({
      ok: true,
      servicios
    });

  } catch (error) {
    console.error("Error al obtener servicios:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron obtener los servicios"
    });
  }
});
app.post("/api/reservas", async (req, res) => {
  try {
    const { usuario_id, servicio_id, fecha, hora, observaciones } = req.body;

    if (!usuario_id || !servicio_id || !fecha || !hora) {
      return res.status(400).json({
        ok: false,
        message: "Completá todos los datos de la reserva"
      });
    }

    const [usuarios] = await db.query(
      "SELECT id FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "El usuario no existe"
      });
    }

    const [servicios] = await db.query(
      "SELECT id FROM servicios WHERE id = ? AND activo = 1",
      [servicio_id]
    );

    if (servicios.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "El servicio no está disponible"
      });
    }

    const [resultado] = await db.query(
      `INSERT INTO reservas
      (usuario_id, servicio_id, fecha, hora, estado, observaciones)
      VALUES (?, ?, ?, ?, 'pendiente', ?)`,
      [usuario_id, servicio_id, fecha, hora, observaciones || null]
    );

    res.status(201).json({
      ok: true,
      message: "Turno solicitado correctamente",
      reserva_id: resultado.insertId
    });

  } catch (error) {
    console.error("Error al crear reserva:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        message: "Ese horario ya está ocupado. Elegí otro."
      });
    }

    res.status(500).json({
      ok: false,
      message: "No se pudo guardar la reserva"
    });
  }
});
app.get("/api/mis-reservas/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const [reservas] = await db.query(
      `SELECT
        reservas.id,
        servicios.nombre AS servicio,
        reservas.fecha,
        reservas.hora,
        reservas.estado,
        reservas.observaciones
      FROM reservas
      INNER JOIN servicios
        ON reservas.servicio_id = servicios.id
      WHERE reservas.usuario_id = ?
      ORDER BY reservas.fecha DESC, reservas.hora DESC`,
      [usuario_id]
    );

    res.json({
      ok: true,
      reservas
    });

  } catch (error) {
    console.error("Error al obtener reservas:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron obtener las reservas"
    });
  }
});
app.get("/api/admin/reservas/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Comprobar que el usuario sea administrador
    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0 || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para acceder"
      });
    }

    // Obtener todas las reservas
    const [reservas] = await db.query(`
      SELECT
        reservas.id,
        usuarios.nombre AS cliente,
        usuarios.telefono,
        servicios.nombre AS servicio,
        reservas.fecha,
        reservas.hora,
        reservas.estado
      FROM reservas
      INNER JOIN usuarios
        ON reservas.usuario_id = usuarios.id
      INNER JOIN servicios
        ON reservas.servicio_id = servicios.id
      ORDER BY reservas.fecha DESC, reservas.hora DESC
    `);

    res.json({
      ok: true,
      reservas
    });

  } catch (error) {
    console.error("Error en panel admin:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron obtener las reservas"
    });
  }
});
app.put("/api/admin/reservas/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, estado } = req.body;

    if (!usuario_id || !["confirmada", "cancelada"].includes(estado)) {
      return res.status(400).json({
        ok: false,
        message: "Datos incorrectos"
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0 || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para realizar esta acción"
      });
    }

    const [resultado] = await db.query(
      "UPDATE reservas SET estado = ? WHERE id = ?",
      [estado, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la reserva"
      });
    }

    res.json({
      ok: true,
      message: estado === "confirmada"
        ? "Reserva confirmada correctamente"
        : "Reserva cancelada correctamente"
    });

  } catch (error) {
    console.error("Error al actualizar reserva:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo actualizar la reserva"
    });
  }
});

app.post("/api/registro", async (req, res) => {
  try {
    const { nombre, email, telefono, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Nombre, email y contraseña son obligatorios"
      });
    }

    const correo = email.trim().toLowerCase();

    const [usuarios] = await db.query(
      "SELECT id FROM usuarios WHERE email = ?",
      [correo]
    );

    if (usuarios.length > 0) {
      return res.status(409).json({
        ok: false,
        message: "Ese correo ya está registrado"
      });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    const passwordHash = `${salt}:${hash.toString("hex")}`;

    const [resultado] = await db.query(
      `INSERT INTO usuarios
      (nombre, email, telefono, password_hash, rol)
      VALUES (?, ?, ?, ?, 'cliente')`,
      [nombre.trim(), correo, telefono || null, passwordHash]
    );

    res.status(201).json({
      ok: true,
      message: "Cuenta creada correctamente",
      usuario: {
        id: resultado.insertId,
        nombre: nombre.trim(),
        email: correo
      }
    });

  } catch (error) {
    console.error("Error en registro:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo registrar el usuario"
    });
  }
});



app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Ingresá tu email y contraseña"
      });
    }

    const correo = email.trim().toLowerCase();

    const [usuarios] = await db.query(
      "SELECT * FROM usuarios WHERE email = ? LIMIT 1",
      [correo]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "Email o contraseña incorrectos"
      });
    }

    const usuario = usuarios[0];
    const [salt, hashGuardado] = usuario.password_hash.split(":");

    const hashIngresado = await scrypt(password, salt, 64);

    const hashGuardadoBuffer = Buffer.from(hashGuardado, "hex");

if (hashGuardadoBuffer.length !== hashIngresado.length) {
  return res.status(401).json({
    ok: false,
    message: "Email o contraseña incorrectos"
  });
}

const coincide = crypto.timingSafeEqual(
  hashIngresado,
  hashGuardadoBuffer
);
    if (!coincide) {
      return res.status(401).json({
        ok: false,
        message: "Email o contraseña incorrectos"
      });
    }

    res.json({
      ok: true,
      message: "Inicio de sesión correcto",
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      ok: false,
      message: "Error al iniciar sesión"
    });
  }
});

app.get("/api/opiniones", async (req, res) => {
  try {
    const [opiniones] = await db.query(`
      SELECT 
        opiniones.id,
        opiniones.puntuacion,
        opiniones.comentario,
        opiniones.fecha,
        usuarios.nombre
      FROM opiniones
      INNER JOIN usuarios 
        ON opiniones.usuario_id = usuarios.id
      WHERE opiniones.aprobada = 1
      ORDER BY opiniones.fecha DESC
    `);

    res.json({
      ok: true,
      opiniones
    });

  } catch (error) {
    console.error("Error al obtener opiniones:", error);

    res.status(500).json({
      ok: false,
      message: "Error al cargar las opiniones"
    });
  }
});
app.post("/api/opiniones", async (req, res) => {
  try {
    const { usuario_id, puntuacion, comentario } = req.body;

    if (!usuario_id || !puntuacion || !comentario || puntuacion < 1 || puntuacion > 5) {
      return res.status(400).json({
        ok: false,
        message: "Completá todos los campos correctamente."
      });
    }

    const [usuarios] = await db.query(
      "SELECT id FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado."
      });
    }

    await db.query(
      `INSERT INTO opiniones (usuario_id, puntuacion, comentario, aprobada)
       VALUES (?, ?, ?, 0)`,
      [usuario_id, puntuacion, comentario.trim()]
    );

    res.status(201).json({
      ok: true,
      message: "Tu opinión fue enviada y está pendiente de aprobación."
    });

  } catch (error) {
    console.error("Error al guardar opinión:", error);
console.error("Error de inio de sesion;",error);
    res.status(500).json({
      ok: false,
      message: "No se pudo guardar la opinión."
    });
  }
});
app.get("/api/admin/opiniones/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const [admins] = await db.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'admin'",
      [usuario_id]
    );

    if (admins.length === 0) {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para acceder."
      });
    }

    const [opiniones] = await db.query(`
      SELECT opiniones.id, opiniones.puntuacion,
      opiniones.comentario, opiniones.fecha, usuarios.nombre
      FROM opiniones
      INNER JOIN usuarios ON opiniones.usuario_id = usuarios.id
      WHERE opiniones.aprobada = 0
      ORDER BY opiniones.fecha DESC
    `);

    res.json({ ok: true, opiniones });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Error al cargar opiniones pendientes."
    });
  }
});
app.put("/api/admin/opiniones/:id/aprobar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const { id } = req.params;

    const [admins] = await db.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'admin'",
      [usuario_id]
    );

    if (admins.length === 0) {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para aprobar opiniones."
      });
    }

    const [resultado] = await db.query(
      "UPDATE opiniones SET aprobada = 1 WHERE id = ?",
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "Opinión no encontrada."
      });
    }

    res.json({
      ok: true,
      message: "Opinión aprobada correctamente."
    });

  } catch (error) {
    console.error("Error al aprobar opinión:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo aprobar la opinión."
    });
  }
});
app.get("/api/galeria", async (req, res) => {
  try {
    const [imagenes] = await db.query(`
      SELECT id, titulo, imagen, descripcion
      FROM galeria
      WHERE activa = 1
      ORDER BY fecha DESC
    `);

    res.json({
      ok: true,
      imagenes
    });

  } catch (error) {
    console.error("Error al cargar galería:", error);
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "No se pudo cargar la galería."
    });
  }
});
// LISTAR TODAS LAS IMÁGENES (SOLO ADMIN)
app.get("/api/admin/galeria/:usuario_id", async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuario_id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [imagenes] = await db.query(`
      SELECT id, titulo, imagen, descripcion, activa, fecha
      FROM galeria
      ORDER BY fecha DESC
    `);

    res.json({
      ok: true,
      imagenes
    });

  } catch (error) {
    console.error("Error al listar galería:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo cargar la galería."
    });
  }
});
// AGREGAR IMAGEN A LA GALERÍA (SOLO ADMIN)
app.post("/api/admin/galeria", async (req, res) => {
  try {
    const {
      usuario_id,
      titulo,
      imagen,
      descripcion
    } = req.body;

    if (!usuario_id || !titulo || !imagen) {
      return res.status(400).json({
        ok: false,
        message: "El usuario, título e imagen son obligatorios."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      `INSERT INTO galeria
       (titulo, imagen, descripcion, activa)
       VALUES (?, ?, ?, 1)`,
      [titulo.trim(), imagen.trim(), descripcion || ""]
    );

    res.status(201).json({
      ok: true,
      message: "¡Imagen agregada correctamente!",
      id: resultado.insertId
    });

  } catch (error) {
    console.error("Error al agregar imagen:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo agregar la imagen."
    });
  }
});

// EDITAR IMAGEN DE LA GALERÍA (SOLO ADMIN)
app.put("/api/admin/galeria/:id", async (req, res) => {
  try {
    const {
      usuario_id,
      titulo,
      imagen,
      descripcion
    } = req.body;

    const imagenId = Number(req.params.id);

    if (!usuario_id || !Number.isInteger(imagenId) || imagenId <= 0 ||
        !titulo || !imagen) {
      return res.status(400).json({
        ok: false,
        message: "Datos incorrectos."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      `UPDATE galeria
       SET titulo = ?, imagen = ?, descripcion = ?
       WHERE id = ?`,
      [titulo.trim(), imagen.trim(), descripcion || "", imagenId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la imagen."
      });
    }

    res.json({
      ok: true,
      message: "¡Imagen actualizada correctamente!"
    });

  } catch (error) {
    console.error("Error al editar imagen:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo editar la imagen."
    });
  }
});
// DESACTIVAR IMAGEN DE LA GALERÍA (SOLO ADMIN)
app.put("/api/admin/galeria/:id/desactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const imagenId = Number(req.params.id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      "UPDATE galeria SET activa = 0 WHERE id = ?",
      [imagenId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la imagen."
      });
    }

    res.json({
      ok: true,
      message: "Imagen desactivada correctamente."
    });

  } catch (error) {
    console.error("Error al desactivar imagen:", error);
    res.status(500).json({
      ok: false,
      message: "No se pudo desactivar la imagen."
    });
  }
});

// REACTIVAR IMAGEN DE LA GALERÍA (SOLO ADMIN)
app.put("/api/admin/galeria/:id/reactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const imagenId = Number(req.params.id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      "UPDATE galeria SET activa = 1 WHERE id = ?",
      [imagenId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la imagen."
      });
    }

    res.json({
      ok: true,
      message: "Imagen reactivada correctamente."
    });

  } catch (error) {
    console.error("Error al reactivar imagen:", error);
    res.status(500).json({
      ok: false,
      message: "No se pudo reactivar la imagen."
    });
  }
});

app.get("/api/promociones", async (req, res) => {
  try {
    const [promociones] = await db.query(`
      SELECT titulo, descripcion, descuento, fecha_inicio, fecha_fin
      FROM promociones
      WHERE activa = 1
      AND fecha_inicio <=CURDATE()
      AND fecha_fin >=CURDATE()
      ORDER BY fecha_inicio ASC
    `);

    res.json({
      ok: true,
      promociones
    });

  } catch (error) {
    console.error("Error al cargar promociones:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron cargar las promociones."
    });
  }
});

app.post("/api/admin/servicios", async (req, res) => {
  try {
    const {
      usuario_id,
      nombre,
      descripcion,
      precio,
      duracion
    } = req.body;

    if (!usuario_id || !nombre || !precio || !duracion) {
      return res.status(400).json({
        ok: false,
        message: "Completá todos los campos obligatorios."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0 || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para agregar servicios."
      });
    }

    const precioNumero = Number(precio);
    const duracionNumero = Number(duracion);

    if (
      !Number.isFinite(precioNumero) ||
      !Number.isFinite(duracionNumero) ||
      precioNumero <= 0 ||
      duracionNumero <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "El precio y la duración deben ser mayores que cero."
      });
    }

    await db.query(
      `INSERT INTO servicios
      (nombre, descripcion, precio, duracion, activo)
      VALUES (?, ?, ?, ?, 1)`,
      [
        nombre.trim(),
        descripcion ? descripcion.trim() : "",
        precioNumero,
        duracionNumero
      ]
    );

    res.status(201).json({
      ok: true,
      message: "¡Servicio agregado correctamente!"
    });

  } catch (error) {
    console.error("Error al agregar servicio:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo agregar el servicio."
    });
  }
});
app.post("/api/admin/servicios", async (req, res) => {
  try {
    const {
      usuario_id,
      nombre,
      descripcion,
      precio,
      duracion
    } = req.body;

    if (!usuario_id || !nombre || !precio || !duracion) {
      return res.status(400).json({
        ok: false,
        message: "Completá todos los campos obligatorios."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (usuarios.length === 0 || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permiso para agregar servicios."
      });
    }

    const precioNumero = Number(precio);
    const duracionNumero = Number(duracion);

    if (
      !Number.isFinite(precioNumero) ||
      !Number.isFinite(duracionNumero) ||
      precioNumero <= 0 ||
      duracionNumero <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "El precio y la duración deben ser mayores que cero."
      });
    }

    await db.query(
      `INSERT INTO servicios
      (nombre, descripcion, precio, duracion, activo)
      VALUES (?, ?, ?, ?, 1)`,
      [
        nombre.trim(),
        descripcion ? descripcion.trim() : "",
        precioNumero,
        duracionNumero
      ]
    );

    res.status(201).json({
      ok: true,
      message: "¡Servicio agregado correctamente!"
    });

  } catch (error) {
    console.error("Error al agregar servicio:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo agregar el servicio."
    });
  }
});

// EDITAR SERVICIO (SOLO ADMIN)
app.put("/api/admin/servicios/:id", async (req, res) => {
  try {
    const { usuario_id, nombre, descripcion, precio, duracion } = req.body;
    const servicioId = Number(req.params.id);

    if (!usuario_id || !nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Completá los campos obligatorios."
      });
    }

    const precioNumero = Number(precio);
    const duracionNumero = Number(duracion);

    if (
      !Number.isInteger(servicioId) ||
      servicioId <= 0 ||
      !Number.isFinite(precioNumero) ||
      !Number.isFinite(duracionNumero) ||
      precioNumero <= 0 ||
      duracionNumero <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "Revisá el precio, la duración y el servicio."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      `UPDATE servicios
       SET nombre = ?, descripcion = ?, precio = ?, duracion = ?
       WHERE id = ?`,
      [
        nombre.trim(),
        descripcion ? descripcion.trim() : "",
        precioNumero,
        duracionNumero,
        servicioId
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró el servicio."
      });
    }

    res.json({
      ok: true,
      message: "¡Servicio actualizado correctamente!"
    });

  } catch (error) {
    console.error("Error al editar servicio:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el servicio."
    });
  }
});

app.put("/api/admin/servicios/:id/desactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const servicioId = Number(req.params.id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos para realizar esta acción."
      });
    }

    const [resultado] = await db.query(
      "UPDATE servicios SET activo = 0 WHERE id = ?",
      [servicioId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró el servicio."
      });
    }

    res.json({
      ok: true,
      message: "Servicio desactivado correctamente."
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "No se pudo desactivar el servicio."
    });
  }
});

app.put("/api/admin/servicios/:id/reactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const servicioId = Number(req.params.id);

    if (!usuario_id || !Number.isInteger(servicioId) || servicioId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Datos incorrectos."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      "UPDATE servicios SET activo = 1 WHERE id = ?",
      [servicioId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró el servicio."
      });
    }

    res.json({
      ok: true,
      message: "¡Servicio reactivado correctamente!"
    });

  } catch (error) {
    console.error("Error al reactivar servicio:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo reactivar el servicio."
    });
  }
});

// LISTAR TODOS LOS SERVICIOS (SOLO ADMIN)
app.get("/api/admin/servicios/:usuario_id", async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuario_id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [servicios] = await db.query(`
      SELECT id, nombre, descripcion, precio, duracion, activo
      FROM servicios
      ORDER BY activo DESC, nombre ASC
    `);

    res.json({
      ok: true,
      servicios
    });

  } catch (error) {
    console.error("Error al cargar servicios del administrador:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los servicios."
    });
  }
});
app.post("/api/admin/promociones", async (req, res) => {
  try {
    const {
      usuario_id,
      titulo,
      descripcion,
      descuento,
      fecha_inicio,
      fecha_fin
    } = req.body;

    if (!usuario_id || !titulo || !descuento ||
        !fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        ok: false,
        message: "Completá todos los campos obligatorios."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    if (
      Number(descuento) <= 0 ||
      Number(descuento) > 100 ||
      new Date(fecha_fin) < new Date(fecha_inicio)
    ) {
      return res.status(400).json({
        ok: false,
        message: "Revisá el descuento y las fechas."
      });
    }

    await db.query(
      `INSERT INTO promociones
      (titulo, descripcion, descuento, fecha_inicio, fecha_fin, activa)
      VALUES (?, ?, ?, ?, ?, 1)`,
      [
        titulo.trim(),
        descripcion || "",
        Number(descuento),
        fecha_inicio,
        fecha_fin
      ]
    );

    res.json({
      ok: true,
      message: "¡Promoción agregada correctamente!"
    });

  } catch (error) {
    console.error("Error al agregar promoción:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo agregar la promoción."
    });
  }
});

app.get("/api/admin/promociones/:usuario_id", async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuario_id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [promociones] = await db.query(`
      SELECT id, titulo, descripcion, descuento,
             fecha_inicio, fecha_fin, activa
      FROM promociones
      ORDER BY fecha_inicio DESC
    `);

    res.json({
      ok: true,
      promociones
    });

  } catch (error) {
    console.error("Error al listar promociones:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron cargar las promociones."
    });
  }
});

// EDITAR PROMOCIÓN (SOLO ADMIN)
app.put("/api/admin/promociones/:id", async (req, res) => {
  try {
    const { usuario_id, titulo, descripcion, descuento, fecha_inicio, fecha_fin } = req.body;
    const promocionId = Number(req.params.id);

    if (
      !usuario_id ||
      !Number.isInteger(promocionId) ||
      promocionId <= 0 ||
      !titulo?.trim() ||
      !fecha_inicio ||
      !fecha_fin ||
      !Number.isFinite(Number(descuento)) ||
      Number(descuento) <= 0 ||
      Number(descuento) > 100 ||
      fecha_fin < fecha_inicio
    ) {
      return res.status(400).json({
        ok: false,
        message: "Revisá los datos de la promoción."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      `UPDATE promociones
       SET titulo = ?, descripcion = ?, descuento = ?,
           fecha_inicio = ?, fecha_fin = ?
       WHERE id = ?`,
      [
        titulo.trim(),
        descripcion || "",
        Number(descuento),
        fecha_inicio,
        fecha_fin,
        promocionId
      ]
    );

    if (resultado.affectedRows === 0) {
      const [existe] = await db.query(
        "SELECT id FROM promociones WHERE id = ?",
        [promocionId]
      );

      if (!existe.length) {
        return res.status(404).json({
          ok: false,
          message: "No se encontró la promoción."
        });
      }
    }

    res.json({
      ok: true,
      message: "¡Promoción actualizada correctamente!"
    });

  } catch (error) {
    console.error("Error al editar promoción:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo actualizar la promoción."
    });
  }
});

// DESACTIVAR PROMOCIÓN (SOLO ADMIN)
app.put("/api/admin/promociones/:id/desactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const promocionId = Number(req.params.id);
    console.log("LLEGO A DESACTIVAR PROMOCION", promocionId);

    if (!usuario_id || !Number.isInteger(promocionId) || promocionId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Datos incorrectos."
      });
    }

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    console.log("ID de promoción recibido:", promocionId);

const [resultado] = await db.query(
  "UPDATE promociones SET activa = 0 WHERE id = ?",
  [promocionId]
);

console.log("Filas modificadas:", resultado.affectedRows);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la promoción."
      });
    }

    res.json({
      ok: true,
      message: "¡Promoción desactivada correctamente!"
    });

  } catch (error) {
    console.error("Error al desactivar promoción:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudo desactivar la promoción."
    });
  }
});

app.put("/api/admin/promociones/:id/reactivar", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    const promocionId = Number(req.params.id);

    const [usuarios] = await db.query(
      "SELECT rol FROM usuarios WHERE id = ?",
      [usuario_id]
    );

    if (!usuarios.length || usuarios[0].rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tenés permisos de administrador."
      });
    }

    const [resultado] = await db.query(
      "UPDATE promociones SET activa = 1 WHERE id = ?",
      [promocionId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la promoción."
      });
    }

    res.json({
      ok: true,
      message: "¡Promoción reactivada correctamente!"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "No se pudo reactivar la promoción."
    });
  }
});


app.listen(PORT, () => {
  console.log(`Barbería Premium disponible en http://localhost:${PORT}`);
});


