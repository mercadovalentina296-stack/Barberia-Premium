 async function apiRequest(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "No se pudo completar la solicitud."
    );
  }

  return data;
}

// Obtener servicios.
async function obtenerServicios() {
  const data = await apiRequest("/api/servicios");
  return data.servicios;
}

// Guardar usuario que inició sesión.
function guardarUsuario(usuario) {
  sessionStorage.setItem("usuario", JSON.stringify(usuario));
}

// Obtener usuario de la sesión.
function obtenerUsuario() {
  const usuario = sessionStorage.getItem("usuario");
  return usuario ? JSON.parse(usuario) : null;
}

// Cerrar sesión.
function cerrarSesion() {
  sessionStorage.removeItem("usuario");
}