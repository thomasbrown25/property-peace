import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Slide,
  alpha,
  useTheme,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import { CheckCircleOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  getMoveInReportTemplate,
  addOrUpdateMoveInReportTemplate,
  completeMoveInReportTemplateForLease
} from 'api/checklist';
import { openSnackbar } from 'api/snackbar';

const STEPS = { NAME: 1, SPACES: 2, ITEMS: 3, SUCCESS: 4 };
const STEP_LABELS = ['NAME', 'SPACES', 'ITEMS'];

const BATH_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const PREDEFINED_SPACE_LABELS = [
  'Living Room',
  'Kitchen',
  'Dining Rooms',
  'Bedroom',
  'Bathroom',
  'Mechanical Systems',
  'Other'
];

const DEFAULT_ITEMS_BY_SPACE_TYPE = {
  'Bathroom': [
    'Floors and Floor Coverings',
    'Walls and Ceilings',
    'Counters and Surfaces',
    'Windows, screens, and locks',
    'Drawers and Cabinets',
    'Electrical Outlets',
    'Window Coverings',
    'Sink and Plumbing',
    'Bathtub Shower',
    'Toilet',
    'Light Fixtures',
    'Doors',
    'Door Locks and Hardwares',
    'Other'
  ],
  'Bedroom': [
    'Floor and Floor Coverings',
    'Walls and Ceiling',
    'Windows, screens, and locks',
    'Window Coverings',
    'Closets including Doors and Tracks',
    'Lighting Fixtures',
    'Electrical Outlets',
    'Smoke Alarm',
    'Carbon Monoxide Alarm',
    'Doors',
    'Door Locks and Hardware',
    'Other'
  ],
  'Dining Rooms': [
    'Floor and Floor Coverings',
    'Walls and Ceiling',
    'Light Fixtures',
    'Windows, screens, and locks',
    'Window Coverings',
    'Door locks & hardware',
    'Electrical Outlets',
    'Smoke Alarm',
    'Carbon monoxide alarm',
    'Other'
  ],
  'Kitchen': [
    'Floor and Floor Coverings',
    'Walls and Ceiling',
    'Doors',
    'Door Locks and Hardware',
    'Windows, screens, and locks',
    'Microwave',
    'Window Coverings',
    'Light Fixtures',
    'Cabinets',
    'Electrical Outlets',
    'Counters',
    'Stove',
    'Oven Rangehood Inside Outside Fan',
    'Refrigerator',
    'Dishwasher',
    'Sinks and Plumbing',
    'Garbage Disposal',
    'Fire Extinguisher',
    'Other'
  ],
  'Living Room': [
    'Floor and Floor Covering',
    'Walls and Ceiling',
    'Doors',
    'Electrical Outlets',
    'Door Locks and Hardware',
    'Lighting Fixtures',
    'Windows, screens, and locks',
    'Window Coverings',
    'Smoke Alarm',
    'Carbon Monoxide Alarm',
    'Fireplace',
    'Other'
  ],
  'Mechanical Systems': [
    'Heating System',
    'Air Conditioning',
    'Hot Water',
    'Water Heater',
    'Breaker Panel (Location)',
    'Water Shutoff (Location)',
    'Other'
  ],
  'Other': [
    'Backyard',
    'Basement',
    'Garage',
    'Washing machine',
    'Dryer',
    'Other'
  ]
};

const getSpaceKey = (space) => (space.customName && space.customName.trim() ? space.customName.trim() : space.spaceLabel);

const getDefaultReportName = (propertyName) =>
  propertyName && propertyName.trim()
    ? `${propertyName.trim()} - Move-in Condition Report`
    : 'Move-in Condition Report';

