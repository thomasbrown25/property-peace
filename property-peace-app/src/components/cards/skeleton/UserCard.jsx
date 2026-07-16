// material-ui
import { Avatar } from '@mui/material';
import { CardContent } from '@mui/material';
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Skeleton } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';

// assets
import ContactsOutlined from '@ant-design/icons/ContactsOutlined';

// ===========================|| SKELETON - USER EMPTY CARD ||=========================== //

export default function UserCard() {
  return (
    <MainCard
      border={false}
      content={false}
      boxShadow
      sx={{ boxShadow: `rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px`, borderRadius: 2 }}
    >
      <CardContent sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Avatar>
                <ContactsOutlined style={{ visibility: 'inherit' }} />
              </Avatar>
              <Stack sx={{ width: 1, pl: 2.5 }}>
                <Skeleton animation={false} height={20} width="80%" />
                <Skeleton animation={false} height={20} width="40%" />
              </Stack>
            </Stack>
          </Grid>
          <Grid size={12}>
            <Skeleton animation={false} height={20} width={45} />
            <Skeleton animation={false} height={20} />
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Skeleton animation={false} height={20} width={90} />
              <Skeleton animation={false} height={20} width={38} />
            </Stack>
          </Grid>
          <Grid size={12}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Grid container spacing={1}>
                <Grid>
                  <Skeleton animation={false} height={20} width={40} />
                </Grid>
                <Grid>
                  <Skeleton animation={false} height={17} width={20} />
                </Grid>
              </Grid>
              <Skeleton animation={false} height={32} width={47} />
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </MainCard>
  );
}
