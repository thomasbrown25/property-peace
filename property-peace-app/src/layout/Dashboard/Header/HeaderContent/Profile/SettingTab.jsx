import { useNavigate } from 'react-router-dom';

// material-ui
import { List } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';

// assets
import CommentOutlined from '@ant-design/icons/CommentOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import HighlightOutlined from '@ant-design/icons/HighlightOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';

// ==============================|| HEADER PROFILE - SETTING TAB ||============================== //

export default function SettingTab({ handleClose }) {
  const navigate = useNavigate();
  const auth = useAuth();

  // Get roles from JWTContext - ensure it's an array
  const userRoles = Array.isArray(auth?.user?.Roles) 
    ? auth?.user?.Roles 
    : Array.isArray(auth?.user?.roles) 
    ? auth?.user?.roles 
    : [];

  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasLandlordRole = normalizedRoles.includes('landlord');

  // Determine base path based on role (priority: Tenant first)
  const basePath = hasTenantRole ? '/tenant/settings' : '/landlord/settings';

  const handleNavigate = (path) => {
    navigate(path);
    if (handleClose) {
      handleClose();
    }
  };

  // Tenant settings menu
  if (hasTenantRole) {
    return (
      <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
        <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=general`)}>
          <ListItemIcon>
            <SettingOutlined />
          </ListItemIcon>
          <ListItemText primary="General" />
        </ListItemButton>
        <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=account`)}>
          <ListItemIcon>
            <UserOutlined />
          </ListItemIcon>
          <ListItemText primary="Account Settings" />
        </ListItemButton>
        <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=notifications`)}>
          <ListItemIcon>
            <BellOutlined />
          </ListItemIcon>
          <ListItemText primary="Notifications" />
        </ListItemButton>
        <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=appearance`)}>
          <ListItemIcon>
            <HighlightOutlined />
          </ListItemIcon>
          <ListItemText primary="Appearance" />
        </ListItemButton>
      </List>
    );
  }

  // Landlord settings menu
  return (
    <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=general`)}>
        <ListItemIcon>
          <SettingOutlined />
        </ListItemIcon>
        <ListItemText primary="General" />
      </ListItemButton>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=account`)}>
        <ListItemIcon>
          <UserOutlined />
        </ListItemIcon>
        <ListItemText primary="Account Settings" />
      </ListItemButton>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=notifications`)}>
        <ListItemIcon>
          <BellOutlined />
        </ListItemIcon>
        <ListItemText primary="Notifications" />
      </ListItemButton>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=appearance`)}>
        <ListItemIcon>
          <HighlightOutlined />
        </ListItemIcon>
        <ListItemText primary="Appearance" />
      </ListItemButton>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=payments`)}>
        <ListItemIcon>
          <DollarOutlined />
        </ListItemIcon>
        <ListItemText primary="Rent Collection" />
      </ListItemButton>
      <ListItemButton onClick={() => handleNavigate(`${basePath}?tab=feedback`)}>
        <ListItemIcon>
          <CommentOutlined />
        </ListItemIcon>
        <ListItemText primary="Feedback" />
      </ListItemButton>
    </List>
  );
}
