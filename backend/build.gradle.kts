plugins {
  kotlin("jvm") version "2.0.21"
  application
}

group = "com.example"
version = "0.1.0"

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(21)
  }
}

application {
  mainClass.set("com.example.japantrip.ApplicationKt")
}

val ktorVersion = "3.0.3"

dependencies {
  implementation("io.ktor:ktor-server-call-logging-jvm:$ktorVersion")
  implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
  implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
  implementation("io.ktor:ktor-server-cors-jvm:$ktorVersion")
  implementation("io.ktor:ktor-server-netty-jvm:$ktorVersion")
  implementation("io.ktor:ktor-server-status-pages-jvm:$ktorVersion")
  implementation("io.ktor:ktor-serialization-jackson-jvm:$ktorVersion")
  implementation("ch.qos.logback:logback-classic:1.5.15")
  implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.18.2")
  implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.18.2")
  implementation("com.zaxxer:HikariCP:6.2.1")
  implementation("org.apache.pdfbox:pdfbox:3.0.3")
  implementation("org.postgresql:postgresql:42.7.4")
  testImplementation("io.ktor:ktor-server-test-host-jvm:$ktorVersion")
  testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
}

tasks.withType<Test> {
  useJUnitPlatform()
}
