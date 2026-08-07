using brownstone_hub_api.Dtos.OrganizationInvite;
using brownstone_hub_api.Dtos.Role;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Roles;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.GoogleAuthService;
using brownstone_hub_api.Services.AppleAuthService;
using brownstone_hub_api.Services.OrganizationInviteService;
using brownstone_hub_api.Services.TenantInviteService;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Users
{
    public class UserServiceTests : IDisposable
    {
        // ── Mocks / SUT ───────────────────────────────────────────────────────────

        private readonly Mock<IUserRepository> _userRepo = new();
        private readonly Mock<IRoleRepository> _roleRepo = new();
        private readonly Mock<IGoogleAuthService> _googleAuth = new();
        private readonly Mock<IAppleAuthService> _appleAuth = new();
        private readonly Mock<IOrganizationInviteService> _orgInviteService = new();
        private readonly Mock<ITenantInviteService> _tenantInviteService = new();
        private readonly Mock<ITenantRepository> _tenantRepo = new();
        private readonly Data.DataContext _context;
        private readonly IConfiguration _configuration;
        private readonly UserService _sut;

        // A password that passes all PasswordValidator rules
        private const string ValidPassword = "Secure@Pass1!";

        public UserServiceTests()
        {
            _context = DbContextFactory.Create();

            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["JwtSettings:SecretKey"] = Convert.ToBase64String(new byte[32]),
                    ["JwtSettings:Issuer"]    = "test-issuer",
                    ["JwtSettings:Audience"]  = "test-audience",
                    ["JwtSettings:ExpiresInMinutes"] = "60",
                })
                .Build();

            _sut = new UserService(
                _userRepo.Object,
                _roleRepo.Object,
                _configuration,
                Mock.Of<ILogger<UserService>>(),
                _googleAuth.Object,
                _appleAuth.Object,
                _context,
                organizationInviteService: _orgInviteService.Object,
                tenantInviteService: _tenantInviteService.Object,
                tenantRepository: _tenantRepo.Object
            );
        }

        public void Dispose() => _context.Dispose();

        // ── Seed helpers ──────────────────────────────────────────────────────────

        private static User MakeUser(
            long id = 1,
            bool isDeleted = false,
            bool isSuspended = false,
            long? currentOrgId = null) => new()
        {
            Id = id,
            FirstName = "John",
            LastName = "Doe",
            Email = "john@test.com",
            IsDeleted = isDeleted,
            IsSuspended = isSuspended,
            CurrentOrganizationId = currentOrgId,
            UserRoles = [],
        };

        private static LoadUserDto MakeLoadUserDto(long id = 1, string email = "john@test.com") => new()
        {
            Id = id,
            Email = email,
            Firstname = "John",
            Lastname = "Doe",
            Roles = [],
        };

        private static ServiceResponse<LoadOrganizationInviteDto> OrgInviteResponse(
            string email = "john@test.com",
            bool isAccepted = false,
            DateTime? expiresAt = null) => new()
        {
            Success = true,
            Data = new LoadOrganizationInviteDto
            {
                Id = 1,
                OrganizationId = 10,
                Email = email,
                IsAccepted = isAccepted,
                ExpiresAt = expiresAt ?? DateTime.Now.AddDays(7),
                Token = "valid-token",
                Role = "Member",
            }
        };

        // ── Register — guard clauses ──────────────────────────────────────────────

        [Fact]
        public async Task Register_ReturnsFailure_WhenEmailAlreadyExists()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(true);

            var result = await _sut.Register(new AddUserDto { Email = "john@test.com", Password = ValidPassword });

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("already exists");
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenPasswordTooWeak()
        {
            _userRepo.Setup(r => r.UserExists(It.IsAny<string>())).ReturnsAsync(false);

            var result = await _sut.Register(new AddUserDto { Email = "john@test.com", Password = "weak" });

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenOrgInviteEmailMismatch()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _orgInviteService.Setup(s => s.GetInviteByTokenAsync("token123"))
                .ReturnsAsync(OrgInviteResponse(email: "other@different.com"));

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                OrganizationInviteToken = "token123",
            });

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("Email does not match");
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenOrgInviteAlreadyAccepted()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _orgInviteService.Setup(s => s.GetInviteByTokenAsync("token123"))
                .ReturnsAsync(OrgInviteResponse(isAccepted: true));

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                OrganizationInviteToken = "token123",
            });

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("already been accepted");
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenOrgInviteExpired()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _orgInviteService.Setup(s => s.GetInviteByTokenAsync("token123"))
                .ReturnsAsync(OrgInviteResponse(expiresAt: DateTime.Now.AddDays(-1)));

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                OrganizationInviteToken = "token123",
            });

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("expired");
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenTenantInviteInvalid()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _tenantInviteService.Setup(s => s.ValidateInviteToken("invite-token"))
                .ReturnsAsync(new ServiceResponse<ValidateInviteTokenDto>
                {
                    Success = true,
                    Data = new ValidateInviteTokenDto { IsValid = false, Message = "Token expired" }
                });

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                InviteToken = "invite-token",
            });

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Register_ReturnsFailure_WhenTenantInviteEmailMismatch()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _tenantInviteService.Setup(s => s.ValidateInviteToken("invite-token"))
                .ReturnsAsync(new ServiceResponse<ValidateInviteTokenDto>
                {
                    Success = true,
                    Data = new ValidateInviteTokenDto
                    {
                        IsValid = true,
                        Email = "other@different.com",
                        TenantId = 5
                    }
                });

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                InviteToken = "invite-token",
            });

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("Email does not match");
        }

        [Fact]
        public async Task Register_ReturnsSuccess_WithValidSimpleUser()
        {
            _userRepo.Setup(r => r.UserExists("john@test.com")).ReturnsAsync(false);
            _userRepo.Setup(r => r.AddUser(It.IsAny<AddUserDto>()))
                     .ReturnsAsync(MakeLoadUserDto(1, "john@test.com"));
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1));
            _userRepo.Setup(r => r.GetUser("john@test.com")).ReturnsAsync(MakeLoadUserDto(1, "john@test.com"));
            _userRepo.Setup(r => r.AddUserSettings(It.IsAny<long?>(), It.IsAny<string?>())).ReturnsAsync(new SettingsDto());
            _roleRepo.Setup(r => r.GetRoleByNameAsync(It.IsAny<string>()))
                     .ReturnsAsync(new LoadRoleDto { Id = 1, RoleName = "Landlord" });

            var result = await _sut.Register(new AddUserDto
            {
                Email = "john@test.com",
                Password = ValidPassword,
                Firstname = "John",
                Lastname = "Doe",
            });

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.JWTToken.Should().NotBeNullOrEmpty();
        }

        // ── Login ─────────────────────────────────────────────────────────────────

        [Fact]
        public async Task Login_ReturnsFailure_WhenCredentialsInvalid()
        {
            _userRepo.Setup(r => r.GetRegisteredUser("john@test.com"))
                     .ReturnsAsync(new AddUserDto { Email = "john@test.com" });
            _userRepo.Setup(r => r.ValidateUser(It.IsAny<AddUserDto>(), "wrongpass"))
                     .ReturnsAsync(default(LoadUserDto)!);

            var result = await _sut.Login("john@test.com", "wrongpass");

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("Invalid email or password");
        }

        [Fact]
        public async Task Login_ReturnsFailure_WhenUserSuspended()
        {
            var validatedUser = MakeLoadUserDto();
            _userRepo.Setup(r => r.GetRegisteredUser("john@test.com"))
                     .ReturnsAsync(new AddUserDto { Email = "john@test.com" });
            _userRepo.Setup(r => r.ValidateUser(It.IsAny<AddUserDto>(), "correctpass"))
                     .ReturnsAsync(validatedUser);
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, isSuspended: true));

            var result = await _sut.Login("john@test.com", "correctpass");

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(403);
            result.Message.Should().Contain("suspended");
        }

        [Fact]
        public async Task Login_ReturnsSuccess_AndIncludesJwtToken()
        {
            var validatedUser = new LoadUserDto
            {
                Id = 1, Email = "john@test.com", Firstname = "John", Lastname = "Doe", Roles = ["Landlord"]
            };
            _userRepo.Setup(r => r.GetRegisteredUser("john@test.com"))
                     .ReturnsAsync(new AddUserDto { Email = "john@test.com" });
            _userRepo.Setup(r => r.ValidateUser(It.IsAny<AddUserDto>(), "correctpass"))
                     .ReturnsAsync(validatedUser);
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, isSuspended: false));

            var result = await _sut.Login("john@test.com", "correctpass");

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.JWTToken.Should().NotBeNullOrEmpty();
        }

        // ── ChangePassword ────────────────────────────────────────────────────────

        [Fact]
        public async Task ChangePassword_ReturnsFailure_WhenNewPasswordTooWeak()
        {
            var result = await _sut.ChangePassword("OldPass1!", "weak");

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task ChangePassword_ReturnsFailure_WhenCurrentPasswordWrong()
        {
            _userRepo.Setup(r => r.ChangePassword("wrongold", ValidPassword)).ReturnsAsync(false);

            var result = await _sut.ChangePassword("wrongold", ValidPassword);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("incorrect");
        }

        [Fact]
        public async Task ChangePassword_ReturnsSuccess_WhenValid()
        {
            _userRepo.Setup(r => r.ChangePassword("OldPass1!", ValidPassword)).ReturnsAsync(true);

            var result = await _sut.ChangePassword("OldPass1!", ValidPassword);

            result.Success.Should().BeTrue();
            result.Data.Should().Contain("successfully");
        }

        // ── AppleLogin ─────────────────────────────────────────────────────────────

        [Fact]
        public async Task AppleLogin_ReturnsUnauthorized_WhenIdentityTokenIsInvalid()
        {
            _appleAuth.Setup(service => service.VerifyIdentityTokenAsync("bad-token", "nonce", It.IsAny<CancellationToken>()))
                .ReturnsAsync((AppleUserInfo?)null);

            var (response, isNewUser) = await _sut.AppleLogin("bad-token", "nonce");

            response.Success.Should().BeFalse();
            response.StatusCode.Should().Be(401);
            isNewUser.Should().BeFalse();
            _userRepo.Verify(repository => repository.GetUserByAppleIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task AppleLogin_ReturnsExistingAccount_WithoutRequiringNameAgain()
        {
            var user = MakeUser();
            user.AppleId = "apple-user-123";
            user.AuthProvider = "Apple";
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            var loaded = MakeLoadUserDto();
            _appleAuth.Setup(service => service.VerifyIdentityTokenAsync("token", "nonce", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new AppleUserInfo("apple-user-123", "john@test.com"));
            _userRepo.Setup(repository => repository.GetUserByAppleIdAsync("apple-user-123")).ReturnsAsync(loaded);
            _userRepo.Setup(repository => repository.GetUser(1L)).ReturnsAsync(user);

            var (response, isNewUser) = await _sut.AppleLogin("token", "nonce");

            response.Success.Should().BeTrue();
            response.Data.Should().BeSameAs(loaded);
            isNewUser.Should().BeFalse();
            user.LoginCount.Should().Be(1);
        }

        [Fact]
        public async Task AppleLogin_LinksVerifiedEmail_WhenAccountHasNoAppleIdentity()
        {
            var user = MakeUser();
            user.PasswordHash = [1, 2, 3];
            user.AuthProvider = "Email";
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            var loaded = MakeLoadUserDto();
            _appleAuth.Setup(service => service.VerifyIdentityTokenAsync("token", "nonce", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new AppleUserInfo("apple-user-123", "john@test.com"));
            _userRepo.SetupSequence(repository => repository.GetUserByAppleIdAsync("apple-user-123"))
                .ReturnsAsync((LoadUserDto?)null)
                .ReturnsAsync(loaded);
            _userRepo.Setup(repository => repository.GetUserByEmailAsync("john@test.com")).ReturnsAsync(loaded);
            _userRepo.Setup(repository => repository.GetUser(1L)).ReturnsAsync(user);

            var (response, isNewUser) = await _sut.AppleLogin("token", "nonce");

            response.Success.Should().BeTrue();
            isNewUser.Should().BeFalse();
            user.AppleId.Should().Be("apple-user-123");
            user.AuthProvider.Should().Be("Email,Apple");
        }

        [Fact]
        public async Task AppleLogin_RejectsVerifiedEmail_WhenAccountHasDifferentAppleIdentity()
        {
            var user = MakeUser();
            user.AppleId = "different-apple-user";
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            var loaded = MakeLoadUserDto();
            _appleAuth.Setup(service => service.VerifyIdentityTokenAsync("token", "nonce", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new AppleUserInfo("apple-user-123", "john@test.com"));
            _userRepo.Setup(repository => repository.GetUserByAppleIdAsync("apple-user-123"))
                .ReturnsAsync((LoadUserDto?)null);
            _userRepo.Setup(repository => repository.GetUserByEmailAsync("john@test.com")).ReturnsAsync(loaded);
            _userRepo.Setup(repository => repository.GetUser(1L)).ReturnsAsync(user);

            var (response, isNewUser) = await _sut.AppleLogin("token", "nonce");

            response.Success.Should().BeFalse();
            response.StatusCode.Should().Be(409);
            isNewUser.Should().BeFalse();
            user.AppleId.Should().Be("different-apple-user");
        }

        // ── DeleteUser ────────────────────────────────────────────────────────────

        [Fact]
        public async Task DeleteUser_ReturnsFailure_WhenUserNotFound()
        {
            _userRepo.Setup(r => r.GetUser(99L)).ReturnsAsync((User)null!);

            var result = await _sut.DeleteUser(99);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("not found");
        }

        [Fact]
        public async Task DeleteUser_ReturnsFailure_WhenUserAlreadyDeleted()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, isDeleted: true));

            var result = await _sut.DeleteUser(1);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("already deleted");
        }

        [Fact]
        public async Task DeleteUser_ReturnsFailure_WhenUserHasActiveLeases()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1));

            // Seed the chain needed by Include(l => l.Unit).ThenInclude(u => u.Property)
            _context.Properties.Add(new Property { Id = 1, Name = "Prop", LandlordId = 1 });
            _context.Units.Add(new Unit { Id = 1, PropertyId = 1, Name = "Unit 1" });
            _context.Leases.Add(new Lease { Id = 1, UnitId = 1, IsDeleted = false });
            await _context.SaveChangesAsync();

            var result = await _sut.DeleteUser(1);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("active leases");
        }

        [Fact]
        public async Task DeleteUser_ReturnsFailure_WhenOrgHasActiveSubscription()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, currentOrgId: 10));

            // No leases, but org has an active subscription
            _context.Subscriptions.Add(new Subscription { Id = 1, OrganizationId = 10, Status = "Active" });
            await _context.SaveChangesAsync();

            var result = await _sut.DeleteUser(1);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("subscription");
        }

        [Fact]
        public async Task DeleteUser_ReturnsSuccess_WhenNoConstraints()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1));
            // No leases, subscriptions, or organizations in context

            var result = await _sut.DeleteUser(1);

            result.Success.Should().BeTrue();
            _userRepo.Verify(r => r.DeleteUser(It.IsAny<User>()), Times.Once);
        }

        [Fact]
        public async Task HardDeleteUserCompletely_RemovesTenantUserDependentReferences()
        {
            var user = MakeUser(1);
            var otherUser = MakeUser(2);
            otherUser.Email = "other@test.com";

            _userRepo.Setup(r => r.GetUserByIdIncludingDeleted(1L)).ReturnsAsync(user);
            _userRepo.Setup(r => r.HardDeleteUser(user)).Returns(Task.CompletedTask);

            _context.Users.AddRange(user, otherUser);
            _context.Tenants.Add(new Tenant { Id = 10, UserId = 1, Firstname = "Joe", Lastname = "Smith", Email = user.Email });
            _context.TenantDocuments.Add(new TenantDocument { Id = 20, TenantId = 10, RefId = 10, DocumentType = brownstone_hub_api.Enums.ETenantDocumentType.LeaseAgreement, BlobName = "doc", BlobUrl = "url" });
            _context.TenantInvites.Add(new TenantInvite { Id = 30, TenantId = 10, Email = user.Email!, InviteToken = "tenant-token", CreatedBy = 2 });
            _context.LeaseShieldConversations.Add(new LeaseShieldConversation { Id = 40, UserId = 1, State = "NY", Title = "Question" });
            _context.Subscriptions.Add(new Subscription { Id = 50, UserId = 1, SubscriptionPlanId = 1, Status = "Trial" });
            _context.SubscriptionHistories.Add(new SubscriptionHistory { Id = 51, SubscriptionId = 50, EventType = "Created" });
            _context.SupportAndFeedbacks.Add(new SupportAndFeedback { Id = 60, UserId = 1, Type = brownstone_hub_api.Enums.ESupportAndFeedbackType.Feedback, SubType = "bug", Subject = "Bug", Message = "Help" });
            _context.Notifications.Add(new Notification { Id = 70, UserId = 2, Type = brownstone_hub_api.Enums.ENotificationType.System, Title = "Activity", Message = "Tenant updated", PerformedByUserId = 1 });

            var conversation = new Conversation { Id = 80, LandlordId = 2, TenantId = 10 };
            _context.Conversations.Add(conversation);
            _context.Messages.Add(new Message { Id = 90, ConversationId = 80, SenderId = 1, Content = "Original" });
            _context.Messages.Add(new Message { Id = 91, ConversationId = 80, SenderId = 2, Content = "Reply", ReplyToMessageId = 90 });
            await _context.SaveChangesAsync();

            var result = await _sut.HardDeleteUserCompletely(1);

            result.Success.Should().BeTrue();
            _context.Tenants.Should().BeEmpty();
            _context.TenantDocuments.Should().BeEmpty();
            _context.TenantInvites.Should().BeEmpty();
            _context.LeaseShieldConversations.Should().BeEmpty();
            _context.Subscriptions.Should().BeEmpty();
            _context.SubscriptionHistories.Should().BeEmpty();
            _context.SupportAndFeedbacks.Should().BeEmpty();
            _context.Messages.Should().ContainSingle(m => m.Id == 91 && m.ReplyToMessageId == null);
            _context.Notifications.Single(n => n.Id == 70).PerformedByUserId.Should().BeNull();
            _context.Conversations.Single(c => c.Id == 80).TenantId.Should().BeNull();
            _userRepo.Verify(r => r.HardDeleteUser(user), Times.Once);
        }

        // ── SuspendUser ───────────────────────────────────────────────────────────

        [Fact]
        public async Task SuspendUser_Returns404_WhenNotFound()
        {
            _userRepo.Setup(r => r.GetUser(99L)).ReturnsAsync((User)null!);

            var result = await _sut.SuspendUser(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task SuspendUser_Returns400_WhenAlreadySuspended()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, isSuspended: true));

            var result = await _sut.SuspendUser(1);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            result.Message.Should().Contain("already suspended");
        }

        [Fact]
        public async Task SuspendUser_ReturnsSuccess_AndSetsSuspendedFlag()
        {
            var user = MakeUser(1, isSuspended: false);
            // Both GetUser calls return the same reference; after service mutates it,
            // the second call returns the already-mutated object (IsSuspended=true).
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(user);

            var result = await _sut.SuspendUser(1);

            result.Success.Should().BeTrue();
            result.Data!.IsSuspended.Should().BeTrue();
        }

        // ── UnsuspendUser ─────────────────────────────────────────────────────────

        [Fact]
        public async Task UnsuspendUser_Returns404_WhenNotFound()
        {
            _userRepo.Setup(r => r.GetUser(99L)).ReturnsAsync((User)null!);

            var result = await _sut.UnsuspendUser(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task UnsuspendUser_Returns400_WhenNotSuspended()
        {
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(MakeUser(1, isSuspended: false));

            var result = await _sut.UnsuspendUser(1);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            result.Message.Should().Contain("not suspended");
        }

        [Fact]
        public async Task UnsuspendUser_ReturnsSuccess_AndClearsSuspendedFlag()
        {
            var user = MakeUser(1, isSuspended: true);
            _userRepo.Setup(r => r.GetUser(1L)).ReturnsAsync(user);

            var result = await _sut.UnsuspendUser(1);

            result.Success.Should().BeTrue();
            result.Data!.IsSuspended.Should().BeFalse();
        }
    }
}
