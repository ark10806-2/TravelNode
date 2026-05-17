package com.example.japantrip

import java.net.URI

data class AppConfig(
  val serverPort: Int,
  val corsOrigin: URI,
  val publicBaseUrl: String
) {
  val corsHost: String
    get() = corsOrigin.host + if (corsOrigin.port >= 0) ":${corsOrigin.port}" else ""

  companion object {
    fun fromEnv() = AppConfig(
      serverPort = System.getenv("SERVER_PORT")?.toIntOrNull() ?: 4000,
      corsOrigin = URI(System.getenv("APP_CORS_ORIGIN") ?: "http://localhost:5173"),
      publicBaseUrl = System.getenv("APP_PUBLIC_BASE_URL") ?: ""
    )
  }
}
