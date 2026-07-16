import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DownloadOutlined, LinkOutlined } from '@ant-design/icons';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

export default function Billing({ subscription, loading, onUpdate, preview = false }) {
  const theme = useTheme();
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    if (subscription) {
      fetchPaymentHistory();
    }
  }, [subscription]);

  const fetchPaymentHistory = async () => {
    try {
      setInvoicesLoading(true);
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
      setInvoicesLoading(false);
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
      case 'paid':
        return 'success';
      case 'open':
        return 'warning';
      case 'void':
      case 'uncollectible':
        return 'error';
      default:
        return 'default';
    }
  };

  // Parse invoice date: API may send Unix seconds (number) or ISO string (from DateTime)
  const formatInvoiceDate = (created) => {
    if (created == null) return 'N/A';
    const date =
      typeof created === 'number'
        ? new Date(created * (created < 1e12 ? 1000 : 1)) // seconds vs milliseconds
        : new Date(created);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleDownloadInvoice = (invoice) => {
    if (invoice.invoicePdf) {
      window.open(invoice.invoicePdf, '_blank');
    } else if (invoice.hostedInvoiceUrl) {
      window.open(invoice.hostedInvoiceUrl, '_blank');
    } else {
      openSnackbar({
        open: true,
        message: 'Invoice PDF not available',
        variant: 'alert',
        alert: { color: 'warning' }
      });
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (!subscription) {
    return (
      <Alert severity="info">
        <Typography variant="body2">
          No active subscription. Subscribe to a plan to manage billing.
        </Typography>
      </Alert>
    );
  }

  const displayedInvoices = preview ? invoices.slice(0, 5) : invoices;

  return (
    <Box>
      {invoicesLoading ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Loading payment history...</Typography>
        </Box>
      ) : invoices.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No payment history found</Typography>
        </Box>
      ) : (
        <Box>
          {displayedInvoices.map((invoice, idx) => {
            const status = invoice.status?.toLowerCase();
            const isPaid = status === 'paid';
            const isOpen = status === 'open';
            const StatusIcon = isPaid ? CheckCircleIcon : isOpen ? AccessTimeIcon : ErrorIcon;
            const iconColor = isPaid
              ? theme.palette.success.main
              : isOpen
              ? theme.palette.warning.main
              : theme.palette.error.main;

            const invoiceLabel = invoice.invoiceNumber || invoice.id?.substring(0, 12);
            const dateStr = formatInvoiceDate(invoice.created);

            return (
              <Box key={invoice.id}>
                {idx > 0 && <Divider />}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ py: 1.5, px: 0.5 }}
                >
                  {/* Status icon */}
                  <StatusIcon sx={{ color: iconColor, fontSize: 22, flexShrink: 0 }} />

                  {/* Description + invoice number / date */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {invoice.description || 'Subscription payment'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invoiceLabel}{dateStr !== 'N/A' ? ` · ${dateStr}` : ''}
                    </Typography>
                  </Box>

                  {/* Status chip */}
                  <Chip
                    label={invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).toLowerCase() : 'Unknown'}
                    color={getStatusColor(invoice.status)}
                    size="small"
                    variant="outlined"
                    sx={{ flexShrink: 0 }}
                  />

                  {/* Amount */}
                  <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                    {formatAmount(invoice.amount, invoice.currency)}
                  </Typography>

                  {/* Action icons */}
                  {(invoice.invoicePdf || invoice.hostedInvoiceUrl) && (
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownloadInvoice(invoice)}>
                        <DownloadOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                  {invoice.hostedInvoiceUrl && (
                    <Tooltip title="View Invoice">
                      <IconButton size="small" onClick={() => window.open(invoice.hostedInvoiceUrl, '_blank')}>
                        <LinkOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
