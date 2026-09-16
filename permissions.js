const ROLES = {
  ADMIN: 'admin',
  OPERADOR: 'operador',
  APROBADOR: 'aprobador',
  TESORERIA: 'tesoreria',
  CONSULTA: 'consulta'
};

const PERMISSIONS = {
  admin: ['*'],
  operador: ['dashboard.read','masters.read','documents.read','documents.create','pdf.generate'],
  aprobador: ['dashboard.read','masters.read','documents.read','documents.approve','pdf.generate'],
  tesoreria: ['dashboard.read','masters.read','documents.read','documents.receive','pdf.generate'],
  consulta: ['dashboard.read','masters.read','documents.read','pdf.generate']
};

function hasPermission(user, permission) {
  if (!user || user.activo === false) return false;
  const permissions = PERMISSIONS[user.rol] || [];
  return permissions.includes('*') || permissions.includes(permission);
}
