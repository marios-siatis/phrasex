using System.Text;
using Amazon.S3;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;
using PhraseX.Api;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("PhraseX")));

// HTTP clients
builder.Services.AddHttpClient();

// AWS
builder.Services.AddAWSService<IAmazonS3>();

// Application services
builder.Services.AddScoped<PexelsClient>();
builder.Services.AddScoped<ImageComposer>();

// Controllers
builder.Services.AddControllers();

// JWT
var jwt = builder.Configuration.GetSection("Jwt");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new()
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],

            ValidateAudience = true,
            ValidAudience = jwt["Audience"],

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwt["Key"]!)),

            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();

// CORS
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(
                builder.Configuration
                    .GetSection("Cors:Origins")
                    .Get<string[]>()
                    ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod()));

var app = builder.Build();

// Storage
var localImageDirectory = Path.GetFullPath(
    builder.Configuration["Storage:LocalPath"] ?? "generated");

Directory.CreateDirectory(localImageDirectory);

// Middleware
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

// Generated images
app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            localImageDirectory),

        RequestPath = "/generated"
    });

// Logo assets for quote branding
app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            Path.Combine(builder.Environment.ContentRootPath, "logos")),
        RequestPath = "/logos"
    });

// Database initialization
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await db.Database.EnsureCreatedAsync();

    if (!await db.Interests.AnyAsync())
    {
        db.Interests.AddRange(
            new[]
            {
                "Love",
                "Relationships",
                "Inspiration",
                "Mindfulness",
                "Success",
                "Friendship",
                "Motivation",
                "Gratitude"
            }
            .Select(name => new Interest
            {
                Name = name
            }));

        var admin = new AppUser
        {
            Email = "admin@phrasex.local",
            DisplayName = "PhraseX Admin",
            IsAdmin = true
        };

        admin.PasswordHash =
            new PasswordHasher<AppUser>()
                .HashPassword(admin, "ChangeMe123!");

        db.Users.Add(admin);

        await db.SaveChangesAsync();
    }
}

// API
app.MapControllers();

app.Run();
