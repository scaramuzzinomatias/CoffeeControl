package com.ieasrl.coffeecontrol.tecnico.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class MobileLoginRequest(
    val username: String,
    val password: String,
    val device_name: String,
    val platform: String
)

@Serializable
data class RefreshRequest(val refresh_token: String)

@Serializable
data class LogoutRequest(val refresh_token: String)

@Serializable
data class MobileSessionDto(
    val id: String,
    val device_name: String? = null,
    val platform: String,
    val expires_at: String
)

@Serializable
data class MobileUserDto(
    val id: Int,
    val username: String,
    val role: String,
    val is_protected: Boolean,
    val department: String? = null,
    val department_scopes: List<String> = emptyList()
)

@Serializable
data class MobileAuthResponse(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Int,
    val user: MobileUserDto,
    val session: MobileSessionDto
)

@Serializable
data class StockSummaryDto(
    val configured_items: Int,
    val low_items: Int,
    val empty_items: Int,
    val inactive_items: Int,
    val total_units: Int
)

@Serializable
data class MachineSummaryDto(
    val id: Int,
    val name: String,
    val location: String? = null,
    val active: Boolean,
    val blocked: Boolean,
    val blocked_reason: String? = null,
    val last_seen: String? = null,
    val taps_today: String = "0",
    val taps_month: String = "0",
    val cost_month_cents: String = "0",
    val last_tap_at: String? = null,
    val wifi_ssid: String? = null,
    val backend_url: String? = null,
    val wifi_rssi: Int? = null,
    val wifi_ip: String? = null,
    val backend_ok: Boolean? = null,
    val backend_error: String? = null,
    val online: Boolean = false,
    val stock_summary: StockSummaryDto? = null
)

@Serializable
data class MachinesEnvelope(val machines: List<MachineSummaryDto>)

@Serializable
data class MachineHeaderDto(
    val id: Int,
    val name: String,
    val location: String? = null
)

@Serializable
data class StockItemDto(
    val id: Int,
    val machine_id: Int,
    val item_id: Int,
    val product_name: String,
    val slot_label: String? = null,
    val capacity_units: Int,
    val current_units: Int,
    val min_units: Int,
    val active: Boolean,
    val status: String,
    val status_label: String? = null,
    val fill_pct: Int? = null
)

@Serializable
data class StockMovementDto(
    val id: Long,
    val machine_id: Int,
    val stock_item_id: Int,
    val item_id: Int,
    val movement_type: String,
    val quantity_delta: Int,
    val previous_units: Int? = null,
    val current_units: Int? = null,
    val actor_username: String? = null,
    val product_name: String? = null,
    val slot_label: String? = null,
    val note: String? = null,
    val created_at: String
)

@Serializable
data class MachineStockResponse(
    val machine: MachineHeaderDto,
    val summary: StockSummaryDto,
    val items: List<StockItemDto> = emptyList(),
    val movements: List<StockMovementDto> = emptyList()
)

@Serializable
data class CommandRequest(
    val type: String,
    val payload: JsonObject? = null
)

@Serializable
data class CommandDto(
    val id: Long,
    val machine_id: Int,
    val command_type: String,
    val status: String
)

@Serializable
data class CommandEnvelope(val command: CommandDto)

@Serializable
data class CommandStatusDto(
    val id: Long,
    val machine_id: Int,
    val command_type: String,
    val status: String,
    val result: JsonObject? = null
)

@Serializable
data class CommandStatusEnvelope(val command: CommandStatusDto)

@Serializable
data class PendingMachineDto(
    val id: Int,
    val mac: String,
    val first_seen: String? = null,
    val last_ping: String? = null
)

@Serializable
data class PendingMachinesEnvelope(
    val pending: List<PendingMachineDto> = emptyList()
)

@Serializable
data class ApprovePendingRequest(
    val name: String,
    val location: String? = null
)

@Serializable
data class WifiScanNetworkDto(
    val ssid: String,
    val rssi: Int? = null,
    val secure: Boolean? = null
)

@Serializable
data class RestockRequest(
    val quantity: Int,
    val note: String? = null
)

@Serializable
data class AdjustRequest(
    val current_units: Int,
    val note: String? = null
)

@Serializable
data class StockItemEnvelope(val stock_item: StockItemDto)

