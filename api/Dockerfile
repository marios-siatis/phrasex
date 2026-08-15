FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY ["PhraseX.Api.csproj", "./"]
RUN dotnet restore

COPY . .

RUN dotnet publish -c Release -o /app/publish --no-restore


FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fontconfig \
        fonts-dejavu \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install PhraseX fonts
RUN mkdir -p /usr/local/share/fonts/phrasex

COPY Fonts/*.ttf /usr/local/share/fonts/phrasex/

RUN fc-cache -f -v

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 8080

ENTRYPOINT ["dotnet", "PhraseX.Api.dll"]