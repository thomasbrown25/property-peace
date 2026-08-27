import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { CloseOutlined, DeleteOutlined, FileTextOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { tenantDocumentAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { DOCUMENT_TYPE_OPTIONS, getDocumentTitleFromFile, getDocumentTypeApiValue } from './leaseDocumentUpload';

export { getDocumentTitleFromFile } from './leaseDocumentUpload';

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx'];

const isAcceptedFile = (file) => {
  const extension = file?.name?.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(extension);
};

export default function LeaseDocumentUploadDrawer({ open, onClose, leaseId, tenants = [], onUploaded }) {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPE_OPTIONS[0].value);
  const [shareWithTenants, setShareWithTenants] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const resetForm = useCallback(() => {
    setFile(null);
    setDocumentTitle('');
    setDocumentType(DOCUMENT_TYPE_OPTIONS[0].value);
    setShareWithTenants(true);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    if (!isAcceptedFile(nextFile)) {
      openSnackbar({
        open: true,
        message: 'Choose a PDF, DOC, or DOCX file',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    setFile(nextFile);
    setDocumentTitle(getDocumentTitleFromFile(nextFile));
  };

  const handleFileChange = (event) => selectFile(event.target.files?.[0]);

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const handleRemoveFile = (event) => {
    event.stopPropagation();
    setFile(null);
    setDocumentTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (!uploading) onClose();
  };

  const handleUpload = async () => {
    if (!file || !documentTitle.trim() || !leaseId) return;

    setUploading(true);
    try {
      const isPrivate = !shareWithTenants;
      const documentTypeApiValue = getDocumentTypeApiValue(documentType);
      const leaseIdNumber = Number.parseInt(leaseId, 10);

      if (tenants.length === 0) {
        await tenantDocumentAPI.uploadLeaseDocuments(leaseId, [file], {
          description: documentTitle.trim(),
          documentType: documentTypeApiValue,
          isPrivate
        });
      } else {
        const tenantIds = shareWithTenants
          ? tenants.map((tenant) => tenant.id || tenant.Id).filter(Boolean)
          : [tenants[0].id || tenants[0].Id];

        for (const tenantId of tenantIds) {
          await tenantDocumentAPI.uploadTenantDocuments(tenantId, [file], {
            description: documentTitle.trim(),
            documentType: documentTypeApiValue,
            leaseId: leaseIdNumber,
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
      try {
        await onUploaded?.();
      } catch (refreshError) {
        console.error('Document uploaded, but lease data could not be refreshed:', refreshError);
      }
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error uploading lease document:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to upload document',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploading(false);
    }
  };

  const hasTenants = tenants.length > 0;
  const dropBorder = dragActive ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.5);

  return (
    <ThemeAdaptiveDrawer open={open} onClose={handleClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' } }}>
      <Toolbar sx={{ minHeight: 72, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5">Upload document</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add a lease agreement, addendum, or related file without leaving this lease.
          </Typography>
        </Box>
        <IconButton aria-label="Close upload document drawer" onClick={handleClose} disabled={uploading}>
          <CloseOutlined />
        </IconButton>
      </Toolbar>
      <Divider />

      <Stack spacing={3} sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            File
          </Typography>
          <Box
            role="button"
            tabIndex={0}
            aria-label="Choose a lease document"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              width: '100%',
              maxWidth: 330,
              aspectRatio: '1 / 1',
              mx: 'auto',
              display: 'grid',
              placeItems: 'center',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              border: `2px dashed ${dropBorder}`,
              borderRadius: 2,
              bgcolor: dragActive ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.045),
              transition: 'border-color 160ms ease, background-color 160ms ease, transform 160ms ease',
              transform: dragActive ? 'scale(1.01)' : 'none',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              },
              '&:focus-visible': {
                outline: `3px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                outlineOffset: 3
              }
            }}
          >
            <input ref={fileInputRef} accept=".pdf,.doc,.docx" type="file" hidden onChange={handleFileChange} />
            {file ? (
              <Stack spacing={2} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main'
                  }}
                >
                  <FileTextOutlined style={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ minWidth: 0, width: '100%' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Click or drop another file to replace it
                  </Typography>
                </Box>
                <Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlined />} onClick={handleRemoveFile}>
                  Remove
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main'
                  }}
                >
                  <InboxOutlined style={{ fontSize: 30 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
                    Drag and drop your document here
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    or click anywhere in this square to browse
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  PDF, DOC, or DOCX
                </Typography>
              </Stack>
            )}
          </Box>
        </Box>

        <TextField
          fullWidth
          required
          label="Document title"
          value={documentTitle}
          onChange={(event) => setDocumentTitle(event.target.value)}
          inputProps={{ maxLength: 250 }}
          helperText={`${documentTitle.length} / 250 characters used`}
        />

        <FormControl fullWidth required>
          <InputLabel>Document type</InputLabel>
          <Select value={documentType} label="Document type" onChange={(event) => setDocumentType(event.target.value)}>
            {DOCUMENT_TYPE_OPTIONS.map((option, index) => (
              <MenuItem key={`${option.value}-${option.label}-${index}`} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl component="fieldset">
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Tenant access
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {hasTenants
              ? 'Choose whether tenants on this lease can view the document.'
              : 'Choose whether future tenants added to this lease can view the document.'}
          </Typography>
          <RadioGroup
            value={shareWithTenants ? 'shared' : 'private'}
            onChange={(event) => setShareWithTenants(event.target.value === 'shared')}
          >
            <FormControlLabel value="shared" control={<Radio />} label="Share with tenants" />
            <FormControlLabel value="private" control={<Radio />} label="Keep private" />
          </RadioGroup>
        </FormControl>
      </Stack>

      <Divider />
      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Button variant="outlined" onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadOutlined />}
          onClick={handleUpload}
          disabled={uploading || !file || !documentTitle.trim()}
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </Button>
      </Stack>
    </ThemeAdaptiveDrawer>
  );
}

LeaseDocumentUploadDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  leaseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tenants: PropTypes.array,
  onUploaded: PropTypes.func
};
