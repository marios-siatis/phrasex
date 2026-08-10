using Microsoft.EntityFrameworkCore;

namespace PhraseX.Api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Interest> Interests => Set<Interest>();
    public DbSet<QuoteImage> QuoteImages => Set<QuoteImage>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Interest>().HasIndex(x => x.Name).IsUnique();
        b.Entity<AppUser>().HasMany(x => x.Interests).WithMany();
    }
}

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin { get; set; }
    public ICollection<Interest> Interests { get; set; } = new List<Interest>();
}

public class Interest { public int Id { get; set; } public string Name { get; set; } = ""; }

public class QuoteImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Quote { get; set; } = "";
    public string SourceImageUrl { get; set; } = "";
    public string FinalImageUrl { get; set; } = "";
    public string? Attribution { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
}

public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record ProfileRequest(string DisplayName, int[] InterestIds);
public record QuoteRequest(string ImageUrl, string Quote, string? Attribution);
public record AuthResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Email, string DisplayName, bool IsAdmin, IEnumerable<int> InterestIds);
