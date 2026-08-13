using System.IO;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net.Http;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
    private readonly double _quoteSimilarityThreshold;
    private readonly IHttpClientFactory _httpClientFactory;

    public PhraseXController(
        AppDbContext db,
        IConfiguration configuration,
        PexelsClient pexelsClient,
        ImageComposer imageComposer,
        IWebHostEnvironment environment,
        IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _configuration = configuration;
        _pexelsClient = pexelsClient;
        _imageComposer = imageComposer;
        _environment = environment;
        _httpClientFactory = httpClientFactory;
        _quoteSimilarityThreshold = configuration.GetValue<double>("ThresholdQuoteSimilarity", 0.75);
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
                new { message = "Email is already registered." });
        }

        var user = new AppUser { Email = email, DisplayName = request.DisplayName };

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
            .Include(x => x.Categories)
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
    // Categories
    // ==========================================

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _db.Categories
            .OrderBy(x => x.Name)
            .ToListAsync();

        return Ok(categories);
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

        user.Categories = await _db.Categories
            .Where(i => request.CategoryIds.Contains(i.Id))
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
                new { message = "A quote is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Author))
        {
            return BadRequest(
                new { message = "An author is required." });
        }

        if (string.IsNullOrWhiteSpace(request.ImageUrl))
        {
            return BadRequest(
                new { message = "A source image is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest(new { message = "A category is required for the quote." });
        }

        var quoteText = request.Quote.Trim();
        var authorText = request.Author.Trim();
        var categoryText = request.Category.Trim();

        // Ensure category exists
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Name == categoryText);
        if (category is null)
        {
            return BadRequest(new { message = "Category does not exist." });
        }

        // Check both image quotes and imported text quotes.
        // This prevents a CSV quote from later being saved again as an image quote.
        var existingImageQuotes = await _db.QuoteImages
            .AsNoTracking()
            .Select(q => new { q.Quote, q.Author, q.Category })
            .ToListAsync();

        var existingTextQuotes = await _db.TextQuotes
            .AsNoTracking()
            .Select(q => new { q.Quote, q.Author, q.Category })
            .ToListAsync();

        var duplicateImageQuoteExists = existingImageQuotes.Any(q =>
            QuoteMatchesByThreshold(
                quoteText, authorText, categoryText,
                q.Quote, q.Author, q.Category,
                _quoteSimilarityThreshold));

        var duplicateTextQuoteExists = existingTextQuotes.Any(q =>
            QuoteMatchesByThreshold(
                quoteText, authorText, categoryText,
                q.Quote, q.Author, q.Category,
                _quoteSimilarityThreshold));

        if (duplicateImageQuoteExists || duplicateTextQuoteExists)
        {
            return BadRequest(new
            {
                message =
                    $"This quote is too similar to an existing quote. Similarity threshold: {_quoteSimilarityThreshold:P0}."
            });
        }

        var branding = await GetBrandingAsync();
        var logoName = string.IsNullOrWhiteSpace(request.LogoName)
            ? branding?.LogoName
            : request.LogoName.Trim();

        if (string.IsNullOrWhiteSpace(logoName))
        {
            return BadRequest(
                new { message = "A logo is required. Set a default branding logo or choose one for this quote." });
        }

        var finalUrl = await _imageComposer.ComposeAndStore(
            request.ImageUrl,
            quoteText,
            logoName,
            cancellationToken);

        var quote = new QuoteImage
        {
            Quote = quoteText,
            Author = authorText,
            Category = categoryText,
            LogoName = logoName,
            SourceImageUrl = request.ImageUrl,
            FinalImageUrl = finalUrl,
            Attribution = request.Attribution,
            CreatedById = user.Id,
            CreatedBy = user
        };

        // Attach tags if provided (optional comma-separated list in Attribution field?)
        // Expect tags passed via request.Attribution as comma-separated names is not ideal;
        // Better approach: accept tags explicitly in the request. For now, check QueryString for tags param.
        var tagsParam = HttpContext.Request.Query["tags"].ToString();
        if (!string.IsNullOrWhiteSpace(tagsParam))
        {
            var tagNames = tagsParam.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToArray();

            foreach (var tn in tagNames)
            {
                var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == tn) ?? new Tag { Name = tn };
                if (tag.Id == 0)
                {
                    _db.Tags.Add(tag);
                }

                quote.Tags.Add(tag);
            }
        }

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

    [HttpPost("admin/textquotes/upload")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> UploadTextQuotes(IFormFile file)
    {
        var user = await CurrentUser();

        if (!user.IsAdmin)
        {
            return Forbid();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "A CSV file is required." });
        }

        using var reader = new StreamReader(file.OpenReadStream());
        var headerLine = await reader.ReadLineAsync();

        if (headerLine is null)
        {
            return BadRequest(new { message = "CSV file is empty." });
        }

        var headers = ParseCsvLine(headerLine);
        var quoteIndex = Array.FindIndex(headers, h => h.Equals("quote", StringComparison.OrdinalIgnoreCase));
        var authorIndex = Array.FindIndex(headers, h => h.Equals("author", StringComparison.OrdinalIgnoreCase));
        var categoryIndex = Array.FindIndex(headers, h => h.Equals("category", StringComparison.OrdinalIgnoreCase));

        if (quoteIndex < 0 || authorIndex < 0 || categoryIndex < 0)
        {
            return BadRequest(new { message = "CSV header must contain Quote, Author, and Category columns." });
        }

        var existingTextQuotes = await _db.TextQuotes
            .AsNoTracking()
            .Select(t => new { t.Quote, t.Author, t.Category })
            .ToListAsync();

        // Keep track of duplicates so the frontend can show the admin
        // exactly which CSV rows were skipped.
        var duplicates = new List<object>();
        var imported = new List<TextQuote>();

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var values = ParseCsvLine(line);
            if (values.Length <= Math.Max(quoteIndex, Math.Max(authorIndex, categoryIndex)))
            {
                continue;
            }

            var quoteTextLine = values[quoteIndex].Trim();
            if (string.IsNullOrWhiteSpace(quoteTextLine))
            {
                continue;
            }

            var authorTextLine = values[authorIndex].Trim();
            var categoryTextLine = values[categoryIndex].Trim();

            var isDuplicate = existingTextQuotes.Any(existing =>
                                  QuoteMatchesByThreshold(quoteTextLine, authorTextLine, categoryTextLine,
                                      existing.Quote, existing.Author, existing.Category, _quoteSimilarityThreshold)) ||
                              imported.Any(existing =>
                                  QuoteMatchesByThreshold(quoteTextLine, authorTextLine, categoryTextLine,
                                      existing.Quote, existing.Author, existing.Category, _quoteSimilarityThreshold));

            if (isDuplicate)
            {
                duplicates.Add(new { quote = quoteTextLine, author = authorTextLine, category = categoryTextLine });

                continue;
            }

            imported.Add(new TextQuote { Quote = quoteTextLine, Author = authorTextLine, Category = categoryTextLine });
        }

        if (imported.Count > 0)
        {
            _db.TextQuotes.AddRange(imported);
            await _db.SaveChangesAsync();
        }

        return Ok(new { inserted = imported.Count, duplicates });
    }

    private static string[] ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (c == ',' && !inQuotes)
            {
                values.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(c);
        }

        values.Add(current.ToString());
        return values.ToArray();
    }

    private static bool QuoteMatchesByThreshold(
        string quoteA,
        string authorA,
        string categoryA,
        string quoteB,
        string authorB,
        string categoryB,
        double threshold)
    {
        // Duplicate detection is based on the quote text only.
        // Author and category do not affect whether two quotes are considered
        // duplicates. This prevents the same quote being stored multiple times
        // simply because it has a different author or category.
        return StringSimilarity(quoteA, quoteB) >= threshold;
    }

    private static double StringSimilarity(string a, string b)
    {
        var normalizedA = NormalizeQuote(a);
        var normalizedB = NormalizeQuote(b);

        if (normalizedA == normalizedB)
        {
            return 1.0;
        }

        if (string.IsNullOrWhiteSpace(normalizedA) || string.IsNullOrWhiteSpace(normalizedB))
        {
            return 0.0;
        }

        // Character similarity catches typos and small edits.
        var distance = LevenshteinDistance(normalizedA, normalizedB);
        var maxLen = Math.Max(normalizedA.Length, normalizedB.Length);
        var characterSimilarity = 1.0 - distance / (double)maxLen;

        // Word containment catches one quote being another quote plus
        // additional words.
        var wordsA = GetQuoteWords(normalizedA);
        var wordsB = GetQuoteWords(normalizedB);

        var shorterWords = wordsA.Length <= wordsB.Length ? wordsA : wordsB;
        var longerWords = wordsA.Length <= wordsB.Length ? wordsB : wordsA;

        var containmentSimilarity = shorterWords.Length == 0
            ? 0.0
            : shorterWords.Count(word =>
                  longerWords.Contains(word, StringComparer.OrdinalIgnoreCase))
              / (double)shorterWords.Length;

        return Math.Max(characterSimilarity, containmentSimilarity);
    }

    private static string NormalizeQuote(string value)
    {
        var chars = value
            .Trim()
            .ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c) ? c : ' ')
            .ToArray();

        return string.Join(
            ' ',
            new string(chars)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string[] GetQuoteWords(string normalizedQuote)
    {
        return normalizedQuote
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static int LevenshteinDistance(string a, string b)
    {
        var n = a.Length;
        var m = b.Length;
        var dp = new int[n + 1, m + 1];

        for (var i = 0; i <= n; i++)
        {
            dp[i, 0] = i;
        }

        for (var j = 0; j <= m; j++)
        {
            dp[0, j] = j;
        }

        for (var i = 1; i <= n; i++)
        {
            for (var j = 1; j <= m; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                dp[i, j] = Math.Min(
                    Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1),
                    dp[i - 1, j - 1] + cost);
            }
        }

        return dp[n, m];
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

    [HttpGet("admin/instagramaccounts")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetInstagramAccounts()
    {
        var user = await CurrentUser();
        if (!user.IsAdmin)
        {
            return Forbid();
        }

        var accounts = await _db.InstagramAccounts
            .OrderBy(a => a.DisplayName)
            .Select(a => new InstagramAccountDto(
                a.Id,
                a.InstagramUserId,
                a.DisplayName,
                a.AccessToken,
                a.RefreshToken,
                a.CreatedAt))
            .ToListAsync();

        return Ok(accounts);
    }

    [HttpPost("admin/instagramaccounts")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> CreateInstagramAccount(InstagramAccountRequest request)
    {
        var user = await CurrentUser();
        if (!user.IsAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.InstagramUserId))
        {
            return BadRequest(new { message = "Instagram user ID is required." });
        }

        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return BadRequest(new { message = "Display name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.AccessToken))
        {
            return BadRequest(new { message = "Access token is required." });
        }

        if (await _db.InstagramAccounts.AnyAsync(a => a.InstagramUserId == request.InstagramUserId))
        {
            return Conflict(new { message = "Instagram account already exists." });
        }

        var account = new InstagramAccount
        {
            InstagramUserId = request.InstagramUserId.Trim(),
            DisplayName = request.DisplayName.Trim(),
            AccessToken = request.AccessToken.Trim(),
            RefreshToken = request.RefreshToken?.Trim()
        };

        _db.InstagramAccounts.Add(account);
        await _db.SaveChangesAsync();

        return Created($"/api/admin/instagramaccounts/{account.Id}", new InstagramAccountDto(
            account.Id,
            account.InstagramUserId,
            account.DisplayName,
            account.AccessToken,
            account.RefreshToken,
            account.CreatedAt));
    }

    [HttpGet("admin/instagramauth/url")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetInstagramAuthUrl()
    {
        var user = await CurrentUser();

        if (!user.IsAdmin)
            return Forbid();

        var insta = _configuration.GetSection("Instagram");

        var appId = insta["AppId"];
        var redirect = insta["RedirectUri"];

        var scope = insta["Scopes"]
                    ?? "instagram_business_basic,instagram_business_content_publish";

        if (string.IsNullOrWhiteSpace(appId) ||
            string.IsNullOrWhiteSpace(redirect))
        {
            return BadRequest(new { message = "Instagram configuration missing (AppId/RedirectUri)." });
        }

        var authUrl =
            "https://www.instagram.com/oauth/authorize" +
            $"?client_id={Uri.EscapeDataString(appId)}" +
            $"&redirect_uri={Uri.EscapeDataString(redirect)}" +
            $"&scope={Uri.EscapeDataString(scope)}" +
            "&response_type=code";

        return Ok(new { url = authUrl });
    }

    [HttpGet("admin/instagramauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> InstagramAuthCallback(
        [FromQuery] string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(new { message = "Missing Instagram authorization code." });
        }

        var insta = _configuration.GetSection("Instagram");

        var appId = insta["AppId"];
        var appSecret = insta["AppSecret"];
        var redirect = insta["RedirectUri"];

        if (string.IsNullOrWhiteSpace(appId) ||
            string.IsNullOrWhiteSpace(appSecret) ||
            string.IsNullOrWhiteSpace(redirect))
        {
            return BadRequest(new { message = "Instagram configuration not set." });
        }

        var client = _httpClientFactory.CreateClient();

        try
        {
            // Instagram Login token exchange.
            var tokenResponse = await client.PostAsync(
                "https://api.instagram.com/oauth/access_token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = appId,
                    ["client_secret"] = appSecret,
                    ["grant_type"] = "authorization_code",
                    ["redirect_uri"] = redirect,
                    ["code"] = code
                }));

            var tokenBody = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                return BadRequest(new { message = "Instagram token exchange failed.", details = tokenBody });
            }

            using var tokenDoc = JsonDocument.Parse(tokenBody);
            var tokenRoot = tokenDoc.RootElement;

            var accessToken =
                tokenRoot.GetProperty("access_token").GetString();

            var instagramUserId =
                tokenRoot.GetProperty("user_id").GetInt64().ToString();

            if (string.IsNullOrWhiteSpace(accessToken) ||
                string.IsNullOrWhiteSpace(instagramUserId))
            {
                return BadRequest(new { message = "Instagram did not return a valid access token." });
            }

            // Get Instagram account information using the Instagram User token.
            var meUrl =
                $"https://graph.instagram.com/me" +
                $"?fields=id,user_id,username" +
                $"&access_token={Uri.EscapeDataString(accessToken)}";

            var meResponse = await client.GetAsync(meUrl);
            var meBody = await meResponse.Content.ReadAsStringAsync();

            if (!meResponse.IsSuccessStatusCode)
            {
                return BadRequest(new { message = "Failed to retrieve Instagram account.", details = meBody });
            }

            using var meDoc = JsonDocument.Parse(meBody);
            var me = meDoc.RootElement;

            var igUserId =
                me.TryGetProperty("user_id", out var userIdElement)
                    ? userIdElement.GetString()
                    : instagramUserId;

            var displayName =
                me.TryGetProperty("username", out var usernameElement)
                    ? usernameElement.GetString()
                    : igUserId;

            if (string.IsNullOrWhiteSpace(igUserId))
            {
                return BadRequest(new { message = "Could not determine Instagram user ID." });
            }

            // Update existing account or create a new one.
            var account = await _db.InstagramAccounts
                .FirstOrDefaultAsync(a => a.InstagramUserId == igUserId);

            if (account == null)
            {
                account = new InstagramAccount
                {
                    InstagramUserId = igUserId,
                    DisplayName = displayName ?? igUserId,
                    AccessToken = accessToken,
                    RefreshToken = null
                };

                _db.InstagramAccounts.Add(account);
            }
            else
            {
                account.DisplayName = displayName ?? account.DisplayName;
                account.AccessToken = accessToken;
            }

            await _db.SaveChangesAsync();

            var html = $"""
                        <html>
                        <body>
                            <h1>Instagram connected</h1>
                            <p>Account {System.Net.WebUtility.HtmlEncode(displayName ?? igUserId)} connected.</p>
                            <script>
                                setTimeout(() => window.close(), 1200);
                            </script>
                        </body>
                        </html>
                        """;

            return Content(html, "text/html");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Instagram authentication failed.", details = ex.Message });
        }
    }

    [HttpDelete("admin/instagramaccounts/{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> DeleteInstagramAccount(int id)
    {
        var user = await CurrentUser();
        if (!user.IsAdmin) return Forbid();

        var account = await _db.InstagramAccounts.FindAsync(id);
        if (account is null) return NotFound();

        _db.InstagramAccounts.Remove(account);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("admin/quoteimages")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetAdminQuoteImages()
    {
        var user = await CurrentUser();
        if (!user.IsAdmin)
        {
            return Forbid();
        }

        var quoteImages = await _db.QuoteImages
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuoteImageDto(
                q.Id,
                q.Quote,
                q.Author,
                q.Category,
                q.FinalImageUrl))
            .ToListAsync();

        return Ok(quoteImages);
    }

    [HttpGet("admin/scheduledposts")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetScheduledPosts()
    {
        var user = await CurrentUser();
        if (!user.IsAdmin)
        {
            return Forbid();
        }

        var posts = await _db.ScheduledPosts
            .Include(p => p.QuoteImage)
            .Include(p => p.InstagramAccount)
            .OrderByDescending(p => p.ScheduledAt)
            .Select(p => new ScheduledPostDto(
                p.Id,
                p.QuoteImageId,
                p.InstagramAccountId,
                p.InstagramAccount.DisplayName,
                p.ScheduledAt,
                p.Posted,
                p.CreatedAt,
                new QuoteImageDto(
                    p.QuoteImage.Id,
                    p.QuoteImage.Quote,
                    p.QuoteImage.Author,
                    p.QuoteImage.Category,
                    p.QuoteImage.FinalImageUrl)))
            .ToListAsync();

        return Ok(posts);
    }

    [HttpPost("admin/scheduledposts")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> CreateScheduledPost(ScheduledPostRequest request)
    {
        var user = await CurrentUser();
        if (!user.IsAdmin)
        {
            return Forbid();
        }

        var quoteImage = await _db.QuoteImages.FindAsync(request.QuoteImageId);
        if (quoteImage is null)
        {
            return BadRequest(new { message = "Quote image not found." });
        }

        var instagramAccount = await _db.InstagramAccounts.FindAsync(request.InstagramAccountId);
        if (instagramAccount is null)
        {
            return BadRequest(new { message = "Instagram account not found." });
        }

        if (request.ScheduledAt.Kind == DateTimeKind.Unspecified)
        {
            return BadRequest(new { message = "Scheduled date and time must include a valid timezone." });
        }

        var scheduledPost = new ScheduledPost
        {
            QuoteImageId = request.QuoteImageId,
            InstagramAccountId = request.InstagramAccountId,
            ScheduledAt = request.ScheduledAt,
            Posted = false
        };

        _db.ScheduledPosts.Add(scheduledPost);
        await _db.SaveChangesAsync();

        return Created($"/api/admin/scheduledposts/{scheduledPost.Id}", new ScheduledPostDto(
            scheduledPost.Id,
            scheduledPost.QuoteImageId,
            scheduledPost.InstagramAccountId,
            instagramAccount.DisplayName,
            scheduledPost.ScheduledAt,
            scheduledPost.Posted,
            scheduledPost.CreatedAt,
            new QuoteImageDto(
                quoteImage.Id,
                quoteImage.Quote,
                quoteImage.Author,
                quoteImage.Category,
                quoteImage.FinalImageUrl)));
    }

    [HttpGet("quotes")]
    public async Task<IActionResult> GetQuotes([FromQuery] string? q)
    {
        var quoteQuery = _db.QuoteImages
            .Include(qt => qt.CreatedBy)
            .Include(qt => qt.Tags)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var normalized = q.Trim().ToLowerInvariant();

            quoteQuery = quoteQuery.Where(quote =>
                quote.Quote.ToLower().Contains(normalized) ||
                quote.Author.ToLower().Contains(normalized) ||
                quote.Category.ToLower().Contains(normalized));
        }

        var quotes = await quoteQuery
            .OrderByDescending(q => q.CreatedAt)
            .Take(30)
            .Select(q => new
            {
                q.Id,
                q.Quote,
                q.Author,
                q.Category,
                q.FinalImageUrl,
                q.Attribution,
                Tags = q.Tags.Select(t => t.Name),
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
            .Include(x => x.Categories)
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

    private async Task<SiteBranding?> GetBrandingAsync()
    {
        return await _db.SiteBrandings.FirstOrDefaultAsync();
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
            user.Categories.Select(i => i.Id));
    }
}
