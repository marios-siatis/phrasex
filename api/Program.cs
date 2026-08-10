using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Amazon.S3;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PhraseX.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("PhraseX")));
builder.Services.AddHttpClient<PexelsClient>();
builder.Services.AddHttpClient<ImageComposer>();
builder.Services.AddAWSService<IAmazonS3>();
builder.Services.AddScoped<PexelsClient>();
builder.Services.AddScoped<ImageComposer>();
var jwt = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new() { ValidateIssuer = true, ValidIssuer = jwt["Issuer"], ValidateAudience = true, ValidAudience = jwt["Audience"], ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)), ValidateLifetime = true });
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
var localImageDirectory = Path.GetFullPath(builder.Configuration["Storage:LocalPath"] ?? "generated");
Directory.CreateDirectory(localImageDirectory);
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(Path.GetFullPath(builder.Configuration["Storage:LocalPath"] ?? "generated")),
        RequestPath = "/generated"
    });

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (!await db.Interests.AnyAsync())
    {
        db.Interests.AddRange((new string[] { "Love", "Relationships", "Inspiration", "Mindfulness", "Success", "Friendship", "Motivation", "Gratitude" }).Select(n => new Interest { Name = n }));
        var admin = new AppUser { Email = "admin@phrasex.local", DisplayName = "PhraseX Admin", IsAdmin = true };
        admin.PasswordHash = new PasswordHasher<AppUser>().HashPassword(admin, "ChangeMe123!");
        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPost("/api/auth/register", async (RegisterRequest r, AppDbContext db) =>
{
    if (await db.Users.AnyAsync(u => u.Email == r.Email.ToLower()))
        return Results.Conflict(new
        {
            message = "Email is already registered."
        });
    var u = new AppUser { Email = r.Email.ToLower(), DisplayName = r.DisplayName };
    u.PasswordHash = new PasswordHasher<AppUser>().HashPassword(u, r.Password);
    db.Users.Add(u);
    await db.SaveChangesAsync();
    return Results.Ok(CreateAuth(u, builder.Configuration));
});
app.MapPost("/api/auth/login", async (LoginRequest r, AppDbContext db) => { var u = await db.Users.Include(x => x.Interests).SingleOrDefaultAsync(x => x.Email == r.Email.ToLower()); if (u is null || new PasswordHasher<AppUser>().VerifyHashedPassword(u, u.PasswordHash, r.Password) == PasswordVerificationResult.Failed) return Results.Unauthorized(); return Results.Ok(CreateAuth(u, builder.Configuration)); });
app.MapGet("/api/interests", async (AppDbContext db) => await db.Interests.OrderBy(x => x.Name).ToListAsync());
app.MapGet("/api/profile", async (ClaimsPrincipal p, AppDbContext db) => { var u = await CurrentUser(p, db); return Results.Ok(ToDto(u)); }).RequireAuthorization();
app.MapPut("/api/profile", async (ProfileRequest r, ClaimsPrincipal p, AppDbContext db) => { var u = await CurrentUser(p, db); u.DisplayName = r.DisplayName.Trim(); u.Interests = await db.Interests.Where(i => r.InterestIds.Contains(i.Id)).ToListAsync(); await db.SaveChangesAsync(); return Results.Ok(ToDto(u)); }).RequireAuthorization();
app.MapGet("/api/images/search", async (string q, PexelsClient client, CancellationToken ct) => Results.Ok(await client.Search(q, 18, ct))).RequireAuthorization();
app.MapPost("/api/admin/quotes", async (QuoteRequest r, ClaimsPrincipal p, AppDbContext db, ImageComposer composer, CancellationToken ct) => { var u = await CurrentUser(p, db); if (!u.IsAdmin) return Results.Forbid(); if (string.IsNullOrWhiteSpace(r.Quote)) return Results.BadRequest(new { message = "A quote is required." }); var finalUrl = await composer.ComposeAndStore(r.ImageUrl, r.Quote.Trim(), ct); var quote = new QuoteImage { Quote = r.Quote.Trim(), SourceImageUrl = r.ImageUrl, FinalImageUrl = finalUrl, Attribution = r.Attribution, CreatedById = u.Id }; db.QuoteImages.Add(quote); await db.SaveChangesAsync(ct); return Results.Created($"/api/quotes/{quote.Id}", quote); }).RequireAuthorization();
app.MapGet("/api/quotes", async (AppDbContext db) => await db.QuoteImages.OrderByDescending(q => q.CreatedAt).Take(30).ToListAsync());
app.Run();

static async Task<AppUser> CurrentUser(ClaimsPrincipal p, AppDbContext db) => await db.Users.Include(x => x.Interests).SingleAsync(u => u.Id == Guid.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)!));
static UserDto ToDto(AppUser u) => new(u.Id, u.Email, u.DisplayName, u.IsAdmin, u.Interests.Select(i => i.Id));
static AuthResponse CreateAuth(AppUser u, IConfiguration c) { var claims = new[] { new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()), new Claim(ClaimTypes.Email, u.Email), new Claim("admin", u.IsAdmin.ToString()) }; var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(c["Jwt:Key"]!)); var token = new JwtSecurityToken(c["Jwt:Issuer"], c["Jwt:Audience"], claims, expires: DateTime.UtcNow.AddDays(7), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)); return new(new JwtSecurityTokenHandler().WriteToken(token), ToDto(u)); }
