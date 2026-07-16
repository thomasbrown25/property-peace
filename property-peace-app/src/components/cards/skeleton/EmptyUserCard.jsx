import PropTypes from 'prop-types';
// material-ui
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';

// project imports
import UserCard from './UserCard';

// ==============================|| EMPTY STATE ||============================== //

export default function EmptyUserCard({ title }) {
  return (
    <Grid size={12}>
      <Box
        sx={{
          p: { xs: 2.5, sm: 6 },
          height: `calc(100vh - 192px)`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'transparent'
        }}
      >
        <Grid container direction="column" justifyContent="center" alignItems="center">
          <Grid>
            <Box sx={{ ml: -9, mb: { xs: -8, sm: -5 } }}>
              <Box sx={{ position: 'relative' }}>
                <UserCard />
              </Box>
              <Box sx={{ position: 'relative', top: -120, left: 72 }}>
                <UserCard />
              </Box>
            </Box>
          </Grid>
          <Grid>
            <Stack sx={{ gap: 1 }}>
              <Typography align="center" variant="h4">
                {title}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Grid>
  );
}

EmptyUserCard.propTypes = { title: PropTypes.string };