@Serializable
data class EmployeeSearchItemDto(
    val id: Int,
    val name: String,
    val department: String? = null,
    val email: String? = null,
    val dni: String? = null,
    val legajo: String? = null,
    val active: Boolean,
    val nfc_cards: List<NfcCardDto> = emptyList()
)

@Serializable
data class EmployeeSearchResponse(
    val employees: List<EmployeeSearchItemDto> = emptyList(),
    val query: String = ""
)

@Serializable
data class NfcCardDto(
    val id: Int,
    val uid: String,
    val label: String? = null,
    val employee_id: Int? = null,
    val active: Boolean,
    val status: String,
    val employee_name: String? = null,
    val employee_department: String? = null,
    val employee_email: String? = null
)

@Serializable
data class CardLookupResponse(
    val found: Boolean,
    val card: NfcCardDto? = null
)

@Serializable
data class AssignCardRequest(
    val uid: String,
    val label: String? = null
)

@Serializable
data class AssignCardResponse(
    val card: NfcCardDto,
    val employee: EmployeeSearchItemDto? = null
)

@Serializable
data class UpdateCardRequest(
    val label: String? = null,
    val employee_id: Int? = null,
    val status: String? = null,
    val active: Boolean? = null
)

@Serializable
data class UpdateCardResponse(val card: NfcCardDto)

interface TechnicianApi {
    @POST("api/mobile-auth/login")
    suspend fun login(@Body request: MobileLoginRequest): MobileAuthResponse

