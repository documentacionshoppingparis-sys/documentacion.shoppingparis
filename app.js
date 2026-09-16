/**
 * app.js
 * Componentes React, navegación y lógica de negocio del cliente.
 * Sin proceso de build: JSX transformado en el navegador por Babel Standalone.
 *
 * Regla central del proyecto:
 * El PDF es una representación del documento; el verdadero documento administrativo
 * es el registro estructurado, trazable e histórico almacenado en Firestore.
 */

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ==========================================================================
// CONSTANTES DE DOMINIO
// ==========================================================================

const ESTADOS = [
  "borrador",
  "pendiente",
  "solicitado",
  "en_aprobacion",
  "aprobado",
  "rechazado",
  "en_tesoreria",
  "pagado",
  "cobrado",
  "anulado",
];

const ESTADOS_LABELS = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  solicitado: "Solicitado",
  en_aprobacion: "En aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  en_tesoreria: "En Tesorería",
  pagado: "Pagado",
  cobrado: "Cobrado",
  anulado: "Anulado",
};

const MONEDAS = ["PYG", "USD", "BRL"];

// Tipos de Orden de Pago. Los conceptos de RR.HH. (comisiones, incentivos, etc.)
// se resuelven con el campo `concepto`, sin crear un tipo documental por cada uno
// (ver sección 13 del documento maestro).
const TIPOS_ORDEN = {
  productos: { label: "Orden de Pago - Productos", contador: "ordenPagoProductos" },
  servicios: { label: "Orden de Pago - Servicios", contador: "ordenPagoServicios" },
  // Un solo tipo para RR.HH.: funcionarios, comisiones, incentivos y bonificaciones
  // se distinguen con el campo "concepto", sin crear un tipo documental por cada uno
  // (sección 13 del documento maestro).
  rrhh: { label: "Orden de Pago - RR.HH.", contador: "ordenPagoRRHH" },
};

const CONCEPTOS_RRHH = ["Pago a funcionario", "Comisión", "Incentivo", "Bonificación", "Otro"];

const SECTORES_INICIALES = [
  "Operacional", "Servicios Generales", "Electromecánica", "Seguridad",
  "Marketing", "Tesorería", "RR.HH.", "Comercial", "Obras",
];

// ==========================================================================
// HELPERS DE DATOS
// ==========================================================================

/**
 * Obtiene el próximo número secuencial para un tipo documental usando una
 * transacción atómica sobre contadores/{tipoContador}. No depende del ID
 * aleatorio de Firestore (sección 19).
 */
async function obtenerSiguienteNumero(tipoContador) {
  const ref = db.collection("contadores").doc(tipoContador);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const actual = snap.exists ? (snap.data().ultimo || 0) : 0;
    const siguiente = actual + 1;
    tx.set(ref, { ultimo: siguiente }, { merge: true });
    return siguiente;
  });
}

/** Registra una entrada de auditoría. No depende de textos visibles en pantalla. */
async function registrarAuditoria({ accion, documentoId, documentoTipo, perfil, estadoAnterior, estadoNuevo, detalle }) {
  await db.collection("auditoria").add({
    accion,
    documentoId: documentoId || null,
    documentoTipo: documentoTipo || null,
    usuarioUid: perfil ? perfil.uid : null,
    usuarioNombre: perfil ? perfil.nombre : null,
    estadoAnterior: estadoAnterior || null,
    estadoNuevo: estadoNuevo || null,
    detalle: detalle || null,
    fecha: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

function formatMoneda(valor, moneda) {
  const n = Number(valor || 0);
  return `${moneda || "PYG"} ${n.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`;
}

function fechaLegible(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-PY");
}

/** Suscripción en tiempo real a una colección, con filtros opcionales. */
function useColeccion(nombre, { activosSolo = false, where = [], orderBy = null } = {}) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let ref = db.collection(nombre);
    where.forEach(([campo, op, valor]) => {
      if (valor !== undefined && valor !== null && valor !== "") ref = ref.where(campo, op, valor);
    });
    if (activosSolo) ref = ref.where("activo", "==", true);
    if (orderBy) ref = ref.orderBy(orderBy[0], orderBy[1] || "asc");

    const unsub = ref.onSnapshot(
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(`Error leyendo ${nombre}:`, err);
        setCargando(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, activosSolo, JSON.stringify(where), orderBy ? orderBy.join(",") : null]);

  return { items, cargando };
}

// ==========================================================================
// AUTENTICACIÓN
// ==========================================================================

function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [perfil, setPerfil] = useState(null);
  const [errorPerfil, setErrorPerfil] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u || null);
      setErrorPerfil(null);
      if (u) {
        try {
          const snap = await db.collection("usuarios").doc(u.uid).get();
          if (!snap.exists) {
            setErrorPerfil("Tu cuenta no tiene un perfil registrado en el sistema. Contactá a un administrador.");
            setPerfil(null);
            return;
          }
          const data = snap.data();
          if (data.activo === false) {
            setErrorPerfil("Tu usuario está desactivado. Contactá a un administrador.");
            setPerfil(null);
            return;
          }
          setPerfil({ uid: u.uid, ...data });
        } catch (e) {
          console.error(e);
          setErrorPerfil("No se pudo cargar tu perfil de usuario.");
        }
      } else {
        setPerfil(null);
      }
    });
    return () => unsub();
  }, []);

  const logout = useCallback(() => auth.signOut(), []);
  return { user, perfil, errorPerfil, logout };
}

function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      setError("No se pudo iniciar sesión. Verificá tus credenciales.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-box" onSubmit={onSubmit}>
        <h1>Sistema Administrativo Multiempresa</h1>
        <p className="subtitle">Iniciá sesión para continuar</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
        <button type="submit" disabled={cargando}>{cargando ? "Ingresando..." : "Ingresar"}</button>
        <p className="version">v{typeof APP_VERSION !== "undefined" ? APP_VERSION : ""}</p>
      </form>
    </div>
  );
}

// ==========================================================================
// LAYOUT: SIDEBAR + TOPBAR
// ==========================================================================

