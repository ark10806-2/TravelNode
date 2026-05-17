FROM gradle:8.11.1-jdk21-alpine AS build

WORKDIR /app
COPY settings.gradle.kts build.gradle.kts ./
COPY src ./src
RUN gradle installDist --no-daemon

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=build /app/build/install/japan-trip-backend /app
EXPOSE 4000
ENTRYPOINT ["/app/bin/japan-trip-backend"]
