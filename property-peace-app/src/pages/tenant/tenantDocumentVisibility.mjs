// Defense in depth: the tenant endpoint filters private documents server-side too.
// Missing legacy flags remain visible; generated agreements are handled separately.
export function visibleTenantDocuments(documents = []) {
  return documents.filter((document) => (document.isPrivate ?? document.IsPrivate) !== true);
}
