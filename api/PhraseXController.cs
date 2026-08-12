using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PhraseX.Api;

namespace PhraseX.Api.Controllers;

[ApiController]
[Route("api")]
public class PhraseXController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly PexelsClient _pexelsClient;
    private readonly ImageComposer _imageComposer;
    private readonly IWebHostEnvironment _environment;

    public PhraseXController(
        AppDbContext db,
        IConfiguration configuration,
        PexelsClient pexelsClient,
        ImageComposer imageComposer,
        IWebHostEnvironment environment)
    {
        _db = db;
        _configuration = configuration;
        _pexelsClient = pexelsClient;
        _imageComposer = imageComposer;
        _environment = environment;
    }

    // ==========================================
    // Health
    // ==========================================

    [HttpGet("/health")]
    public IActionResult Health()
    {
        return Ok(new { status = "ok" });
    }

    // ==========================================
    // Authentication
    // ==========================================

    [HttpPost("auth/register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.ToLower();

        if (await _db.Users.AnyAsync(u => u.Email == email))
        {
            return Conflict(
                new
                {
                    message = "Email is already registered."
                });
        }

        var user = new AppUser
        {
            Email = email,
            DisplayName = request.DisplayName
        };

        user.PasswordHash =
            new PasswordHasher<AppUser>()
                .HashPassword(user, request.Password);

        _db.Users.Add(user);

        await _db.SaveChangesAsync();

        return Ok(CreateAuth(user));
    }

    [HttpPost("auth/login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.ToLower();

        var user = await _db.Users
            .Include(x => x.Interests)
            .SingleOrDefaultAsync(x => x.Email == email);

        if (user is null)
        {
            return Unauthorized();
        }

        var passwordResult =
            new PasswordHasher<AppUser>()
                .VerifyHashedPassword(
                    user,
                    user.PasswordHash,
                    request.Password);

        if (passwordResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized();
        }

        return Ok(CreateAuth(user));
    }

    // ==========================================
    // Interests
    // ==========================================

    [HttpGet("interests")]
    public async Task<IActionResult> GetInterests()
    {
        var interests = await _db.Interests
            .OrderBy(x => x.Name)
            .ToListAsync();

        return Ok(interests);
    }

    // ==========================================
    // Profile
    // ==========================================

    [HttpGet("profile")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetProfile()
    {
        var user = await CurrentUser();

        return Ok(ToDto(user));
    }

    [HttpPut("profile")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> UpdateProfile(
        ProfileRequest request)
    {
        var user = await CurrentUser();

        user.DisplayName = request.DisplayName.Trim();

        user.Interests = await _db.Interests
            .Where(i => request.InterestIds.Contains(i.Id))
            .ToListAsync();

        await _db.SaveChangesAsync();

        return Ok(ToDto(user));
    }

    // ==========================================
    // Image Search
    // ==========================================

    [HttpGet("images/search")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> SearchImages(
        [FromQuery] string q,
        CancellationToken cancellationToken)
    {
        var results = await _pexelsClient.Search(
            q,
            18,
            cancellationToken);

        return Ok(results);
    }

    // ==========================================
    // Admin Quotes
    // ==========================================

    [HttpPost("admin/quotes")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> CreateQuote(
        QuoteRequest request,
        CancellationToken cancellationToken)
    {
        var user = await CurrentUser();

        if (!user.IsAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Quote))
        {
            return BadRequest(
                new
                {
                    message = "A quote is required."
                });
        }

        if (string.IsNullOrWhiteSpace(request.Author))
        {
            return BadRequest(
                new
                {
                    message = "An author is required."
                });
        }

        if (string.IsNullOrWhiteSpace(request.LogoName))
        {
            return BadRequest(
                new
                {
                    message = "A logo is required."
                });
        }

        if (string.IsNullOrWhiteSpace(request.ImageUrl))
        {
            return BadRequest(
                new
                {
                    message = "A source image is required."
                });
        }

        var quoteText = request.Quote.Trim();
        var authorText = request.Author.Trim();

        var finalUrl = await _imageComposer.ComposeAndStore(
            request.ImageUrl,
            quoteText,
            request.LogoName,
            cancellationToken);

        var quote = new QuoteImage
        {
            Quote = quoteText,
            Author = authorText,
            LogoName = request.LogoName ?? string.Empty,
            SourceImageUrl = request.ImageUrl,
            FinalImageUrl = finalUrl,
            Attribution = request.Attribution,
            CreatedById = user.Id,
            CreatedBy = user
        };

        _db.QuoteImages.Add(quote);

        await _db.SaveChangesAsync(cancellationToken);

        return Created(
            $"/api/quotes/{quote.Id}",
            new
            {
                quote.Id,
                quote.Quote,
                quote.Author,
                quote.FinalImageUrl,
                quote.Attribution,
                Creator = user.DisplayName
            });
    }

    // ==========================================
    // Quotes
    // ==================================

    [HttpGet("logos")]
    public IActionResult GetLogos()
    {
        var logosPath = Path.Combine(_environment.ContentRootPath, "logos");

        if (!Directory.Exists(logosPath))
        {
            return Ok(Array.Empty<string>());
        }

        var logos = Directory.EnumerateFiles(logosPath)
            .Select(Path.GetFileName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToArray();

        return Ok(logos);
    }

    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding()
    {
        var branding = await _db.SiteBrandings.FirstOrDefaultAsync();

        if (branding is null)
        {
            return Ok(new BrandingResponse("PhraseX", "Create meaningful branded quote images.", "phrasex.jpg"));
        }

        return Ok(new BrandingResponse(branding.Title, branding.Description, branding.LogoName));
    }

    [HttpPut("branding")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> UpdateBranding(BrandingRequest request)
    {
        var user = await CurrentUser();

        if (!user.IsAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "A title is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { message = "A description is required." });
        }

        if (string.IsNullOrWhiteSpace(request.LogoName))
        {
            return BadRequest(new { message = "A logo is required." });
        }

        var branding = await _db.SiteBrandings.FirstOrDefaultAsync();

        if (branding is null)
        {
            branding = new SiteBranding
            {
                Title = request.Title.Trim(),
                Description = request.Description.Trim(),
                LogoName = request.LogoName.Trim()
            };
            _db.SiteBrandings.Add(branding);
        }
        else
        {
            branding.Title = request.Title.Trim();
            branding.Description = request.Description.Trim();
            branding.LogoName = request.LogoName.Trim();
        }

        await _db.SaveChangesAsync();

        return Ok(new BrandingResponse(branding.Title, branding.Description, branding.LogoName));
    }

    [HttpGet("quotes")]
    public async Task<IActionResult> GetQuotes([FromQuery] string? q)
    {
        var quoteQuery = _db.QuoteImages
            .Include(qt => qt.CreatedBy)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var normalized = q.Trim().ToLowerInvariant();
            var user = await GetCurrentUserOrNull();
            var interestMatchesQuery = user?.Interests
                .Any(i => i.Name.Contains(normalized, StringComparison.OrdinalIgnoreCase))
                ?? false;

            if (!interestMatchesQuery)
            {
                quoteQuery = quoteQuery.Where(quote =>
                    quote.Quote.ToLower().Contains(normalized) ||
                    quote.Author.ToLower().Contains(normalized) ||
                    (quote.CreatedBy != null && quote.CreatedBy.DisplayName.ToLower().Contains(normalized)));
            }
        }

        var quotes = await quoteQuery
            .OrderByDescending(q => q.CreatedAt)
            .Take(30)
            .Select(q => new
            {
                q.Id,
                q.Quote,
                q.Author,
                q.FinalImageUrl,
                q.Attribution,
                Creator = q.CreatedBy != null ? q.CreatedBy.DisplayName : "Unknown"
            })
            .ToListAsync();

        return Ok(quotes);
    }

    // ==========================================
    // Helpers
    // ==========================================

    private async Task<AppUser> CurrentUser()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (userId is null)
        {
            throw new UnauthorizedAccessException();
        }

        return await _db.Users
            .Include(x => x.Interests)
            .SingleAsync(
                u => u.Id == Guid.Parse(userId));
    }

    private async Task<AppUser?> GetCurrentUserOrNull()
    {
        try
        {
            return await CurrentUser();
        }
        catch
        {
            return null;
        }
    }

    private AuthResponse CreateAuth(AppUser user)
    {
        var claims = new[]
        {
            new Claim(
                ClaimTypes.NameIdentifier,
                user.Id.ToString()),

            new Claim(
                ClaimTypes.Email,
                user.Email),

            new Claim(
                "admin",
                user.IsAdmin.ToString())
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(
                _configuration["Jwt:Key"]!));

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256));

        return new AuthResponse(
            new JwtSecurityTokenHandler()
                .WriteToken(token),
            ToDto(user));
    }

    private static UserDto ToDto(AppUser user)
    {
        return new UserDto(
            user.Id,
            user.Email,
            user.DisplayName,
            user.IsAdmin,
            user.Interests.Select(i => i.Id));
    }
}
