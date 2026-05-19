package com.example.japantrip

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.slf4j.Logger

fun Route.apiRoutes(services: AppServices, config: AppConfig, appLog: Logger) {
  get("/api/health") {
    call.respond(mapOf("ok" to true))
  }

  authRoutes(services.authRepository)
  apiUsageRoutes(services.apiUsageRepository, services.authRepository)
  categoryRoutes(services.categoryRepository, services.authRepository)
  scheduleRoutes(services.scheduleRepository, services.authRepository)
  todoRoutes(services.todoRepository, services.authRepository)
  reservationRoutes(services.reservationRepository, services.authRepository)
  routeCacheRoutes(services.routeCacheRepository)
  googleMapsRoutes(services.googleMapsPreviewService, services.googleMapsListSyncService, services.authRepository)
  restaurantRoutes(
    services.restaurantRepository,
    services.restaurantPhotoRepository,
    services.googleMapsPhotoService,
    services.apiUsageRepository,
    services.authRepository,
    config.publicBaseUrl,
    appLog
  )
}
