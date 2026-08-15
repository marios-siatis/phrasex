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

public class ImageComposer(HttpClient http, IConfiguration configuration, IAmazonS3 s3, IWebHostEnvironment environment)
{
    private readonly IWebHostEnvironment _environment = environment;

    public async Task<string> ComposeAndStore(string imageUrl, string quote, string? logoName,string authorText, CancellationToken ct)
    {
        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) || uri.Host is not "images.pexels.com")
        {
            throw new ArgumentException("Please select an image returned by Pexels.");
        }

        var bytes = await http.GetByteArrayAsync(uri, ct);
        using var image = Image.Load<Rgba32>(bytes);
        image.Mutate(c =>
        {
            c.Resize(new ResizeOptions { Size = new Size(1080, 1350), Mode = ResizeMode.Crop });
            c.Fill(Color.FromRgba(0, 0, 0, 95));
        });

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

        var font = default(FontFamily);

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
            throw new InvalidOperationException("No system font is available for rendering.");
        }

        var quoteFont = SystemFonts.CreateFont(
            font.Name,
            58,
            FontStyle.Bold
        );

        var quoteOptions = new RichTextOptions(quoteFont)
        {
            Origin = new PointF(540, 620),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            WrappingLength = 860,
            TextAlignment = TextAlignment.Center
        };

        var safeLogoName = string.IsNullOrWhiteSpace(logoName)
            ? "phrasex.jpg"
            : Path.GetFileName(logoName);

        var logoFile = Path.Combine(_environment.ContentRootPath, "logos", safeLogoName);

        if (!File.Exists(logoFile))
        {
            throw new ArgumentException("The selected logo could not be found.");
        }

        using var logo = Image.Load<Rgba32>(logoFile);
        var logoWidth = Math.Min(360, image.Width / 3);
        var logoHeight = logo.Width > 0
            ? (int)Math.Round(logoWidth * (logo.Height / (float)logo.Width))
            : logoWidth;
        logo.Mutate(x => x.Resize(new ResizeOptions { Size = new Size(logoWidth, logoHeight), Mode = ResizeMode.Max }));

        var logoPosition = new Point((image.Width - logoWidth) / 2, image.Height - logoHeight - 60);

        var authorOptions = new RichTextOptions(quoteFont)
        {
            Origin = new PointF(540, 720),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            WrappingLength = 860,
            TextAlignment = TextAlignment.Center
        };

        image.Mutate(c =>
        {
            c.DrawText(quoteOptions, quote, Color.White);
            c.DrawText(authorOptions, authorText, Color.White);
            c.DrawImage(logo, logoPosition, 1f);
        });

        await using var output = new MemoryStream();
        await image.SaveAsync(output, new JpegEncoder { Quality = 92 }, ct);
        output.Position = 0;
        var key = $"quotes/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}.jpg";
        var bucket = configuration["Storage:BucketName"];
        if (!string.IsNullOrWhiteSpace(bucket))
        {
            await s3.PutObjectAsync(
                new PutObjectRequest
                {
                    BucketName = bucket, Key = key, InputStream = output, ContentType = "image/jpeg"
                }, ct);
            return $"https://{bucket}.s3.amazonaws.com/{key}";
        }

        var local = configuration["Storage:LocalPath"] ?? "generated";
        Directory.CreateDirectory(local);
        await File.WriteAllBytesAsync(Path.Combine(local, Path.GetFileName(key)), output.ToArray(), ct);
        return $"/generated/{Path.GetFileName(key)}";
    }
}
