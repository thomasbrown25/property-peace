import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Fade,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer
} from '@mui/material';
import {
  HistoryOutlined,
  LeftOutlined,
  RightOutlined,
  DollarCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AnimateIn from 'components/AnimateIn';
import { aiFollowUpAPI } from 'api';

const ACTION_CONFIG = {
  sent: { label: 'Follow-up Sent', color: 'success', icon: <CheckCircleOutlined /> },
  flagged: { label: 'Flagged for Review', color: 'error', icon: <ExclamationCircleOutlined /> },
  late_fee: { label: 'Late Fee Rec.', color: 'warning', icon: <DollarCircleOutlined /> }
};

function ActionChip({ type, isManual }) {
  const cfg = ACTION_CONFIG[type] ?? { label: type, color: 'default' };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Chip
        label={cfg.label}
        size="small"
        color={cfg.color}
        variant="outlined"
        sx={{ fontWeight: 500, fontSize: '0.7rem' }}
      />
      {isManual && (
        <Chip
          label="Manual"
          size="small"
          icon={<UserOutlined style={{ fontSize: 10 }} />}
          sx={{ fontSize: '0.68rem', height: 20 }}
        />
      )}
    </Stack>
  );
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function CollectionsHistory() {
  const theme = useTheme();
  const [fadeIn, setFadeIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setFadeIn(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    aiFollowUpAPI
      .getCollectionsHistory(page, pageSize)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        setItems(data?.items ?? []);
        setTotalCount(data?.totalCount ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, pageSize]);

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box>
        {/* Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box sx={{ mb: 2 }}>
            <PageBreadcrumbs
              items={[
                { label: 'Dashboard', path: '/landlord/dashboard' },
                { label: 'Rent collection', path: '/landlord/rent-collection' },
                { label: 'History' }
              ]}
            />
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <HistoryOutlined style={{ fontSize: 26, color: theme.palette.primary.main }} />
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={700}>Rent Collection History</Typography>
                <Typography variant="body1" color="text.secondary">
                  Rent follow-up and collection activity across your leases.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </AnimateIn>

        {/* Table */}
        <AnimateIn direction="bottom" delay={150} distance={100}>
          <MainCard sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                <CircularProgress size={32} />
              </Box>
            ) : error ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
              </Box>
            ) : items.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <HistoryOutlined style={{ fontSize: 36, color: theme.palette.text.disabled, marginBottom: 8 }} />
                <Typography variant="body2" color="text.secondary">
                  Rent collection activity will appear here as follow-ups are recorded.
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Tenant</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Property</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Action</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Message</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }} align="right">Lease</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow
                          key={item.id}
                          hover
                          sx={{ '&:last-child td': { borderBottom: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {formatDate(item.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {item.tenantNames || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {item.propertyName || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <ActionChip type={item.actionType} isManual={item.isManual} />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {item.message}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Link
                              to={`/landlord/leases/${item.leaseId}`}
                              style={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none' }}
                            >
                              View →
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary">Rows per page:</Typography>
                    <FormControl size="small">
                      <Select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        sx={{ height: 28, fontSize: '0.8rem' }}
                      >
                        {[10, 20, 50].map((n) => (
                          <MenuItem key={n} value={n}>{n}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LeftOutlined />}
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      sx={{ minWidth: 90, height: 28 }}
                    >
                      Previous
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<RightOutlined />}
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                      sx={{ minWidth: 70, height: 28 }}
                    >
                      Next
                    </Button>
                  </Stack>
                </Box>
              </>
            )}
          </MainCard>
        </AnimateIn>
      </Box>
    </Fade>
  );
}
