import PropTypes from 'prop-types';
import { iconsaxIcons } from '@property-peace/shared/iconsax-icons';

export default function AppIcon({ name, variant = 'linear', size = '1em', style, className }) {
  const icon = iconsaxIcons[name];
  const { viewBox, paths } = icon[variant] ?? icon.linear;

  return (
    <svg
      data-app-icon=""
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      style={{ flexShrink: 0, verticalAlign: '-0.125em', ...style }}
    >
      {paths.map((path) => <path key={path.d} {...path} />)}
    </svg>
  );
}

AppIcon.propTypes = {
  name: PropTypes.oneOf(Object.keys(iconsaxIcons)).isRequired,
  variant: PropTypes.oneOf(['linear', 'bold', 'bulk']),
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  style: PropTypes.object,
  className: PropTypes.string
};
