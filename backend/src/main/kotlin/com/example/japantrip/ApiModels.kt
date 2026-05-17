package com.example.japantrip

data class DataResponse<T>(val data: T)

data class ErrorResponse(val errors: List<String>)
