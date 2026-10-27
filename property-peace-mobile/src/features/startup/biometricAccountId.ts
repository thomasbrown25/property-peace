type AccountIdentity = { id?: string | number | null; Id?: string | number | null } | null | undefined;

export const getBiometricAccountId = (user: AccountIdentity): string => {
  const id = user?.id ?? user?.Id;
  return id === null || id === undefined ? '' : String(id);
};
