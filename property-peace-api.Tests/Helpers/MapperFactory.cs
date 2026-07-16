using AutoMapper;

namespace brownstone_hub_api.Tests.Helpers
{
    /// <summary>
    /// Creates a real AutoMapper instance using the production AutoMapperProfile.
    /// Using the real profile (rather than mocking IMapper) means mapping bugs
    /// surface in tests rather than being hidden behind a mock.
    /// </summary>
    public static class MapperFactory
    {
        public static IMapper Create()
        {
            var config = new MapperConfiguration(cfg =>
                cfg.AddProfile<AutoMapperProfile>());

            return config.CreateMapper();
        }
    }
}
