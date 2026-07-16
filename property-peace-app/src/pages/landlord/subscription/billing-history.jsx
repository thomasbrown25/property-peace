import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Button,
  Stack,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  OutlinedInput,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  LinkOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { useSubscription } from 'hooks/useSubscription';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

export default function BillingHistory() {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await subscriptionAPI.getPaymentHistory();
      if (response.success && response.data) {
        setInvoices(response.data);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load payment history',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'success';
      case 'open': return 'warning';
      case 'void':
      case 'uncollectible': return 'error';
      default: return 'default';
    }
  };

  const formatInvoiceDate = (created) => {
    if (created == null) return '—';
    const date = typeof created === 'number'
      ? new Date(created * (created < 1e12 ? 1000 : 1))
      : new Date(created);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleDownload = (invoice) => {
    if (invoice.invoicePdf) {
      window.open(invoice.invoicePdf, '_blank');
    } else if (invoice.hostedInvoiceUrl) {
      window.open(invoice.hostedInvoiceUrl, '_blank');
    } else {
      openSnackbar({ open: true, message: 'Invoice PDF not available', variant: 'alert', alert: { color: 'warning' } });
    }
  };

  const filteredInvoices = useMemo(() => {
    const searchLower = search.toLowerCase();
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === 'all' || inv.status?.toLowerCase() === statusFilter;
      const matchesSearch =
        search.trim() === '' ||
        (inv.invoiceNumber || inv.id || '').toLowerCase().includes(searchLower) ||
        (inv.description || '').toLowerCase().includes(searchLower) ||
        formatAmount(inv.amount, inv.currency).includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginated = useMemo(() => {
    return filteredInvoices.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);
  }, [filteredInvoices, page, itemsPerPage]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [search, statusFilter, itemsPerPage]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set(invoices.map((i) => i.status?.toLowerCase()).filter(Boolean));
    return Array.from(s);
  }, [invoices]);

  return (
    <Container maxWidth="xl">
      <PageBreadcrumbs
        links={[
          { title: 'Subscription', to: '/landlord/subscription' },
          { title: 'Billing History' }
        ]}
      />

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, mt: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
            Billing History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All invoices and payment records for your subscription.
          </Typography>
        </Box>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/subscription')}
          sx={{ textTransform: 'none' }}
        >
          Back to Subscription
        </Button>
      </Stack>

      <MainCard>
        {/* Toolbar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" flex={1}>
            <OutlinedInput
              size="small"
              placeholder="Search invoice #, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                </InputAdornment>
              }
              sx={{ width: { xs: '100%', sm: 280 }, bgcolor: 'background.paper' }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                {uniqueStatuses.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filteredInvoices.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {invoices.length === 0 ? 'No payment history found.' : 'No invoices match your filters.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {invoice.invoiceNumber || invoice.id?.substring(0, 12) || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatInvoiceDate(invoice.created)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {invoice.description || 'Subscription payment'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatAmount(invoice.amount, invoice.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).toLowerCase() : 'Unknown'}
                          color={getStatusColor(invoice.status)}
                          size="small"
                          variant={invoice.status?.toLowerCase() === 'paid' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          {(invoice.invoicePdf || invoice.hostedInvoiceUrl) && (
                            <Tooltip title="Download Invoice">
                              <IconButton size="small" onClick={() => handleDownload(invoice)} color="primary">
                                <DownloadOutlined />
                              </IconButton>
                            </Tooltip>
                          )}
                          {invoice.hostedInvoiceUrl && (
                            <Tooltip title="View Invoice">
                              <IconButton size="small" onClick={() => window.open(invoice.hostedInvoiceUrl, '_blank')} color="primary">
                                <LinkOutlined />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
                <FormControl size="small" sx={{ minWidth: 70 }}>
                  <Select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    sx={{ height: 32 }}
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                      <MenuItem key={n} value={n}>{n}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Page {page + 1} of {totalPages || 1}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LeftOutlined />}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  sx={{ minWidth: 100 }}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<RightOutlined />}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </MainCard>
    </Container>
  );
}
