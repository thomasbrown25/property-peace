import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  alpha,
  useTheme,
  CircularProgress,
  IconButton
} from '@mui/material';
import { ArrowLeftOutlined, CloseOutlined, StarOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing, updateListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import listingApi from 'api/listing';
import { openSnackbar } from 'api/snackbar';

export default function ListingSetupPhotosPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [galleryNewFiles, setGalleryNewFiles] = useState([]);
  const [galleryPreviews, setGalleryPreviews] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [videoTourUrl, setVideoTourUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  useEffect(() => {
    if (listing) {
      setVideoTourUrl(listing.videoTourUrl ?? '');
    }
  }, [listing]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (galleryNewFiles.length === 0) {
      setGalleryPreviews([]);
      return;
    }
    const urls = galleryNewFiles.map((f) => URL.createObjectURL(f));
    setGalleryPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [galleryNewFiles]);

  const handleBack = () => navigate(`/landlord/listings/${id}/setup`);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setCoverFile(file);
    e.target.value = '';
  };

  const handleGalleryAdd = (e) => {
    const files = e.target.files;
    if (files?.length) setGalleryNewFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = '';
  };

  const removeGalleryNewFile = (index) => {
    setGalleryNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageId) => {
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const listingId = parseInt(id);
      for (const imageId of removedImageIds) {
        await listingApi.deleteListingImage(imageId);
      }
      const filesToUpload = [coverFile, ...galleryNewFiles].filter(Boolean);
      if (filesToUpload.length > 0) {
        const res = await listingApi.uploadListingImages(listingId, filesToUpload);
        if (res?.data?.length && coverFile) {
          await listingApi.setCoverPhoto(res.data[0].id, listingId);
        }
      }
      if (videoTourUrl !== (listing?.videoTourUrl ?? '')) {
        await dispatch(updateListing(listingId, { videoTourUrl: videoTourUrl || null }));
      }
      dispatch(getListingById(listingId));
      openSnackbar({ open: true, message: 'Photos & media saved', variant: 'alert', alert: { color: 'success' } });
      navigate(`/landlord/listings/${id}/setup`);
    } catch (e) {
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || 'Failed to save',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !listing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const propertyDisplay = listing.propertyName || 'Property';
  const unitDisplay = listing.unitName || 'Whole property';
  const addressDisplay = listing.propertyAddress || '';
  const existingImages = listing.images ?? [];
  const existingToShow = existingImages.filter((img) => !removedImageIds.includes(img.id));
  const coverImage = existingToShow.find((img) => img.isCoverPhoto);
  const galleryImages = existingToShow.filter((img) => !img.isCoverPhoto);

  const handleSetAsCover = async (imageId) => {
    try {
      await listingApi.setCoverPhoto(imageId, parseInt(id));
      dispatch(getListingById(parseInt(id)));
      openSnackbar({ open: true, message: 'Cover photo updated', variant: 'alert', alert: { color: 'success' } });
    } catch (e) {
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || 'Failed to set cover photo',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Listings', path: '/landlord/listings' },
          { label: listing.listingNumber ?? 'Listing' },
          { label: 'Set Up', path: `/landlord/listings/${id}/setup` },
          { label: 'Photos & media' }
        ]}
      />

      <Box
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={1} alignItems="flex-start">
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowLeftOutlined style={{ fontSize: 14 }} />}
              onClick={handleBack}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
                minWidth: 'auto',
                width: 'fit-content',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              BACK
            </Button>
            <Typography variant="h4" fontWeight={700}>
              {propertyDisplay} – {unitDisplay}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {addressDisplay}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <MainCard
        title="Photos & media"
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        <Stack spacing={3} sx={{ maxWidth: 720 }}>
          {/* Cover photo – shown only here; not repeated in gallery */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Cover photo
            </Typography>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
                minHeight: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
              onClick={() => document.getElementById('photos-cover-input')?.click()}
            >
              <input
                id="photos-cover-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverChange}
              />
              {coverPreview ? (
                <Box sx={{ position: 'relative', width: '100%', maxHeight: 280 }}>
                  <Box
                    component="img"
                    src={coverPreview}
                    alt="Cover preview"
                    sx={{
                      width: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      borderRadius: 1
                    }}
                  />
                </Box>
              ) : coverImage ? (
                <Box sx={{ position: 'relative', width: '100%', maxHeight: 280 }}>
                  <Box
                    component="img"
                    src={coverImage.blobUrl}
                    alt="Cover"
                    sx={{
                      width: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      borderRadius: 1
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Click to replace cover photo
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary">
                  {coverFile ? coverFile.name : 'Click to upload cover photo'}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Gallery – excludes cover photo so it only appears in the section above */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Gallery
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={2}>
              {galleryImages.map((image) => (
                <Box
                  key={image.id}
                  sx={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box
                    component="img"
                    src={image.blobUrl}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleSetAsCover(image.id);
                      }}
                      title="Set as cover photo"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        width: 28,
                        height: 28,
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                    >
                      <StarOutlined style={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => removeExistingImage(image.id)}
                      sx={{
                        bgcolor: 'error.main',
                        color: 'white',
                        width: 28,
                        height: 28,
                        '&:hover': { bgcolor: 'error.dark' }
                      }}
                    >
                      <CloseOutlined style={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
              {galleryPreviews.map((url, index) => (
                <Box
                  key={`new-${index}`}
                  sx={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box
                    component="img"
                    src={url}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeGalleryNewFile(index)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      bgcolor: 'error.main',
                      color: 'white',
                      width: 28,
                      height: 28,
                      '&:hover': { bgcolor: 'error.dark' }
                    }}
                  >
                    <CloseOutlined style={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                onClick={() => document.getElementById('photos-gallery-input')?.click()}
              >
                <input
                  id="photos-gallery-input"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleGalleryAdd}
                />
                <Typography variant="caption" color="text.secondary">
                  Add photos
                </Typography>
              </Box>
            </Stack>
          </Box>

          <TextField
            fullWidth
            label="Video tour URL"
            placeholder="https://..."
            value={videoTourUrl}
            onChange={(e) => setVideoTourUrl(e.target.value)}
          />

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handleBack}
              sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </MainCard>
    </Box>
  );
}
