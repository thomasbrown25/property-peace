import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  alpha,
  useTheme,
  Tooltip,
  LinearProgress
} from '@mui/material';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  ArrowLeftOutlined,
  SettingOutlined,
  EditOutlined,
  GlobalOutlined,
  HomeOutlined,
  DollarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  SafetyOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import { formatCurrency } from 'utils/formatters';
import { useSubscription } from 'hooks/useSubscription';
import RentEstimateCard from 'components/RentEstimateCard';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import LeasingPipelinePanel from 'components/leasing-pipeline/LeasingPipelinePanel';

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

function MetricCard({ label, value, icon, color = 'primary', helper }) {
  const theme = useTheme();
  const palette = theme.palette[color] || theme.palette.primary;

  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        borderRadius: 3,
        bgcolor: alpha(palette.main, 0.07),
        border: `1px solid ${alpha(palette.main, 0.12)}`
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800} color={`${color}.main`} sx={{ lineHeight: 1.1 }}>
            {value}
          </Typography>
          {helper && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {helper}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: `${color}.main`,
            bgcolor: alpha(palette.main, 0.12),
            flexShrink: 0
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Box>
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
  const { subscription } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const isPremium = planName === 'premium' || planName.includes('lifetime');
  const { presentation: syndicationReadiness } = useFeatureReadiness(FEATURE_KEYS.listingSyndication);

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

  const allAmenities = [
    ...(listing.basicAmenities ?? []),
    ...(listing.propertyAmenities ?? []),
    ...(listing.propertyFeatures ?? [])
  ];

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

      <Box sx={{ mb: 3 }}>
        <LeasingPipelinePanel resourceType="listing" resourceId={id} />
      </Box>

      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            mb: 3,
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

      {galleryImages.length > 0 && (
        <AnimateIn direction="bottom" delay={300} distance={120}>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={1.5}>
              {galleryImages.map((image, index) => (
                <Grid key={`${image.id ?? image.blobUrl}-${index}`} size={{ xs: index === 0 ? 12 : 6, sm: index === 0 ? 4 : 2 }}>
                  <Box
                    component="img"
                    src={image.blobUrl}
                    alt={`${title} photo ${index + 1}`}
                    sx={{
                      width: '100%',
                      height: { xs: index === 0 ? 160 : 118, sm: 132 },
                      objectFit: 'cover',
                      borderRadius: 2.5,
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.16)}`,
                      boxShadow: `0 12px 28px ${alpha(theme.palette.grey[900], 0.08)}`
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </AnimateIn>
      )}

      <AnimateIn direction="bottom" delay={400} distance={120}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Monthly Rent" value={formatCurrency(listing.monthlyRent)} icon={<DollarOutlined />} color="primary" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Security Deposit" value={listing.securityDeposit ? formatCurrency(listing.securityDeposit) : '—'} icon={<SafetyOutlined />} color="success" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Available From" value={formatDate(listing.dateAvailable) ?? 'Now'} icon={<CalendarOutlined />} color="info" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Lease Duration"
              value={listing.minLeaseDuration ? `${listing.minLeaseDuration}${listing.maxLeaseDuration && listing.maxLeaseDuration !== listing.minLeaseDuration ? `–${listing.maxLeaseDuration}` : ''} mo` : '—'}
              icon={<FileTextOutlined />}
              color="warning"
            />
          </Grid>
        </Grid>
      </AnimateIn>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <AnimateIn direction="bottom" delay={500} distance={120}>
              <SectionCard title="Property Details" subtitle="The core facts renters see first." icon={<HomeOutlined />}>
                <Grid container spacing={2.5}>
                  {listing.squareFeet && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                      <DetailRow label="Square Feet" value={`${listing.squareFeet.toLocaleString()} sqft`} icon={<HomeOutlined />} accent />
                    </Grid>
                  )}
                  {listing.yearBuilt && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                      <DetailRow label="Year Built" value={listing.yearBuilt} icon={<CalendarOutlined />} />
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <DetailRow
                      label="Pets"
                      value={listing.petsAllowed ? 'Allowed' : 'Not allowed'}
                      icon={listing.petsAllowed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      accent={listing.petsAllowed}
                    />
                  </Grid>
                  {listing.listingContactName && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                      <DetailRow label="Contact" value={listing.listingContactName} icon={<TeamOutlined />} />
                    </Grid>
                  )}
                  {listing.listingContactPhone && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                      <DetailRow label="Phone" value={listing.listingContactPhone} icon={<TeamOutlined />} />
                    </Grid>
                  )}
                  {listing.listingContactEmail && (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                      <DetailRow label="Email" value={listing.listingContactEmail} icon={<TeamOutlined />} />
                    </Grid>
                  )}
                </Grid>
              </SectionCard>
            </AnimateIn>

            {listing.marketingDescription && (
              <AnimateIn direction="bottom" delay={600} distance={120}>
                <SectionCard title="Listing Description" subtitle="Marketing copy shown to prospects." icon={<FileTextOutlined />}>
                  <Box
                    sx={{
                      p: 2.25,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.primary.main, 0.035),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`
                    }}
                  >
                    <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
                      {listing.marketingDescription}
                    </Typography>
                  </Box>
                </SectionCard>
              </AnimateIn>
            )}

            {allAmenities.length > 0 && (
              <AnimateIn direction="bottom" delay={700} distance={120}>
                <SectionCard title="Amenities & Features" subtitle="The selling points attached to this listing." icon={<CheckCircleOutlined />}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {allAmenities.map((a) => (
                      <Chip
                        key={`${a.id}-${a.name}`}
                        label={a.name}
                        size="small"
                        sx={{
                          borderRadius: 2,
                          fontWeight: 700,
                          bgcolor: alpha(theme.palette.success.main, 0.08),
                          color: 'success.dark',
                          border: `1px solid ${alpha(theme.palette.success.main, 0.16)}`
                        }}
                      />
                    ))}
                  </Box>
                </SectionCard>
              </AnimateIn>
            )}

            <AnimateIn direction="bottom" delay={800} distance={120}>
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
            </AnimateIn>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <AnimateIn direction="bottom" delay={550} distance={120}>
              <SectionCard title="Market Rent Estimate" subtitle="Premium comparison context." icon={<DollarOutlined />}>
                <RentEstimateCard propertyId={listing.propertyId} unitId={listing.unitId ?? null} isPremium={isPremium} />
              </SectionCard>
            </AnimateIn>

            <AnimateIn direction="bottom" delay={650} distance={120}>
              <SectionCard title="Listing Control Center" subtitle="Status, publishing, and syndication." icon={<GlobalOutlined />}>
                <Stack spacing={2}>
                  <FeatureReadinessNotice presentation={syndicationReadiness} featureName="Listing syndication" />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <ListingStatusChip isActive={isActive} isDraft={isDraft} statusLabel={statusLabel} />
                  </Stack>
                  {listing.expiresAt && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Expires
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {formatDate(listing.expiresAt)}
                      </Typography>
                    </Stack>
                  )}
                  <Divider />
                  {[
                    ['Listing website', listing.syndicateToListingWebsite],
                    ['Free sites', listing.syndicateToFreeSites],
                    ['Premium sites', listing.syndicateToPremiumSites]
                  ].map(([label, enabled]) => (
                    <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Chip size="small" label={!syndicationReadiness.canInvoke ? syndicationReadiness.title : enabled ? 'On' : 'Off'} color={syndicationReadiness.canInvoke && enabled ? 'success' : 'default'} variant="outlined" />
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            </AnimateIn>

            <AnimateIn direction="bottom" delay={750} distance={120}>
              <MainCard sx={softCardSx(theme)}>
                <Stack spacing={1.5}>
                  <Typography variant="h5" fontWeight={800}>
                    Quick Actions
                  </Typography>
                  <Button fullWidth variant="contained" startIcon={<EditOutlined />} onClick={() => navigate(`/landlord/listings/${id}/setup`)} sx={{ textTransform: 'none', justifyContent: 'flex-start', fontWeight: 800 }}>
                    Edit Listing
                  </Button>
                  {isActive && (
                    <Button fullWidth variant="outlined" startIcon={<GlobalOutlined />} onClick={() => window.open(publicListingUrl, '_blank')} sx={{ textTransform: 'none', justifyContent: 'flex-start', fontWeight: 800 }}>
                      View Published Listing
                    </Button>
                  )}
                  <Button fullWidth variant="outlined" startIcon={<SettingOutlined />} onClick={() => navigate(`/landlord/listings/${id}/settings`)} sx={{ textTransform: 'none', justifyContent: 'flex-start', fontWeight: 800 }}>
                    Listing Settings
                  </Button>
                  {isActive && (
                    <Tooltip title={publicListingUrl} placement="top">
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all', pt: 0.5 }}>
                        Public URL: {publicListingUrl}
                      </Typography>
                    </Tooltip>
                  )}
                </Stack>
              </MainCard>
            </AnimateIn>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
