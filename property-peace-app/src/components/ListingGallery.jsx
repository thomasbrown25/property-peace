import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import listingApi from 'api/listing';
import { moveListingImage, orderedListingImages, withoutListingImage } from './listingGalleryOrder.mjs';

// onImagesChange keeps the listing header in sync without refetching the entire page.
export default function ListingGallery({ listing, onImagesChange }) {
  const listingId = listing?.id;
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const inputRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setImages(orderedListingImages(listing?.images || []));
  }, [listing?.images, listingId]);

  const showImages = (next) => {
    const ordered = orderedListingImages(next);
    setImages(ordered);
    onImagesChange?.(ordered);
  };

  const refresh = async () => {
    const result = await listingApi.getListingImages(listingId);
    if (result?.success === false) throw new Error(result.message);
    showImages(result?.data || []);
  };

  const mutate = async (action) => {
    if (busy || !listingId) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not save photos. Please try again.');
      try { await refresh(); } catch { /* Retain the current photos until the next load. */ }
    } finally {
      setBusy(false);
    }
  };

  const upload = (files) => {
    const photos = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (photos.length) mutate(async () => {
      const result = await listingApi.uploadListingImages(listingId, photos);
      if (!images.length && result?.data?.[0]?.id) await listingApi.setCoverPhoto(result.data[0].id, listingId);
    });
  };

  const reorder = (targetId) => {
    const next = moveListingImage(images, dragId, targetId);
    setDragId(null);
    if (next === images || busy) return;
    mutate(() => listingApi.reorderListingImages(listingId, next.map((image) => image.id)));
  };

  const remove = async (imageId) => {
    if (busy || !listingId) return;
    const { previous, remaining, wasCover } = withoutListingImage(images, imageId);
    setBusy(true);
    setError('');
    showImages(remaining); // Starts the tile exit animation before waiting on the API.
    let deleted = false;
    try {
      const response = await listingApi.deleteListingImage(imageId);
      if (response?.success === false) throw new Error(response.message);
      deleted = true;
      if (wasCover && remaining.length) {
        const orderResponse = await listingApi.reorderListingImages(listingId, remaining.map((photo) => photo.id));
        if (orderResponse?.success === false) throw new Error(orderResponse.message);
      }
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not remove photo. Please try again.');
      if (deleted) {
        // The deletion may have succeeded even if cover promotion or reconciliation failed.
        try { await refresh(); } catch { showImages(remaining); }
      } else {
        showImages(previous);
      }
    } finally {
      setBusy(false);
    }
  };

  const sorted = orderedListingImages(images);
  return (
    <Box onDragOver={(event) => { if (event.dataTransfer?.types?.includes('Files')) event.preventDefault(); }}
      onDrop={(event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault();
          upload(event.dataTransfer.files);
        }
      }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Gallery</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag photos to reorder. The first photo is the cover. Drop image files here to upload.
      </Typography>
      {error && <Typography role="alert" color="error" sx={{ mb: 2 }}>{error}</Typography>}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <AnimatePresence initial={false}>
          {sorted.map((image, index) => (
            <Box component={motion.div} layout={!reduceMotion} key={image.id}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
              draggable={!busy} onDragStart={(event) => {
                setDragId(image.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(image.id));
              }} onDragEnd={() => setDragId(null)}
              onDragOver={(event) => { if (dragId != null) event.preventDefault(); }}
              onDrop={(event) => { if (dragId != null) { event.preventDefault(); event.stopPropagation(); reorder(image.id); } }}
              sx={{ position: 'relative', width: { xs: 'calc(50% - 6px)', sm: index === 0 ? 240 : 120 },
                height: 160, overflow: 'hidden', borderRadius: 1, border: '1px solid', borderColor: 'divider', cursor: 'grab' }}>
              {index === 0 && <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, py: 0.5, bgcolor: 'background.paper' }}>Cover photo</Typography>}
              <Box component="img" src={image.blobUrl} alt={index === 0 ? 'Cover photo' : `Listing photo ${index + 1}`}
                sx={{ width: '100%', height: index === 0 ? 'calc(100% - 28px)' : '100%', objectFit: 'cover' }} />
              <IconButton aria-label={`Remove photo ${index + 1}`} disabled={busy} size="small"
                onClick={() => remove(image.id)}
                sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}>
                <CloseOutlined />
              </IconButton>
            </Box>
          ))}
        </AnimatePresence>
        <Button variant="outlined" disabled={busy || !listingId} startIcon={busy ? <CircularProgress size={16} /> : <PlusOutlined />}
          onClick={() => inputRef.current?.click()}
          sx={{ width: { xs: 'calc(50% - 6px)', sm: 120 }, minHeight: 160, borderStyle: 'dashed', flexDirection: 'column' }}>
          Add photos
        </Button>
      </Box>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden aria-label="Choose listing photos"
        onChange={(event) => { upload(event.target.files); event.target.value = ''; }} />
    </Box>
  );
}
