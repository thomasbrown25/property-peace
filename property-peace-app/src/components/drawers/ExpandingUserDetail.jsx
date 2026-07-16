import PropTypes from 'prop-types';
import { useMediaQuery } from '@mui/material';
import { Grid } from '@mui/material';
import { Chip } from '@mui/material';
import { Divider } from '@mui/material';
import { Link } from '@mui/material';
import { List } from '@mui/material';
import { ListItem } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';

// third-party
import { PatternFormat } from 'react-number-format';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import { getImageUrl, ImagePath } from 'utils/getImageUrl';

// assets
import EnvironmentOutlined from '@ant-design/icons/EnvironmentOutlined';
import LinkOutlined from '@ant-design/icons/LinkOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';
import PhoneOutlined from '@ant-design/icons/PhoneOutlined';

const allStatus = [
  { value: 3, label: 'Rejected' },
  { value: 1, label: 'Verified' },
  { value: 2, label: 'Pending' }
];

// ==============================|| EXPANDING TABLE - USER DETAILS ||============================== //

export default function ExpandingUserDetail({ data }) {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const selectedStatus = allStatus.filter((item) => item.value === Number(data.status));

  return (
    <Grid container spacing={2.5} sx={{ pl: { xs: 0, sm: 5, md: 6, lg: 10, xl: 12 } }}>
      <Grid size={{ xs: 12, sm: 5, md: 4, xl: 3.5 }}>
        <MainCard>
          <Chip
            label={selectedStatus.length > 0 ? selectedStatus[0].label : 'Pending'}
            size="small"
            sx={{
              position: 'absolute',
              right: -1,
              top: -1,
              borderRadius: '0 4px 0 4px'
            }}
          />
          <Grid container spacing={3}>
            <Grid size={12}>
              <Stack sx={{ gap: 2.5, alignItems: 'center' }}>
                <Avatar alt="Avatar 1" size="xl" src={getImageUrl(`avatar-${data.avatar}.png`, ImagePath.USERS)} />
                <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="h5">
                    {data.firstName} {data.lastName}
                  </Typography>
                  <Typography color="secondary">{data.role}</Typography>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={12}>
              <Divider />
            </Grid>
            <Grid size={12}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-around' }}>
                <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="h5">{data.age}</Typography>
                  <Typography color="secondary">Age</Typography>
                </Stack>
                <Divider orientation="vertical" flexItem />
                <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="h5">{data.progress}%</Typography>
                  <Typography color="secondary">Progress</Typography>
                </Stack>
                <Divider orientation="vertical" flexItem />
                <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="h5">{data.orders}</Typography>
                  <Typography color="secondary">Visits</Typography>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={12}>
              <Divider />
            </Grid>
            <Grid size={12}>
              <List component="nav" aria-label="main mailbox folders" sx={{ py: 0, '& .MuiListItem-root': { p: 0 } }}>
                <ListItem secondaryAction={<Typography sx={{ textAlign: 'right' }}>{data.email}</Typography>}>
                  <ListItemIcon>
                    <MailOutlined />
                  </ListItemIcon>
                  <ListItemText primary={<Typography color="secondary">Email</Typography>} />
                </ListItem>
                <ListItem
                  secondaryAction={
                    <Typography sx={{ textAlign: 'right' }}>
                      <PatternFormat displayType="text" format="+1 (###) ###-####" mask="_" defaultValue={data.contact} />
                    </Typography>
                  }
                >
                  <ListItemIcon>
                    <PhoneOutlined />
                  </ListItemIcon>
                  <ListItemText primary={<Typography color="secondary">Phone</Typography>} />
                </ListItem>
                <ListItem secondaryAction={<Typography sx={{ textAlign: 'right' }}>{data.country}</Typography>}>
                  <ListItemIcon>
                    <EnvironmentOutlined />
                  </ListItemIcon>
                  <ListItemText primary={<Typography color="secondary">Location</Typography>} />
                </ListItem>
                <ListItem
                  secondaryAction={
                    <Link sx={{ textAlign: 'right' }} href="https://google.com" target="_blank">
                      https://anshan.dh.url
                    </Link>
                  }
                >
                  <ListItemIcon>
                    <LinkOutlined />
                  </ListItemIcon>
                  <ListItemText primary={<Typography color="secondary">Portfolio</Typography>} />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, sm: 7, md: 8, xl: 8.5 }}>
        <Stack spacing={2.5}>
          <MainCard title="Personal Details">
            <List sx={{ py: 0 }}>
              <ListItem divider={!downMD}>
                <Grid container spacing={3} sx={{ width: 1 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack sx={{ gap: 0.5 }}>
                      <Typography color="secondary">Full Name</Typography>
                      <Typography>
                        {data.firstName} {data.lastName}
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack sx={{ gap: 0.5 }}>
                      <Typography color="secondary">Father Name</Typography>
                      <Typography>Mr. {data.fatherName}</Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </ListItem>
              <ListItem divider={!downMD}>
                <Grid container spacing={3} sx={{ width: 1 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack sx={{ gap: 0.5 }}>
                      <Typography color="secondary">Country</Typography>
                      <Typography>{data.country}</Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack sx={{ gap: 0.5 }}>
                      <Typography color="secondary">Zip Code</Typography>
                      <Typography>
                        <PatternFormat displayType="text" format="### ###" mask="_" defaultValue={data.contact} />
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </ListItem>
              <ListItem>
                <Stack sx={{ gap: 0.5 }}>
                  <Typography color="secondary">Address</Typography>
                  <Typography>{data.location}</Typography>
                </Stack>
              </ListItem>
            </List>
          </MainCard>
          <MainCard title="About me">
            <Typography color="secondary">{data.about}</Typography>
          </MainCard>
        </Stack>
      </Grid>
    </Grid>
  );
}

ExpandingUserDetail.propTypes = { data: PropTypes.any };
