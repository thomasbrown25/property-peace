import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';

// assets
import CaretUpOutlined from '@ant-design/icons/CaretUpOutlined';
import CaretDownOutlined from '@ant-design/icons/CaretDownOutlined';
import { XFilled } from '@ant-design/icons';

// ==============================|| INVOICE - CARD ||============================== //

export default function RentDueWidgetCard({ color, title, count, percentage, isLoss, invoice, isActive }) {
  return (
    <MainCard
      sx={(theme) => ({
        ...(isActive && {
          bgcolor: 'secondary.lighter',
          ...theme.applyStyles('dark', { bgcolor: 'background.default' }),
          borderColor: 'secondary.lighter'
        }),
        [theme.breakpoints.only('lg')]: { '& .MuiCardContent-root': { p: 1.5 } }
      })}
    >
      <Grid container spacing={1.25}>
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Typography variant="subtitle1">{title}</Typography>
            {!isLoss && <XFilled style={{ fontSize: '0.75rem', color: color }} />}
            {isLoss && <XFilled style={{ fontSize: '0.75rem', color: color }} />}
            {/* {percentage && (
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', ml: 1.25, pl: 1 }}>
                <Typography color="secondary" variant="h5" sx={{ fontWeight: 500 }}>
                  {percentage}%
                </Typography>
              </Stack>
            )} */}
          </Stack>
        </Grid>
        <Grid size={12}>
          <Stack spacing={0.25}>
            <Typography variant="h5">{count}</Typography>
          </Stack>
        </Grid>
      </Grid>
    </MainCard>
  );
}

RentDueWidgetCard.propTypes = {
  color: PropTypes.any,
  title: PropTypes.string,
  count: PropTypes.string,
  percentage: PropTypes.number,
  isLoss: PropTypes.bool,
  invoice: PropTypes.string,
  isActive: PropTypes.bool
};
