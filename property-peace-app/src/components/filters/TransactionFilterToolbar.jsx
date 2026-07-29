import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  alpha,
  Badge,
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Popover,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { CloseOutlined, FilterOutlined, SearchOutlined, SortAscendingOutlined } from '@ant-design/icons';

import { getActiveFilterCount, hasActiveToolbarFilters } from './transactionFilterToolbarUtils';

const controlSx = {
  height: 40,
  borderRadius: 1.75,
  bgcolor: 'background.paper',
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center' }
};

function SelectControl({ value, onChange, options, ariaLabel, minWidth = 120, startAdornment }) {
  return (
    <Select
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-label': ariaLabel }}
      startAdornment={startAdornment}
      sx={{ ...controlSx, minWidth }}
    >
      {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select>
  );
}

SelectControl.propTypes = {
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.any.isRequired, label: PropTypes.string.isRequired })).isRequired,
  ariaLabel: PropTypes.string.isRequired,
  minWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  startAdornment: PropTypes.node
};

function AdvancedFilterFields({ filters }) {
  return (
    <Stack spacing={1.5}>
      {filters.map((filter) => (
        <FormControl key={filter.key} fullWidth size="small">
          <Typography component="label" sx={{ mb: 0.65, fontSize: '0.71rem', fontWeight: 750, letterSpacing: 0.45, color: 'text.secondary', textTransform: 'uppercase' }}>
            {filter.label}
          </Typography>
          <SelectControl
            value={filter.value}
            onChange={filter.onChange}
            options={filter.options}
            ariaLabel={filter.label}
            minWidth="100%"
          />
        </FormControl>
      ))}
    </Stack>
  );
}

AdvancedFilterFields.propTypes = { filters: PropTypes.array.isRequired };