    @POST("api/mobile-auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): MobileAuthResponse

    @POST("api/mobile-auth/logout")
    suspend fun logout(@Body request: LogoutRequest)

    @GET("api/machines")
    suspend fun machines(@Header("Authorization") authorization: String): MachinesEnvelope

    @GET("api/machines/{machineId}/stock")
    suspend fun machineStock(
        @Header("Authorization") authorization: String,
        @Path("machineId") machineId: Int
    ): MachineStockResponse

    @POST("api/machines/{machineId}/commands")
    suspend fun queueCommand(
        @Header("Authorization") authorization: String,
        @Path("machineId") machineId: Int,
        @Body request: CommandRequest
    ): CommandEnvelope

    @GET("api/machines/{machineId}/commands/{commandId}")
    suspend fun commandStatus(
        @Header("Authorization") authorization: String,
        @Path("machineId") machineId: Int,
        @Path("commandId") commandId: Long
    ): CommandStatusEnvelope

    @POST("api/machines/{machineId}/stock/{stockItemId}/restock")
    suspend fun restock(
        @Header("Authorization") authorization: String,
        @Path("machineId") machineId: Int,
        @Path("stockItemId") stockItemId: Int,
        @Body request: RestockRequest
    ): StockItemEnvelope

    @POST("api/machines/{machineId}/stock/{stockItemId}/adjust")
    suspend fun adjust(
        @Header("Authorization") authorization: String,
        @Path("machineId") machineId: Int,
        @Path("stockItemId") stockItemId: Int,
        @Body request: AdjustRequest
    ): StockItemEnvelope

    @GET("api/mobile-tech/employees/search")
    suspend fun searchEmployees(
        @Header("Authorization") authorization: String,
        @Query("q") query: String
    ): EmployeeSearchResponse

    @GET("api/mobile-tech/cards/lookup/{uid}")
    suspend fun lookupCard(
        @Header("Authorization") authorization: String,
        @Path("uid") uid: String
    ): CardLookupResponse

    @POST("api/mobile-tech/employees/{employeeId}/cards")
    suspend fun assignCard(
        @Header("Authorization") authorization: String,
        @Path("employeeId") employeeId: Int,
        @Body request: AssignCardRequest
    ): AssignCardResponse

    @PATCH("api/mobile-tech/employees/{employeeId}/cards/{cardId}")
    suspend fun updateCard(
        @Header("Authorization") authorization: String,
        @Path("employeeId") employeeId: Int,
        @Path("cardId") cardId: Int,
        @Body request: UpdateCardRequest
    ): UpdateCardResponse

    @GET("api/machines/pending")
    suspend fun pendingMachines(
        @Header("Authorization") authorization: String
    ): PendingMachinesEnvelope

    @POST("api/machines/pending/{pendingId}/approve")
    suspend fun approvePending(
        @Header("Authorization") authorization: String,
        @Path("pendingId") pendingId: Int,
        @Body request: ApprovePendingRequest
    )

    @POST("api/machines/pending/{pendingId}/reject")
    suspend fun rejectPending(
        @Header("Authorization") authorization: String,
        @Path("pendingId") pendingId: Int
    )
}

class BackendException(
    override val message: String,
    val statusCode: Int? = null
) : RuntimeException(message)

class TechnicianBackend(
    private val sessionStore: SecureSessionStore,
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private val contentType = "application/json".toMediaType()

    suspend fun restoreStoredSession(): StoredSession? = sessionStore.loadSession()

    suspend fun login(
        baseUrl: String,
        username: String,
        password: String,
        companyId: String? = null,
        companyName: String? = null,
        biometricEnabled: Boolean
    ): StoredSession {
        val normalizedBaseUrl = normalizeBaseUrl(baseUrl)
        val response = service(normalizedBaseUrl).login(
            MobileLoginRequest(
                username = username.trim(),
                password = password,
                device_name = android.os.Build.MODEL ?: "Android",
                platform = "android"
            )
        )
        val stored = StoredSession(
            companyId = companyId,
            companyName = companyName,
            baseUrl = normalizedBaseUrl,
            accessToken = response.access_token,
            refreshToken = response.refresh_token,
            expiresIn = response.expires_in,
            lastAuthenticatedAt = System.currentTimeMillis(),
            biometricEnabled = biometricEnabled,
            user = response.user.toSessionUser()
        )
        sessionStore.saveSession(stored)
        return stored
    }

    suspend fun logoutCurrent() {
        val session = sessionStore.loadSession()
        if (session != null) {
            runCatching {
                service(session.baseUrl).logout(LogoutRequest(session.refreshToken))
            }
        }
        sessionStore.clearSession()
    }

    fun rememberBackendUrl(baseUrl: String) {
        sessionStore.saveLastBackendUrl(normalizeBaseUrl(baseUrl))
    }

    fun lastBackendUrl(): String? = sessionStore.loadLastBackendUrl()

    suspend fun listMachines(): List<MachineSummaryDto> = withAuthorizedCall { api, session ->
        api.machines(session.authorization).machines
    }

    suspend fun machineStock(machineId: Int): MachineStockResponse = withAuthorizedCall { api, session ->
        api.machineStock(session.authorization, machineId)
    }

    suspend fun rebootMachine(machineId: Int) = withAuthorizedCall { api, session ->
        api.queueCommand(session.authorization, machineId, CommandRequest(type = "reboot"))
    }

    suspend fun queueWifiScan(machineId: Int): Long = withAuthorizedCall { api, session ->
        api.queueCommand(
            session.authorization,
            machineId,
            CommandRequest(type = "wifi_scan")
        ).command.id
    }

    suspend fun queueWifiUpdate(
        machineId: Int,
        ssid: String,
        password: String,
        backendUrl: String?,
        preservePassword: Boolean
    ): Long = withAuthorizedCall { api, session ->
        api.queueCommand(
            session.authorization,
            machineId,
            CommandRequest(
                type = "wifi_update",
                payload = buildJsonObject {
                    put("ssid", ssid.trim())
                    put("pass", password)
                    if (!backendUrl.isNullOrBlank()) {
                        put("url", backendUrl.trim())
                    }
                    put("preserve_password", preservePassword)
                }
            )
        ).command.id
    }

    suspend fun commandStatus(machineId: Int, commandId: Long): CommandStatusDto = withAuthorizedCall { api, session ->
        api.commandStatus(session.authorization, machineId, commandId).command
    }

    suspend fun restock(machineId: Int, stockItemId: Int, quantity: Int, note: String? = null): StockItemDto =
        withAuthorizedCall { api, session ->
            api.restock(session.authorization, machineId, stockItemId, RestockRequest(quantity, note)).stock_item
        }

    suspend fun adjust(machineId: Int, stockItemId: Int, currentUnits: Int, note: String? = null): StockItemDto =
        withAuthorizedCall { api, session ->
            api.adjust(session.authorization, machineId, stockItemId, AdjustRequest(currentUnits, note)).stock_item
        }

    suspend fun searchEmployees(query: String): List<EmployeeSearchItemDto> = withAuthorizedCall { api, session ->
        api.searchEmployees(session.authorization, query).employees
    }

    suspend fun lookupCard(uid: String): CardLookupResponse = withAuthorizedCall { api, session ->
        api.lookupCard(session.authorization, uid.trim().uppercase())
    }

    suspend fun assignCard(employeeId: Int, uid: String, label: String = "TAG tecnico"): NfcCardDto =
        withAuthorizedCall { api, session ->
            api.assignCard(
                session.authorization,
                employeeId,
                AssignCardRequest(uid = uid.trim().uppercase(), label = label)
            ).card
        }

    suspend fun reassignCard(cardId: Int, employeeId: Int, label: String? = null): NfcCardDto =
        withAuthorizedCall { api, session ->
            api.updateCard(
                session.authorization,
                employeeId,
                cardId,
                UpdateCardRequest(
                    label = label,
                    employee_id = employeeId,
                    status = "active"
                )
            ).card
        }

    suspend fun listPendingMachines(): List<PendingMachineDto> = withAuthorizedCall { api, session ->
        api.pendingMachines(session.authorization).pending
    }

    suspend fun approvePending(pendingId: Int, name: String, location: String? = null) = withAuthorizedCall { api, session ->
        api.approvePending(
            session.authorization,
            pendingId,
            ApprovePendingRequest(name = name.trim(), location = location?.trim()?.takeIf { it.isNotEmpty() })
        )
    }

    suspend fun rejectPending(pendingId: Int) = withAuthorizedCall { api, session ->
        api.rejectPending(session.authorization, pendingId)
    }

    fun commandMessage(command: CommandStatusDto): String? =
        command.result?.get("message")?.jsonPrimitive?.contentOrNull

    fun wifiScanNetworks(command: CommandStatusDto): List<WifiScanNetworkDto> {
        val rawNetworks = command.result?.get("networks") ?: return emptyList()
        return rawNetworks.jsonArray.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val ssid = obj["ssid"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
            if (ssid.isBlank()) return@mapNotNull null
            WifiScanNetworkDto(
                ssid = ssid,
                rssi = obj["rssi"]?.jsonPrimitive?.contentOrNull?.toIntOrNull(),
                secure = obj["secure"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull()
            )
        }
    }

    private suspend fun <T> withAuthorizedCall(block: suspend (TechnicianApi, StoredSessionHandle) -> T): T {
        val initial = sessionStore.loadSession() ?: throw BackendException("No hay sesión activa")
        return try {
            block(service(initial.baseUrl), StoredSessionHandle(initial))
        } catch (error: HttpException) {
            if (error.code() == 401 && initial.refreshToken.isNotBlank()) {
                val refreshed = refresh(initial)
                sessionStore.saveSession(refreshed)
                block(service(refreshed.baseUrl), StoredSessionHandle(refreshed))
            } else {
                throw error.toBackendException()
            }
        }
    }

    private suspend fun refresh(session: StoredSession): StoredSession {
        val response = service(session.baseUrl).refresh(RefreshRequest(session.refreshToken))
        return session.copy(
            accessToken = response.access_token,
            refreshToken = response.refresh_token,
            expiresIn = response.expires_in,
            lastAuthenticatedAt = System.currentTimeMillis(),
            user = response.user.toSessionUser()
        )
    }

    private fun service(baseUrl: String): TechnicianApi {
        val logger = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder()
            .addInterceptor(logger)
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(TechnicianApi::class.java)
    }

    private fun normalizeBaseUrl(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            trimmed
        } else {
            "http://$trimmed"
        }
        return if (withScheme.endsWith("/")) withScheme else "$withScheme/"
    }

    private fun MobileUserDto.toSessionUser(): SessionUser = SessionUser(
        id = id,
        username = username,
        role = role,
        is_protected = is_protected,
        department = department,
        department_scopes = department_scopes
    )

    private fun HttpException.toBackendException(): BackendException {
        val fallback = "Error HTTP ${code()}"
        val rawBody = response()?.errorBody()?.string()
        val message = rawBody?.let {
            runCatching { json.decodeFromString<ApiErrorEnvelope>(it).error }.getOrNull()
        } ?: message()
        return BackendException(message.ifBlank { fallback }, code())
    }
}

@Serializable
private data class ApiErrorEnvelope(val error: String)

private data class StoredSessionHandle(
    val session: StoredSession
) {
    val authorization: String
        get() = "Bearer ${session.accessToken}"
}
