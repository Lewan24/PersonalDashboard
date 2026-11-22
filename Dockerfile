FROM node:24-bookworm-slim AS web
WORKDIR /build/src/personal-hub-web
COPY src/personal-hub-web/package*.json ./
RUN npm ci
COPY src/personal-hub-web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /build
COPY src/PersonalHub.Api/ src/PersonalHub.Api/
RUN dotnet restore src/PersonalHub.Api --locked-mode
COPY --from=web /build/src/PersonalHub.Api/wwwroot/ src/PersonalHub.Api/wwwroot/
RUN dotnet publish src/PersonalHub.Api -c Release --no-restore -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /publish ./
USER root
RUN mkdir -p /app/data && chown app:app /app/data
USER app
ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__Default="Data Source=/app/data/dashboard.db;Foreign Keys=True;Default Timeout=5"
EXPOSE 8080
ENTRYPOINT ["dotnet", "PersonalHub.Api.dll"]
