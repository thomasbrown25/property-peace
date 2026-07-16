import { alpha, Grid } from '@mui/system';
import { DollarCircleFilled } from '@ant-design/icons';
import EcommerceMetrix from 'components/statistics/EcommerceMetrix';
import { formatCurrency } from 'utils/formatters';

const OverviewCards = ({ summary }) => {

  const { remainingThisMonth = 0, collectedThisMonth = 0, overdue = 0 } = summary || {};

  return (
    <>
      <Grid size={{ xs: 12, lg: 4, sm: 6 }}>
        <EcommerceMetrix
          className="rent-collected-overview-card"
          sx={(theme) => ({
            boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.4)}`
          })}
          primary="Rent Collected"
          secondary={formatCurrency(collectedThisMonth)}
          color="success.main"
          iconPrimary={DollarCircleFilled}
        />
      </Grid>
      <Grid size={{ xs: 12, lg: 4, sm: 6 }}>
        <EcommerceMetrix
          className="rent-remaining-overview-card"
          sx={(theme) => ({
            boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.4)}`
          })}
          primary="Rent Remaining"
          secondary={formatCurrency(remainingThisMonth)}
          color="primary.main"
          iconPrimary={DollarCircleFilled}
        />
      </Grid>
      <Grid size={{ xs: 12, lg: 4, sm: 12 }}>
        <EcommerceMetrix
          className="rent-overdue-overview-card"
          sx={(theme) => ({
            boxShadow: `0 0 20px ${alpha(theme.palette.error.main, 0.4)}`
          })}
          primary="Rent Overdue"
          secondary={formatCurrency(overdue)}
          color="error.main"
          iconPrimary={DollarCircleFilled}
        />
      </Grid>
    </>
  );
};

export default OverviewCards;
