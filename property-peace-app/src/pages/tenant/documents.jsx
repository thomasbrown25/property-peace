import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  alpha,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Avatar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
  SearchOutlined,
  FileProtectOutlined,
  HomeOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatDate } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import { tenantDocumentAPI } from 'api';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Document type labels
const DOCUMENT_TYPE_LABELS = {
  1: 'Government ID',
  2: 'Social Security Card',
  10: 'Lease Agreement',
  11: 'Lease Addendum',
  12: 'Lease Renewal',
  20: 'Renter Insurance',
  21: 'Liability Insurance',
  30: 'Rental Application',
  31: 'Credit Report',
  32: 'Background Check',
  33: 'Income Verification',
  34: 'Employment Verification',
  40: 'Move-In Checklist',
  41: 'Move-Out Checklist',
  42: 'Move-In Photos',
  43: 'Move-Out Photos',
  50: 'Bank Statement',
  51: 'Tax Return',
  52: 'W2',
  53: 'Pay Stub',
  60: 'Pet Agreement',
  61: 'Parking Agreement',
  99: 'Other'
};

// Icon colors per type group
function getDocTypeColor(type) {
  if ([10, 11, 12].includes(type)) return '#1877F2'; // lease - blue
  if ([1, 2].includes(type)) return '#9c27b0'; // identity - purple
  if ([20, 21].includes(type)) return '#0288d1'; // insurance - light blue
  if ([30, 31, 32, 33, 34].includes(type)) return '#f57c00'; // applications - orange
  if ([40, 41, 42, 43].includes(type)) return '#388e3c'; // move in/out - green
  if ([50, 51, 52, 53].includes(type)) return '#00796b'; // financial - teal
  if ([60, 61].includes(type)) return '#5d4037'; // agreements - brown
  return '#616161'; // other - grey
}

function getLeaseId(lease) {
  return lease?.id ?? lease?.Id;
}

function getDocLeaseId(doc) {
  return doc?.leaseId ?? doc?.LeaseId;
}

