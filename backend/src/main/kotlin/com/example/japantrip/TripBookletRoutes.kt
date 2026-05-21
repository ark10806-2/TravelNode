package com.example.japantrip

import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.response.header
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

fun Route.tripBookletRoutes(
  pdfService: TripBookletPdfService,
  authRepository: AuthRepository
) {
  route("/api/booklet") {
    get("pdf") {
      if (!call.requireAuth(authRepository)) return@get

      val pdf = pdfService.generate()
      val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"))
      call.response.header(HttpHeaders.CacheControl, "no-store")
      call.response.header(HttpHeaders.ContentDisposition, """attachment; filename="travel-node-booklet-$timestamp.pdf"""")
      call.respondBytes(pdf, ContentType.Application.Pdf)
    }
  }
}
