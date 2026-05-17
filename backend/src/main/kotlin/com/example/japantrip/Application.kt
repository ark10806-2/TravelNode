package com.example.japantrip

import io.ktor.server.application.Application
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.routing

fun main() {
  val config = AppConfig.fromEnv()

  embeddedServer(Netty, host = "0.0.0.0", port = config.serverPort) {
    module(config)
  }.start(wait = true)
}

fun Application.module(config: AppConfig = AppConfig.fromEnv()) {
  val appLog = environment.log
  val services = AppServices.fromEnv()
  services.initialize()

  configureServerPlugins(config, appLog)

  routing {
    apiRoutes(services, config, appLog)
  }
}
