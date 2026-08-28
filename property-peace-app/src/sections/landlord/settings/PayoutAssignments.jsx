import { useEffect, useMemo, useState } from 'react';
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
import useFetchProperties from 'hooks/useFetchProperties';
import { addOrUpdateProperty } from 'store/property/property.action';

const field = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
const accountId = (account) => field(account, 'id', 'Id');

const accountLabel = (account) => {
  if (!account) return 'Not assigned';
  const name = field(account, 'accountName', 'AccountName') || field(account, 'bankName', 'BankName') || 'Bank account';
  const last4 = field(account, 'last4', 'Last4');
  return last4 ? `${name} ···· ${last4}` : name;
};

const propertyAddress = (property) =>
  [field(property, 'streetAddress', 'StreetAddress'), field(property, 'city', 'City'), field(property, 'state', 'State')]
    .filter(Boolean)
    .join(', ');

export default function PayoutAssignments() {
  const dispatch = useDispatch();
  const { properties, propertiesRefetch, isLoading: propertiesLoading, propertiesError } = useFetchProperties();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        setAccountsError(false);
        const response = await bankAccountAPI.getBankAccounts();
        if (active) setBankAccounts(response?.success ? response.data || [] : []);
      } catch (error) {
        console.error('Unable to load payout accounts:', error);
        if (active) setAccountsError(true);
      } finally {
        if (active) setAccountsLoading(false);
      }
    };

    loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  const accountsById = useMemo(() => new Map(bankAccounts.map((account) => [String(accountId(account)), account])), [bankAccounts]);

  const openEditor = (property) => {
    setEditingProperty(property);
    const assignedId = field(property, 'operatingAccountId', 'OperatingAccountId');
    setSelectedAccountId(assignedId ? String(assignedId) : '');
  };

  const closeEditor = () => {
    if (saving) return;
    setEditingProperty(null);
    setSelectedAccountId('');
  };

  const saveAssignment = async () => {
    if (!editingProperty) return;

    setSaving(true);
    try {
      const selectedAccount = selectedAccountId ? accountsById.get(selectedAccountId) : null;
      const updated = await dispatch(
        addOrUpdateProperty({
          ...editingProperty,
          operatingAccountId: selectedAccount ? accountId(selectedAccount) : null
        })
      );
      if (!updated) throw new Error('The payout assignment could not be saved.');

      await propertiesRefetch();
      openSnackbar({
        open: true,
        message: 'Payout assignment updated',
        variant: 'alert',
        alert: { color: 'success' }
      });
      closeEditor();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to update payout assignment',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
      setEditingProperty(null);
    }
  };

  if (propertiesLoading || accountsLoading) {
    return (
      <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={34} />
      </Box>
    );
  }

  if (propertiesError || accountsError) {
    return <Alert severity="error">We could not load payout assignments. Please try again.</Alert>;
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: (theme) => alpha(theme.palette.divider, 0.7) }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.25 }}>
        <Typography variant="h6" fontWeight={750}>
          Property payout assignments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Choose the Stripe-managed bank account used for rent income and deposit payouts at each property.
        </Typography>
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
            const assignedAccount = assignedId ? accountsById.get(String(assignedId)) : null;
            const label = accountLabel(assignedAccount);

            return (
              <Box
                key={field(property, 'id', 'Id')}
                sx={{
                  px: { xs: 2, sm: 3 },
                  py: 2.25,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1.2fr) minmax(180px, 1fr) minmax(180px, 1fr) auto' },
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
                    <Typography variant="body2" color="text.secondary" noWrap>
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
                      <Typography variant="body2" fontWeight={650} noWrap>
                        {label}
                      </Typography>
                    </Stack>
                  </Box>
                ))}

                <Button variant="text" onClick={() => openEditor(property)} sx={{ justifySelf: { md: 'end' }, px: 1 }}>
                  Edit
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(editingProperty)} onClose={closeEditor} fullWidth maxWidth="xs">
        <DialogTitle>Edit payout assignment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Income and deposit payouts for {field(editingProperty, 'name', 'Name') || 'this property'} will use this account.
          </Typography>
          <FormControl fullWidth>
            <Select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              displayEmpty
              inputProps={{ 'aria-label': 'Payout bank account' }}
            >
              <MenuItem value="">
                <em>Not assigned</em>
              </MenuItem>
              {bankAccounts.map((account) => (
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
