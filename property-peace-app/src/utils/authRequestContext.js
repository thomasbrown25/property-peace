const removeHeader = (headers, name) => {
  if (typeof headers?.delete === 'function') headers.delete(name);
  if (headers && typeof headers === 'object') {
    delete headers[name];
    delete headers[name.toLowerCase()];
  }
};

export const removeInheritedAuthContext = (headers) => {
  removeHeader(headers, 'Authorization');
  removeHeader(headers, 'X-Organization-Id');
  return headers;
};
