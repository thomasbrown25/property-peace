import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography, alpha, useTheme } from '@mui/material';
import { AuditOutlined, CheckCircleOutlined, HomeOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import Autocomplete from 'components/@extended/AutoComplete';
import useFetchProperties from 'hooks/useFetchProperties';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

function isMultiUnitProperty(property) {
  const type = String(property?.propertyType || '').toLowerCase();
  return ['multiunit', 'smallmultifamily', 'apartmentbuilding', 'multifamily', 'other'].includes(type);
}

function getPropertyLabel(property) {
  return property?.name || property?.streetAddress || `Property ${property?.id}`;
}

function getPropertyAddress(property) {
  return [property?.streetAddress, property?.city, property?.state].filter(Boolean).join(', ');
}

export default function ChecklistsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const propertyOptions = useMemo(
    () => (properties || []).map((property) => ({
      ...property,
      label: getPropertyLabel(property)
    })),
    [properties]
  );

  const needsUnit = isMultiUnitProperty(selectedProperty);
  const unitOptions = useMemo(
    () => units.map((unit) => ({ ...unit, label: unit.name || `Unit ${unit.id}` })),
    [units]
  );

  useEffect(() => {
    setSelectedUnit(null);
    setUnits([]);

    if (!selectedProperty || !isMultiUnitProperty(selectedProperty)) return;

    let active = true;
    const loadUnits = async () => {
      setUnitsLoading(true);
      try {
        const response = await axiosServices.get(`/api/unit/${selectedProperty.id}`);
        if (active) setUnits(response.data?.data || []);
      } catch {
        if (active) {
          openSnackbar({
            open: true,
            message: 'Failed to load units for this property',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } finally {
        if (active) setUnitsLoading(false);
      }
    };

    loadUnits();
    return () => {
      active = false;
    };
  }, [selectedProperty]);

  const handleContinue = () => {
    if (!selectedProperty || (needsUnit && !selectedUnit)) return;

    const basePath = `/landlord/checklists/property/${selectedProperty.id}`;
    navigate(needsUnit ? `${basePath}/unit/${selectedUnit.id}` : basePath);
  };

  return (
    <Box>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Checklists' }]} />

      <Box sx={{ maxWidth: 760, mx: 'auto', pt: { xs: 2, md: 4.5 } }}>
        <Stack alignItems="center" textAlign="center" spacing={1} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.25,
              bgcolor: '#061e35',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 0.5,
              boxShadow: `0 8px 22px ${alpha('#061e35', 0.16)}`
            }}
          >
            <AuditOutlined style={{ fontSize: 24 }} />
          </Box>
          <Typography variant="h3" fontWeight={700}>Checklists</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            Choose a home to start a move-in or move-out checklist and review its history.
          </Typography>
        </Stack>

        <MainCard
          content={false}
          sx={{
            border: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
            boxShadow: `0 14px 36px ${alpha('#061e35', 0.08)}`,
            borderRadius: 2.5,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ height: 4, bgcolor: 'success.main' }} />
          <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack spacing={2.75}>
              <Box>
                <Typography variant="h5" fontWeight={750}>Find the home</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  We’ll keep the current work and past records together in one quiet workspace.
                </Typography>
              </Box>

              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HomeOutlined style={{ color: theme.palette.primary.main }} />
                  <Typography variant="subtitle1" fontWeight={700}>Property</Typography>
                </Stack>
                <Autocomplete
                  options={propertyOptions}
                  width="100%"
                  value={selectedProperty}
                  onChange={(_, property) => setSelectedProperty(property)}
                  isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                  getOptionLabel={(option) => option?.label || ''}
                  loading={propertiesLoading}
                  disabled={propertiesLoading}
                  disablePortal={false}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    const address = getPropertyAddress(option);
                    return (
                      <Box component="li" key={key} {...optionProps} sx={{ py: 1.25, alignItems: 'flex-start !important' }}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{option.label}</Typography>
                          {address && address !== option.label && (
                            <Typography variant="caption" color="text.secondary">{address}</Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }}
                />
                {!propertiesLoading && propertyOptions.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Add a property before creating or viewing checklists.
                  </Typography>
                )}
              </Stack>

              {needsUnit && (
                <Stack spacing={0.75}>
                  <Typography variant="subtitle1" fontWeight={700}>Unit</Typography>
                  <Autocomplete
                    options={unitOptions}
                    width="100%"
                    value={selectedUnit}
                    onChange={(_, unit) => setSelectedUnit(unit)}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    getOptionLabel={(option) => option?.label || ''}
                    loading={unitsLoading}
                    disabled={unitsLoading || unitOptions.length === 0}
                    disablePortal={false}
                  />
                  {unitsLoading && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={13} />
                      <Typography variant="caption" color="text.secondary">Loading units…</Typography>
                    </Stack>
                  )}
                  {!unitsLoading && selectedProperty && unitOptions.length === 0 && (
                    <Typography variant="caption" color="text.secondary">No units were found for this property.</Typography>
                  )}
                </Stack>
              )}

              <Button
                variant="contained"
                size="large"
                endIcon={<RightOutlined />}
                onClick={handleContinue}
                disabled={!selectedProperty || (needsUnit && !selectedUnit)}
                fullWidth
                sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700 }}
              >
                Open Checklists
              </Button>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', pt: 0.25 }}>
                <CheckCircleOutlined style={{ color: theme.palette.success.main, fontSize: 14 }} />
                <Typography variant="caption">History stays organized by home, tenant, and lease.</Typography>
              </Stack>
            </Stack>
          </Box>
        </MainCard>
      </Box>
    </Box>
  );
}
