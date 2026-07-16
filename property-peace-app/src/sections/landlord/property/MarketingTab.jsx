import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import { PlusOutlined, CopyOutlined, LinkOutlined, FileTextOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import listingApi from 'api/listing';
import { openSnackbar } from 'api/snackbar';
import { formatCurrency } from 'utils/formatters';

const appBaseUrl = import.meta.env.VITE_APP_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const STATUS_COLOR = {
  Draft: 'default',
  Active: 'success',
  Expired: 'warning',
  Unlisted: 'default'
};

function MarketingTab({ propertyId, onNavigateToAddListing, creatingListing = false }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await listingApi.getListingsByPropertyId(propertyId);
        if (cancelled) return;
        const data = res?.data ?? res;
        setListings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [propertyId]);

  const handleCopyLink = (listingNumber) => {
    const url = `${appBaseUrl}/listing/${listingNumber}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => openSnackbar({ open: true, message: 'Link copied to clipboard', variant: 'alert', alert: { color: 'success' } }),
        () => openSnackbar({ open: true, message: 'Failed to copy link', variant: 'alert', alert: { color: 'error' } })
      );
    } else {
      openSnackbar({ open: true, message: 'Clipboard not supported', variant: 'alert', alert: { color: 'warning' } });
    }
  };

  const statusLabel = (status) => {
    if (typeof status === 'string') return status;
    const map = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };
    return map[status] ?? 'Draft';
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Listings
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
          onClick={onNavigateToAddListing}
          disabled={creatingListing}
          sx={{ textTransform: 'none' }}
        >
          {creatingListing ? 'Creating...' : 'Create Listing'}
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <>
          {listings.length === 0 ? (
            <MainCard sx={{ p: 6, textAlign: 'center', bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}
              >
                <FileTextOutlined style={{ fontSize: 64, color: theme.palette.primary.main, opacity: 0.5 }} />
              </Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                No listings yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                Create a listing to market this property and start receiving applications.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
                onClick={onNavigateToAddListing}
                disabled={creatingListing}
                sx={{ textTransform: 'none' }}
              >
                {creatingListing ? 'Creating...' : 'Create Listing'}
              </Button>
            </MainCard>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[100], 0.8) }}>
                    <TableCell sx={{ fontWeight: 600 }}>Listing #</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Rent</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listings.map((row, index) => {
                    const status = statusLabel(row.status);
                    const statusKey = String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
                    const isActive = statusKey === 'Active';
                    const isDraft = statusKey === 'Draft';
                    const publicUrl = `${appBaseUrl}/listing/${row.listingNumber}`;
                    const listingId = row.id ?? row.listingId;

                    return (
                      <TableRow
                        key={listingId ?? row.listingNumber ?? index}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (!listingId) return;
                          navigate(isDraft ? `/landlord/listings/${listingId}/setup` : `/landlord/listings/${listingId}`);
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {row.listingNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {row.unitName || 'Whole property'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={statusKey} color={STATUS_COLOR[statusKey] || 'default'} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatCurrency(row.monthlyRent)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LinkOutlined />}
                              href={isActive ? publicUrl : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              disabled={!isActive}
                              sx={{ textTransform: 'none' }}
                            >
                              View page
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleCopyLink(row.listingNumber)}
                              sx={{ color: 'text.secondary', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                            >
                              <CopyOutlined style={{ fontSize: 15 }} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}

export default MarketingTab;