const MENU = [
  { vista: "dashboard", label: "Dashboard", permiso: null },
  { grupo: "Documentos" },
  { vista: "presupuestos", label: "Presupuestos", permiso: "crearPresupuestos" },
  { vista: "orden_productos", label: "Orden de Pago - Productos", permiso: "crearOrdenes" },
  { vista: "orden_servicios", label: "Orden de Pago - Servicios", permiso: "crearOrdenes" },
  { vista: "orden_rrhh", label: "Orden de Pago - RR.HH.", permiso: "crearOrdenes" },
  { vista: "ordenes_cobro", label: "Órdenes de Cobro", permiso: "crearOrdenes" },
  { grupo: "Maestros" },
  { vista: "empresas", label: "Empresas", permiso: "verEmpresas" },
  { vista: "tiendas", label: "Tiendas / Sucursales", permiso: "verEmpresas" },
  { vista: "sectores", label: "Sectores", permiso: "verEmpresas" },
  { vista: "personas", label: "Personas", permiso: "verEmpresas" },
  { vista: "proveedores", label: "Proveedores", permiso: "verEmpresas" },
  { grupo: "Administración" },
  { vista: "usuarios", label: "Usuarios", permiso: "administrarUsuarios" },
  { grupo: "Consultas" },
  { vista: "historial", label: "Historial / Auditoría", permiso: "consultarHistorial" },
];

function Sidebar({ perfil, vista, setVista }) {
  return (
    <nav className="sidebar">
      <div className="brand">Sistema Multiempresa</div>
      <ul>
        {MENU.map((item, i) =>
          item.grupo ? (
            <li key={`g-${i}`} className="menu-grupo">{item.grupo}</li>
          ) : (!item.permiso || hasPermission(perfil.rol, item.permiso)) ? (
            <li key={item.vista} className={vista === item.vista ? "activo" : ""} onClick={() => setVista(item.vista)}>
              {item.label}
            </li>
          ) : null
        )}
      </ul>
    </nav>
  );
}

function TopBar({ perfil, onLogout }) {
  return (
    <header className="topbar">
      <span>{perfil.nombre} · {ROLES_LABELS[perfil.rol] || perfil.rol}</span>
      <button className="btn-secundario" onClick={onLogout}>Cerrar sesión</button>
    </header>
  );
}

// ==========================================================================
// COMPONENTES DE FORMULARIO GENÉRICOS
// ==========================================================================

