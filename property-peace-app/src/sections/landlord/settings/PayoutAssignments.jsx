import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  alpha
} from '@mui/material';
import { BankOutlined, HomeOutlined } from '@ant-design/icons';

import { bankAccountAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useOrganization } from 'contexts/OrganizationContext';
import useFetchProperties from 'hooks/useFetchProperties';
import { addOrUpdateProperty } from 'store/property/property.action';

const field = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
const accountId = (account) => field(account, 'id', 'Id');

const accountLabel = (account) => {
  if (!account) return 'Not assigned';
  const name = field(account, 'accountName', 'AccountName') || field(account, 'bankName', 'BankName') || 'Stripe payout account';
  const last4 = field(account, 'last4', 'Last4');
  return last4 ? `${name} ···· ${last4}` : name;
};

const propertyAddress = (property) =>
  [field(property, 'streetAddress', 'StreetAddress'), field(property, 'city', 'City'), field(property, 'state', 'State')]
    .filter(Boolean)
    .join(', ');

export default function PayoutAssignments() {
  const dispatch = useDispatch();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const { properties, propertiesRefetch, isLoading: propertiesLoading, propertiesError } = useFetchProperties();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editingOrganizationId, setEditingOrganizationId] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const organizationIdRef = useRef(organizationId);
  const organizationVersionRef = useRef(0);

  useEffect(() => {
    organizationIdRef.current = organizationId;
    organizationVersionRef.current += 1;
    setEditingProperty(null);
    setEditingOrganizationId(null);
    setSelectedAccountId('');
    setSaving(false);
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    setBankAccounts([]);
    setLoadedOrganizationId(null);

    if (!organizationId) {
      setAccountsLoading(false);
      setAccountsError(false);
      return () => {
        active = false;
      };
    }

    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        setAccountsError(false);
        const response = await bankAccountAPI.getBankAccounts(organizationId);
        if (!active) return;
        const success = response?.success ?? response?.Success;
        const data = response?.data ?? response?.Data;
        setBankAccounts(success === false ? [] : Array.isArray(data) ? data : []);
        setLoadedOrganizationId(organizationId);
      } catch (error) {
        console.error('Unable to load property payout accounts:', error);
        if (active) setAccountsError(true);
      } finally {
        if (active) setAccountsLoading(false);
      }
    };

    loadAccounts();
    return () => {
      active = false;
    };
  }, [organizationId, retryVersion]);

  const visibleBankAccounts = loadedOrganizationId === organizationId ? bankAccounts : [];
  const accountsById = useMemo(
    () => new Map(visibleBankAccounts.map((account) => [String(accountId(account)), account])),
    [visibleBankAccounts]
  );

  const openEditor = (property) => {
    setEditingProperty(property);
    setEditingOrganizationId(organizationId);
    const assignedId = field(property, 'operatingAccountId', 'OperatingAccountId');
    setSelectedAccountId(assignedId == null ? '' : String(assignedId));
  };

  const closeEditor = () => {
    if (saving) return;
    setEditingProperty(null);
    setEditingOrganizationId(null);
    setSelectedAccountId('');
  };

  const saveAssignment = async () => {
    if (!editingProperty || !editingOrganizationId || String(editingOrganizationId) !== String(organizationIdRef.current)) return;

    const saveOrganizationId = editingOrganizationId;
    const saveOrganizationVersion = organizationVersionRef.current;
    setSaving(true);
    try {
      const selectedAccount = selectedAccountId ? accountsById.get(selectedAccountId) : null;
      if (selectedAccountId && !selectedAccount) throw new Error('The selected payout account is no longer available.');

      const updated = await dispatch(
        addOrUpdateProperty(
          {
            ...editingProperty,
            operatingAccountId: selectedAccount ? accountId(selectedAccount) : null
          },
          [],
          saveOrganizationId
        )
      );
      if (organizationVersionRef.current !== saveOrganizationVersion) return;
      if (!updated) throw new Error('The payout assignment could not be saved.');

      await propertiesRefetch();
      if (organizationVersionRef.current !== saveOrganizationVersion) return;
      openSnackbar({
        open: true,
        message: 'Property payout assignment updated',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setEditingProperty(null);
      setEditingOrganizationId(null);
      setSelectedAccountId('');
    } catch (error) {
      if (organizationVersionRef.current !== saveOrganizationVersion) return;
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to update the property payout assignment',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      if (organizationVersionRef.current === saveOrganizationVersion) setSaving(false);
    }
  };

  if (propertiesLoading || accountsLoading || loadedOrganizationId !== organizationId) {
    return (
      <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={34} />
      </Box>
    );
  }

  if (propertiesError || accountsError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => setRetryVersion((value) => value + 1)}>
            Retry
          </Button>
        }
      >
        We could not load property payout assignments. Please try again.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: (theme) => alpha(theme.palette.divider, 0.7) }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
        <Typography variant="h6" fontWeight={750}>
          Property payout assignments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
          See where income and deposit funds are routed for each property, then edit the property’s default Stripe payout destination.
        </Typography>
        <Alert severity="info" icon={false} sx={{ mt: 2 }}>
          Both labels currently use the same payout account. Changing this property default affects future transfers that use the property default; lease-specific payout overrides remain unchanged.
        </Alert>
      </Box>
      <Divider />

      {!properties?.length ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">Add a property before assigning payout accounts.</Alert>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {properties.map((property) => {
            const assignedId = field(property, 'operatingAccountId', 'OperatingAccountId');
            const assignedAccount = assignedId == null ? null : accountsById.get(String(assignedId));
            const label = accountLabel(assignedAccount);

            return (
              <Box
                key={field(property, 'id', 'Id')}
                sx={{
                  px: { xs: 2, sm: 3 },
                  py: 2.25,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1.2fr) minmax(170px, 1fr) minmax(170px, 1fr) auto' },
                  gap: { xs: 1.75, md: 3 },
                  alignItems: 'center'
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
                  <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                    <HomeOutlined />
                  </Box>
                  <Box minWidth={0}>
                    <Typography fontWeight={750}>{field(property, 'name', 'Name') || 'Unnamed property'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      {propertyAddress(property) || 'Address not available'}
                    </Typography>
                  </Box>
                </Stack>

                {['Income', 'Deposit'].map((type) => (
                  <Box key={type} minWidth={0}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {type}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.35 }}>
                      <BankOutlined style={{ flexShrink: 0 }} />
                      <Typography variant="body2" fontWeight={650} sx={{ overflowWrap: 'anywhere' }}>
                        {label}
                      </Typography>
                    </Stack>
                  </Box>
                ))}

                <Button variant="outlined" size="small" onClick={() => openEditor(property)} sx={{ justifySelf: { md: 'end' } }}>
                  Edit assignment
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(editingProperty)} onClose={closeEditor} fullWidth maxWidth="xs">
        <DialogTitle>Edit property payout assignment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Income and deposit payouts that use the property default for {field(editingProperty, 'name', 'Name') || 'this property'} will use this same destination.
          </Typography>
          {!visibleBankAccounts.length && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No Stripe payout accounts are available. Add one from the Bank Accounts tab first.
            </Alert>
          )}
          <FormControl fullWidth>
            <Select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              displayEmpty
              inputProps={{ 'aria-label': 'Property payout account' }}
            >
              <MenuItem value="">
                <em>Not assigned</em>
              </MenuItem>
              {visibleBankAccounts.map((account) => (
                <MenuItem key={accountId(account)} value={String(accountId(account))}>
                  {accountLabel(account)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveAssignment} disabled={saving}>
            {saving ? 'Saving…' : 'Save assignment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
