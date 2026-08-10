import PropTypes from 'prop-types';

// Tutorials may be launched explicitly from Help, but never mount over operational pages.
export default function OnboardingWrapper({ children }) {
  return children;
}

OnboardingWrapper.propTypes = {
  children: PropTypes.node
};