function Campo({ campo, valor, onChange, opciones }) {
  if (campo.tipo === "imagen") {
    return (
      <div className="campo-imagen">
        {valor && <img src={valor} alt="Logo" className="logo-preview" />}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 400 * 1024) {
              alert("La imagen es muy grande. Usá un logo de hasta 400 KB (ideal: PNG con fondo transparente).");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result);
            reader.readAsDataURL(file);
          }}
        />
        {valor && <button type="button" className="btn-link" onClick={() => onChange("")}>Quitar logo</button>}
      </div>
    );
  }
  if (campo.tipo === "select") {
    return (
      <select value={valor || ""} onChange={(e) => onChange(e.target.value)} required={campo.requerido}>
        <option value="">Seleccionar...</option>
        {(opciones || campo.opciones || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (campo.tipo === "textarea") {
    return <textarea value={valor || ""} onChange={(e) => onChange(e.target.value)} required={campo.requerido} />;
  }
  return (
    <input
      type={campo.tipo || "text"}
      value={valor === undefined || valor === null ? "" : valor}
      onChange={(e) => onChange(campo.tipo === "number" ? e.target.value : e.target.value)}
      required={campo.requerido}
    />
  );
}

/**
 * CRUD genérico para colecciones "maestro": empresas, tiendas, sectores,
 * personas, proveedores. No eliminan físicamente: usan baja lógica (activo).
 */
function MaestroCRUD({ titulo, coleccion, campos, permisoAdmin, perfil, resolverOpciones }) {
  const puedeAdministrar = hasPermission(perfil.rol, permisoAdmin);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const { items, cargando } = useColeccion(coleccion);
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, {...} = edición
  const [opciones, setOpciones] = useState({});

  useEffect(() => {
    let activo = true;
    if (resolverOpciones) {
      resolverOpciones().then((r) => { if (activo) setOpciones(r); });
    }
    return () => { activo = false; };
  }, [resolverOpciones]);

  const visibles = items.filter((i) => mostrarInactivos || i.activo !== false);

  const abrirNuevo = () => {
    const base = {};
    campos.forEach((c) => { base[c.campo] = c.default !== undefined ? c.default : ""; });
    setEditando(base);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const datos = { ...editando };
    const id = datos.id;
    delete datos.id;
    if (id) {
      datos.fechaModificacion = firebase.firestore.FieldValue.serverTimestamp();
      datos.modificadoPor = perfil.nombre;
      await db.collection(coleccion).doc(id).update(datos);
      await registrarAuditoria({ accion: "EDICION_MAESTRO", documentoId: id, documentoTipo: coleccion, perfil });
    } else {
      datos.activo = datos.activo !== undefined ? datos.activo : true;
      datos.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
      datos.creadoPor = perfil.nombre;
      const ref = await db.collection(coleccion).add(datos);
      await registrarAuditoria({ accion: "CREACION_MAESTRO", documentoId: ref.id, documentoTipo: coleccion, perfil });
    }
    setEditando(null);
  };

  const toggleActivo = async (item) => {
    await db.collection(coleccion).doc(item.id).update({
      activo: !item.activo,
      fechaModificacion: firebase.firestore.FieldValue.serverTimestamp(),
      modificadoPor: perfil.nombre,
    });
    await registrarAuditoria({
      accion: item.activo ? "DESACTIVACION" : "ACTIVACION",
      documentoId: item.id,
      documentoTipo: coleccion,
      perfil,
    });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>{titulo}</h2>
        <div className="panel-header-acciones">
          <label className="chk-inline">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
          {puedeAdministrar && <button onClick={abrirNuevo}>+ Nuevo</button>}
        </div>
      </div>

      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead>
            <tr>
              {campos.filter((c) => c.enLista !== false).map((c) => <th key={c.campo}>{c.label}</th>)}
              <th>Estado</th>
              {puedeAdministrar && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((item) => (
              <tr key={item.id} className={item.activo === false ? "fila-inactiva" : ""}>
                {campos.filter((c) => c.enLista !== false).map((c) => (
                  <td key={c.campo}>
                    {c.tipo === "imagen" ? (
                      item[c.campo] ? <img src={item[c.campo]} alt="Logo" className="logo-thumb" /> : "-"
                    ) : c.tipo === "select" ? (
                      (opciones[c.campo] || {})[item[c.campo]] || item[c.campo]
                    ) : (
                      String(item[c.campo] ?? "")
                    )}
                  </td>
                ))}
                <td><span className={`badge ${item.activo === false ? "badge-gris" : "badge-verde"}`}>{item.activo === false ? "Inactivo" : "Activo"}</span></td>
                {puedeAdministrar && (
                  <td className="acciones-celda">
                    <button className="btn-link" onClick={() => setEditando({ id: item.id, ...item })}>Editar</button>
                    <button className="btn-link" onClick={() => toggleActivo(item)}>{item.activo === false ? "Activar" : "Desactivar"}</button>
                  </td>
                )}
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan="10">Sin registros.</td></tr>}
          </tbody>
        </table>
      )}

      {editando && (
        <div className="modal-fondo" onClick={() => setEditando(null)}>
          <form className="modal-caja" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>{editando.id ? "Editar" : "Nuevo"} {titulo}</h3>
            {campos.map((c) => (
              <div className="campo-form" key={c.campo}>
                <label>{c.label}{c.requerido && " *"}</label>
                <Campo campo={c} valor={editando[c.campo]} opciones={c.tipo === "select" ? c.opcionesResueltas || c.opciones : null}
                  onChange={(v) => setEditando({ ...editando, [c.campo]: v })} />
              </div>
            ))}
            <div className="modal-acciones">
              <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// MAESTROS CONCRETOS
// ==========================================================================

function Empresas({ perfil }) {
  return (
    <MaestroCRUD
      titulo="Empresas" coleccion="empresas" perfil={perfil} permisoAdmin="administrarEmpresas"
      campos={[
        { campo: "logoBase64", label: "Logo", tipo: "imagen" },
        { campo: "razonSocial", label: "Razón social", requerido: true },
        { campo: "nombreComercial", label: "Nombre comercial" },
        { campo: "ruc", label: "RUC", requerido: true },
        { campo: "direccion", label: "Dirección" },
        { campo: "telefono", label: "Teléfono" },
        { campo: "correo", label: "Correo", tipo: "email" },
      ]}
    />
  );
}

function Tiendas({ perfil }) {
  const { items: empresas } = useColeccion("empresas", { activosSolo: true });
  const opcionesEmpresa = empresas.map((e) => ({ value: e.id, label: e.razonSocial }));
  const mapaEmpresas = Object.fromEntries(empresas.map((e) => [e.id, e.razonSocial]));
  return (
    <MaestroCRUD
      titulo="Tiendas / Sucursales" coleccion="tiendas" perfil={perfil} permisoAdmin="administrarTiendas"
      resolverOpciones={async () => ({ empresaId: mapaEmpresas })}
      campos={[
        { campo: "empresaId", label: "Empresa", tipo: "select", opciones: opcionesEmpresa, requerido: true },
        { campo: "cod", label: "Código (COD)", requerido: true },
        { campo: "nombre", label: "Nombre de tienda/sucursal", requerido: true },
        { campo: "direccion", label: "Dirección" },
        { campo: "observaciones", label: "Observaciones", tipo: "textarea" },
      ]}
    />
  );
}

function Sectores({ perfil }) {
  return (
    <MaestroCRUD
      titulo="Sectores" coleccion="sectores" perfil={perfil} permisoAdmin="administrarSectores"
      campos={[
        { campo: "nombre", label: "Nombre del sector", requerido: true },
        { campo: "descripcion", label: "Descripción" },
      ]}
    />
  );
}

function Personas({ perfil }) {
  const { items: empresas } = useColeccion("empresas", { activosSolo: true });
  const { items: sectores } = useColeccion("sectores", { activosSolo: true });
  const opcionesEmpresa = empresas.map((e) => ({ value: e.id, label: e.razonSocial }));
  const opcionesSector = sectores.map((s) => ({ value: s.id, label: s.nombre }));
  const mapaEmpresas = Object.fromEntries(empresas.map((e) => [e.id, e.razonSocial]));
  const mapaSectores = Object.fromEntries(sectores.map((s) => [s.id, s.nombre]));
  return (
    <MaestroCRUD
      titulo="Personas / Responsables" coleccion="personas" perfil={perfil} permisoAdmin="administrarPersonas"
      resolverOpciones={async () => ({ empresaId: mapaEmpresas, sectorId: mapaSectores })}
      campos={[
        { campo: "nombre", label: "Nombre", requerido: true },
        { campo: "apellido", label: "Apellido", requerido: true },
        { campo: "documento", label: "Documento de identidad" },
        { campo: "cargo", label: "Cargo" },
        { campo: "empresaId", label: "Empresa", tipo: "select", opciones: opcionesEmpresa },
        { campo: "sectorId", label: "Sector", tipo: "select", opciones: opcionesSector },
        { campo: "correo", label: "Correo", tipo: "email" },
        { campo: "telefono", label: "Teléfono" },
      ]}
    />
  );
}

function Proveedores({ perfil }) {
  return (
    <MaestroCRUD
      titulo="Proveedores" coleccion="proveedores" perfil={perfil} permisoAdmin="administrarProveedores"
      campos={[
        { campo: "razonSocial", label: "Razón social", requerido: true },
        { campo: "nombreComercial", label: "Nombre comercial" },
        { campo: "ruc", label: "RUC", requerido: true },
        { campo: "direccion", label: "Dirección" },
        { campo: "telefono", label: "Teléfono" },
        { campo: "correo", label: "Correo" },
        { campo: "contacto", label: "Contacto" },
        { campo: "datosBancarios", label: "Datos bancarios", tipo: "textarea" },
        { campo: "observaciones", label: "Observaciones", tipo: "textarea" },
      ]}
    />
  );
}

function Usuarios({ perfil }) {
  const { items, cargando } = useColeccion("usuarios");
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState("");
  const puedeAdministrar = hasPermission(perfil.rol, "administrarUsuarios");

  const crearUsuario = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Se usa la app secundaria de Authentication para no cerrar la sesión del admin (sección 39)
      const cred = await secondaryAuth.createUserWithEmailAndPassword(editando.email, editando.password);
      const uid = cred.user.uid;
      await db.collection("usuarios").doc(uid).set({
        nombre: editando.nombre,
        email: editando.email,
        rol: editando.rol,
        activo: true,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        creadoPor: perfil.nombre,
      });
      await secondaryAuth.signOut();
      await registrarAuditoria({ accion: "CREACION_USUARIO", documentoId: uid, documentoTipo: "usuarios", perfil });
      setEditando(null);
    } catch (err) {
      setError(err.message || "No se pudo crear el usuario.");
    }
  };

  const toggleActivo = async (item) => {
    await db.collection("usuarios").doc(item.id).update({ activo: !item.activo });
    await registrarAuditoria({
      accion: item.activo ? "DESACTIVACION_USUARIO" : "ACTIVACION_USUARIO",
      documentoId: item.id, documentoTipo: "usuarios", perfil,
    });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Usuarios</h2>
        {puedeAdministrar && <button onClick={() => setEditando({ nombre: "", email: "", password: "", rol: ROLES.SOLICITANTE })}>+ Nuevo</button>}
      </div>
      <p className="nota">Desactivar un usuario aquí no elimina su cuenta de Firebase Authentication; solo le impide operar en el sistema.</p>
      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>{puedeAdministrar && <th>Acciones</th>}</tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className={u.activo === false ? "fila-inactiva" : ""}>
                <td>{u.nombre}</td><td>{u.email}</td><td>{ROLES_LABELS[u.rol] || u.rol}</td>
                <td><span className={`badge ${u.activo === false ? "badge-gris" : "badge-verde"}`}>{u.activo === false ? "Inactivo" : "Activo"}</span></td>
                {puedeAdministrar && <td><button className="btn-link" onClick={() => toggleActivo(u)}>{u.activo === false ? "Activar" : "Desactivar"}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editando && (
        <div className="modal-fondo" onClick={() => setEditando(null)}>
          <form className="modal-caja" onClick={(e) => e.stopPropagation()} onSubmit={crearUsuario}>
            <h3>Nuevo usuario</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="campo-form"><label>Nombre *</label><input required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></div>
            <div className="campo-form"><label>Correo *</label><input type="email" required value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} /></div>
            <div className="campo-form"><label>Contraseña provisoria *</label><input type="password" required minLength={6} value={editando.password} onChange={(e) => setEditando({ ...editando, password: e.target.value })} /></div>
            <div className="campo-form">
              <label>Rol *</label>
              <select value={editando.rol} onChange={(e) => setEditando({ ...editando, rol: e.target.value })}>
                {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLES_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="modal-acciones">
              <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit">Crear</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// DETALLE DE LÍNEAS (cabecera + detalle, sección 28)
// ==========================================================================

function DetalleLineas({ lineas, setLineas }) {
  const agregar = () => setLineas([...lineas, { descripcion: "", cantidad: 1, precioUnitario: 0 }]);
  const quitar = (i) => setLineas(lineas.filter((_, idx) => idx !== i));
  const actualizar = (i, campo, valor) => {
    const copia = [...lineas];
    copia[i] = { ...copia[i], [campo]: valor };
    setLineas(copia);
  };
  const total = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);

  return (
    <div className="detalle-lineas">
      <table className="tabla tabla-compacta">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr></thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i}>
              <td><input value={l.descripcion} onChange={(e) => actualizar(i, "descripcion", e.target.value)} required /></td>
              <td><input type="number" min="0" step="1" value={l.cantidad} onChange={(e) => actualizar(i, "cantidad", e.target.value)} /></td>
              <td><input type="number" min="0" step="0.01" value={l.precioUnitario} onChange={(e) => actualizar(i, "precioUnitario", e.target.value)} /></td>
              <td>{((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0)).toLocaleString("es-PY")}</td>
              <td><button type="button" className="btn-link" onClick={() => quitar(i)}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn-secundario" onClick={agregar}>+ Agregar línea</button>
      <p className="total-detalle">Total: {total.toLocaleString("es-PY")}</p>
    </div>
  );
}

// ==========================================================================
// SELECTS DE CONTEXTO (empresa / tienda / sector / proveedor)
// ==========================================================================

function useContextoSelects() {
  const { items: empresas } = useColeccion("empresas", { activosSolo: true });
  const { items: tiendas } = useColeccion("tiendas", { activosSolo: true });
  const { items: sectores } = useColeccion("sectores", { activosSolo: true });
  const { items: personas } = useColeccion("personas", { activosSolo: true });
  const { items: proveedores } = useColeccion("proveedores", { activosSolo: true });
  return { empresas, tiendas, sectores, personas, proveedores };
}

// ==========================================================================
// GENERACIÓN DE PDF (jsPDF)
// ==========================================================================

function generarPDF(titulo, doc, empresa) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  const margenIzq = 14;
  let y = 18;

  // Logo de la empresa emisora, si tiene uno cargado en su registro (Maestros > Empresas)
  if (empresa && empresa.logoBase64) {
    try {
      const formato = empresa.logoBase64.indexOf("image/png") !== -1 ? "PNG" : "JPEG";
      pdf.addImage(empresa.logoBase64, formato, margenIzq, 10, 26, 18);
    } catch (e) {
      console.warn("No se pudo insertar el logo en el PDF:", e);
    }
  }

  // Título centrado
  pdf.setFontSize(15);
  pdf.setFont(undefined, "bold");
  pdf.text(titulo, 105, 17, { align: "center" });
  pdf.setFont(undefined, "normal");

  // Caja con N.° de documento y fecha, arriba a la derecha
  pdf.setFontSize(9);
  pdf.rect(150, 9, 46, 14);
  pdf.text(`N.°: ${doc.numero ?? "-"}`, 152, 14);
  pdf.text(`Fecha: ${fechaLegible(doc.fecha)}`, 152, 20);

  y = 33;
  pdf.setDrawColor(180);
  pdf.line(margenIzq, y, 196, y);
  y += 6;

  // Datos de la empresa emisora
  if (empresa) {
    pdf.setFontSize(9);
    const linea1 = empresa.razonSocial + (empresa.ruc ? `  ·  RUC: ${empresa.ruc}` : "");
    pdf.text(linea1, margenIzq, y); y += 5;
    if (empresa.direccion) { pdf.text(empresa.direccion, margenIzq, y); y += 5; }
    y += 2;
  }

  pdf.setFontSize(10);
  pdf.text(`Empresa: ${doc.empresaNombre || "-"}`, 14, y); y += 6;
  pdf.text(`Tienda: ${doc.tiendaNombre || "-"}`, 14, y); y += 6;
  pdf.text(`Sector: ${doc.sectorNombre || "-"}`, 14, y); y += 6;
  if (doc.proveedorNombre) { pdf.text(`Proveedor: ${doc.proveedorNombre}`, 14, y); y += 6; }
  if (doc.solicitadoPor) { pdf.text(`Solicitado por: ${doc.solicitadoPor.nombre} (${doc.solicitadoPor.cargo || "-"})`, 14, y); y += 6; }
  if (doc.aprobadoPor) { pdf.text(`Aprobado por: ${doc.aprobadoPor.nombre} (${doc.aprobadoPor.cargo || "-"})`, 14, y); y += 6; }
  pdf.text(`Estado: ${ESTADOS_LABELS[doc.estado] || doc.estado}`, 14, y); y += 8;

  if (Array.isArray(doc.detalle) && doc.detalle.length) {
    pdf.setFontSize(9);
    pdf.text("Descripción", 14, y);
    pdf.text("Cant.", 110, y);
    pdf.text("P. Unit.", 135, y);
    pdf.text("Subtotal", 165, y);
    y += 4;
    pdf.line(14, y, 196, y); y += 5;
    doc.detalle.forEach((l) => {
      const sub = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
      pdf.text(String(l.descripcion || ""), 14, y);
      pdf.text(String(l.cantidad || 0), 110, y);
      pdf.text(String(l.precioUnitario || 0), 135, y);
      pdf.text(String(sub), 165, y);
      y += 6;
    });
    y += 4;
  }

  pdf.setFontSize(11);
  pdf.text(`Total: ${formatMoneda(doc.total, doc.moneda)}`, 14, y); y += 8;
  if (doc.observaciones) { pdf.setFontSize(9); pdf.text(`Observaciones: ${doc.observaciones}`, 14, y); }

  pdf.save(`${titulo.replace(/\s+/g, "_")}_${doc.numero || "s-n"}.pdf`);
}

// ==========================================================================
// PRESUPUESTOS
// ==========================================================================

function Presupuestos({ perfil }) {
  const { empresas, tiendas, sectores, personas, proveedores } = useContextoSelects();
  const { items, cargando } = useColeccion("presupuestos", { orderBy: ["numero", "desc"] });
  const [form, setForm] = useState(null);
  const puedeCrear = hasPermission(perfil.rol, "crearPresupuestos");
  const puedeAprobar = hasPermission(perfil.rol, "aprobarPresupuestos");

  const abrirNuevo = () => setForm({
    empresaId: "", tiendaId: "", sectorId: "", proveedorId: "", solicitanteId: "",
    moneda: "PYG", condiciones: "", formaPago: "", prioridad: "normal", observaciones: "",
    detalle: [{ descripcion: "", cantidad: 1, precioUnitario: 0 }],
  });

  const guardar = async (e) => {
    e.preventDefault();
    const empresa = empresas.find((x) => x.id === form.empresaId);
    const tienda = tiendas.find((x) => x.id === form.tiendaId);
    const sector = sectores.find((x) => x.id === form.sectorId);
    const proveedor = proveedores.find((x) => x.id === form.proveedorId);
    const solicitante = personas.find((x) => x.id === form.solicitanteId);
    const total = form.detalle.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);
    const numero = await obtenerSiguienteNumero("presupuestoProveedor");

    const registro = {
      numero,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      empresaId: form.empresaId, empresaNombre: empresa ? empresa.razonSocial : null,
      tiendaId: form.tiendaId || null, tiendaNombre: tienda ? tienda.nombre : null,
      sectorId: form.sectorId || null, sectorNombre: sector ? sector.nombre : null,
      proveedorId: form.proveedorId || null, proveedorNombre: proveedor ? proveedor.razonSocial : null,
      // Copia histórica del solicitante (sección 7): no depende del maestro de personas a futuro.
      solicitadoPor: solicitante ? { personaId: solicitante.id, nombre: `${solicitante.nombre} ${solicitante.apellido}`, cargo: solicitante.cargo || null, sector: sector ? sector.nombre : null } : null,
      moneda: form.moneda, detalle: form.detalle, total,
      condiciones: form.condiciones, formaPago: form.formaPago, prioridad: form.prioridad,
      observaciones: form.observaciones, estado: "pendiente",
      creadoPor: perfil.nombre, creadoPorUid: perfil.uid,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("presupuestos").add(registro);
    await registrarAuditoria({ accion: "CREACION", documentoId: ref.id, documentoTipo: "presupuesto", perfil, estadoNuevo: "pendiente" });
    setForm(null);
  };

  const cambiarEstado = async (item, nuevoEstado) => {
    await db.collection("presupuestos").doc(item.id).update({ estado: nuevoEstado });
    await registrarAuditoria({ accion: nuevoEstado.toUpperCase(), documentoId: item.id, documentoTipo: "presupuesto", perfil, estadoAnterior: item.estado, estadoNuevo: nuevoEstado });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Presupuestos de Proveedor</h2>
        {puedeCrear && <button onClick={abrirNuevo}>+ Nuevo presupuesto</button>}
      </div>
      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead><tr><th>N.º</th><th>Empresa</th><th>Proveedor</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.numero}</td><td>{it.empresaNombre}</td><td>{it.proveedorNombre || "-"}</td>
                <td>{formatMoneda(it.total, it.moneda)}</td>
                <td><span className="badge badge-azul">{ESTADOS_LABELS[it.estado] || it.estado}</span></td>
                <td className="acciones-celda">
                  <button className="btn-link" onClick={() => generarPDF("Presupuesto de Proveedor", it, empresas.find((e) => e.id === it.empresaId))}>PDF</button>
                  {puedeAprobar && it.estado === "pendiente" && (
                    <>
                      <button className="btn-link" onClick={() => cambiarEstado(it, "aprobado")}>Aprobar</button>
                      <button className="btn-link" onClick={() => cambiarEstado(it, "rechazado")}>Rechazar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6">Sin registros.</td></tr>}
          </tbody>
        </table>
      )}

      {form && (
        <div className="modal-fondo" onClick={() => setForm(null)}>
          <form className="modal-caja modal-grande" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>Nuevo Presupuesto</h3>
            <div className="grid-2">
              <div className="campo-form"><label>Empresa *</label>
                <select required value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value, tiendaId: "" })}>
                  <option value="">Seleccionar...</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Tienda / Sucursal</label>
                <select value={form.tiendaId} onChange={(e) => setForm({ ...form, tiendaId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {tiendas.filter((t) => t.empresaId === form.empresaId).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Sector</label>
                <select value={form.sectorId} onChange={(e) => setForm({ ...form, sectorId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Proveedor</label>
                <select value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Solicitante</label>
                <select value={form.solicitanteId} onChange={(e) => setForm({ ...form, solicitanteId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Forma de pago</label><input value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })} /></div>
              <div className="campo-form"><label>Prioridad</label>
                <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                  <option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option>
                </select>
              </div>
            </div>
            <div className="campo-form"><label>Condiciones</label><textarea value={form.condiciones} onChange={(e) => setForm({ ...form, condiciones: e.target.value })} /></div>
            <div className="campo-form"><label>Observaciones</label><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <label>Detalle</label>
            <DetalleLineas lineas={form.detalle} setLineas={(l) => setForm({ ...form, detalle: l })} />
            <div className="modal-acciones">
              <button type="button" className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// ÓRDENES DE PAGO (parametrizada por tipo: productos/servicios/rrhh/funcionarios)
// ==========================================================================

function OrdenesPago({ perfil, tipo }) {
  const meta = TIPOS_ORDEN[tipo];
  const { empresas, tiendas, sectores, personas, proveedores } = useContextoSelects();
  const { items: presupuestosAprobados } = useColeccion("presupuestos", { where: [["estado", "==", "aprobado"]] });
  const { items, cargando } = useColeccion("ordenesPago", { where: [["tipo", "==", tipo]], orderBy: ["numero", "desc"] });
  const [form, setForm] = useState(null);
  const puedeCrear = hasPermission(perfil.rol, "crearOrdenes");
  const puedeAprobar = hasPermission(perfil.rol, "aprobarOrdenes");
  const puedePagar = hasPermission(perfil.rol, "procesarPagos");

  const abrirNuevo = () => setForm({
    empresaId: "", tiendaId: "", sectorId: "", proveedorId: "", solicitanteId: "",
    presupuestoId: "", moneda: "PYG", concepto: "", condicionPago: "", formaPago: "",
    facturas: "", observaciones: "",
    detalle: [{ descripcion: "", cantidad: 1, precioUnitario: 0 }],
  });

  const guardar = async (e) => {
    e.preventDefault();
    const empresa = empresas.find((x) => x.id === form.empresaId);
    const tienda = tiendas.find((x) => x.id === form.tiendaId);
    const sector = sectores.find((x) => x.id === form.sectorId);
    const proveedor = proveedores.find((x) => x.id === form.proveedorId);
    const solicitante = personas.find((x) => x.id === form.solicitanteId);
    const presupuesto = presupuestosAprobados.find((x) => x.id === form.presupuestoId);
    const total = form.detalle.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);
    const numero = await obtenerSiguienteNumero(meta.contador);

    const registro = {
      tipo, numero,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      presupuestoId: form.presupuestoId || null, presupuestoNumero: presupuesto ? presupuesto.numero : null,
      empresaId: form.empresaId, empresaNombre: empresa ? empresa.razonSocial : null,
      tiendaId: form.tiendaId || null, tiendaNombre: tienda ? tienda.nombre : null,
      sectorId: form.sectorId || null, sectorNombre: sector ? sector.nombre : null,
      proveedorId: form.proveedorId || null, proveedorNombre: proveedor ? proveedor.razonSocial : null,
      solicitadoPor: solicitante ? { personaId: solicitante.id, nombre: `${solicitante.nombre} ${solicitante.apellido}`, cargo: solicitante.cargo || null, sector: sector ? sector.nombre : null } : null,
      concepto: form.concepto, moneda: form.moneda, detalle: form.detalle, total,
      condicionPago: form.condicionPago, formaPago: form.formaPago, facturas: form.facturas,
      observaciones: form.observaciones, estado: "pendiente",
      creadoPor: perfil.nombre, creadoPorUid: perfil.uid,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("ordenesPago").add(registro);
    await registrarAuditoria({ accion: "CREACION", documentoId: ref.id, documentoTipo: `ordenPago_${tipo}`, perfil, estadoNuevo: "pendiente" });
    setForm(null);
  };

  const cambiarEstado = async (item, nuevoEstado) => {
    await db.collection("ordenesPago").doc(item.id).update({ estado: nuevoEstado });
    await registrarAuditoria({ accion: nuevoEstado.toUpperCase(), documentoId: item.id, documentoTipo: `ordenPago_${tipo}`, perfil, estadoAnterior: item.estado, estadoNuevo: nuevoEstado });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>{meta.label}</h2>
        {puedeCrear && <button onClick={abrirNuevo}>+ Nueva orden</button>}
      </div>
      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead><tr><th>N.º</th><th>Empresa</th><th>Proveedor / Concepto</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.numero}</td><td>{it.empresaNombre}</td><td>{it.proveedorNombre || it.concepto || "-"}</td>
                <td>{formatMoneda(it.total, it.moneda)}</td>
                <td><span className="badge badge-azul">{ESTADOS_LABELS[it.estado] || it.estado}</span></td>
                <td className="acciones-celda">
                  <button className="btn-link" onClick={() => generarPDF(meta.label, it, empresas.find((e) => e.id === it.empresaId))}>PDF</button>
                  {puedeAprobar && it.estado === "pendiente" && <button className="btn-link" onClick={() => cambiarEstado(it, "aprobado")}>Aprobar</button>}
                  {puedeAprobar && it.estado === "pendiente" && <button className="btn-link" onClick={() => cambiarEstado(it, "rechazado")}>Rechazar</button>}
                  {puedePagar && it.estado === "aprobado" && <button className="btn-link" onClick={() => cambiarEstado(it, "en_tesoreria")}>Enviar a Tesorería</button>}
                  {puedePagar && it.estado === "en_tesoreria" && <button className="btn-link" onClick={() => cambiarEstado(it, "pagado")}>Marcar pagado</button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6">Sin registros.</td></tr>}
          </tbody>
        </table>
      )}

      {form && (
        <div className="modal-fondo" onClick={() => setForm(null)}>
          <form className="modal-caja modal-grande" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>Nueva {meta.label}</h3>
            <div className="grid-2">
              <div className="campo-form"><label>Empresa *</label>
                <select required value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value, tiendaId: "" })}>
                  <option value="">Seleccionar...</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Tienda</label>
                <select value={form.tiendaId} onChange={(e) => setForm({ ...form, tiendaId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {tiendas.filter((t) => t.empresaId === form.empresaId).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Sector</label>
                <select value={form.sectorId} onChange={(e) => setForm({ ...form, sectorId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              {(tipo === "productos" || tipo === "servicios") && (
                <div className="campo-form"><label>Proveedor</label>
                  <select value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
                  </select>
                </div>
              )}
              <div className="campo-form"><label>Presupuesto relacionado</label>
                <select value={form.presupuestoId} onChange={(e) => setForm({ ...form, presupuestoId: e.target.value })}>
                  <option value="">Ninguno</option>
                  {presupuestosAprobados.map((p) => <option key={p.id} value={p.id}>N.º {p.numero} - {p.proveedorNombre || p.empresaNombre}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Solicitante</label>
                <select value={form.solicitanteId} onChange={(e) => setForm({ ...form, solicitanteId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {tipo === "rrhh" && (
                <div className="campo-form"><label>Concepto *</label>
                  <select required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {CONCEPTOS_RRHH.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div className="campo-form"><label>Condición de pago</label><input value={form.condicionPago} onChange={(e) => setForm({ ...form, condicionPago: e.target.value })} /></div>
              <div className="campo-form"><label>Facturas relacionadas</label><input value={form.facturas} onChange={(e) => setForm({ ...form, facturas: e.target.value })} /></div>
            </div>
            <div className="campo-form"><label>Observaciones</label><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <label>Detalle</label>
            <DetalleLineas lineas={form.detalle} setLineas={(l) => setForm({ ...form, detalle: l })} />
            <div className="modal-acciones">
              <button type="button" className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// ÓRDENES DE COBRO
// ==========================================================================

function OrdenesCobro({ perfil }) {
  const { empresas, tiendas, sectores, personas } = useContextoSelects();
  const { items, cargando } = useColeccion("ordenesCobro", { orderBy: ["numero", "desc"] });
  const [form, setForm] = useState(null);
  const puedeCrear = hasPermission(perfil.rol, "crearOrdenes");
  const puedeAprobar = hasPermission(perfil.rol, "aprobarOrdenes");

  const abrirNuevo = () => setForm({
    empresaId: "", tiendaId: "", sectorId: "", responsableId: "",
    obligado: "", concepto: "", moneda: "PYG", importe: 0, observaciones: "",
  });

  const guardar = async (e) => {
    e.preventDefault();
    const empresa = empresas.find((x) => x.id === form.empresaId);
    const tienda = tiendas.find((x) => x.id === form.tiendaId);
    const sector = sectores.find((x) => x.id === form.sectorId);
    const responsable = personas.find((x) => x.id === form.responsableId);
    const numero = await obtenerSiguienteNumero("ordenCobro");
    const registro = {
      numero, fecha: firebase.firestore.FieldValue.serverTimestamp(),
      empresaId: form.empresaId, empresaNombre: empresa ? empresa.razonSocial : null,
      tiendaId: form.tiendaId || null, tiendaNombre: tienda ? tienda.nombre : null,
      sectorId: form.sectorId || null, sectorNombre: sector ? sector.nombre : null,
      obligado: form.obligado, concepto: form.concepto,
      responsablePor: responsable ? { personaId: responsable.id, nombre: `${responsable.nombre} ${responsable.apellido}`, cargo: responsable.cargo || null } : null,
      moneda: form.moneda, total: Number(form.importe) || 0,
      observaciones: form.observaciones, estado: "pendiente",
      creadoPor: perfil.nombre, creadoPorUid: perfil.uid,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("ordenesCobro").add(registro);
    await registrarAuditoria({ accion: "CREACION", documentoId: ref.id, documentoTipo: "ordenCobro", perfil, estadoNuevo: "pendiente" });
    setForm(null);
  };

  const cambiarEstado = async (item, nuevoEstado) => {
    await db.collection("ordenesCobro").doc(item.id).update({ estado: nuevoEstado });
    await registrarAuditoria({ accion: nuevoEstado.toUpperCase(), documentoId: item.id, documentoTipo: "ordenCobro", perfil, estadoAnterior: item.estado, estadoNuevo: nuevoEstado });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Órdenes de Cobro</h2>
        {puedeCrear && <button onClick={abrirNuevo}>+ Nueva orden de cobro</button>}
      </div>
      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead><tr><th>N.º</th><th>Empresa</th><th>Obligado</th><th>Importe</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.numero}</td><td>{it.empresaNombre}</td><td>{it.obligado}</td>
                <td>{formatMoneda(it.total, it.moneda)}</td>
                <td><span className="badge badge-azul">{ESTADOS_LABELS[it.estado] || it.estado}</span></td>
                <td className="acciones-celda">
                  <button className="btn-link" onClick={() => generarPDF("Orden de Cobro", it, empresas.find((e) => e.id === it.empresaId))}>PDF</button>
                  {puedeAprobar && it.estado === "pendiente" && <button className="btn-link" onClick={() => cambiarEstado(it, "cobrado")}>Marcar cobrado</button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6">Sin registros.</td></tr>}
          </tbody>
        </table>
      )}

      {form && (
        <div className="modal-fondo" onClick={() => setForm(null)}>
          <form className="modal-caja" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>Nueva Orden de Cobro</h3>
            <div className="campo-form"><label>Empresa *</label>
              <select required value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
              </select>
            </div>
            <div className="campo-form"><label>Tienda</label>
              <select value={form.tiendaId} onChange={(e) => setForm({ ...form, tiendaId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {tiendas.filter((t) => t.empresaId === form.empresaId).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="campo-form"><label>Sector</label>
              <select value={form.sectorId} onChange={(e) => setForm({ ...form, sectorId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="campo-form"><label>Persona/empresa obligada al pago *</label><input required value={form.obligado} onChange={(e) => setForm({ ...form, obligado: e.target.value })} /></div>
            <div className="campo-form"><label>Concepto *</label><input required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
            <div className="grid-2">
              <div className="campo-form"><label>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="campo-form"><label>Importe *</label><input type="number" min="0" step="0.01" required value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} /></div>
            </div>
            <div className="campo-form"><label>Observaciones</label><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <div className="modal-acciones">
              <button type="button" className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// DASHBOARD
// ==========================================================================

function Dashboard({ perfil }) {
  const { items: presupuestos } = useColeccion("presupuestos");
  const { items: ordenes } = useColeccion("ordenesPago");
  const { items: cobros } = useColeccion("ordenesCobro");
  const { items: auditoria } = useColeccion("auditoria", { orderBy: ["fecha", "desc"] });

  const pendientesPresupuesto = presupuestos.filter((p) => p.estado === "pendiente").length;
  const ordenesEnTesoreria = ordenes.filter((o) => o.estado === "en_tesoreria").length;
  const ordenesPendientes = ordenes.filter((o) => o.estado === "pendiente").length;
  const pagosRealizados = ordenes.filter((o) => o.estado === "pagado").length;
  const cobrosPendientes = cobros.filter((c) => c.estado === "pendiente").length;

  const totalesPorEmpresa = useMemo(() => {
    const acc = {};
    [...presupuestos, ...ordenes].forEach((d) => {
      if (!d.empresaNombre) return;
      acc[d.empresaNombre] = (acc[d.empresaNombre] || 0) + (Number(d.total) || 0);
    });
    return acc;
  }, [presupuestos, ordenes]);

  return (
    <div className="panel">
      <h2>Dashboard</h2>
      <div className="tarjetas">
        <div className="tarjeta"><span className="tarjeta-num">{pendientesPresupuesto}</span><span>Presupuestos pendientes</span></div>
        <div className="tarjeta"><span className="tarjeta-num">{ordenesPendientes}</span><span>Órdenes pendientes</span></div>
        <div className="tarjeta"><span className="tarjeta-num">{ordenesEnTesoreria}</span><span>Documentos en Tesorería</span></div>
        <div className="tarjeta"><span className="tarjeta-num">{pagosRealizados}</span><span>Pagos realizados</span></div>
        <div className="tarjeta"><span className="tarjeta-num">{cobrosPendientes}</span><span>Cobros pendientes</span></div>
      </div>

      <h3>Totales por empresa</h3>
      <table className="tabla">
        <thead><tr><th>Empresa</th><th>Total</th></tr></thead>
        <tbody>
          {Object.entries(totalesPorEmpresa).map(([nombre, total]) => (
            <tr key={nombre}><td>{nombre}</td><td>{total.toLocaleString("es-PY")}</td></tr>
          ))}
          {Object.keys(totalesPorEmpresa).length === 0 && <tr><td colSpan="2">Sin datos aún.</td></tr>}
        </tbody>
      </table>

      <h3>Actividad reciente</h3>
      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Tipo</th></tr></thead>
        <tbody>
          {auditoria.slice(0, 10).map((a) => (
            <tr key={a.id}><td>{fechaLegible(a.fecha)}</td><td>{a.accion}</td><td>{a.usuarioNombre}</td><td>{a.documentoTipo}</td></tr>
          ))}
          {auditoria.length === 0 && <tr><td colSpan="4">Sin actividad registrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================================================
// HISTORIAL / CONSULTAS
// ==========================================================================

function Historial({ perfil }) {
  const { empresas } = useContextoSelects();
  const [tipoDoc, setTipoDoc] = useState("presupuestos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const where = [];
  if (filtroEmpresa) where.push(["empresaId", "==", filtroEmpresa]);
  if (filtroEstado) where.push(["estado", "==", filtroEstado]);
  const { items, cargando } = useColeccion(tipoDoc === "ordenesPago" ? "ordenesPago" : tipoDoc, { where, orderBy: ["numero", "desc"] });

  return (
    <div className="panel">
      <h2>Historial / Consultas</h2>
      <div className="filtros">
        <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
          <option value="presupuestos">Presupuestos</option>
          <option value="ordenesPago">Órdenes de Pago (todas)</option>
          <option value="ordenesCobro">Órdenes de Cobro</option>
        </select>
        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((es) => <option key={es} value={es}>{ESTADOS_LABELS[es]}</option>)}
        </select>
      </div>
      {cargando ? <p>Cargando...</p> : (
        <table className="tabla">
          <thead><tr><th>N.º</th><th>Empresa</th><th>Total</th><th>Estado</th><th>Creado por</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.numero}</td><td>{it.empresaNombre}</td><td>{formatMoneda(it.total, it.moneda)}</td>
                <td><span className="badge badge-azul">{ESTADOS_LABELS[it.estado] || it.estado}</span></td>
                <td>{it.creadoPor}</td>
                <td><button className="btn-link" onClick={() => generarPDF(
                  it.tipo && TIPOS_ORDEN[it.tipo] ? TIPOS_ORDEN[it.tipo].label : (tipoDoc === "presupuestos" ? "Presupuesto de Proveedor" : tipoDoc === "ordenesCobro" ? "Orden de Cobro" : "Orden de Pago"),
                  it, empresas.find((e) => e.id === it.empresaId)
                )}>PDF</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6">Sin resultados.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==========================================================================
// APP RAÍZ
// ==========================================================================

function AppAutenticada({ perfil, logout }) {
  const [vista, setVista] = useState("dashboard");

  const render = () => {
    switch (vista) {
      case "dashboard": return <Dashboard perfil={perfil} />;
      case "presupuestos": return <Presupuestos perfil={perfil} />;
      case "orden_productos": return <OrdenesPago perfil={perfil} tipo="productos" />;
      case "orden_servicios": return <OrdenesPago perfil={perfil} tipo="servicios" />;
      case "orden_rrhh": return <OrdenesPago perfil={perfil} tipo="rrhh" />;
      case "ordenes_cobro": return <OrdenesCobro perfil={perfil} />;
      case "empresas": return <Empresas perfil={perfil} />;
      case "tiendas": return <Tiendas perfil={perfil} />;
      case "sectores": return <Sectores perfil={perfil} />;
      case "personas": return <Personas perfil={perfil} />;
      case "proveedores": return <Proveedores perfil={perfil} />;
      case "usuarios": return <Usuarios perfil={perfil} />;
      case "historial": return <Historial perfil={perfil} />;
      default: return <Dashboard perfil={perfil} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar perfil={perfil} vista={vista} setVista={setVista} />
      <div className="app-main">
        <TopBar perfil={perfil} onLogout={logout} />
        <main className="app-contenido">{render()}</main>
        <footer className="app-footer">v{APP_VERSION}</footer>
      </div>
    </div>
  );
}

function App() {
  const { user, perfil, errorPerfil, logout } = useAuth();

  if (user === undefined) return <div className="pantalla-carga">Cargando...</div>;
  if (!user) return <Login />;
  if (errorPerfil) {
    return (
      <div className="pantalla-carga">
        <div className="alert alert-error">{errorPerfil}</div>
        <button className="btn-secundario" onClick={logout}>Cerrar sesión</button>
      </div>
    );
  }
  if (!perfil) return <div className="pantalla-carga">Cargando perfil...</div>;

  return <AppAutenticada perfil={perfil} logout={logout} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
