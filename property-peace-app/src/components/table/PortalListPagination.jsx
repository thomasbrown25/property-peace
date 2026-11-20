import PropTypes from 'prop-types';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { alpha } from '@mui/material/styles';
import { Button, MenuItem, Select, Stack, Typography } from '@mui/material';

const PAGE_SIZES = [10, 20, 50, 100];

export default function PortalListPagination({
  page,
  pageCount,
  pageSize,
  start,
  end,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'requests'
}) {
  const visiblePage = Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
  const displayItemLabel = total === 1 && itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems="center"
      justifyContent="space-between"
      sx={(theme) => ({
        px: 2,
        py: 1.5,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
      })}
    >
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        Showing {start}–{end} of {total} {displayItemLabel}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
        <Typography variant="body2" color="text.secondary">Items per page</Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          inputProps={{ 'aria-label': `${itemLabel} items per page` }}
          sx={{ height: 32, minWidth: 72 }}
        >
          {PAGE_SIZES.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
        </Select>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<LeftOutlined />}
            onClick={() => onPageChange(visiblePage - 1)}
            disabled={visiblePage === 0}
            sx={{ minWidth: 92 }}
          >
            Previous
          </Button>
          <Button
            size="small"
            variant="outlined"
            endIcon={<RightOutlined />}
            onClick={() => onPageChange(visiblePage + 1)}
            disabled={visiblePage >= pageCount - 1}
            sx={{ minWidth: 72 }}
          >
            Next
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

PortalListPagination.propTypes = {
  page: PropTypes.number.isRequired,
  pageCount: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  itemLabel: PropTypes.string
};
