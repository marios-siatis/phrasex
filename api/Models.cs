using Microsoft.EntityFrameworkCore;

namespace PhraseX.Api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Interest> Interests => Set<Interest>();
    public DbSet<QuoteImage> QuoteImages => Set<QuoteImage>();
    public DbSet<SiteBranding> SiteBrandings => Set<SiteBranding>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("public");

        b.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Interest>().HasIndex(x => x.Name).IsUnique();
        b.Entity<AppUser>().HasMany(x => x.Interests).WithMany();

        b.Entity<QuoteImage>().ToTable("quoteimages");
        b.Entity<QuoteImage>().Property(x => x.Id).HasColumnName("id");
        b.Entity<QuoteImage>().Property(x => x.Quote).HasColumnName("quote");
        b.Entity<QuoteImage>().Property(x => x.Author).HasColumnName("author");
        b.Entity<QuoteImage>().Property(x => x.LogoName).HasColumnName("logoname");
        b.Entity<QuoteImage>().Property(x => x.SourceImageUrl).HasColumnName("sourceimageurl");
        b.Entity<QuoteImage>().Property(x => x.FinalImageUrl).HasColumnName("finalimageurl");
        b.Entity<QuoteImage>().Property(x => x.Attribution).HasColumnName("attribution");
        b.Entity<QuoteImage>().Property(x => x.CreatedAt).HasColumnName("createdat");
        b.Entity<QuoteImage>().Property(x => x.CreatedById).HasColumnName("createdbyid");

        b.Entity<SiteBranding>().ToTable("sitebrandings");
        b.Entity<SiteBranding>().Property(x => x.Id).HasColumnName("id");
        b.Entity<SiteBranding>().Property(x => x.Title).HasColumnName("title");
        b.Entity<SiteBranding>().Property(x => x.Description).HasColumnName("description");
        b.Entity<SiteBranding>().Property(x => x.LogoName).HasColumnName("logoname");
    }
}

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin
    {
        get; set;
    }
    public ICollection<Interest> Interests { get; set; } = new List<Interest>();
}

public class Interest
{
    public int Id
    {
        get; set;
    }
    public string Name { get; set; } = "";
}

public class QuoteImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Quote { get; set; } = "";
    public string Author { get; set; } = "";
    public string LogoName { get; set; } = "";
    public string SourceImageUrl { get; set; } = "";
    public string FinalImageUrl { get; set; } = "";
    public string? Attribution
    {
        get; set;
    }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById
    {
        get; set;
    }
    public AppUser? CreatedBy { get; set; }
}

public class SiteBranding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string LogoName { get; set; } = "";
}

public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record ProfileRequest(string DisplayName, int[] InterestIds);
public record QuoteRequest(string ImageUrl, string Quote, string Author, string? Attribution, string? LogoName);
public record BrandingRequest(string Title, string Description, string LogoName);
public record BrandingResponse(string Title, string Description, string LogoName);
public record AuthResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Email, string DisplayName, bool IsAdmin, IEnumerable<int> InterestIds);
