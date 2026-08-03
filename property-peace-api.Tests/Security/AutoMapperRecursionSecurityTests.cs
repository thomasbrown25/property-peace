using AutoMapper;
using AutoMapper.Internal;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class AutoMapperRecursionSecurityTests
{
    [Fact]
    public void ProductionProfile_BoundsEveryMapDepth()
    {
        var productionAssembly = typeof(AutoMapperProfile).Assembly;
        var configuration = new MapperConfiguration(cfg => cfg.AddMaps(productionAssembly));

        var typeMaps = configuration.Internal().GetAllTypeMaps();

        Assert.NotEmpty(typeMaps);
        Assert.All(typeMaps, typeMap => Assert.Equal(64, typeMap.MaxDepth));
    }
}
