import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
// material-ui
import { List, Box, Typography, Stack, Divider } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';

// assets
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import WalletOutlined from '@ant-design/icons/WalletOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';

// project imports
import useAuth from 'hooks/useAuth';
import Avatar from 'components/@extended/Avatar';
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //

export default function ProfileTab({ handleLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const displayName = `${user?.firstname || user?.FirstName || ''} ${user?.lastname || user?.LastName || ''}`.trim();
  const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl || avatar1;

  const handleViewProfile = () => {
    navigate('/landlord/profile');
  };

  return (
    <Box>
      <Box sx={{ p: 2.5, pb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar alt="profile user" src={profileImageUrl} size="md" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ textTransform: 'capitalize', fontWeight: 600, mb: 0.25 }}>
              {displayName}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <MailOutlined style={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || user?.Email || 'No email'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
        <ListItemButton onClick={handleViewProfile}>
          <ListItemIcon>
            <UserOutlined />
          </ListItemIcon>
          <ListItemText primary="View Profile" />
        </ListItemButton>
        <ListItemButton>
          <ListItemIcon>
            <WalletOutlined />
          </ListItemIcon>
          <ListItemText primary="Billing" />
        </ListItemButton>
        <ListItemButton onClick={handleLogout}>
          <ListItemIcon>
            <LogoutOutlined />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
    </Box>
  );
}

ProfileTab.propTypes = { handleLogout: PropTypes.func };
