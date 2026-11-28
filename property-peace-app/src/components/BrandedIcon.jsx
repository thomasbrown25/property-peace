import PropTypes from 'prop-types';
import createLease from 'assets/images/app-icons/create-lease.webp';
import createTask from 'assets/images/app-icons/create-task.webp';
import edit from 'assets/images/app-icons/edit.webp';
import house from 'assets/images/app-icons/house.webp';
import more from 'assets/images/app-icons/more.webp';
import payment from 'assets/images/app-icons/payment.webp';
import properties from 'assets/images/app-icons/properties.webp';
import settings from 'assets/images/app-icons/settings.webp';
import uploadDocument from 'assets/images/app-icons/upload-document.webp';

const artwork = { createLease, createTask, edit, house, more, payment, properties, settings, uploadDocument };

export default function BrandedIcon({ name, size = 22, style }) {
  return (
    <img
      src={artwork[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain', ...style }}
    />
  );
}

BrandedIcon.propTypes = {
  name: PropTypes.oneOf(Object.keys(artwork)).isRequired,
  size: PropTypes.number,
  style: PropTypes.object
};