export default function TransactionFilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  propertyControl,
  period,
  onPeriodChange,
  periodOptions,
  sort,
  onSortChange,
  sortOptions,
  filters = [],
  activeChips = [],
  onClearAll,
  customDates,
  onCustomDatesChange,
  resultSummary
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFilterCount = getActiveFilterCount(filters);
  const hasActiveFilters = hasActiveToolbarFilters(search, activeChips);
  const filterButtonLabel = activeFilterCount ? `Filters ${activeFilterCount}` : 'Filters';

  const openFilters = (event) => {
    if (isMobile) setMobileFiltersOpen(true);
    else setFilterAnchor(event.currentTarget);
  };

  const filterFields = (
    <>
      {isMobile && (
        <FormControl fullWidth size="small" sx={{ mb: filters.length ? 1.5 : 0 }}>
          <Typography component="label" sx={{ mb: 0.65, fontSize: '0.71rem', fontWeight: 750, letterSpacing: 0.45, color: 'text.secondary', textTransform: 'uppercase' }}>
            Date
          </Typography>
          <SelectControl value={period} onChange={onPeriodChange} options={periodOptions} ariaLabel="Date" minWidth="100%" />
        </FormControl>
      )}
      <AdvancedFilterFields filters={filters} />
      {isMobile && period === 'custom' && customDates && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <OutlinedInput type="date" size="small" fullWidth value={customDates.startDate} onChange={(event) => onCustomDatesChange({ ...customDates, startDate: event.target.value })} inputProps={{ 'aria-label': 'Start date' }} sx={{ borderRadius: 1.75 }} />
          <OutlinedInput type="date" size="small" fullWidth value={customDates.endDate} onChange={(event) => onCustomDatesChange({ ...customDates, endDate: event.target.value })} inputProps={{ 'aria-label': 'End date' }} sx={{ borderRadius: 1.75 }} />
        </Stack>
      )}
    </>
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.15} alignItems={{ md: 'center' }}>
        <OutlinedInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          size="small"
          startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
          sx={{ flex: { xs: '0 0 auto', md: '1 1 270px' }, minWidth: 0, width: { xs: '100%', md: 'auto' }, borderRadius: 1.75 }}
        />

        <Box sx={{ display: 'flex', flex: { md: '1 1 auto' }, flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: { md: 'flex-end' } }}>
          <Box sx={{ flex: { xs: '1 1 150px', md: '1 1 190px' }, minWidth: 0, maxWidth: { md: 245 }, '& .MuiOutlinedInput-root': { width: '100%', height: 40, borderRadius: 1.75 }, '& .MuiInputLabel-root': { display: 'none' } }}>
            {propertyControl}
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <SelectControl value={period} onChange={onPeriodChange} options={periodOptions} ariaLabel="Date" minWidth={125} />
          </Box>

          <Button
            variant="outlined"
            onClick={openFilters}
            startIcon={<Badge color="primary" variant="dot" invisible={!activeFilterCount}><FilterOutlined /></Badge>}
            aria-haspopup="true"
            aria-expanded={isMobile ? mobileFiltersOpen : Boolean(filterAnchor)}
            sx={{ height: 40, minWidth: { xs: 104, md: 112 }, borderRadius: 1.75, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {filterButtonLabel}
          </Button>

          {sortOptions?.length > 0 && (
            <SelectControl
              value={sort}
              onChange={onSortChange}
              options={sortOptions}
              ariaLabel="Sort"
              minWidth={isMobile ? 52 : 138}
              startAdornment={isMobile ? <InputAdornment position="start"><SortAscendingOutlined /></InputAdornment> : undefined}
            />
          )}
        </Box>
      </Stack>

      {!isMobile && period === 'custom' && customDates && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.2, maxWidth: 390 }}>
          <OutlinedInput type="date" size="small" fullWidth value={customDates.startDate} onChange={(event) => onCustomDatesChange({ ...customDates, startDate: event.target.value })} inputProps={{ 'aria-label': 'Start date' }} sx={{ borderRadius: 1.75 }} />
          <OutlinedInput type="date" size="small" fullWidth value={customDates.endDate} onChange={(event) => onCustomDatesChange({ ...customDates, endDate: event.target.value })} inputProps={{ 'aria-label': 'End date' }} sx={{ borderRadius: 1.75 }} />
        </Stack>
      )}

      {(hasActiveFilters || resultSummary) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 1.2 }}>
          <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" alignItems="center" minWidth={0}>
            {activeChips.map((chip) => <Chip key={chip.key} label={chip.label} onDelete={chip.onDelete} size="small" variant="outlined" sx={{ height: 26, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.09 : 0.035) }} />)}
            {resultSummary && <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>{resultSummary}</Typography>}
          </Stack>
          {hasActiveFilters && <Button size="small" onClick={onClearAll} sx={{ flexShrink: 0, px: 0.5, textTransform: 'none' }}>Clear all</Button>}
        </Stack>
      )}

      <Popover
        open={Boolean(filterAnchor)}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.75, width: 300, p: 2, borderRadius: 2.25, boxShadow: `0 18px 46px ${alpha('#061e35', 0.18)}` } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Box><Typography fontWeight={750}>More filters</Typography><Typography sx={{ mt: 0.2, fontSize: '0.72rem', color: 'text.secondary' }}>Refine this financial view</Typography></Box>
          {hasActiveFilters && <Button size="small" onClick={onClearAll} sx={{ textTransform: 'none' }}>Clear all</Button>}
        </Stack>
        {filterFields}
      </Popover>

      <Drawer anchor="bottom" open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} PaperProps={{ sx: { maxHeight: '82vh', borderRadius: '18px 18px 0 0' } }}>
        <Box sx={{ p: 2, overflowY: 'auto' }}>
          <Box sx={{ width: 42, height: 4, borderRadius: 4, bgcolor: 'divider', mx: 'auto', mb: 1.75 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box><Typography variant="h6" fontWeight={750}>Filters</Typography><Typography sx={{ mt: 0.2, fontSize: '0.75rem', color: 'text.secondary' }}>Narrow this financial view</Typography></Box>
            <Button color="inherit" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '50%' }}><CloseOutlined /></Button>
          </Stack>
          {filterFields}
          <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
            <Button variant="outlined" fullWidth onClick={onClearAll} sx={{ textTransform: 'none' }}>Clear all</Button>
            <Button variant="contained" fullWidth onClick={() => setMobileFiltersOpen(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>Apply filters</Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

TransactionFilterToolbar.propTypes = {
  search: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  searchPlaceholder: PropTypes.string.isRequired,
  propertyControl: PropTypes.node.isRequired,
  period: PropTypes.string.isRequired,
  onPeriodChange: PropTypes.func.isRequired,
  periodOptions: PropTypes.array.isRequired,
  sort: PropTypes.string,
  onSortChange: PropTypes.func,
  sortOptions: PropTypes.array,
  filters: PropTypes.array,
  activeChips: PropTypes.array,
  onClearAll: PropTypes.func.isRequired,
  customDates: PropTypes.shape({ startDate: PropTypes.string, endDate: PropTypes.string }),
  onCustomDatesChange: PropTypes.func,
  resultSummary: PropTypes.string
};
