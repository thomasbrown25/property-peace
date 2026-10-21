using AutoMapper;
using brownstone_hub_api;
using brownstone_hub_api.Configurations;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Services.PropertyService;
using Moq;
using Newtonsoft.Json;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Properties;

public sealed class RentalModeContractTests
{
    [Fact]
    public async Task Relational_insert_without_mode_uses_sql_default_and_round_trips_both_modes()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        // The full SQL Server model contains nvarchar(max), unsupported by SQLite.
        // Exercise EF's real Unit mapping against an isolated relational table instead.
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Units (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Bedrooms TEXT NOT NULL, Baths TEXT NOT NULL, Type TEXT NOT NULL, SquareFeet INTEGER NOT NULL, IsOccupied INTEGER NOT NULL, PropertyId INTEGER NOT NULL, OrganizationId INTEGER, RentalMode TEXT NOT NULL DEFAULT 'LongTerm')");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id, Name, Bedrooms, Baths, Type, SquareFeet, IsOccupied, PropertyId) VALUES (100, 'Old', '', '', '', 0, 0, 1)");
        var legacy = await db.Units.AsNoTracking().SingleAsync(u => u.Id == 100);
        Assert.Equal(ERentalMode.LongTerm, legacy.RentalMode);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id, Name, Bedrooms, Baths, Type, SquareFeet, IsOccupied, PropertyId, RentalMode) VALUES (101, 'Stay', '', '', '', 0, 0, 1, 'ShortTerm')");
        var stay = await db.Units.AsNoTracking().SingleAsync(u => u.Id == 101);
        Assert.Equal(ERentalMode.ShortTerm, stay.RentalMode);
    }

    [Fact]
    public async Task Multipart_property_data_parses_mode_and_rejects_unknown_string()
    {
        UpdatePropertyDto? received = null;
        var service = new Mock<IPropertyService>();
        service.Setup(s => s.AddOrUpdateProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<List<IFormFile>>(), It.IsAny<CancellationToken>()))
            .Callback<UpdatePropertyDto, List<IFormFile>, CancellationToken>((dto, _, _) => received = dto)
            .ReturnsAsync(ServiceResponse<LoadPropertyDto>.CreateSuccess(new LoadPropertyDto()));
        var controller = new PropertyController(service.Object);
        Assert.IsType<OkObjectResult>(await controller.AddOrUpdateProperty(
            "{\"propertyType\":\"SingleFamily\",\"rentalMode\":\"ShortTerm\"}", [], default));
        Assert.Equal(ERentalMode.ShortTerm, received!.RentalMode);
        Assert.IsType<BadRequestObjectResult>(await controller.AddOrUpdateProperty(
            "{\"rentalMode\":\"Unknown\"}", [], default));
        service.Verify(s => s.AddOrUpdateProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<List<IFormFile>>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Omitted_create_modes_are_long_term_and_explicit_short_term_survives_mapping()
    {
        var mapper = brownstone_hub_api.Tests.Helpers.MapperFactory.Create();
        Assert.Equal(ERentalMode.LongTerm, new Unit().RentalMode);
        Assert.Equal(ERentalMode.LongTerm, JsonConvert.DeserializeObject<UpdatePropertyDto>("{\"propertyType\":\"SingleFamily\"}")!.RentalMode);
        Assert.Null(JsonConvert.DeserializeObject<UpdateUnitDto>("{}")!.RentalMode);
        Assert.Equal(ERentalMode.LongTerm, JsonConvert.DeserializeObject<AddUnitDto>("{}")!.RentalMode);
        var unit = mapper.Map<Unit>(new UpdateUnitDto { RentalMode = ERentalMode.ShortTerm });
        Assert.Equal(ERentalMode.ShortTerm, mapper.Map<LoadUnitDto>(unit).RentalMode);
        Assert.Equal(ERentalMode.ShortTerm, mapper.Map<Unit>(new AddUnitDto { RentalMode = ERentalMode.ShortTerm }).RentalMode);
        Assert.Equal(ERentalMode.ShortTerm, mapper.Map<AddUnitDto>(unit).RentalMode);
    }

    [Fact]
    public void Legacy_unit_update_does_not_change_existing_short_term_mode()
    {
        var mapper = brownstone_hub_api.Tests.Helpers.MapperFactory.Create();
        var existing = new Unit { RentalMode = ERentalMode.ShortTerm };
        mapper.Map(JsonConvert.DeserializeObject<UpdateUnitDto>("{\"name\":\"Updated\"}")!, existing);
        Assert.Equal(ERentalMode.ShortTerm, existing.RentalMode);
    }

    [Fact]
    public void Invalid_mode_is_not_a_valid_enum_value()
    {
        Assert.False(Enum.IsDefined((ERentalMode)99));
        Assert.Throws<JsonSerializationException>(() => JsonConvert.DeserializeObject<UpdatePropertyDto>("{\"rentalMode\":\"NotAMode\"}"));
    }

    [Fact]
    public void Ef_model_stores_string_with_long_term_sql_default()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite("Data Source=:memory:").Options);
        var prop = db.Model.FindEntityType(typeof(Unit))!.FindProperty(nameof(Unit.RentalMode))!;
        Assert.Equal(typeof(string), prop.GetProviderClrType());
        Assert.Equal(ERentalMode.LongTerm, prop.GetDefaultValue());
        Assert.Equal(ERentalMode.ShortTerm, prop.GetTypeMapping().Converter!.ConvertFromProvider("ShortTerm"));
    }
}
