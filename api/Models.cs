using Microsoft.EntityFrameworkCore;

namespace PhraseX.Api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<QuoteImage> QuoteImages => Set<QuoteImage>();
    public DbSet<TextQuote> TextQuotes => Set<TextQuote>();
    public DbSet<InstagramAccount> InstagramAccounts => Set<InstagramAccount>();
    public DbSet<ScheduledPost> ScheduledPosts => Set<ScheduledPost>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<SiteBranding> SiteBrandings => Set<SiteBranding>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("public");

        b.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Category>().HasIndex(x => x.Name).IsUnique();
        b.Entity<AppUser>().HasMany(x => x.Categories).WithMany();

        b.Entity<QuoteImage>().ToTable("quoteimages");
        b.Entity<QuoteImage>().Property(x => x.Id).HasColumnName("id");
        b.Entity<QuoteImage>().Property(x => x.Quote).HasColumnName("quote");
        b.Entity<QuoteImage>().Property(x => x.Author).HasColumnName("author");
        b.Entity<QuoteImage>().Property(x => x.LogoName).HasColumnName("logoname");
        b.Entity<QuoteImage>().Property(x => x.SourceImageUrl).HasColumnName("sourceimageurl");
        b.Entity<QuoteImage>().Property(x => x.FinalImageUrl).HasColumnName("finalimageurl");
        b.Entity<QuoteImage>().Property(x => x.Category).HasColumnName("category");
        b.Entity<QuoteImage>().Property(x => x.Attribution).HasColumnName("attribution");
        b.Entity<QuoteImage>().Property(x => x.CreatedAt).HasColumnName("createdat");
        b.Entity<QuoteImage>().Property(x => x.CreatedById).HasColumnName("createdbyid");

        b.Entity<Category>().ToTable("categories");
        b.Entity<Category>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Category>().Property(x => x.Name).HasColumnName("name");

        b.Entity<Tag>().ToTable("tags");
        b.Entity<Tag>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Tag>().Property(x => x.Name).HasColumnName("name");

        b.Entity<QuoteImage>()
            .HasMany(q => q.Tags)
            .WithMany(t => t.QuoteImages)
            .UsingEntity(join => join.ToTable("quoteimagetags"));

        b.Entity<TextQuote>().ToTable("textquotes");
        b.Entity<TextQuote>().Property(x => x.Id).HasColumnName("id");
        b.Entity<TextQuote>().Property(x => x.Quote).HasColumnName("quote");
        b.Entity<TextQuote>().Property(x => x.Author).HasColumnName("author");
        b.Entity<TextQuote>().Property(x => x.Category).HasColumnName("category");

        b.Entity<InstagramAccount>().ToTable("instagramaccounts");
        b.Entity<InstagramAccount>().Property(x => x.Id).HasColumnName("id");
        b.Entity<InstagramAccount>().Property(x => x.InstagramUserId).HasColumnName("instagramuserid");
        b.Entity<InstagramAccount>().Property(x => x.DisplayName).HasColumnName("displayname");
        b.Entity<InstagramAccount>().Property(x => x.AccessToken).HasColumnName("accesstoken");
        b.Entity<InstagramAccount>().Property(x => x.RefreshToken).HasColumnName("refreshtoken");
        b.Entity<InstagramAccount>().Property(x => x.CreatedAt).HasColumnName("createdat");
        b.Entity<InstagramAccount>().HasIndex(x => x.InstagramUserId).IsUnique();

        b.Entity<ScheduledPost>().ToTable("scheduledposts");
        b.Entity<ScheduledPost>().Property(x => x.Id).HasColumnName("id");
        b.Entity<ScheduledPost>().Property(x => x.QuoteImageId).HasColumnName("quoteimageid");
        b.Entity<ScheduledPost>().Property(x => x.InstagramAccountId).HasColumnName("instagramaccountid");
        b.Entity<ScheduledPost>().Property(x => x.ScheduledAt).HasColumnName("scheduledat");
        b.Entity<ScheduledPost>().Property(x => x.CreatedAt).HasColumnName("createdat");
        b.Entity<ScheduledPost>().Property(x => x.Posted).HasColumnName("posted");
        b.Entity<ScheduledPost>()
            .HasOne(x => x.QuoteImage)
            .WithMany(q => q.ScheduledPosts)
            .HasForeignKey(x => x.QuoteImageId);
        b.Entity<ScheduledPost>()
            .HasOne(x => x.InstagramAccount)
            .WithMany(i => i.ScheduledPosts)
            .HasForeignKey(x => x.InstagramAccountId);

        b.Entity<SiteBranding>().ToTable("sitebrandings");
        b.Entity<SiteBranding>().Property(x => x.Id).HasColumnName("id");
        b.Entity<SiteBranding>().Property(x => x.Title).HasColumnName("title");
        b.Entity<SiteBranding>().Property(x => x.Description).HasColumnName("description");
        b.Entity<SiteBranding>().Property(x => x.LogoName).HasColumnName("logoname");

        // Collections
        b.Entity<Collection>().ToTable("collections");
        b.Entity<Collection>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Collection>().Property(x => x.Name).HasColumnName("name");
        b.Entity<Collection>().Property(x => x.CreatedAt).HasColumnName("createdat");
        b.Entity<Collection>().Property(x => x.CreatedById).HasColumnName("createdbyid");

        b.Entity<QuoteImage>()
            .HasMany(q => q.Collections)
            .WithMany(c => c.QuoteImages)
            .UsingEntity(join => join.ToTable("collectionquoteimages"));
    }
}
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public ICollection<QuoteImage> QuoteImages { get; set; } = new List<QuoteImage>();
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
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Collection> Collections { get; set; } = new List<Collection>();
}

