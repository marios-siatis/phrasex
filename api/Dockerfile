FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY ["PhraseX.Api.csproj", "./"]
RUN dotnet restore

COPY . .

RUN dotnet publish -c Release -o /app/publish --no-restore


FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Install fontconfig and basic fonts
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bodoni Moda
RUN mkdir -p /usr/local/share/fonts/bodoni-moda \
    && wget -q https://fonts.google.com/download?family=Bodoni%20Moda \
    -O /tmp/bodoni-moda.zip \
    && unzip -q /tmp/bodoni-moda.zip \
    -d /usr/local/share/fonts/bodoni-moda \
    && find /usr/local/share/fonts/bodoni-moda -type f \
    \( -name "*.ttf" -o -name "*.otf" \) \
    -exec cp {} /usr/local/share/fonts/bodoni-moda/ \; \
    && rm -rf /tmp/bodoni-moda.zip \
    && fc-cache -f -v

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 8080

ENTRYPOINT ["dotnet", "PhraseX.Api.dll"]