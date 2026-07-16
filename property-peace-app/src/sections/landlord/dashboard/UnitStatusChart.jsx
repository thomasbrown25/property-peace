import { useState } from 'react';

// material-ui
import { useTheme } from '@emotion/react';
import { alpha, Grid, IconButton, Menu, MenuItem, Typography } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';

// assets
import MoreOutlined from '@ant-design/icons/MoreOutlined';

// recharts
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, LabelList } from 'recharts';

export default function UnitStatusChart({ isSingleUnitPortfolio, counts }) {
  const theme = useTheme();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const total = (counts?.occupiedUnits || 0) + (counts?.vacantUnits || 0) + (counts?.noticeGivenUnits || 0) + (counts?.makeReadyUnits || 0);

  // Chart data
  const data = [
    { name: 'Occupied', value: counts?.occupiedUnits || 0, color: theme.palette.info.main },
    { name: 'Vacant', value: counts?.vacantUnits || 0, color: theme.palette.warning.main },
    { name: 'Notice Given', value: counts?.noticeGivenUnits || 0, color: theme.palette.error.main },
    { name: 'Make-Ready', value: counts?.makeReadyUnits || 0, color: theme.palette.primary.main }
  ];

  // Custom label using MUI Typography
  const renderCustomLabel = (props) => {
    const { x, y, width, value } = props;
    const percent = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
    return (
      <text x={x + width / 2} y={y - 5} textAnchor="middle" dominantBaseline="middle">
        <tspan>
          <Typography variant="caption" fontWeight={500} color="text.primary">
            {value} ({percent}%)
          </Typography>
        </tspan>
      </text>
    );
  };

  return (
    <MainCard
      title={isSingleUnitPortfolio ? 'Property Status' : 'Unit Status'}
      sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}
      secondary={
        <>
          <IconButton edge="end" aria-label="menu" color="secondary" onClick={handleMenuClick}>
            <MoreOutlined style={{ fontSize: '1.15rem' }} />
          </IconButton>
          <Menu
            id="fade-menu"
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem>Print</MenuItem>
            <MenuItem>Settings</MenuItem>
          </Menu>
        </>
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }} sx={{ height: 273 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [`${value}`, 'Units']} />
              <Legend />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList dataKey="value" content={renderCustomLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grid>
      </Grid>
    </MainCard>
  );
}
