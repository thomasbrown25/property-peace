import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  alpha,
  useTheme,
  IconButton,
  CircularProgress,
  Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowLeftOutlined, UploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { tenantDocumentAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { useSelector } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import { formatDate } from 'utils/formatters';

// Document types for upload - excluding Lease Addendum (value 11)
const DOCUMENT_TYPE_OPTIONS = [
  { value: 10, label: 'Lease Agreement' },
  { value: 40, label: 'Condition Report' },
  { value: 99, label: 'Forms' },
  { value: 99, label: 'Other' }
];

export default function LeaseUploadDocumentPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const lease = properties
    ?.flatMap((p) =>
      (p.units || [])
        .filter((u) => u.lease)
        .map((u) => ({ ...u.lease, unit: u, property: p }))
    )
    ?.find((l) => l?.id?.toString() === leaseId);

  const tenants = lease?.tenants || lease?.Tenants || [];

  const [file, setFile] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState(10);
  const [shareWithTenants, setShareWithTenants] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);

  const loadDocuments = async () => {
    if (!leaseId) return;
    try {
      setLoadingDocuments(true);
      const res = await tenantDocumentAPI.getTenantDocumentsByLease(leaseId);
      if (res?.success && res?.data) {
        setDocuments(Array.isArray(res.data) ? res.data : res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [leaseId]);

  useEffect(() => {
    if (file) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setDocumentTitle(baseName);
    }
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setDocumentTitle('');
  };

  const handleUpload = async () => {
    if (!file) {
      openSnackbar({ open: true, message: 'Please select a file to upload', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    if (!documentTitle?.trim()) {
      openSnackbar({ open: true, message: 'Please enter a document title', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    setUploading(true);
    try {
      const isPrivate = !shareWithTenants;
      const leaseIdNum = parseInt(leaseId, 10);

      if (tenants.length === 0) {
        await tenantDocumentAPI.uploadLeaseDocuments(leaseId, [file], {
          description: documentTitle.trim(),
          documentType,
          isPrivate
        });
      } else {
        const tenantIds = shareWithTenants ? tenants.map((t) => t.id || t.Id) : [tenants[0].id || tenants[0].Id];
        for (const tenantId of tenantIds) {
          await tenantDocumentAPI.uploadTenantDocuments(tenantId, [file], {
            description: documentTitle.trim(),
            documentType,
            leaseId: leaseIdNum,
            isPrivate
          });
        }
      }
      openSnackbar({
        open: true,
        message: 'Document uploaded successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setFile(null);
      setDocumentTitle('');
      loadDocuments();
      propertiesRefetch();
    } catch (err) {
      console.error('Error uploading document:', err);
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to upload document',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (doc) => {
    try {
      const res = await tenantDocumentAPI.getTenantDocument(doc.id);
      if (res?.success && res?.data?.blobUrl) {
        window.open(res.data.blobUrl, '_blank');
      }
    } catch (err) {
      openSnackbar({ open: true, message: 'Unable to view document', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const getDocumentTypeLabel = (type) => DOCUMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'Other';

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: lease ? `${lease.unit?.property?.name || 'Lease'} - Upload Document` : 'Upload Document' }
        ]}
      />

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 3, mb: 2 }}>
        <IconButton onClick={() => navigate(`/landlord/leases/${leaseId}`)}>
          <ArrowLeftOutlined />
        </IconButton>
        <Typography variant="h4" fontWeight={700}>
          Upload Your Document
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Store and/or share lease agreements, addendums, or other lease related documents. You can upload before adding tenants.
      </Typography>

      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Left: Upload document card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            title="Upload document"
            sx={{
              height: '100%',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2
            }}
          >
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Box
                  sx={{
                    p: 2,
                    border: `2px dashed ${alpha(theme.palette.primary.main, 0.5)}`,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <input
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    id="lease-doc-upload"
                    type="file"
                    onChange={handleFileChange}
                  />
                  {file ? (
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ width: '100%' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <FileTextOutlined style={{ fontSize: 22, color: theme.palette.primary.main, flexShrink: 0 }} />
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {file.name}
                        </Typography>
                      </Stack>
                      <IconButton size="small" onClick={handleRemoveFile} color="error" title="Remove file">
                        <DeleteOutlined />
                      </IconButton>
                    </Stack>
                  ) : (
                    <label htmlFor="lease-doc-upload" style={{ width: '100%' }}>
                      <Button variant="outlined" size="small" component="span" fullWidth startIcon={<UploadOutlined />} sx={{ py: 1.25 }}>
                        Select File
                      </Button>
                    </label>
                  )}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'stretch' }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadOutlined />}
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  sx={{ textTransform: 'uppercase', fontWeight: 600, borderRadius: 1, py: 1.25 }}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Document Title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              inputProps={{ maxLength: 250 }}
              helperText={`${documentTitle.length} / 250 characters used`}
              sx={{ mb: 3 }}
            />

            <FormControl fullWidth sx={{ mb: 3 }} required>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={documentType}
                label="Document Type"
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt, i) => (
                  <MenuItem key={`${opt.value}-${opt.label}-${i}`} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                {tenants.length > 0
                  ? 'Do you want to share your uploaded document with the tenants on this lease?'
                  : 'When tenants are added, should they see this document?'}
              </Typography>
              <RadioGroup
                row
                value={shareWithTenants}
                onChange={(e) => setShareWithTenants(e.target.value === 'true')}
              >
                <FormControlLabel value={true} control={<Radio />} label="Yes, Share It" />
                <FormControlLabel value={false} control={<Radio />} label="No, Keep It Private" />
              </RadioGroup>
            </FormControl>

          </MainCard>
        </Grid>

        {/* Right: Documents list */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            title="Documents"
            sx={{
              height: '100%',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2
            }}
          >
            {loadingDocuments ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No documents uploaded yet for this lease.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {documents.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.background.paper, 0.6),
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={600} noWrap>
                          {doc.description || doc.fileName}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography variant="caption" color="text.secondary">
                            {getDocumentTypeLabel(doc.documentType)} • {formatDate(doc.createdAt)}
                          </Typography>
                          <Chip
                            size="small"
                            label={doc.isPrivate ? 'Private' : 'Shared with tenants'}
                            color={doc.isPrivate ? 'default' : 'primary'}
                            variant={doc.isPrivate ? 'outlined' : 'filled'}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Stack>
                      </Box>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleViewDocument(doc)}
                      startIcon={<FileTextOutlined />}
                      sx={{ flexShrink: 0, ml: 1 }}
                    >
                      View
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
