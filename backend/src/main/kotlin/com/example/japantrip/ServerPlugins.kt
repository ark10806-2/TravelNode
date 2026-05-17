package com.example.japantrip

import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import org.slf4j.Logger
import org.slf4j.event.Level

fun Application.configureServerPlugins(config: AppConfig, appLog: Logger) {
  install(CallLogging) {
    level = Level.INFO
  }

  install(ContentNegotiation) {
    jackson {
      registerKotlinModule()
      registerModule(JavaTimeModule())
      disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    }
  }

  install(StatusPages) {
    exception<Throwable> { call, cause ->
      appLog.error("Unhandled API error", cause)
      call.respond(HttpStatusCode.InternalServerError, ErrorResponse(listOf("internal server error")))
    }
  }

  install(CORS) {
    allowHost(config.corsHost, schemes = listOf(config.corsOrigin.scheme))
    allowMethod(HttpMethod.Get)
    allowMethod(HttpMethod.Post)
    allowMethod(HttpMethod.Put)
    allowMethod(HttpMethod.Patch)
    allowMethod(HttpMethod.Delete)
    allowMethod(HttpMethod.Options)
    allowHeader(HttpHeaders.ContentType)
    allowHeader(HttpHeaders.Authorization)
  }
}
