package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond

suspend fun ApplicationCall.respondError(status: HttpStatusCode, message: String) {
  respond(status, ErrorResponse(listOf(message)))
}

suspend fun ApplicationCall.respondErrors(status: HttpStatusCode, errors: List<String>) {
  respond(status, ErrorResponse(errors))
}
