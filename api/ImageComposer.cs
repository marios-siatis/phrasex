using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Hosting;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace PhraseX.Api;

public class ImageComposer(
    HttpClient http,
    IConfiguration configuration,
    IAmazonS3 s3,
    IWebHostEnvironment environment)
{
    private readonly IWebHostEnvironment _environment = environment;

    public async Task<string> ComposeAndStore(
        string imageUrl,
        string quote,
        string? logoName,
        string authorText,
        CancellationToken ct)
    {
        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) ||
            uri.Host is not "images.pexels.com")
        {
            throw new ArgumentException(
                "Please select an image returned by Pexels.");
        }

        var bytes = await http.GetByteArrayAsync(uri, ct);

        using var image = Image.Load<Rgba32>(bytes);

        image.Mutate(c =>
        {
            c.Resize(new ResizeOptions
            {
                Size = new Size(1080, 1350),
                Mode = ResizeMode.Crop
            });

            // Slightly darken the overall image.
            c.Fill(Color.FromRgba(0, 0, 0, 80));
        });

        // ---------------------------------------------------------
        // Font selection
        // ---------------------------------------------------------

        var preferredFonts = new[]
        {
            "Bodoni Moda",
            "Roboto",
            "Inter",
            "Noto Sans",
            "Open Sans",
            "Source Sans 3",
            "Arial"
        };

        FontFamily font = default;

        foreach (var preferredFont in preferredFonts)
        {
            var candidate = SystemFonts.Collection.Families
                .FirstOrDefault(
                    f => string.Equals(
                        f.Name,
                        preferredFont,
                        StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(candidate.Name))
            {
                font = candidate;
                break;
            }
        }

        if (string.IsNullOrEmpty(font.Name))
        {
            throw new InvalidOperationException(
                "No system font is available for rendering.");
        }

        // Bodoni Moda doesn't expose a separate SemiBold FontStyle
        // through ImageSharp's standard FontStyle enum, so Bold is used.
        var quoteFont = SystemFonts.CreateFont(
            font.Name,
            68,
            FontStyle.Bold);

        var authorFont = SystemFonts.CreateFont(
            font.Name,
            58,
            FontStyle.Bold);

        // ---------------------------------------------------------
        // Normalize quote quotation marks
        // ---------------------------------------------------------

        var formattedQuote = EnsureQuoted(quote);

        // ---------------------------------------------------------
        // Quote text
        // ---------------------------------------------------------

        var quoteOptions = new RichTextOptions(quoteFont)
        {
            Origin = new PointF(540, 575),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            WrappingLength = 860,
            TextAlignment = TextAlignment.Center
        };

        // ---------------------------------------------------------
        // Author
        // ---------------------------------------------------------

        var authorOptions = new RichTextOptions(authorFont)
        {
            Origin = new PointF(540, 725),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            WrappingLength = 860,
            TextAlignment = TextAlignment.Center
        };

        // ---------------------------------------------------------
        // Logo
        // ---------------------------------------------------------

        var safeLogoName = string.IsNullOrWhiteSpace(logoName)
            ? "phrasex.jpg"
            : Path.GetFileName(logoName);

        var logoFile = Path.Combine(
            _environment.ContentRootPath,
            "logos",
            safeLogoName);

        if (!File.Exists(logoFile))
        {
            throw new ArgumentException(
                "The selected logo could not be found.");
        }

        using var logo = Image.Load<Rgba32>(logoFile);

        var logoWidth = Math.Min(360, image.Width / 4);

        var logoHeight = logo.Width > 0
            ? (int)Math.Round(
                logoWidth * (logo.Height / (float)logo.Width))
            : logoWidth;

        logo.Mutate(x =>
            x.Resize(
                new ResizeOptions
                {
                    Size = new Size(logoWidth, logoHeight),
                    Mode = ResizeMode.Max
                }));

        var logoPosition = new Point(
            (image.Width - logoWidth) / 2,
            image.Height - logoHeight - 60);

        // ---------------------------------------------------------
        // SEPARATE SOFT HALO BEHIND QUOTE
        // ---------------------------------------------------------

        using var quoteGlow = new Image<Rgba32>(
            image.Width,
            image.Height,
            Color.Transparent);

        quoteGlow.Mutate(ctx =>
        {
            // Narrow, centered halo around the quote and author.
            // This avoids creating a large dark rectangle across
            // the photograph.
            ctx.Fill(
                Color.FromRgba(0, 0, 0, 90),
                new Rectangle(
                    160,
                    430,
                    760,
                    300));

            // Soft atmospheric edges.
            ctx.GaussianBlur(68);
        });

        image.Mutate(ctx =>
        {
            ctx.DrawImage(
                quoteGlow,
                Point.Empty,
                1f);
        });

        // ---------------------------------------------------------
        // SEPARATE SOFT HALO BEHIND LOGO
        // ---------------------------------------------------------

        using var logoGlow = new Image<Rgba32>(
            image.Width,
            image.Height,
            Color.Transparent);

        logoGlow.Mutate(ctx =>
        {
            // Much narrower than the quote halo.
            // This creates a localized halo around the branding.
            ctx.Fill(
                Color.FromRgba(0, 0, 0, 90),
                new Rectangle(
                    410,
                    image.Height - 330,
                    260,
                    180));

            // Soft atmospheric edges.
            ctx.GaussianBlur(68);
        });

        image.Mutate(ctx =>
        {
            ctx.DrawImage(
                logoGlow,
                Point.Empty,
                1f);
        });

        // ---------------------------------------------------------
        // Render quote, author and logo
        // ---------------------------------------------------------

        image.Mutate(c =>
        {
            c.DrawText(
                quoteOptions,
                formattedQuote,
                Color.White);

            c.DrawText(
                authorOptions,
                authorText,
                Color.White);

            c.DrawImage(
                logo,
                logoPosition,
                1f);
        });

        // ---------------------------------------------------------
        // Save
        // ---------------------------------------------------------

        await using var output = new MemoryStream();

        await image.SaveAsync(
            output,
            new JpegEncoder
            {
                Quality = 92
            },
            ct);

        output.Position = 0;

        var key =
            $"quotes/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}.jpg";

        var bucket = configuration["Storage:BucketName"];

        if (!string.IsNullOrWhiteSpace(bucket))
        {
            await s3.PutObjectAsync(
                new PutObjectRequest
                {
                    BucketName = bucket,
                    Key = key,
                    InputStream = output,
                    ContentType = "image/jpeg"
                },
                ct);

            return $"https://{bucket}.s3.amazonaws.com/{key}";
        }

        var local =
            configuration["Storage:LocalPath"] ?? "generated";

        Directory.CreateDirectory(local);

        await File.WriteAllBytesAsync(
            Path.Combine(
                local,
                Path.GetFileName(key)),
            output.ToArray(),
            ct);

        return $"/generated/{Path.GetFileName(key)}";
    }

    private static string EnsureQuoted(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "“”";
        }

        var cleaned = text.Trim();

        // Remove existing quotation marks from the beginning/end
        // so we don't produce “"Hello"”.
        cleaned = cleaned.Trim(
            '"',
            '“',
            '”');

        return $"“{cleaned}”";
    }
}
