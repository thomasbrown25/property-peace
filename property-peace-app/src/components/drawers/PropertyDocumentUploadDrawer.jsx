import { useId, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, IconButton, MenuItem, Stack, TextField, Toolbar, Typography } from '@mui/material';
import { fileAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import AppIcon from 'components/AppIcon';
import ThemeAdaptiveDrawer from './shared/ThemeAdaptiveDrawer';

const categories = [
  { id: 1, name: 'Landlord Insurance Policy' },
  { id: 2, name: 'Utility & Maintenance' },
  { id: 3, name: 'Loan & Financial Documents' },
  { id: 4, name: 'Other Documents' }
];

export default function PropertyDocumentUploadDrawer({ open, onClose, propertyId, onUploaded }) {
  const headingId = useId();
  const fileInput = useRef(null);
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(4);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const resetAndClose = () => {
    setFiles([]);
    setTitle('');
    setCategoryId(4);
    setDragging(false);
    onClose();
  };

  const handleClose = () => {
    if (!uploading) resetAndClose();
  };

  const selectFiles = (fileList) => {
    if (!uploading && fileList.length) setFiles(Array.from(fileList));
  };

  const canUpload = Boolean(propertyId && files.length && title.trim()) && !uploading;
  const handleUpload = async (event) => {
    event.preventDefault();
    if (!canUpload) return;

    setUploading(true);
    try {
      const response = await fileAPI.uploadFiles(files, { title: title.trim(), propertyId, categoryId });
      if (!response?.success) throw new Error(response?.message || 'Failed to upload documents');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    } finally {
      setUploading(false);
    }

    resetAndClose();
    onUploaded();
    openSnackbar({
      open: true,
      message: files.length === 1 ? 'Document uploaded successfully' : 'Documents uploaded successfully',
      variant: 'alert',
      alert: { color: 'success' }
    });
  };

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={handleClose}
      slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-labelledby': headingId, sx: { width: '100%', maxWidth: 560 } } }}
    >
      <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography id={headingId} component="h2" variant="h5">Upload a document</Typography>
          <Typography variant="body2" color="text.secondary">Add files to this property’s Documents tab.</Typography>
        </Box>
        <IconButton aria-label="Close upload drawer" onClick={handleClose} disabled={uploading}>
          <AppIcon name="close" size={16} />
        </IconButton>
      </Toolbar>
      <Divider />
      <Stack component="form" onSubmit={handleUpload} sx={{ flex: 1, minHeight: 0 }}>
        <Stack spacing={2.5} sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
          <Stack
            spacing={1.5}
            alignItems="center"
            onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}
            sx={{ p: 3, border: '1px dashed', borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 2 }}
          >
            <input ref={fileInput} type="file" multiple hidden disabled={uploading} onChange={(event) => {
              selectFiles(event.target.files);
              event.target.value = '';
            }} />
            <Button type="button" variant="outlined" onClick={() => fileInput.current?.click()} disabled={uploading} startIcon={<AppIcon name="uploadDocument" />}>
              {files.length ? 'Change files' : 'Choose files'}
            </Button>
            {files.length ? (
              <Box component="ul" sx={{ pl: 2, m: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                {files.map((file, index) => <Typography component="li" variant="body2" key={`${file.name}-${index}`}>{file.name}</Typography>)}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">You can also drag and drop files here.</Typography>}
          </Stack>
          <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required disabled={uploading} />
          <TextField select label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={uploading}>
            {categories.map(({ id, name }) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
          </TextField>
        </Stack>
        <Divider />
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 2 }}>
          <Button type="button" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canUpload} startIcon={uploading ? <CircularProgress size={16} /> : <AppIcon name="uploadDocument" />}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </Stack>
      </Stack>
    </ThemeAdaptiveDrawer>
  );
}
