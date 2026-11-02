import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Chip,
  Grid,
  Tabs,
  Tab,
  Divider,
  alpha,
  useTheme,
  LinearProgress
} from '@mui/material';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  ArrowLeftOutlined,
  EditOutlined,
  GlobalOutlined,
  HomeOutlined,
  DollarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SafetyOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import { formatCurrency } from 'utils/formatters';

import RentEstimateCard from 'components/RentEstimateCard';
import LeasingPipelinePanel from 'components/leasing-pipeline/LeasingPipelinePanel';
import ListingGallery from 'components/ListingGallery';
import ListingPropertyDetails from 'components/ListingPropertyDetails';

const softCardSx = (theme) => ({
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  boxShadow: `0 18px 42px ${alpha(theme.palette.grey[900], 0.06)}`,
  borderRadius: 3,
  '& .MuiCardContent-root': { p: { xs: 2.25, md: 3 } }
});

function DetailRow({ label, value, icon, accent = false }) {
  const theme = useTheme();
  if (value == null || value === '' || value === false) return null;

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      {icon && (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: accent ? 'primary.main' : 'text.secondary',
            bgcolor: accent ? alpha(theme.palette.primary.main, 0.09) : alpha(theme.palette.grey[500], 0.08),
            flexShrink: 0
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}


function SectionCard({ title, subtitle, icon, children }) {
  const theme = useTheme();

  return (
    <MainCard sx={softCardSx(theme)}>
      <Stack spacing={2.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon && (
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.09)
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h5" fontWeight={800}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {children}
      </Stack>
    </MainCard>
  );
}

function ListingStatusChip({ isActive, isDraft, statusLabel }) {
  const color = isActive ? 'success' : isDraft ? 'warning' : 'default';
  return <Chip label={statusLabel || 'Unknown'} size="small" color={color} sx={{ fontWeight: 700 }} />;
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id, 10)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '420px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!listing) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Listing not found
        </Typography>
      </Box>
    );
  }

  const isActive = listing.status === 'Active' || listing.status === 1 || String(listing.status ?? '').toLowerCase() === 'active';
  const isDraft = listing.status === 'Draft' || listing.status === 0 || String(listing.status ?? '').toLowerCase() === 'draft';
  const statusLabel = isActive ? 'Active' : isDraft ? 'Draft' : String(listing.status ?? '');
  const cover = listing.images?.find((i) => i.isCoverPhoto) ?? listing.images?.[0];
  const galleryImages = (listing.images ?? []).filter((image) => image?.blobUrl).slice(0, 5);
  const title = listing.propertyName ? `${listing.propertyName}${listing.unitName ? ` · ${listing.unitName}` : ''}` : listing.listingNumber;
  const publicListingUrl = `${window.location.origin}/listing/${listing.listingNumber}`;


  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);
  const applicationReadiness = [
    !!listing.marketingDescription,
    galleryImages.length > 0,
    !!listing.monthlyRent,
    !!listing.dateAvailable,
    listing.acceptOnlineApplications !== undefined
  ].filter(Boolean).length;
  const readinessPercent = Math.round((applicationReadiness / 5) * 100);

  return (
    <Box sx={{ pb: 4 }}>
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Listings', path: '/landlord/listings' },
            { label: title }
          ]}
        />
      </AnimateIn>


      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            mb: 0,
            minHeight: { xs: 430, md: 430 },
            color: 'white',
            bgcolor: 'grey.900',
            boxShadow: `0 30px 70px ${alpha(theme.palette.grey[900], 0.22)}`
          }}
        >
          {cover && (
            <Box
              component="img"
              src={cover.blobUrl}
              alt={title}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'saturate(1.08) contrast(1.02)'
              }}
            />
          )}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: cover
                ? 'linear-gradient(90deg, rgba(8,15,28,0.92) 0%, rgba(8,15,28,0.62) 48%, rgba(8,15,28,0.2) 100%), linear-gradient(0deg, rgba(8,15,28,0.6), rgba(8,15,28,0.08))'
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.main} 100%)`
            }}
          />
          <Box sx={{ position: 'relative', p: { xs: 2.25, sm: 3, md: 4 }, minHeight: { xs: 430, md: 430 }, display: 'flex' }}>
            <Grid container spacing={3} alignItems="stretch" sx={{ width: '100%' }}>
              <Grid size={{ xs: 12, md: 7.5 }}>
                <Stack sx={{ height: '100%' }} justifyContent="space-between" spacing={3}>
                  <Stack spacing={2.5}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <ListingStatusChip isActive={isActive} isDraft={isDraft} statusLabel={statusLabel} />
                      <Chip
                        icon={<FileTextOutlined />}
                        label={`Listing #${listing.listingNumber || '—'}`}
                        size="small"
                        sx={{ bgcolor: alpha(theme.palette.common.white, 0.16), color: 'white', fontWeight: 700, '& .MuiChip-icon': { color: 'white' } }}
                      />
                      {listing.syndicateToListingWebsite && (
                        <Chip
                          icon={<GlobalOutlined />}
                          label="Published online"
                          size="small"
                          sx={{ bgcolor: alpha(theme.palette.success.main, 0.9), color: 'white', fontWeight: 700, '& .MuiChip-icon': { color: 'white' } }}
                        />
                      )}
                    </Stack>

                    <Box>
                      <Typography variant="h2" fontWeight={900} sx={{ mb: 1, color: 'white', letterSpacing: '-0.04em', maxWidth: 760 }}>
                        {title}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ maxWidth: 700 }}>
                        <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.78)', marginTop: 3 }} />
                        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                          {listing.propertyAddress || 'No address provided'}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      startIcon={<ArrowLeftOutlined />}
                      onClick={() => navigate('/landlord/listings')}
                      sx={{ borderColor: alpha(theme.palette.common.white, 0.45), color: 'white', textTransform: 'none', fontWeight: 800 }}
                    >
                      Back to listings
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EditOutlined />}
                      onClick={() => navigate(`/landlord/listings/${id}/setup`)}
                      sx={{ borderColor: alpha(theme.palette.common.white, 0.45), color: 'white', textTransform: 'none', fontWeight: 800 }}
                    >
                      Edit listing
                    </Button>
                    {isActive && (
                      <Button
                        variant="outlined"
                        startIcon={<GlobalOutlined />}
                        onClick={() => window.open(publicListingUrl, '_blank')}
                        sx={{ borderColor: alpha(theme.palette.common.white, 0.45), color: 'white', textTransform: 'none', fontWeight: 800 }}
                      >
                        View public page
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 4.5 }}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.common.white, 0.14),
                    border: `1px solid ${alpha(theme.palette.common.white, 0.22)}`,
                    backdropFilter: 'blur(16px)'
                  }}
                >
                  <Stack spacing={2.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.72), textTransform: 'uppercase', letterSpacing: 0.7 }}>
                          Asking rent
                        </Typography>
                        <Typography variant="h3" fontWeight={900} sx={{ color: 'white', lineHeight: 1.1 }}>
                          {formatCurrency(listing.monthlyRent)}
                          <Typography component="span" variant="h6" sx={{ color: alpha(theme.palette.common.white, 0.74), ml: 0.5 }}>
                            /mo
                          </Typography>
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2.5,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(theme.palette.common.white, 0.18)
                        }}
                      >
                        <DollarOutlined style={{ fontSize: 22 }} />
                      </Box>
                    </Stack>

                    <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.16) }} />

                    <Grid container spacing={1.25}>
                      <Grid size={6}>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.68) }}>
                          Available
                        </Typography>
                        <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                          {formatDate(listing.dateAvailable) ?? 'Now'}
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.68) }}>
                          Deposit
                        </Typography>
                        <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                          {listing.securityDeposit ? formatCurrency(listing.securityDeposit) : '—'}
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.68) }}>
                          Lease term
                        </Typography>
                        <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                          {listing.minLeaseDuration
                            ? `${listing.minLeaseDuration}${listing.maxLeaseDuration && listing.maxLeaseDuration !== listing.minLeaseDuration ? `–${listing.maxLeaseDuration}` : ''} mo`
                            : '—'}
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.68) }}>
                          Photos
                        </Typography>
                        <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                          {listing.images?.length ?? 0}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                        <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.72) }}>
                          Listing readiness
                        </Typography>
                        <Typography variant="caption" fontWeight={800} sx={{ color: 'white' }}>
                          {readinessPercent}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={readinessPercent}
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          bgcolor: alpha(theme.palette.common.white, 0.18),
                          '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: 'success.light' }
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </AnimateIn>

      <Box sx={{ mt: 0.5, mb: 2.5, position: 'relative', isolation: 'isolate', width: '100%',
        '&::after': { content: '""', position: 'absolute', right: 0, bottom: 0, left: 0, height: '1px',
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.12), pointerEvents: 'none', zIndex: 0 },
        '& .MuiTabs-root': { minHeight: 42 },
        '& .MuiTab-root': { minHeight: 42, px: 1.25, mr: 1.5, borderRadius: 1.5, textTransform: 'none',
          fontSize: '0.875rem', fontWeight: 700, color: 'text.secondary',
          transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], { duration: theme.transitions.duration.shorter }),
          '&:hover': { color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
            boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none' },
          '&.Mui-selected': { color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04) } },
        '& .MuiTabs-indicator': { zIndex: 1, height: 2, borderRadius: 2, backgroundColor: 'primary.main' }
      }}>
        <Tabs value={activeTab} onChange={(_, tab) => setActiveTab(tab)} variant="scrollable" scrollButtons="auto" aria-label="Listing detail views">
          <Tab value="overview" label="Overview" id="overview-tab" aria-controls="overview-panel" />
          <Tab value="property" label="Property Details" id="property-tab" aria-controls="property-panel" />
          <Tab value="gallery" label="Gallery" id="gallery-tab" aria-controls="gallery-panel" />
        </Tabs>
      </Box>

      <Box id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
        {activeTab === 'property' && <ListingPropertyDetails listing={listing} />}
        {activeTab === 'gallery' && <ListingGallery listing={listing} onImagesChange={(images) => dispatch(setSelectedListing({ ...listing, images }))} />}
        {activeTab === 'overview' && <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <SectionCard title="Market Rent Estimate" subtitle="Premium comparison context." icon={<DollarOutlined />}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Listed monthly rent</Typography>
                    <Typography variant="h5" fontWeight={800}>{listing.monthlyRent != null ? `${formatCurrency(listing.monthlyRent)}/mo` : 'Not set'}</Typography>
                  </Box>
                  <RentEstimateCard propertyId={listing.propertyId} unitId={listing.unitId ?? null} />
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <SectionCard title="Rental facts" icon={<HomeOutlined />}>
                <Stack spacing={2}>
                  <DetailRow label="Listed rent" value={listing.monthlyRent != null ? `${formatCurrency(listing.monthlyRent)}/mo` : 'Not set'} icon={<DollarOutlined />} />
                  <DetailRow label="Security deposit" value={listing.securityDeposit != null ? formatCurrency(listing.securityDeposit) : '—'} icon={<SafetyOutlined />} />
                  <DetailRow label="Next availability" value={formatDate(listing.dateAvailable) ?? 'Not set'} icon={<CalendarOutlined />} />
                  <Divider />
                  <Typography variant="subtitle2" fontWeight={700}>Lease offerings</Typography>
                  <DetailRow label="Long-term listing" value={listing.minLeaseDuration
                    ? `${listing.minLeaseDuration}${listing.maxLeaseDuration && listing.maxLeaseDuration !== listing.minLeaseDuration ? `–${listing.maxLeaseDuration}` : ''} mo`
                    : 'Monthly rental listing'} icon={<FileTextOutlined />} />
                  <Typography variant="body2" color="text.secondary">Short stays are configured separately per unit; this listing does not report their status.</Typography>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <LeasingPipelinePanel resourceType="listing" resourceId={id} showSignatureDetails={false} />
          </Box>

          <Stack spacing={3}>
            <SectionCard title="Listing policies & contact" icon={<SafetyOutlined />}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Pets" value={listing.petsAllowed ? 'Allowed' : 'Not allowed'} /></Grid>
                    {listing.listingContactName && <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Contact" value={listing.listingContactName} /></Grid>}
                    {listing.listingContactPhone && <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Phone" value={listing.listingContactPhone} /></Grid>}
                    {listing.listingContactEmail && <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Email" value={listing.listingContactEmail} /></Grid>}
                  </Grid>
                </SectionCard>


              <SectionCard title="Application Settings" subtitle="Screening and application configuration for prospects." icon={<SafetyOutlined />}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                      <Typography variant="body2" color="text.secondary">
                        Online Applications
                      </Typography>
                      <Chip size="small" label={listing.acceptOnlineApplications ? 'Enabled' : 'Disabled'} color={listing.acceptOnlineApplications ? 'success' : 'default'} variant="outlined" />
                    </Stack>
                  </Grid>
                  {listing.applicationFeeRequired && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                        <Typography variant="body2" color="text.secondary">
                          Application Fee
                        </Typography>
                        <Typography variant="body2" fontWeight={800}>
                          {formatCurrency(listing.applicationFee)}
                        </Typography>
                      </Stack>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                      <Typography variant="body2" color="text.secondary">
                        Screening
                      </Typography>
                      <Chip size="small" label={listing.requireScreening ? listing.screeningType || 'Required' : 'Not required'} color={listing.requireScreening ? 'info' : 'default'} variant="outlined" />
                    </Stack>
                  </Grid>
                  {listing.requireIncomeVerification && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                        <Typography variant="body2" color="text.secondary">
                          Income Verification
                        </Typography>
                        <Typography variant="body2" fontWeight={800}>
                          Required {listing.incomeVerificationCost ? `(${formatCurrency(listing.incomeVerificationCost)})` : ''}
                        </Typography>
                      </Stack>
                    </Grid>
                  )}
                </Grid>
              </SectionCard>
          </Stack>
        </>}
      </Box>
    </Box>
  );
}
