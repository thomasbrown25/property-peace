import React, { useMemo, useState } from 'react';
import { ImageList, ImageListItem, IconButton, Dialog, DialogContent, useMediaQuery, Box, Typography } from '@mui/material';
import { CloseIcon } from '@mui/icons-material';

const MaintenanceImageList = ({
  images = [], // [{ id, blobUrl, alt }]
  onDelete, // (id) => void
  cols = { xs: 2, sm: 3, md: 4 }, // responsive column counts
  rowHeight = 140, // grid cell height
  showDelete = false, // toggle delete overlay button
  title
}) => {
  const isXs = useMediaQuery('(max-width:600px)');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const resolvedCols = useMemo(() => {
    // pick columns based on current screen size
    if (isXs) return cols.xs ?? 2;
    if (window.matchMedia('(max-width:900px)').matches) return cols.sm ?? 3;
    return cols.md ?? 4;
  }, [cols, isXs]);

  const handleOpen = (i) => {
    setIdx(i);
    setOpen(true);
  };

  const next = () => setIdx((i) => (i + 1) % images.length);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);

  return (
    <>
      <Box display="flex" justifyContent="space-between" mt={2} mb={2}>
        {title ? (
          <Box mr={7}>
            <Typography variant="body3" mb={1}>
              {title}
            </Typography>
          </Box>
        ) : (
          <Box mr={21} />
        )}
        {!images || images.length === 0 ? (
          <Box p={2} border="1px dashed #ddd" borderRadius="8px" textAlign="center" width="100%">
            <Typography variant="body2" color="text">
              No photos yet.
            </Typography>
          </Box>
        ) : (
          <ImageList cols={resolvedCols} rowHeight={rowHeight} gap={8} sx={{ mt: 2 }}>
            {images.map((img, i) => (
              <ImageListItem
                key={img.id ?? img.blobUrl ?? i}
                sx={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  '& img': { cursor: 'pointer' }
                }}
              >
                <img
                  src={img.blobUrl}
                  alt={img.alt || `Maintenance photo ${i + 1}`}
                  loading="lazy"
                  onClick={() => handleOpen(i)}
                  onError={(e) => {
                    e.currentTarget.style.opacity = 0.2;
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {showDelete && onDelete && (
                  <IconButton
                    size="small"
                    onClick={() => onDelete(img.id ?? i)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                    aria-label="delete image"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Box>

      {/* Lightbox / Preview */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <Box display="flex" alignItems="center" justifyContent="space-between" px={1} pt={1}>
          <IconButton onClick={() => setOpen(false)}>
            <Close />
          </IconButton>
          <Typography variant="button" color="text">
            {idx + 1} / {images.length}
          </Typography>
          <Box width={40} /> {/* spacer */}
        </Box>
        <DialogContent
          sx={{
            position: 'relative',
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#000'
          }}
        >
          <img
            src={images[idx]?.blobUrl}
            alt={images[idx]?.alt || `Maintenance photo ${idx + 1}`}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
          {images.length > 1 && (
            <>
              <IconButton
                onClick={prev}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' }
                }}
                aria-label="previous image"
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                onClick={next}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' }
                }}
                aria-label="next image"
              >
                <ChevronRight />
              </IconButton>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MaintenanceImageList;
