using Amazon.S3;
using Amazon.S3.Model;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace PhraseX.Api;

public class ImageComposer(HttpClient http, IConfiguration configuration, IAmazonS3 s3)
{
    public async Task<string> ComposeAndStore(string imageUrl, string quote, CancellationToken ct)
    {
        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) || uri.Host is not "images.pexels.com")
            throw new ArgumentException("Please select an image returned by Pexels.");
        var bytes = await http.GetByteArrayAsync(uri, ct);
        using var image = Image.Load<Rgba32>(bytes);
        image.Mutate(c => {
            c.Resize(new ResizeOptions { Size = new Size(1080, 1350), Mode = ResizeMode.Crop });
            c.Fill(Color.FromRgba(0, 0, 0, 95));
        });

        var font = SystemFonts.Collection.Families.FirstOrDefault(f => f.Name.Contains("DejaVu", StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrEmpty(font.Name)) throw new InvalidOperationException("No system font is available for rendering.");
        var quoteFont = font.CreateFont(58, FontStyle.Bold);
        var logoFont = font.CreateFont(30, FontStyle.Bold);
        var quoteOptions = new RichTextOptions(quoteFont) { Origin = new PointF(540, 620), HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center, WrappingLength = 860, TextAlignment = TextAlignment.Center };
        var logoOptions = new RichTextOptions(logoFont) { Origin = new PointF(540, 1180), HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        image.Mutate(c => { c.DrawText(quoteOptions, quote, Color.White); c.DrawText(logoOptions, "PHRASEX", Color.FromRgba(255,255,255,220)); });

        await using var output = new MemoryStream();
        await image.SaveAsync(output, new JpegEncoder { Quality = 92 }, ct);
        output.Position = 0;
        var key = $"quotes/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}.jpg";
        var bucket = configuration["Storage:BucketName"];
        if (!string.IsNullOrWhiteSpace(bucket))
        {
            await s3.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = key, InputStream = output, ContentType = "image/jpeg" }, ct);
            return $"https://{bucket}.s3.amazonaws.com/{key}";
        }
        var local = configuration["Storage:LocalPath"] ?? "generated";
        Directory.CreateDirectory(local);
        await File.WriteAllBytesAsync(Path.Combine(local, Path.GetFileName(key)), output.ToArray(), ct);
        return $"/generated/{Path.GetFileName(key)}";
    }
}