function getLeaseLabel(lease) {
  const property = lease?.unit?.property?.name || lease?.propertyName || lease?.PropertyName || 'Property';
  const unit = lease?.unit?.name || lease?.unitName || lease?.UnitName;
  const propertyType = lease?.unit?.property?.propertyType || lease?.propertyType || lease?.PropertyType;
  const normalizedPropertyType = String(propertyType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedUnitName = String(unit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalizedPropertyType === 'singlefamily' || !unit || normalizedUnitName === 'unit1' ? property : `${property} · ${unit}`;
}

function LeaseFilterItem({ lease, selected, mobile, onClick }) {
  const theme = useTheme();
  const isActive = lease.isActive;
  const propertyName = lease?.unit?.property?.name || lease?.propertyName || lease?.PropertyName || 'Property';
  const unitName = lease?.unit?.name || lease?.unitName || lease?.UnitName;
  const propertyType = lease?.unit?.property?.propertyType || lease?.propertyType || lease?.PropertyType;
  const normalizedPropertyType = String(propertyType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedUnitName = String(unitName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const showUnitName = unitName && normalizedPropertyType !== 'singlefamily' && normalizedUnitName !== 'unit1';

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderRadius: 1.5,
        border: `1.5px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        transition: 'all 0.15s',
        minWidth: mobile ? 220 : 0,
        flexShrink: 0,
        '&:hover': {
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.action.hover, 0.5),
          border: `1.5px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          src={lease.propertyImageUrl || undefined}
          sx={{
            width: 42,
            height: 42,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            flexShrink: 0,
            fontSize: 18
          }}
        >
          {!lease.propertyImageUrl && <HomeOutlined />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.75}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {propertyName}
            </Typography>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isActive ? 'success.main' : 'text.disabled',
                flexShrink: 0
              }}
            />
          </Stack>
          {showUnitName && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', minWidth: 0 }}>
              {unitName}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ==============================|| TENANT - DOCUMENTS ||============================== //

export default function TenantDocuments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantId, setTenantId] = useState(null);
  const [leases, setLeases] = useState([]);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    files: [],
    documentType: 99,
    description: '',
    expirationDate: null
  });

  // Derive tenantId from leases
  useEffect(() => {
    const fetchTenantId = async () => {
      try {
        const res = await axiosServices.get('/api/lease/tenant/my-leases');
        if (res.data?.success && res.data?.data?.length > 0) {
          const allLeases = res.data.data;
          setLeases(allLeases);
          const active = allLeases.find((l) => l.isActive) || allLeases[0];
          if (active) setSelectedLeaseId(getLeaseId(active));

          const firstLease = allLeases[0];
          if (firstLease.tenants?.length > 0) {
            const tenant = firstLease.tenants[0];
            setTenantId(tenant.id || tenant.Id);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching tenant ID:', err);
        setLoading(false);
      }
    };
    if (user?.Id || user?.id) fetchTenantId();
  }, [user]);

  useEffect(() => {
    if (tenantId) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tenantDocumentAPI.getTenantDocumentsByTenant(tenantId);
      if (response.success && response.data) {
        setDocuments(response.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const selectedLease = useMemo(() => leases.find((l) => String(getLeaseId(l)) === String(selectedLeaseId)) || null, [leases, selectedLeaseId]);

  // Filtered document list
  const filteredDocuments = useMemo(() => {
    let list = [...documents];
    if (selectedLeaseId) {
      list = list.filter((d) => String(getDocLeaseId(d)) === String(selectedLeaseId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.fileName?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          DOCUMENT_TYPE_LABELS[d.documentType]?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [documents, selectedLeaseId, searchQuery]);

  const selectedLeaseLabel = selectedLease ? `${getLeaseLabel(selectedLease)} Documents` : 'Documents';

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const isExpiringSoon = (exp) => {
    if (!exp) return false;
    const days = Math.ceil((new Date(exp) - new Date()) / 86400000);
    return days <= 30 && days >= 0;
  };

  const isExpired = (exp) => exp && new Date(exp) < new Date();

  const canDeleteDocument = (doc) => {
    if (doc.documentType === 10) return false;
    if (getDocLeaseId(doc)) return false;
    if (doc.createdBy !== undefined) return doc.createdBy === (user?.Id || user?.id);
    return true;
  };

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadForm.files.length) {
      openSnackbar({ open: true, message: 'Please select at least one file', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    try {
      const response = await tenantDocumentAPI.uploadTenantDocuments(tenantId, uploadForm.files, {
        description: uploadForm.description || null,
        documentType: uploadForm.documentType,
        expirationDate: uploadForm.expirationDate ? uploadForm.expirationDate.toISOString() : null,
        isRequired: false,
        leaseId: selectedLeaseId || null
      });
      if (response.success) {
        openSnackbar({
          open: true,
          message: response.message || 'Documents uploaded successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setUploadDialogOpen(false);
        setUploadForm({ files: [], documentType: 99, description: '', expirationDate: null });
        loadDocuments();
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to upload documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // ── Download / Delete ─────────────────────────────────────────────────────────

  const handleDownload = async (doc) => {
    try {
      const response = await tenantDocumentAPI.getTenantDocument(doc.id);
      if (response.success && response.data?.blobUrl) {
        window.open(response.data.blobUrl, '_blank');
      } else {
        openSnackbar({ open: true, message: 'Unable to download document', variant: 'alert', alert: { color: 'error' } });
      }
    } catch {
      openSnackbar({ open: true, message: 'Failed to download document', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;
    try {
      const response = await tenantDocumentAPI.deleteTenantDocument(documentToDelete.id);
      if (response.success) {
        openSnackbar({ open: true, message: 'Document deleted successfully', variant: 'alert', alert: { color: 'success' } });
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
        loadDocuments();
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to delete document',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────────

  if (!tenantId && !loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
          My Documents
        </Typography>
        <Alert severity="info">Please contact your landlord to link your account to a tenant profile.</Alert>
      </Box>
    );
  }

  // ── Shared Paper sx ───────────────────────────────────────────────────────────

  const panelSx = {
    borderRadius: 2,
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    bgcolor: alpha(theme.palette.background.paper, 0.6),
    boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pb: { xs: 9, sm: 0 } }}>
        {/* Page header */}
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
            My Documents
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload and manage your personal and lease documents.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 1.5, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            alignItems: 'flex-start'
          }}
        >
          {/* ── Left: Lease filter ─────────────────────────────────────────────── */}
          <Paper
            variant="outlined"
            sx={{
              width: { xs: '100%', md: 260 },
              flexShrink: { xs: 1, md: 0 },
              overflow: 'hidden',
              position: { xs: 'relative', md: 'sticky' },
              top: { md: 0 },
              ...panelSx
            }}
          >
            <Box
              sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.5 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {leases.length} {leases.length === 1 ? 'Lease' : 'Leases'}
                </Typography>
              </Stack>
            </Box>

            <Stack
              spacing={{ xs: 1, md: 0.5 }}
              direction={{ xs: 'row', md: 'column' }}
              sx={{
                p: 1,
                overflowX: { xs: 'auto', md: 'visible' },
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' }
              }}
            >
              {leases.map((lease) => {
                const leaseId = getLeaseId(lease);
                return (
                  <LeaseFilterItem
                    key={leaseId}
                    lease={lease}
                    selected={String(leaseId) === String(selectedLeaseId)}
                    mobile={isMobile}
                    onClick={() => {
                      setSelectedLeaseId(leaseId);
                      setSearchQuery('');
                    }}
                  />
                );
              })}

              {!loading && leases.length === 0 && (
                <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.disabled">
                    No leases yet
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* ── Right: Documents panel ─────────────────────────────────────────── */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Paper variant="outlined" sx={{ overflow: 'hidden', ...panelSx }}>
              {/* Panel header */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={{ xs: 1.5, sm: 2 }}
                sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {selectedLeaseLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlusOutlined />}
                  onClick={() => setUploadDialogOpen(true)}
                  fullWidth={isMobile}
                  sx={{ textTransform: 'none' }}
                >
                  Upload Document
                </Button>
              </Stack>

              {/* Search */}
              <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={isMobile ? 'Search documents...' : 'Search by name, type, or description...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined style={{ fontSize: 16, opacity: 0.55 }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              {/* Table */}
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Box sx={{ p: 2.5 }}>
                  <Alert severity="error">{error}</Alert>
                </Box>
              ) : filteredDocuments.length === 0 ? (
                <Box sx={{ textAlign: 'center', px: 2, py: { xs: 6, sm: 8 } }}>
                  <FileTextOutlined style={{ fontSize: 48, color: theme.palette.text.disabled, marginBottom: 12 }} />
                  <Typography variant="body1" color="text.secondary" fontWeight={500}>
                    {documents.length === 0
                      ? 'No documents uploaded yet'
                      : searchQuery
                        ? 'No documents match your search'
                        : `No documents for this lease`}
                  </Typography>
                  {documents.length === 0 && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PlusOutlined />}
                      onClick={() => setUploadDialogOpen(true)}
                      sx={{ mt: 2, textTransform: 'none' }}
                    >
                      Upload Your First Document
                    </Button>
                  )}
                </Box>
              ) : isMobile ? (
                <Stack spacing={1.25} sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
                  {filteredDocuments.map((doc) => {
                    const expired = isExpired(doc.expirationDate);
                    const expiring = isExpiringSoon(doc.expirationDate);
                    const docColor = getDocTypeColor(doc.documentType);

                    return (
                      <Paper
                        key={doc.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          borderColor: alpha(expired ? theme.palette.error.main : docColor, expired ? 0.35 : 0.16),
                          bgcolor: expired ? alpha(theme.palette.error.main, 0.04) : alpha(theme.palette.background.paper, 0.72)
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Stack direction="row" spacing={1.25} alignItems="flex-start">
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1.75,
                                bgcolor: alpha(docColor, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {doc.documentType === 10 ? (
                                <FileProtectOutlined style={{ fontSize: 18, color: docColor }} />
                              ) : (
                                <FileTextOutlined style={{ fontSize: 18, color: docColor }} />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                                {doc.fileName}
                              </Typography>
                              {doc.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                                >
                                  {doc.description}
                                </Typography>
                              )}
                            </Box>
                          </Stack>

                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            <Chip
                              label={DOCUMENT_TYPE_LABELS[doc.documentType] || 'Other'}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 24, borderColor: alpha(docColor, 0.4), color: docColor }}
                            />
                            {doc.expirationDate && (
                              <Chip
                                label={`Expires ${formatDate(doc.expirationDate)}`}
                                size="small"
                                color={expired ? 'error' : expiring ? 'warning' : 'default'}
                                icon={expired || expiring ? <WarningOutlined /> : undefined}
                                sx={{ height: 24, fontSize: '0.7rem' }}
                              />
                            )}
                            <Chip
                              label={`Uploaded ${formatDate(doc.uploadDate || doc.createdAt)}`}
                              size="small"
                              sx={{ height: 24, fontSize: '0.7rem' }}
                            />
                          </Stack>

                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              startIcon={<DownloadOutlined />}
                              onClick={() => handleDownload(doc)}
                              sx={{ textTransform: 'none' }}
                            >
                              Download
                            </Button>
                            {canDeleteDocument(doc) && (
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                fullWidth
                                startIcon={<DeleteOutlined />}
                                onClick={() => {
                                  setDocumentToDelete(doc);
                                  setDeleteDialogOpen(true);
                                }}
                                sx={{ textTransform: 'none' }}
                              >
                                Delete
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                        <TableCell sx={{ width: '40%', fontWeight: 600, fontSize: '0.75rem' }}>Document</TableCell>
                        <TableCell sx={{ width: '18%', fontWeight: 600, fontSize: '0.75rem' }}>Type</TableCell>
                        <TableCell sx={{ width: '20%', fontWeight: 600, fontSize: '0.75rem' }}>Expiration</TableCell>
                        <TableCell sx={{ width: '14%', fontWeight: 600, fontSize: '0.75rem' }}>Uploaded</TableCell>
                        <TableCell sx={{ width: '8%' }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredDocuments.map((doc) => {
                        const expired = isExpired(doc.expirationDate);
                        const expiring = isExpiringSoon(doc.expirationDate);
                        const docColor = getDocTypeColor(doc.documentType);

                        return (
                          <TableRow
                            key={doc.id}
                            sx={{
                              '&:last-child td': { borderBottom: 0 },
                              bgcolor: expired ? alpha('#f5222d', 0.03) : 'transparent'
                            }}
                          >
                            {/* Document name */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box
                                  sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(docColor, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  {doc.documentType === 10 ? (
                                    <FileProtectOutlined style={{ fontSize: 16, color: docColor }} />
                                  ) : (
                                    <FileTextOutlined style={{ fontSize: 16, color: docColor }} />
                                  )}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {doc.fileName}
                                  </Typography>
                                  {doc.description && (
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                      {doc.description}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>

                            {/* Type */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={DOCUMENT_TYPE_LABELS[doc.documentType] || 'Other'}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 22, borderColor: alpha(docColor, 0.4), color: docColor }}
                              />
                            </TableCell>

                            {/* Expiration */}
                            <TableCell sx={{ py: 1.5 }}>
                              {doc.expirationDate ? (
                                <Stack spacing={0.5}>
                                  <Typography variant="caption" color={expired ? 'error.main' : 'text.secondary'}>
                                    {formatDate(doc.expirationDate)}
                                  </Typography>
                                  {expired && (
                                    <Chip
                                      label="Expired"
                                      size="small"
                                      color="error"
                                      icon={<WarningOutlined />}
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                  {expiring && !expired && (
                                    <Chip
                                      label="Expiring Soon"
                                      size="small"
                                      color="warning"
                                      icon={<WarningOutlined />}
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Stack>
                              ) : (
                                <Typography variant="caption" color="text.disabled">
                                  —
                                </Typography>
                              )}
                            </TableCell>

                            {/* Uploaded */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(doc.uploadDate || doc.createdAt)}
                              </Typography>
                            </TableCell>

                            {/* Actions */}
                            <TableCell sx={{ py: 1.5 }} align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Tooltip title="Download">
                                  <IconButton size="small" onClick={() => handleDownload(doc)} sx={{ color: 'text.secondary' }}>
                                    <DownloadOutlined style={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                {canDeleteDocument(doc) ? (
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => {
                                        setDocumentToDelete(doc);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <DeleteOutlined style={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="Uploaded by your landlord — cannot be deleted">
                                    <span>
                                      <IconButton size="small" disabled>
                                        <DeleteOutlined style={{ fontSize: 15 }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>
        </Box>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box>
                <input
                  accept="*/*"
                  style={{ display: 'none' }}
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={(e) => setUploadForm({ ...uploadForm, files: Array.from(e.target.files) })}
                />
                <label htmlFor="file-upload">
                  <Button variant="outlined" component="span" fullWidth startIcon={<UploadOutlined />}>
                    {uploadForm.files.length > 0 ? `${uploadForm.files.length} file(s) selected` : 'Select Files'}
                  </Button>
                </label>
                {uploadForm.files.map((f, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    • {f.name}
                  </Typography>
                ))}
              </Box>
              <FormControl fullWidth>
                <InputLabel>Document Type</InputLabel>
                <Select
                  value={uploadForm.documentType}
                  label="Document Type"
                  onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={Number(value)}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Description (Optional)"
                multiline
                rows={3}
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Add a description for this document..."
              />
              <DatePicker
                label="Expiration Date (Optional)"
                value={uploadForm.expirationDate}
                onChange={(date) => setUploadForm({ ...uploadForm, expirationDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleUpload} disabled={!uploadForm.files.length}>
              Upload
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <ConfirmationDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDocumentToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Document"
          message={`Are you sure you want to delete "${documentToDelete?.fileName}"? This action cannot be undone.`}
        />
      </Box>
    </LocalizationProvider>
  );
}