export default function CustomizeMoveInReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const fromLeaseId = location.state?.fromLeaseId;
  const propertyNameFromState = location.state?.propertyName;
  const unitBedrooms = location.state?.unitBedrooms ?? location.state?.bedrooms;
  const unitBaths = location.state?.unitBaths ?? location.state?.baths;
  const parsedBedrooms = Math.max(1, parseInt(unitBedrooms, 10) || 1);
  const parsedBaths = (() => {
    const n = parseFloat(unitBaths);
    if (Number.isNaN(n) || n < 0.5) return 1;
    const clamped = Math.min(5, Math.max(0.5, n));
    return BATH_OPTIONS.includes(clamped) ? clamped : Math.round(clamped * 2) / 2;
  })();

  const defaultReportName = getDefaultReportName(propertyNameFromState);

  const [currentStep, setCurrentStep] = useState(STEPS.NAME);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [reportName, setReportName] = useState(defaultReportName);
  const [spaces, setSpaces] = useState(() =>
    PREDEFINED_SPACE_LABELS.map((label, i) => ({
      id: `pre-${i}`,
      spaceLabel: label,
      customName: null,
      quantity:
        label === 'Bedroom' ? parsedBedrooms : label === 'Bathroom' ? parsedBaths : 1,
      sortOrder: i
    }))
  );
  const [itemsBySpaceKey, setItemsBySpaceKey] = useState(() => {
    const initial = {};
    PREDEFINED_SPACE_LABELS.forEach((label) => {
      initial[label] = [...(DEFAULT_ITEMS_BY_SPACE_TYPE[label] || [])];
    });
    return initial;
  });
  const [customSpaceName, setCustomSpaceName] = useState('');
  const [expandedSpaceKey, setExpandedSpaceKey] = useState(null);
  const [newItemByKey, setNewItemByKey] = useState({});

  const CustomStepConnector = styled(StepConnector)(({ theme: t }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: t.palette.primary.main }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: t.palette.primary.main }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: t.palette.grey[300] }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: t.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  const getStepperStep = () => {
    if (currentStep === STEPS.NAME) return 0;
    if (currentStep === STEPS.SPACES) return 1;
    if (currentStep === STEPS.ITEMS) return 2;
    return 0;
  };

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMoveInReportTemplate();
      if (res?.success && res?.data) {
        const t = res.data;
        setReportName(t.name || defaultReportName);
        if (t.spaces && t.spaces.length > 0) {
          setSpaces(
            t.spaces.map((s, i) => ({
              id: `loaded-${s.id}-${i}`,
              spaceLabel: s.spaceLabel || 'Other',
              customName: s.customName || null,
              quantity: s.quantity ?? 1,
              sortOrder: s.sortOrder ?? i
            }))
          );
          const itemsMap = {};
          t.spaces.forEach((s) => {
            const key = (s.customName && s.customName.trim()) || s.spaceLabel;
            itemsMap[key] = (s.items || []).map((it) => it.itemName || it.ItemName).filter(Boolean);
          });
          setItemsBySpaceKey((prev) => ({ ...prev, ...itemsMap }));
        }
      }
    } catch (err) {
      console.error('Load move-in report template:', err);
      // 404 or no template yet is expected on first use – keep defaults, don't show error
      const status = err?.response?.status;
      if (status === 404) {
        setError(null);
      } else {
        setError(err?.response?.data?.message || 'Failed to load template');
      }
    } finally {
      setLoading(false);
    }
  }, [defaultReportName]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setError(null);
    setTimeout(() => {
      setCurrentStep(newStep);
      setTimeout(() => setIsAnimating(false), 600);
    }, 50);
  };

  const handleNext = () => {
    if (currentStep === STEPS.NAME) {
      if (!reportName || !reportName.trim()) {
        setError('Please enter a report name');
        return;
      }
      setError(null);
      transitionToStep(STEPS.SPACES, 'left');
    } else if (currentStep === STEPS.SPACES) {
      setError(null);
      const withQty = spaces.filter((s) =>
        s.spaceLabel === 'Bathroom' ? s.quantity >= 0.5 : s.quantity >= 1
      );
      const firstKey = withQty.length > 0 ? getSpaceKey(withQty[0]) : null;
      setExpandedSpaceKey(firstKey);
      transitionToStep(STEPS.ITEMS, 'left');
    } else if (currentStep === STEPS.ITEMS) {
      handleSave();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const spacesWithQty = spaces.filter((s) => s.quantity >= 1);
      const payload = {
        name: reportName.trim(),
        spaces: spacesWithQty.map((s, i) => {
          const key = getSpaceKey(s);
          const items = itemsBySpaceKey[key] || [];
          return {
            spaceLabel: s.spaceLabel,
            customName: s.customName || null,
            quantity: s.quantity,
            sortOrder: i,
            items: items.map((itemName, j) => ({ itemName, sortOrder: j }))
          };
        })
      };
      const res = await addOrUpdateMoveInReportTemplate(payload);
      if (res?.success) {
        if (fromLeaseId) {
          try {
            await completeMoveInReportTemplateForLease(fromLeaseId);
          } catch (e) {
            console.warn('Could not mark lease move-in report step complete:', e);
          }
        }
        transitionToStep(STEPS.SUCCESS, 'left');
      } else {
        setError(res?.message || 'Failed to save');
      }
    } catch (err) {
      console.error('Save move-in report template:', err);
      setError(err?.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.NAME) {
      transitionToStep(currentStep - 1, 'right');
    }
  };

  const setSpaceQuantity = (id, delta) => {
    setSpaces((prev) =>
      prev.map((s) => (s.id === id ? { ...s, quantity: Math.max(0, (s.quantity || 1) + delta) } : s))
    );
  };

  const setBathroomQuantity = (id, delta) => {
    setSpaces((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const current = s.quantity ?? 1;
        const next = Math.round((current + delta * 0.5) * 2) / 2;
        return { ...s, quantity: Math.max(1, Math.min(5, next)) };
      })
    );
  };

  const removeSpace = (id) => {
    setSpaces((prev) => prev.filter((s) => s.id !== id));
  };

  const addCustomSpace = () => {
    const name = customSpaceName.trim();
    if (!name) return;
    const key = name;
    setSpaces((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, spaceLabel: 'Other', customName: name, quantity: 1, sortOrder: prev.length }
    ]);
    if (!itemsBySpaceKey[key]) {
      setItemsBySpaceKey((prev) => ({ ...prev, [key]: [...(DEFAULT_ITEMS_BY_SPACE_TYPE['Other'] || [])] }));
    }
    setCustomSpaceName('');
  };

  const addItemToSpace = (spaceKey) => {
    const name = (newItemByKey[spaceKey] || '').trim();
    if (!name) return;
    setItemsBySpaceKey((prev) => ({
      ...prev,
      [spaceKey]: [...(prev[spaceKey] || []), name]
    }));
    setNewItemByKey((prev) => ({ ...prev, [spaceKey]: '' }));
  };

  const removeItemFromSpace = (spaceKey, index) => {
    setItemsBySpaceKey((prev) => {
      const list = [...(prev[spaceKey] || [])];
      list.splice(index, 1);
      return { ...prev, [spaceKey]: list };
    });
  };

  const spacesWithQuantity = spaces.filter((s) =>
    s.spaceLabel === 'Bathroom' ? s.quantity >= 0.5 : s.quantity >= 1
  );

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.NAME:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Name your report
            </Typography>
            <Alert
              severity="info"
              sx={{
                textAlign: 'left',
                mb: 3,
                maxWidth: 520,
                mx: 'auto',
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Why use a move-in report?
              </Typography>
              <Typography variant="body2" component="span">
                A move-in condition report documents the state of your rental at the start of the tenancy. You and your tenant can note the condition of each room and item (e.g. walls, floors, appliances). When the lease ends, you can compare against this report to fairly assess wear and tear, resolve deposit disputes, and protect both parties.
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Give your move-in condition report a name (e.g. &quot;Move-in Condition Report&quot;).
            </Typography>
            <TextField
              fullWidth
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Move-in Condition Report"
              sx={{ maxWidth: 400, mx: 'auto', display: 'block',  }}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.SPACES:
        return (
          <Box sx={{ textAlign: 'left', maxWidth: 600, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
              Add rooms and other spaces
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Include areas of your rental where you want to track the condition
            </Typography>
            <Stack spacing={2}>
              {spaces.map((space) => (
                <Box
                  key={space.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                >
                  <Typography sx={{ flex: 1, fontWeight: 500 }}>
                    {space.customName || space.spaceLabel}
                    {space.spaceLabel === 'Bathroom'
                      ? (space.quantity !== 1 ? ` (×${space.quantity})` : '')
                      : (space.quantity > 1 ? ` (×${space.quantity})` : '')}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        space.spaceLabel === 'Bathroom'
                          ? setBathroomQuantity(space.id, -1)
                          : setSpaceQuantity(space.id, -1)
                      }
                      disabled={
                        space.spaceLabel === 'Bathroom'
                          ? (space.quantity ?? 1) <= 1
                          : space.quantity <= 0
                      }
                    >
                      −
                    </IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: 'center' }}>
                      {space.quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() =>
                        space.spaceLabel === 'Bathroom'
                          ? setBathroomQuantity(space.id, 1)
                          : setSpaceQuantity(space.id, 1)
                      }
                      disabled={space.spaceLabel === 'Bathroom' && (space.quantity ?? 1) >= 5}
                    >
                      +
                    </IconButton>
                  </Stack>
                  <IconButton size="small" onClick={() => removeSpace(space.id)} color="error">
                    <DeleteOutlined />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 3 }} alignItems="center">
              <TextField
                size="small"
                placeholder="Room or area name"
                value={customSpaceName}
                onChange={(e) => setCustomSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomSpace()}
                sx={{ flex: 1,  }}
              />
              <Button variant="contained" onClick={addCustomSpace} disabled={!customSpaceName.trim()} sx={{ textTransform: 'none' }}>
                Save
              </Button>
            </Stack>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.ITEMS:
        return (
          <Box sx={{ textAlign: 'left', maxWidth: 700, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
              Add items to each space
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Make sure to include items that you want your tenants to mark the condition of in each space of your property.
            </Typography>
            <Stack spacing={2}>
              {spacesWithQuantity.map((space) => {
                const key = getSpaceKey(space);
                const items = itemsBySpaceKey[key] || [];
                const isExpanded = expandedSpaceKey === key;
                const displayName = space.customName || space.spaceLabel;
                return (
                  <Box
                    key={key}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: isExpanded ? alpha(theme.palette.primary.main, 0.04) : 'transparent'
                      }}
                      onClick={() => setExpandedSpaceKey(isExpanded ? null : key)}
                    >
                      <Typography fontWeight={600}>{displayName}</Typography>
                      {isExpanded ? <UpOutlined /> : <DownOutlined />}
                    </Box>
                    <Collapse in={isExpanded}>
                      <Divider />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          {items.map((itemName, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                              <Typography variant="body2">{itemName}</Typography>
                              <IconButton size="small" onClick={() => removeItemFromSpace(key, idx)} color="error">
                                <DeleteOutlined />
                              </IconButton>
                            </Box>
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                          <TextField
                            size="small"
                            placeholder="New Item"
                            value={newItemByKey[key] || ''}
                            onChange={(e) => setNewItemByKey((p) => ({ ...p, [key]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && addItemToSpace(key)}
                            sx={{ flex: 1,  }}
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => addItemToSpace(key)}
                            disabled={!(newItemByKey[key] || '').trim()}
                            sx={{ textTransform: 'none' }}
                          >
                            Save
                          </Button>
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Stack>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 4, maxWidth: 560, mx: 'auto' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Your report is ready to send
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1, textAlign: 'left', fontWeight: 600 }}>
              Here&apos;s what&apos;s next:
            </Typography>
            <Box component="ul" sx={{ textAlign: 'left', mb: 3, pl: 2.5, listStyle: 'none', '& li': { position: 'relative', pl: 2, pb: 1.25 } }}>
              <Box component="li">
                <Box sx={{ position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  You or your tenants can complete the report, adding images and notes.
                </Typography>
              </Box>
              <Box component="li">
                <Box sx={{ position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Review the report to confirm the accuracy.
                </Typography>
              </Box>
              <Box component="li">
                <Box sx={{ position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Once you approve, mark it as approved and you and the tenants will receive downloadable copies of the report.
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
              {fromLeaseId && (
                <Button
                  variant="contained"
                  onClick={() => navigate(`/landlord/leases/${fromLeaseId}`)}
                  sx={{ textTransform: 'none', px: 3 }}
                >
                  Back to lease
                </Button>
              )}
              <Button
                variant={fromLeaseId ? 'outlined' : 'contained'}
                onClick={() =>
                  fromLeaseId
                    ? navigate(`/landlord/leases/${fromLeaseId}?tab=condition-reports`)
                    : navigate('/landlord/dashboard')
                }
                sx={{ textTransform: 'none', px: 3 }}
              >
                Done
              </Button>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  if (loading && currentStep === STEPS.NAME) {
    return (
      <Box>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Customize Move-in Report' }]} />
        <MainCard sx={{ mt: 3, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </MainCard>
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Customize Move-in Report' }
        ]}
      />

      <MainCard sx={{ mt: 3, minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        {currentStep !== STEPS.SUCCESS && (
          <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%', px: 3, pt: 2, display: { xs: 'none', sm: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <Box sx={{ maxWidth: 800, width: '100%' }}>
                <Stepper activeStep={getStepperStep()} alternativeLabel connector={<CustomStepConnector />}>
                  {STEP_LABELS.map((label, index) => (
                    <Step key={label} completed={index < getStepperStep()}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            </Box>
          </Box>
        )}
        <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, px: 3, position: 'relative', overflow: 'hidden', minHeight: '400px' }}>
            <Box sx={{ width: '100%', maxWidth: '700px', position: 'relative' }}>
              <Slide direction={slideDirection} in timeout={600} mountOnEnter unmountOnExit key={currentStep}>
                <Box>{renderStep()}</Box>
              </Slide>
            </Box>
          </Box>

          {currentStep !== STEPS.SUCCESS && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 'auto',
                pt: 4,
                pb: 2,
                px: 3,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
              }}
            >
              <Button
                onClick={handleBack}
                disabled={currentStep === STEPS.NAME || saving}
                startIcon={<ArrowLeftOutlined />}
                sx={{ textTransform: 'none', px: 3 }}
              >
                GO BACK
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={saving}
                sx={{ textTransform: 'none', px: 4, py: 1 }}
              >
                {saving ? 'Saving...' : currentStep === STEPS.ITEMS ? 'Save' : 'NEXT'}
              </Button>
            </Box>
          )}
        </Box>
      </MainCard>
    </Box>
  );
}
