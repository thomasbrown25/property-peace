import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { maintenanceProblemMessage, maintenanceWorkflowAPI } from 'api/maintenanceWorkflow';

const isImage = (item) => String(item?.contentType || '').startsWith('image/') || String(item?.mediaType).toLowerCase() === 'photo';
const isVideo = (item) => String(item?.contentType || '').startsWith('video/') || String(item?.mediaType).toLowerCase() === 'video';

export default function MaintenanceEvidenceList({ maintenanceId, attachments = [] }) {
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const loadBlob = async (item, download = false) => {
    setBusyId(item.id); setError('');
    try {
      const response = await maintenanceWorkflowAPI.downloadAttachment(maintenanceId, item.id);
      const url = URL.createObjectURL(response.data);
      if (download) {
        const link = document.createElement('a'); link.href = url; link.download = item.fileName || `maintenance-evidence-${item.id}`;
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      } else {
        setPreview((current) => { if (current?.url) URL.revokeObjectURL(current.url); return { item, url }; });
      }
    } catch (requestError) { setError(maintenanceProblemMessage(requestError, 'Evidence could not be opened.')); }
    finally { setBusyId(null); }
  };

  return <Stack spacing={1}>
    {error && <Alert severity="error">{error}</Alert>}
    {attachments.length ? attachments.map((item) => <Box key={item.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
        <Box minWidth={0}><Typography variant="body2" fontWeight={650} noWrap>{item.fileName}</Typography><Typography variant="caption" color="text.secondary">{item.mediaType} · {item.purpose}</Typography></Box>
        <Stack direction="row" spacing={1}>
          {(isImage(item) || isVideo(item)) && <Button size="small" onClick={() => loadBlob(item)} disabled={busyId === item.id}>{busyId === item.id ? <CircularProgress size={14} /> : 'Preview'}</Button>}
          <Button size="small" onClick={() => loadBlob(item, true)} disabled={busyId === item.id}>Download</Button>
        </Stack>
      </Stack>
      {preview?.item.id === item.id && <Box sx={{ mt: 1, overflow: 'hidden', borderRadius: 1, bgcolor: 'black' }}>
        {isImage(item) ? <Box component="img" src={preview.url} alt={item.fileName} sx={{ display: 'block', width: '100%', maxHeight: 440, objectFit: 'contain' }} /> :
          <Box component="video" src={preview.url} controls preload="metadata" sx={{ display: 'block', width: '100%', maxHeight: 440 }} />}
      </Box>}
    </Box>) : <Typography variant="body2" color="text.secondary">No evidence uploaded.</Typography>}
  </Stack>;
}
