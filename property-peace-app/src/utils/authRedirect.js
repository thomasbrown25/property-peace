export const getUserRoles = (user) => {
  const roles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
  return roles.map((role) => String(role).toLowerCase().trim()).filter(Boolean);
};

const isSafeRolePath = (path, rolePathPrefix) => typeof path === 'string' && path.startsWith(rolePathPrefix);

export const getPostLoginRedirectPath = (user, requestedPath = '') => {
  const normalizedRoles = getUserRoles(user);

  if (normalizedRoles.includes('admin')) {
    return isSafeRolePath(requestedPath, '/admin/') ? requestedPath : '/admin/dashboard';
  }

  if (normalizedRoles.includes('tenant')) {
    return isSafeRolePath(requestedPath, '/tenant/') ? requestedPath : '/tenant/dashboard';
  }

  if (normalizedRoles.includes('landlord')) {
    return isSafeRolePath(requestedPath, '/landlord/') ? requestedPath : '/landlord/dashboard';
  }

  return '/unauthorized';
};