// Category class defined above

public class QuoteImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Quote { get; set; } = "";
    public string Author { get; set; } = "";
    public string Category { get; set; } = "";
    public ICollection<Tag> Tags { get; set; } = new List<Tag>();
    public ICollection<ScheduledPost> ScheduledPosts { get; set; } = new List<ScheduledPost>();
    public ICollection<Collection> Collections { get; set; } = new List<Collection>();
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

public class TextQuote
{
    public int Id { get; set; }
    public string Quote { get; set; } = "";
    public string Author { get; set; } = "";
    public string Category { get; set; } = "";
}

public class InstagramAccount
{
    public int Id { get; set; }
    public string InstagramUserId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public string? RefreshToken { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScheduledPost> ScheduledPosts { get; set; } = new List<ScheduledPost>();
}

public class ScheduledPost
{
    public int Id { get; set; }
    public Guid QuoteImageId { get; set; }
    public QuoteImage QuoteImage { get; set; } = null!;
    public int InstagramAccountId { get; set; }
    public InstagramAccount InstagramAccount { get; set; } = null!;
    public DateTime ScheduledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Posted { get; set; }
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
public record ProfileRequest(string DisplayName, int[] CategoryIds);
public record QuoteRequest(string ImageUrl, string Quote, string Author, string Category, string? Attribution, string? LogoName);
public record BrandingRequest(string Title, string Description, string LogoName);
public record BrandingResponse(string Title, string Description, string LogoName);
public record InstagramAccountRequest(string InstagramUserId, string DisplayName, string AccessToken, string? RefreshToken);
public record InstagramAccountDto(int Id, string InstagramUserId, string DisplayName, string AccessToken, string? RefreshToken, DateTime CreatedAt);
public record QuoteImageDto(Guid Id, string Quote, string Author, string Category, string FinalImageUrl);
public record ScheduledPostRequest(Guid QuoteImageId, int InstagramAccountId, DateTime ScheduledAt);
public record ScheduledPostDto(int Id, Guid QuoteImageId, int InstagramAccountId, string InstagramAccountDisplayName, DateTime ScheduledAt, bool Posted, DateTime CreatedAt, QuoteImageDto QuoteImage);
public record AuthResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Email, string DisplayName, bool IsAdmin, IEnumerable<int> CategoryIds);

public class Collection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public ICollection<QuoteImage> QuoteImages { get; set; } = new List<QuoteImage>();
}

public record CreateCollectionRequest(string Name);
public record CollectionDto(Guid Id, string Name, DateTime CreatedAt, int ItemCount);
public record AddToCollectionRequest(Guid QuoteImageId);
