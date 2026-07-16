import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  Dialog,
  IconButton,
  Paper,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Fade,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  AppstoreOutlined,
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  PlayCircleOutlined,
  ColumnWidthOutlined,
  AppstoreAddOutlined,
  CheckOutlined
} from '@ant-design/icons';
import listingApi from 'api/listing';
import { submitPublicApplication } from 'api/application';
import AnimateIn from 'components/AnimateIn';
import { formatCurrency, formatDate } from 'utils/formatters';

export default function PublicListingPage() {
  const { listingNumber } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [enlargedIndex, setEnlargedIndex] = useState(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyStep, setApplyStep] = useState(0);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [applyForm, setApplyForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    desiredMoveInDate: '',
    numberOfOccupants: '',
    hasPets: false,
    petDetails: '',
    additionalNotes: ''
  });

  const allImages = useMemo(() => {
    if (!listing) return [];
    const cover = listing.coverPhoto ?? listing.images?.[0];
    const coverId = cover?.id;
    const gallery = (listing.images ?? []).filter((img) => img.id !== coverId);
    return [cover, ...gallery].filter((img) => img?.blobUrl);
  }, [listing]);

  const goPrev = useCallback(() => {
    setEnlargedIndex((i) => (i <= 0 ? Math.max(0, allImages.length - 1) : i - 1));
  }, [allImages.length]);
  const goNext = useCallback(() => {
    setEnlargedIndex((i) => (i == null || i >= allImages.length - 1 ? 0 : i + 1));
  }, [allImages.length]);

  useEffect(() => {
    const loadListing = async () => {
      try {
        setLoading(true);
        const response = await listingApi.getPublicListing(listingNumber);
        if (response.success) {
          setListing(response.data);
        } else {
          setError(response.message || 'Listing not found');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };
    if (listingNumber) loadListing();
  }, [listingNumber]);

  useEffect(() => {
    if (!photoModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (enlargedIndex != null) setEnlargedIndex(null);
        else { setPhotoModalOpen(false); setEnlargedIndex(null); }
        return;
      }
      if (enlargedIndex == null) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoModalOpen, enlargedIndex, goPrev, goNext]);

  const openPhotoModal = useCallback(() => { setEnlargedIndex(null); setPhotoModalOpen(true); }, []);
  const closePhotoModal = useCallback(() => { setPhotoModalOpen(false); setEnlargedIndex(null); }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !listing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography variant="h6" color="error">{error || 'Listing not found'}</Typography>
      </Box>
    );
  }

  const coverPhoto = listing.coverPhoto ?? listing.images?.[0];
  const coverId = coverPhoto?.id;
  const galleryImages = (listing.images ?? []).filter((img) => img.id !== coverId);
  const allAmenities = [
    ...(listing.basicAmenities ?? []),
    ...(listing.propertyAmenities ?? []),
    ...(listing.propertyFeatures ?? [])
  ];

  const keyStats = [
    listing.bedrooms && { label: 'Bedrooms', value: listing.bedrooms, icon: <HomeOutlined /> },
    listing.baths && { label: 'Bathrooms', value: listing.baths, icon: <HomeOutlined /> },
    listing.squareFeet > 0 && { label: 'Sq Ft', value: listing.squareFeet?.toLocaleString(), icon: <ColumnWidthOutlined /> },
    listing.yearBuilt && { label: 'Year Built', value: listing.yearBuilt, icon: <CalendarOutlined /> },
  ].filter(Boolean);

  const hasContact = listing.listingContactName || listing.listingContactPhone || listing.listingContactEmail;

  // Contact info block shown when online applications are disabled
  const ContactBlock = ({ compact = false }) => {
    if (!hasContact) return null;
    return (
      <Box
        sx={{
          p: compact ? 1.5 : 2,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.04)
        }}
      >
        <Typography variant={compact ? 'caption' : 'body2'} fontWeight={700} sx={{ mb: 1, display: 'block' }}>
          Contact the landlord to apply
        </Typography>
        <Stack spacing={0.75}>
          {listing.listingContactName && (
            <Stack direction="row" spacing={1} alignItems="center">
              <UserOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
              <Typography variant={compact ? 'caption' : 'body2'}>{listing.listingContactName}</Typography>
            </Stack>
          )}
          {listing.listingContactPhone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
              <Typography
                component="a"
                href={`tel:${listing.listingContactPhone}`}
                variant={compact ? 'caption' : 'body2'}
                sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {listing.listingContactPhone}
              </Typography>
            </Stack>
          )}
          {listing.listingContactEmail && (
            <Stack direction="row" spacing={1} alignItems="center">
              <MailOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
              <Typography
                component="a"
                href={`mailto:${listing.listingContactEmail}`}
                variant={compact ? 'caption' : 'body2'}
                sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {listing.listingContactEmail}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>
    );
  };

  const ApplyButton = ({ fullWidth = false, size = 'large' }) =>
    listing.acceptOnlineApplications ? (
      <Button
        variant="contained"
        fullWidth={fullWidth}
        size={size}
        onClick={() => setApplyDialogOpen(true)}
        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.5 }}
      >
        Apply Now
      </Button>
    ) : (
      <ContactBlock />
    );

  return (
    <Fade in timeout={450}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f9f9f9' }}>
      {/* Owner Dashboard bar */}
      {(listing.showOwnerDashboard ?? listing.ShowOwnerDashboard) && (listing.listingId ?? listing.ListingId) && (
        <AnimateIn direction="bottom" distance={120} delay={100}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', py: 1, px: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
              <Button
                component={Link}
                to={`/landlord/listings/${listing.listingId ?? listing.ListingId}`}
                startIcon={<AppstoreOutlined />}
                size="small"
                sx={{ textTransform: 'none', color: 'text.secondary' }}
              >
                Owner Dashboard
              </Button>
            </Box>
          </Box>
        </AnimateIn>
      )}

      {/* Photo hero — Airbnb-style grid */}
      <AnimateIn direction="bottom" distance={120} delay={160}>
        <Box sx={{ position: 'relative', bgcolor: 'black' }}>
        <Grid container spacing={0.5} sx={{ height: { xs: 280, sm: 420, md: 560 } }}>
          {/* Cover — takes left 55% */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ height: '100%' }}>
            {coverPhoto?.blobUrl ? (
              <Box
                component="img"
                src={coverPhoto.blobUrl}
                alt="Property"
                onClick={openPhotoModal}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
              />
            ) : (
              <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HomeOutlined style={{ fontSize: 64, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            )}
          </Grid>

          {/* Gallery grid — right 45%, 2x2 */}
          {galleryImages.length > 0 && (
            <Grid size={{ xs: 0, md: 5 }} sx={{ display: { xs: 'none', md: 'block' }, height: '100%' }}>
              <Grid container spacing={0.5} sx={{ height: '100%' }}>
                {galleryImages.slice(0, 4).map((img, i) => (
                  <Grid key={img.id} size={6} sx={{ height: '50%' }}>
                    <Box
                      component="img"
                      src={img.blobUrl}
                      alt={`Photo ${i + 2}`}
                      onClick={openPhotoModal}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
        </Grid>

        {/* Show all photos button */}
        {allImages.length > 1 && (
          <Button
            onClick={openPhotoModal}
            variant="contained"
            size="small"
            startIcon={<AppstoreAddOutlined />}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              bgcolor: 'white',
              color: 'text.primary',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 2,
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            Show all {allImages.length} photos
          </Button>
        )}
        </Box>
      </AnimateIn>

      {/* Main content */}
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: 4 }}>
        <Grid container spacing={4} alignItems="flex-start">
          {/* LEFT — main content */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Property title + address */}
            <AnimateIn direction="bottom" distance={120} delay={260}>
              <Box sx={{ mb: 3 }}>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 0.75 }}>
                {[listing.propertyName, listing.unitName].filter(Boolean).join(' · ')}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <EnvironmentOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
                <Typography variant="body1" color="text.secondary">
                  {listing.propertyAddress}
                </Typography>
              </Stack>

              {/* Key stats pills */}
              {keyStats.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  {keyStats.map(({ label, value }) => (
                    <Chip
                      key={label}
                      label={`${value} ${label}`}
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 500, borderRadius: 1.5 }}
                    />
                  ))}
                  <Chip
                    label={listing.petsAllowed ? 'Pets allowed' : 'No pets'}
                    variant="outlined"
                    size="small"
                    sx={{
                      fontWeight: 500,
                      borderRadius: 1.5,
                      color: listing.petsAllowed ? 'success.main' : 'text.secondary',
                      borderColor: listing.petsAllowed ? 'success.main' : 'divider'
                    }}
                  />
                </Stack>
              )}
              </Box>
            </AnimateIn>

            <Divider sx={{ mb: 3 }} />

            {/* Mobile: price + CTA inline */}
            {isMobile && (
              <AnimateIn direction="bottom" distance={120} delay={320}>
                <Box sx={{ mb: 3, p: 2.5, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h4" fontWeight={700} color="primary.main">
                      {formatCurrency(listing.monthlyRent)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">per month</Typography>
                  </Box>
                  {listing.dateAvailable && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" display="block">Available</Typography>
                      <Typography variant="body2" fontWeight={600}>{formatDate(listing.dateAvailable)}</Typography>
                    </Box>
                  )}
                </Stack>
                <ApplyButton fullWidth />
                </Box>
              </AnimateIn>
            )}

            {/* About */}
            {listing.marketingDescription && (
              <AnimateIn direction="bottom" distance={120} delay={380}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>About this property</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                    {listing.marketingDescription}
                  </Typography>
                </Box>
              </AnimateIn>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* Lease details */}
            <AnimateIn direction="bottom" distance={120} delay={440}>
              <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Lease Details</Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'Monthly Rent', value: formatCurrency(listing.monthlyRent) },
                  listing.securityDeposit && { label: 'Security Deposit', value: formatCurrency(listing.securityDeposit) },
                  listing.dateAvailable && { label: 'Available From', value: formatDate(listing.dateAvailable) },
                  (listing.minLeaseDuration || listing.maxLeaseDuration) && {
                    label: 'Lease Duration',
                    value: listing.minLeaseDuration && listing.maxLeaseDuration && listing.minLeaseDuration !== listing.maxLeaseDuration
                      ? `${listing.minLeaseDuration}–${listing.maxLeaseDuration} months`
                      : `${listing.minLeaseDuration || listing.maxLeaseDuration} months`
                  },
                  { label: 'Pets', value: listing.petsAllowed ? 'Allowed' : 'Not allowed' },
                  listing.applicationFeeRequired && { label: 'Application Fee', value: formatCurrency(listing.applicationFee) },
                ].filter(Boolean).map(({ label, value }) => (
                  <Grid key={label} size={{ xs: 6, sm: 4 }}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1.5, border: `1px solid ${theme.palette.divider}` }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>{value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              </Box>
            </AnimateIn>

            {/* Amenities */}
            {allAmenities.length > 0 && (
              <AnimateIn direction="bottom" distance={120} delay={500}>
                <Box>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Amenities & Features</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {allAmenities.map((a) => (
                      <Chip
                        key={`${a.id}-${a.name}`}
                        label={a.name}
                        size="small"
                        sx={{ borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06), border: 'none', fontWeight: 500 }}
                      />
                    ))}
                  </Box>
                </Box>
                </Box>
              </AnimateIn>
            )}

            {/* Video tour */}
            {listing.videoTourUrl && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Virtual Tour</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<PlayCircleOutlined />}
                    onClick={() => window.open(listing.videoTourUrl, '_blank')}
                    sx={{ textTransform: 'none' }}
                  >
                    Watch Video Tour
                  </Button>
                </Box>
              </>
            )}

            {/* Contact */}
            {hasContact && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Contact</Typography>
                  <Stack spacing={1.5}>
                    {listing.listingContactName && (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <UserOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                        <Typography variant="body2" fontWeight={500}>{listing.listingContactName}</Typography>
                      </Stack>
                    )}
                    {listing.listingContactPhone && (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PhoneOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                        <Typography
                          component="a"
                          href={`tel:${listing.listingContactPhone}`}
                          variant="body2"
                          fontWeight={500}
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {listing.listingContactPhone}
                        </Typography>
                      </Stack>
                    )}
                    {listing.listingContactEmail && (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <MailOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                        <Typography
                          component="a"
                          href={`mailto:${listing.listingContactEmail}`}
                          variant="body2"
                          fontWeight={500}
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {listing.listingContactEmail}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Grid>

          {/* RIGHT — sticky sidebar (desktop only) */}
          {!isMobile && (
            <Grid size={{ md: 4 }}>
              <AnimateIn direction="bottom" distance={120} delay={520}>
                <Paper
                elevation={3}
                sx={{
                  position: 'sticky',
                  top: 24,
                  p: 3,
                  borderRadius: 3,
                  border: `1px solid ${theme.palette.divider}`
                }}
              >
                <Stack spacing={2.5}>
                  {/* Price */}
                  <Box>
                    <Stack direction="row" alignItems="baseline" spacing={0.75}>
                      <Typography variant="h3" fontWeight={800} color="primary.main">
                        {formatCurrency(listing.monthlyRent)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">/mo</Typography>
                    </Stack>
                    {listing.securityDeposit && (
                      <Typography variant="caption" color="text.secondary">
                        + {formatCurrency(listing.securityDeposit)} deposit
                      </Typography>
                    )}
                  </Box>

                  {/* Key details */}
                  <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, p: 1.5 }}>
                    <Stack spacing={1.25}>
                      {listing.dateAvailable && (
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CalendarOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                            <Typography variant="body2" color="text.secondary">Available</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>{formatDate(listing.dateAvailable)}</Typography>
                        </Stack>
                      )}
                      {(listing.minLeaseDuration || listing.maxLeaseDuration) && (
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DollarCircleOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                            <Typography variant="body2" color="text.secondary">Lease Term</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {listing.minLeaseDuration && listing.maxLeaseDuration && listing.minLeaseDuration !== listing.maxLeaseDuration
                              ? `${listing.minLeaseDuration}–${listing.maxLeaseDuration} mo`
                              : `${listing.minLeaseDuration || listing.maxLeaseDuration} mo`}
                          </Typography>
                        </Stack>
                      )}
                      <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                          {listing.petsAllowed
                            ? <CheckCircleOutlined style={{ fontSize: 14, color: theme.palette.success.main }} />
                            : <CloseCircleOutlined style={{ fontSize: 14, color: theme.palette.text.disabled }} />}
                          <Typography variant="body2" color="text.secondary">Pets</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={600} color={listing.petsAllowed ? 'success.main' : 'text.secondary'}>
                          {listing.petsAllowed ? 'Allowed' : 'Not allowed'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  <ApplyButton fullWidth />

                  {listing.applicationFeeRequired && (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                      Application fee: {formatCurrency(listing.applicationFee)}
                    </Typography>
                  )}

                  {hasContact && (
                    <>
                      <Divider />
                      <Stack spacing={1}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Contact
                        </Typography>
                        {listing.listingContactName && (
                          <Typography variant="body2" fontWeight={500}>{listing.listingContactName}</Typography>
                        )}
                        {listing.listingContactPhone && (
                          <Typography
                            component="a"
                            href={`tel:${listing.listingContactPhone}`}
                            variant="body2"
                            sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {listing.listingContactPhone}
                          </Typography>
                        )}
                        {listing.listingContactEmail && (
                          <Typography
                            component="a"
                            href={`mailto:${listing.listingContactEmail}`}
                            variant="body2"
                            sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {listing.listingContactEmail}
                          </Typography>
                        )}
                      </Stack>
                    </>
                  )}
                </Stack>
                </Paper>
              </AnimateIn>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Mobile sticky bottom bar */}
      {isMobile && (listing.acceptOnlineApplications || hasContact) && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            bgcolor: 'background.paper',
            borderTop: `1px solid ${theme.palette.divider}`,
            px: 2,
            py: 1.5,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
          }}
        >
          {listing.acceptOnlineApplications ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" fontWeight={700} color="primary.main">
                  {formatCurrency(listing.monthlyRent)}/mo
                </Typography>
                {listing.dateAvailable && (
                  <Typography variant="caption" color="text.secondary">
                    Available {formatDate(listing.dateAvailable)}
                  </Typography>
                )}
              </Box>
              <ApplyButton size="medium" />
            </Stack>
          ) : (
            <ContactBlock compact />
          )}
        </Box>
      )}

      {/* Apply Now dialog — 3-step stepper */}
      <Dialog
        open={applyDialogOpen}
        onClose={() => {
          if (applySubmitting) return;
          setApplyDialogOpen(false);
          setTimeout(() => { setApplyStep(0); setApplyError(null); }, 300);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {applyStep < 2 ? 'Apply for this Property' : 'Application Submitted!'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[listing.propertyName, listing.unitName].filter(Boolean).join(' · ')} · {formatCurrency(listing.monthlyRent)}/mo
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                if (applySubmitting) return;
                setApplyDialogOpen(false);
                setTimeout(() => { setApplyStep(0); setApplyError(null); }, 300);
              }}
              size="small"
              sx={{ mt: -0.5 }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>

          {/* Stepper */}
          {applyStep < 2 && (
            <Stepper activeStep={applyStep} sx={{ mb: 3 }}>
              <Step><StepLabel>Your Info</StepLabel></Step>
              <Step><StepLabel>Move-in Details</StepLabel></Step>
            </Stepper>
          )}

          {/* Step 1 — Contact info */}
          {applyStep === 0 && (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="First Name"
                  required
                  fullWidth
                  size="small"
                  value={applyForm.firstName}
                  onChange={(e) => setApplyForm((f) => ({ ...f, firstName: e.target.value }))}
                />
                <TextField
                  label="Last Name"
                  required
                  fullWidth
                  size="small"
                  value={applyForm.lastName}
                  onChange={(e) => setApplyForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Stack>
              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                size="small"
                value={applyForm.email}
                onChange={(e) => setApplyForm((f) => ({ ...f, email: e.target.value }))}
              />
              <TextField
                label="Phone Number"
                type="tel"
                fullWidth
                size="small"
                value={applyForm.phoneNumber}
                onChange={(e) => setApplyForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              />
              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ textTransform: 'none', fontWeight: 700, mt: 1, borderRadius: 2 }}
                disabled={!applyForm.firstName.trim() || !applyForm.lastName.trim() || !applyForm.email.trim()}
                onClick={() => { setApplyError(null); setApplyStep(1); }}
              >
                Continue
              </Button>
            </Stack>
          )}

          {/* Step 2 — Move-in details */}
          {applyStep === 1 && (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Desired Move-in Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={applyForm.desiredMoveInDate}
                  onChange={(e) => setApplyForm((f) => ({ ...f, desiredMoveInDate: e.target.value }))}
                />
                <TextField
                  label="# of Occupants"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1 }}
                  value={applyForm.numberOfOccupants}
                  onChange={(e) => setApplyForm((f) => ({ ...f, numberOfOccupants: e.target.value }))}
                />
              </Stack>
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={applyForm.hasPets}
                      onChange={(e) => setApplyForm((f) => ({ ...f, hasPets: e.target.checked, petDetails: e.target.checked ? f.petDetails : '' }))}
                      size="small"
                    />
                  }
                  label="I have pets"
                />
                {applyForm.hasPets && (
                  <TextField
                    label="Pet details (type, breed, size)"
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={applyForm.petDetails}
                    onChange={(e) => setApplyForm((f) => ({ ...f, petDetails: e.target.value }))}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
              <TextField
                label="Message to landlord (optional)"
                fullWidth
                size="small"
                multiline
                rows={3}
                placeholder="Anything you'd like the landlord to know..."
                value={applyForm.additionalNotes}
                onChange={(e) => setApplyForm((f) => ({ ...f, additionalNotes: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': {  } }}
              />
              {applyError && <Alert severity="error" sx={{ py: 0.5 }}>{applyError}</Alert>}
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                  disabled={applySubmitting}
                  onClick={() => { setApplyError(null); setApplyStep(0); }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  disabled={applySubmitting}
                  startIcon={applySubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                  onClick={async () => {
                    setApplySubmitting(true);
                    setApplyError(null);
                    try {
                      await submitPublicApplication({
                        listingNumber: listing.listingNumber,
                        firstName: applyForm.firstName,
                        lastName: applyForm.lastName,
                        email: applyForm.email,
                        phoneNumber: applyForm.phoneNumber || null,
                        desiredMoveInDate: applyForm.desiredMoveInDate || null,
                        numberOfOccupants: applyForm.numberOfOccupants ? Number(applyForm.numberOfOccupants) : null,
                        hasPets: applyForm.hasPets,
                        petDetails: applyForm.petDetails || null,
                        additionalNotes: applyForm.additionalNotes || null
                      });
                      setApplyStep(2);
                    } catch (err) {
                      setApplyError(err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.');
                    } finally {
                      setApplySubmitting(false);
                    }
                  }}
                >
                  {applySubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </Stack>
            </Stack>
          )}

          {/* Step 3 — Success */}
          {applyStep === 2 && (
            <Stack alignItems="center" spacing={2.5} sx={{ py: 2 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckOutlined style={{ fontSize: 30, color: 'white' }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75 }}>
                  Application Submitted!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Thanks, <strong>{applyForm.firstName}</strong>! Your application for{' '}
                  <strong>{listing.propertyName}</strong> has been received. The landlord
                  will be in touch at <strong>{applyForm.email}</strong>.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, mt: 1 }}
                onClick={() => {
                  setApplyDialogOpen(false);
                  setTimeout(() => { setApplyStep(0); setApplyError(null); setApplyForm({ firstName: '', lastName: '', email: '', phoneNumber: '', desiredMoveInDate: '', numberOfOccupants: '', hasPets: false, petDetails: '', additionalNotes: '' }); }, 300);
                }}
              >
                Done
              </Button>
            </Stack>
          )}
        </Box>
      </Dialog>

      {/* Photo lightbox */}
      <Dialog
        open={photoModalOpen}
        onClose={closePhotoModal}
        fullWidth
        fullScreen={enlargedIndex != null}
        PaperProps={{
          sx: {
            m: 2,
            width: 'calc(100% - 32px)',
            height: 'calc(100% - 32px)',
            maxWidth: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 32px)',
            ...(enlargedIndex != null && {
              bgcolor: 'rgba(0,0,0,0.95)',
              margin: 0,
              width: '100%',
              height: '100%',
              boxShadow: 'none'
            })
          }
        }}
        sx={{ '& .MuiDialog-paper': { overflow: 'hidden' } }}
      >
        {enlargedIndex == null ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {listing.propertyName} · {allImages.length} photos
              </Typography>
              <IconButton onClick={closePhotoModal} size="small"><CloseOutlined /></IconButton>
            </Box>
            <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Gallery */}
              <Box sx={{ flex: 1, px: 2, pb: 3, overflowY: 'auto' }}>
                {(() => {
                  const rows = [];
                  let i = 0;
                  while (i < allImages.length) {
                    if (i % 3 === 0) {
                      rows.push({ type: 'single', images: [allImages[i]], startIndex: i });
                      i += 1;
                    } else {
                      rows.push({ type: 'double', images: [allImages[i], allImages[i + 1]].filter(Boolean), startIndex: i });
                      i += 2;
                    }
                  }
                  return rows.map((row, rowIdx) => (
                    <Grid container spacing={1.5} key={rowIdx} sx={{ mt: 1.5 }}>
                      {row.images.map((img, cellIdx) => (
                        <Grid size={row.type === 'single' ? 12 : 6} key={img.id || row.startIndex + cellIdx}>
                          <Box
                            component="img"
                            src={img.blobUrl}
                            alt={`Photo ${row.startIndex + cellIdx + 1}`}
                            onClick={() => setEnlargedIndex(row.startIndex + cellIdx)}
                            sx={{
                              width: '100%',
                              height: row.type === 'single' ? { xs: 240, md: 480 } : { xs: 140, md: 260 },
                              objectFit: 'cover',
                              borderRadius: 1.5,
                              cursor: 'pointer',
                              display: 'block',
                              transition: 'opacity 0.15s',
                              '&:hover': { opacity: 0.9 }
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  ));
                })()}
              </Box>

              {/* Sidebar in lightbox */}
              <Box
                sx={{
                  width: 260,
                  flexShrink: 0,
                  p: 2.5,
                  borderLeft: 1,
                  borderColor: 'divider',
                  display: { xs: 'none', md: 'flex' },
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                <Box>
                  <Typography variant="h5" color="primary.main" fontWeight={700}>
                    {formatCurrency(listing.monthlyRent)}<Typography component="span" variant="body2" color="text.secondary">/mo</Typography>
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {listing.bedrooms && <Typography variant="body2" color="text.secondary">{listing.bedrooms} bd</Typography>}
                  {listing.baths && <Typography variant="body2" color="text.secondary">{listing.baths} ba</Typography>}
                  {listing.squareFeet > 0 && <Typography variant="body2" color="text.secondary">{listing.squareFeet?.toLocaleString()} sqft</Typography>}
                </Stack>
                {listing.propertyAddress && (
                  <Typography variant="body2" color="text.secondary">{listing.propertyAddress}</Typography>
                )}
                <Divider />
                <ApplyButton fullWidth size="medium" />
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1 }}>
              <Button startIcon={<LeftOutlined />} onClick={() => setEnlargedIndex(null)} sx={{ color: 'white', textTransform: 'none' }}>
                All photos
              </Button>
            </Box>
            <IconButton onClick={() => setEnlargedIndex(null)} sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1, color: 'white' }}>
              <CloseOutlined />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative' }}>
              <IconButton onClick={goPrev} sx={{ position: 'absolute', left: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                <LeftOutlined />
              </IconButton>
              <Box
                component="img"
                src={allImages[enlargedIndex]?.blobUrl}
                alt={`Photo ${enlargedIndex + 1}`}
                sx={{ maxWidth: '100%', maxHeight: 'calc(100vh - 100px)', objectFit: 'contain' }}
              />
              <IconButton onClick={goNext} sx={{ position: 'absolute', right: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                <RightOutlined />
              </IconButton>
            </Box>
            <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {enlargedIndex + 1} / {allImages.length}
              </Typography>
            </Box>
          </>
        )}
      </Dialog>

      {/* Bottom padding for mobile sticky bar */}
      {isMobile && (listing.acceptOnlineApplications || hasContact) && <Box sx={{ height: 72 }} />}
      </Box>
    </Fade>
  );
}
