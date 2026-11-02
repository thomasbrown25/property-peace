namespace brownstone_hub_api.Enums
{
    public enum EPropertyType
    {
        SingleFamily,
        MultiUnit,
        Townhouse,
        Condominium,
        SmallMultiFamily,
        ApartmentBuilding,
        Other,
    }

    public static class PropertyTypeClassification
    {
        public static bool IsMultiUnit(string? propertyType) =>
            Enum.TryParse<EPropertyType>(propertyType, ignoreCase: true, out var parsed) &&
            parsed is EPropertyType.MultiUnit or EPropertyType.SmallMultiFamily or
                EPropertyType.ApartmentBuilding or EPropertyType.Other;
    }
}