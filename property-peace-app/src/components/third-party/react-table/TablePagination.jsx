import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

// material-ui
import { useMediaQuery } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Pagination } from '@mui/material';
import { Select } from '@mui/material';
import { Stack } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';

// ==============================|| TABLE PAGINATION ||============================== //

export default function TablePagination({ getPageCount, setPageIndex, setPageSize, getState, initialPageSize }) {
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  const [open, setOpen] = useState(false);
  let options = [10, 25, 50, 100];

  if (initialPageSize) {
    options = [...options, initialPageSize]
      .filter((item, index) => [...options, initialPageSize].indexOf(item) === index)
      .sort(function (a, b) {
        return a - b;
      });
  }

  // eslint-disable-next-line
  useEffect(() => setPageSize(initialPageSize || 10), []);

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleChangePagination = (event, value) => {
    setPageIndex(value - 1);
  };

  const handleChange = (event) => {
    setPageSize(Number(event.target.value));
  };

  return (
    <Stack direction="row" sx={{ gap: 2, justifyContent: 'space-between', alignItems: 'center', width: 'auto', flexWrap: 'wrap' }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
        <Typography variant="caption" color="secondary">
          Row per page
        </Typography>
        <Select
          id="pagination-select"
          open={open}
          onClose={handleClose}
          onOpen={handleOpen}
          value={getState().pagination.pageSize}
          onChange={handleChange}
          size="small"
          slotProps={{ input: { sx: { py: 0.75, px: 1.25 } } }}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="secondary">
          Go to
        </Typography>
        <TextField
          size="small"
          type="number"
          value={getState().pagination.pageIndex + 1}
          onChange={(e) => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0;
            setPageIndex(page);
          }}
          slotProps={{ htmlInput: { sx: { py: 0.75, px: 1.25, width: 36 } } }}
        />
      </Stack>
      <Pagination
        sx={{ my: 0.5 }}
        count={getPageCount()}
        page={getState().pagination.pageIndex + 1}
        onChange={handleChangePagination}
        color="primary"
        variant="combined"
        showFirstButton={!downSM}
        showLastButton={!downSM}
        size={downSM ? 'small' : 'medium'}
      />
    </Stack>
  );
}

TablePagination.propTypes = {
  getPageCount: PropTypes.func,
  setPageIndex: PropTypes.func,
  setPageSize: PropTypes.func,
  getState: PropTypes.func,
  initialPageSize: PropTypes.number
};
