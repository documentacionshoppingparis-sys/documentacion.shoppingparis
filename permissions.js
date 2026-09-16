/**
 * permissions.js
 * Matriz de roles y permisos utilizada por la interfaz (UX/visibilidad).
 *
 * IMPORTANTE: esta matriz controla qué ve y qué puede hacer el usuario en pantalla,
 * pero NO reemplaza la seguridad real, que está implementada en firestore.rules.
 * Cualquier permiso definido aquí debe tener su equivalente verificado en las reglas.
 */

const ROLES = {
  ADMIN: "admin",
  SOLICITANTE: "solicitante",
  APROBADOR: "aprobador",
  TESORERIA: "tesoreria",
  AUDITOR: "auditor",
};

const ROLES_LABELS = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.SOLICITANTE]: "Solicitante",
  [ROLES.APROBADOR]: "Aprobador",
  [ROLES.TESORERIA]: "Tesorería",
  [ROLES.AUDITOR]: "Consulta / Auditor",
};

// Matriz permiso -> roles habilitados.
// Se puede ampliar sin modificar el resto de la aplicación.
const PERMISOS = {
  verEmpresas: [ROLES.ADMIN, ROLES.SOLICITANTE, ROLES.APROBADOR, ROLES.TESORERIA, ROLES.AUDITOR],
  administrarEmpresas: [ROLES.ADMIN],
  administrarTiendas: [ROLES.ADMIN],
  administrarSectores: [ROLES.ADMIN],
  administrarProveedores: [ROLES.ADMIN, ROLES.SOLICITANTE],
  administrarPersonas: [ROLES.ADMIN],
  administrarResponsables: [ROLES.ADMIN],
  crearPresupuestos: [ROLES.ADMIN, ROLES.SOLICITANTE],
  aprobarPresupuestos: [ROLES.ADMIN, ROLES.APROBADOR],
  crearOrdenes: [ROLES.ADMIN, ROLES.SOLICITANTE],
  aprobarOrdenes: [ROLES.ADMIN, ROLES.APROBADOR],
  procesarPagos: [ROLES.ADMIN, ROLES.TESORERIA],
  generarPDF: [ROLES.ADMIN, ROLES.SOLICITANTE, ROLES.APROBADOR, ROLES.TESORERIA, ROLES.AUDITOR],
  consultarHistorial: [ROLES.ADMIN, ROLES.SOLICITANTE, ROLES.APROBADOR, ROLES.TESORERIA, ROLES.AUDITOR],
  administrarUsuarios: [ROLES.ADMIN],
};

/**
 * Determina si un rol tiene un permiso determinado.
 * @param {string} rol
 * @param {string} permiso - clave de PERMISOS
 * @returns {boolean}
 */
function hasPermission(rol, permiso) {
  if (!rol || !PERMISOS[permiso]) return false;
  return PERMISOS[permiso].includes(rol);
}
