import PropertyStory from './PropertyStory';

export default function PropertyOverview({ property, propertyId }) {
  return <PropertyStory property={property} propertyId={propertyId} compact />;
}
