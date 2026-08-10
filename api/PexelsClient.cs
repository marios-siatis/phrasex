using System.Net.Http.Headers;
using System.Text.Json;

namespace PhraseX.Api;

public record PexelsPhoto(long Id, string Alt, string Photographer, string Url, string ThumbnailUrl);

public class PexelsClient(HttpClient client, IConfiguration config)
{
    public async Task<IReadOnlyList<PexelsPhoto>> Search(string query, int perPage, CancellationToken ct)
    {
        var apiKey = config["Pexels:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException("Pexels API key has not been configured.");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.pexels.com/v1/search?query={Uri.EscapeDataString(query)}&per_page={Math.Clamp(perPage, 1, 30)}&orientation=portrait");
        request.Headers.Authorization = new AuthenticationHeaderValue(apiKey);
        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(ct));
        return doc.RootElement.GetProperty("photos").EnumerateArray().Select(p => new PexelsPhoto(
            p.GetProperty("id").GetInt64(),
            p.TryGetProperty("alt", out var alt) ? alt.GetString() ?? "" : "",
            p.GetProperty("photographer").GetString() ?? "",
            p.GetProperty("url").GetString() ?? "",
            p.GetProperty("src").GetProperty("large2x").GetString() ?? ""
        )).ToList();
    }
}
