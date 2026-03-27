package com.ieasrl.coffeecontrol.tecnico.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ieasrl.coffeecontrol.tecnico.BuildConfig
import com.ieasrl.coffeecontrol.tecnico.data.BackendException
import com.ieasrl.coffeecontrol.tecnico.data.CardLookupResponse
import com.ieasrl.coffeecontrol.tecnico.data.EmployeeSearchItemDto
import com.ieasrl.coffeecontrol.tecnico.data.MachineStockResponse
import com.ieasrl.coffeecontrol.tecnico.data.MachineSummaryDto
import com.ieasrl.coffeecontrol.tecnico.data.PendingMachineDto
import com.ieasrl.coffeecontrol.tecnico.data.SecureSessionStore
import com.ieasrl.coffeecontrol.tecnico.data.StoredSession
import com.ieasrl.coffeecontrol.tecnico.data.TechnicianBackend
import com.ieasrl.coffeecontrol.tecnico.data.WifiScanNetworkDto
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

sealed interface AuthState {
    data object Loading : AuthState
    data object LoggedOut : AuthState
    data class Locked(val session: StoredSession) : AuthState
    data class Authenticated(val session: StoredSession) : AuthState
}

enum class TagScanMode {
    LOOKUP,
    ASSIGN
}

data class TechnicianAppState(
    val authState: AuthState = AuthState.Loading,
    val baseUrl: String = BuildConfig.DEFAULT_BACKEND_URL,
    val loginUsername: String = "",
    val loginPassword: String = "",
    val biometricsAvailable: Boolean = false,
    val enableBiometrics: Boolean = true,
    val isBusy: Boolean = false,
    val machines: List<MachineSummaryDto> = emptyList(),
    val pendingMachines: List<PendingMachineDto> = emptyList(),
    val machineSearch: String = "",
    val selectedMachine: MachineSummaryDto? = null,
    val machineStock: MachineStockResponse? = null,
    val stockLoading: Boolean = false,
    val remoteWifiNetworks: List<WifiScanNetworkDto> = emptyList(),
    val remoteWifiStatus: String? = null,
    val remoteWifiBusy: Boolean = false,
    val employeeQuery: String = "",
    val employeeResults: List<EmployeeSearchItemDto> = emptyList(),
    val selectedEmployee: EmployeeSearchItemDto? = null,
    val tagLookup: CardLookupResponse? = null,
    val pendingScanMode: TagScanMode? = null,
    val lastScannedUid: String? = null,
    val infoMessage: String? = null,
    val errorMessage: String? = null
)

class TechnicianAppViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SecureSessionStore(application)
    private val backend = TechnicianBackend(sessionStore)

    var state by mutableStateOf(TechnicianAppState())
        private set

    init {
        viewModelScope.launch {
            restoreSession()
        }
    }

    fun setBiometricsAvailable(available: Boolean) {
        state = state.copy(
            biometricsAvailable = available,
            enableBiometrics = if (available) state.enableBiometrics else false
        )
    }

    fun updateLoginUsername(value: String) {
        state = state.copy(loginUsername = value)
    }

    fun updateLoginPassword(value: String) {
        state = state.copy(loginPassword = value)
    }

    fun updateBaseUrl(value: String) {
        state = state.copy(baseUrl = value)
    }

    fun setMachineSearch(value: String) {
        state = state.copy(machineSearch = value)
    }

    fun setEmployeeQuery(value: String) {
        state = state.copy(employeeQuery = value)
        if (value.trim().length < 2) {
            state = state.copy(employeeResults = emptyList())
            return
        }
        viewModelScope.launch {
            runAction(
                onError = { message -> state = state.copy(errorMessage = message) }
            ) {
                backend.searchEmployees(value).also { employees ->
                    state = state.copy(employeeResults = employees)
                }
            }
        }
    }

    fun toggleBiometrics(enabled: Boolean) {
        state = state.copy(enableBiometrics = enabled)
    }

    fun showError(message: String) {
        state = state.copy(errorMessage = message)
    }

    fun login() {
        val username = state.loginUsername.trim()
        val password = state.loginPassword
        val baseUrl = state.baseUrl.trim()
        if (username.isBlank() || password.isBlank() || baseUrl.isBlank()) {
            state = state.copy(errorMessage = "Completá backend, usuario y contraseña")
            return
        }

        viewModelScope.launch {
            runAction {
                val session = backend.login(
                    baseUrl = baseUrl,
                    username = username,
                    password = password,
                    biometricEnabled = state.enableBiometrics && state.biometricsAvailable
                )
                state = state.copy(
                    authState = AuthState.Authenticated(session),
                    loginPassword = "",
                    infoMessage = "Sesión iniciada"
                )
                loadMachines()
                loadPendingMachines()
            }
        }
    }

    fun unlockStoredSession() {
        val auth = state.authState as? AuthState.Locked ?: return
        state = state.copy(authState = AuthState.Authenticated(auth.session))
        loadMachines()
        loadPendingMachines()
    }

    fun requirePasswordLogin() {
        viewModelScope.launch {
            sessionStore.clearSession()
            state = state.copy(
                authState = AuthState.LoggedOut,
                machines = emptyList(),
                pendingMachines = emptyList(),
                selectedMachine = null,
                machineStock = null,
                remoteWifiNetworks = emptyList(),
                remoteWifiStatus = null,
                remoteWifiBusy = false
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            runAction {
                backend.logoutCurrent()
                state = state.copy(
                    authState = AuthState.LoggedOut,
                    machines = emptyList(),
                    pendingMachines = emptyList(),
                    selectedMachine = null,
                    machineStock = null,
                    remoteWifiNetworks = emptyList(),
                    remoteWifiStatus = null,
                    remoteWifiBusy = false,
                    employeeResults = emptyList(),
                    selectedEmployee = null,
                    tagLookup = null,
                    lastScannedUid = null,
                    infoMessage = "Sesión cerrada"
                )
            }
        }
    }

    fun refreshMachines() {
        loadMachines()
        loadPendingMachines()
        state.selectedMachine?.let { loadMachineStock(it.id) }
    }

    fun selectMachine(machine: MachineSummaryDto) {
        state = state.copy(
            selectedMachine = machine,
            remoteWifiNetworks = emptyList(),
            remoteWifiStatus = null,
            remoteWifiBusy = false
        )
        loadMachineStock(machine.id)
    }

    fun clearSelectedMachine() {
        state = state.copy(
            selectedMachine = null,
            machineStock = null,
            remoteWifiNetworks = emptyList(),
            remoteWifiStatus = null,
            remoteWifiBusy = false
        )
    }

    fun rebootSelectedMachine() {
        val machine = state.selectedMachine ?: return
        viewModelScope.launch {
            runAction {
                backend.rebootMachine(machine.id)
                state = state.copy(infoMessage = "Reinicio remoto encolado para ${machine.name}")
            }
        }
    }

    fun startRemoteWifiScan() {
        val machine = state.selectedMachine ?: return
        if (!machine.online) {
            state = state.copy(errorMessage = "La máquina está offline. No se puede escanear WiFi.")
            return
        }

        viewModelScope.launch {
            state = state.copy(
                remoteWifiBusy = true,
                remoteWifiNetworks = emptyList(),
                remoteWifiStatus = "Encolando escaneo remoto..."
            )
            try {
                val commandId = backend.queueWifiScan(machine.id)
                state = state.copy(remoteWifiStatus = "Escaneando redes desde ${machine.name}...")
                pollWifiScan(machine.id, commandId)
            } catch (error: BackendException) {
                state = state.copy(
                    remoteWifiBusy = false,
                    remoteWifiStatus = "No se pudo iniciar el escaneo remoto",
                    errorMessage = error.message
                )
            } catch (error: Exception) {
                state = state.copy(
                    remoteWifiBusy = false,
                    remoteWifiStatus = "No se pudo iniciar el escaneo remoto",
                    errorMessage = error.message ?: "Error inesperado"
                )
            }
        }
    }

    fun sendWifiUpdate(
        ssid: String,
        password: String,
        backendUrl: String?,
        preservePassword: Boolean
    ) {
        val machine = state.selectedMachine ?: return
        if (!machine.online) {
            state = state.copy(errorMessage = "La máquina está offline. No se puede actualizar WiFi.")
            return
        }
        if (ssid.trim().isBlank()) {
            state = state.copy(errorMessage = "El SSID es obligatorio")
            return
        }

        viewModelScope.launch {
            runAction {
                backend.queueWifiUpdate(
                    machineId = machine.id,
                    ssid = ssid,
                    password = password,
                    backendUrl = backendUrl,
                    preservePassword = preservePassword
                )
                state = state.copy(
                    infoMessage = "Actualización WiFi encolada para ${machine.name}",
                    remoteWifiStatus = "Configuración WiFi enviada a la máquina"
                )
            }
        }
    }

    fun restockSelectedItem(stockItemId: Int, quantity: Int, note: String? = null) {
        val machine = state.selectedMachine ?: return
        if (quantity <= 0) {
            state = state.copy(errorMessage = "La reposición debe ser mayor a cero")
            return
        }
        viewModelScope.launch {
            runAction {
                backend.restock(machine.id, stockItemId, quantity, note)
                state = state.copy(infoMessage = "Stock repuesto en ${machine.name}")
                loadMachineStock(machine.id)
            }
        }
    }

    fun adjustSelectedItem(stockItemId: Int, currentUnits: Int, note: String? = null) {
        val machine = state.selectedMachine ?: return
        if (currentUnits < 0) {
            state = state.copy(errorMessage = "Las unidades no pueden ser negativas")
            return
        }
        viewModelScope.launch {
            runAction {
                backend.adjust(machine.id, stockItemId, currentUnits, note)
                state = state.copy(infoMessage = "Stock ajustado en ${machine.name}")
                loadMachineStock(machine.id)
            }
        }
    }

    fun selectEmployee(employee: EmployeeSearchItemDto) {
        state = state.copy(selectedEmployee = employee)
    }

    fun startTagScan(mode: TagScanMode) {
        state = state.copy(pendingScanMode = mode)
    }

    fun cancelTagScan() {
        state = state.copy(pendingScanMode = null)
    }

    fun handleScannedTag(uid: String) {
        val scanMode = state.pendingScanMode ?: return
        state = state.copy(lastScannedUid = uid, pendingScanMode = null)
        when (scanMode) {
            TagScanMode.LOOKUP -> lookupCard(uid)
            TagScanMode.ASSIGN -> assignCard(uid)
        }
    }

    fun reassignLookupToSelectedEmployee() {
        val selectedEmployee = state.selectedEmployee ?: run {
            state = state.copy(errorMessage = "Seleccioná un empleado antes de reasignar")
            return
        }
        val card = state.tagLookup?.card ?: run {
            state = state.copy(errorMessage = "Primero consultá un TAG")
            return
        }
        viewModelScope.launch {
            runAction {
                val updated = backend.reassignCard(card.id, selectedEmployee.id, card.label)
                state = state.copy(
                    infoMessage = "TAG ${updated.uid} reasignado a ${selectedEmployee.name}",
                    tagLookup = state.tagLookup?.copy(card = updated)
                )
                setEmployeeQuery(selectedEmployee.name)
            }
        }
    }

    fun refreshPendingMachines() {
        loadPendingMachines()
    }

    fun approvePendingMachine(pendingId: Int, name: String, location: String?) {
        if (name.trim().isBlank()) {
            state = state.copy(errorMessage = "El nombre de la máquina es obligatorio")
            return
        }
        viewModelScope.launch {
            runAction {
                backend.approvePending(pendingId, name, location)
                state = state.copy(infoMessage = "Máquina pendiente aprobada")
                loadPendingMachines()
                loadMachines()
            }
        }
    }

    fun rejectPendingMachine(pendingId: Int) {
        viewModelScope.launch {
            runAction {
                backend.rejectPending(pendingId)
                state = state.copy(infoMessage = "Máquina pendiente rechazada")
                loadPendingMachines()
            }
        }
    }

    fun consumeMessages() {
        state = state.copy(infoMessage = null, errorMessage = null)
    }

    private fun lookupCard(uid: String) {
        viewModelScope.launch {
            runAction {
                val lookup = backend.lookupCard(uid)
                state = state.copy(
                    tagLookup = lookup,
                    infoMessage = if (lookup.found) "TAG ${uid.uppercase()} encontrado" else "TAG ${uid.uppercase()} sin registrar"
                )
            }
        }
    }

    private fun assignCard(uid: String) {
        val employee = state.selectedEmployee ?: run {
            state = state.copy(errorMessage = "Seleccioná un empleado antes de escanear para asignar")
            return
        }
        viewModelScope.launch {
            runAction {
                val card = backend.assignCard(employee.id, uid)
                state = state.copy(
                    infoMessage = "TAG ${card.uid} asignado a ${employee.name}",
                    tagLookup = CardLookupResponse(found = true, card = card)
                )
                setEmployeeQuery(employee.name)
            }
        }
    }

    private fun loadMachines() {
        viewModelScope.launch {
            runAction {
                val machines = backend.listMachines()
                val refreshedSelectedMachine = state.selectedMachine?.let { current ->
                    machines.find { it.id == current.id }
                }
                state = state.copy(
                    machines = machines,
                    selectedMachine = refreshedSelectedMachine ?: state.selectedMachine
                )
            }
        }
    }

    private fun loadPendingMachines() {
        val role = currentRole()
        if (!canManagePending(role)) {
            state = state.copy(pendingMachines = emptyList())
            return
        }

        viewModelScope.launch {
            runAction {
                val pending = backend.listPendingMachines()
                state = state.copy(pendingMachines = pending)
            }
        }
    }

    private fun loadMachineStock(machineId: Int) {
        viewModelScope.launch {
            state = state.copy(stockLoading = true)
            try {
                val stock = backend.machineStock(machineId)
                state = state.copy(machineStock = stock, stockLoading = false)
            } catch (error: BackendException) {
                state = state.copy(stockLoading = false, errorMessage = error.message)
            } catch (error: Exception) {
                state = state.copy(stockLoading = false, errorMessage = error.message ?: "Error cargando stock")
            }
        }
    }

    private suspend fun restoreSession() {
        val session = backend.restoreStoredSession()
        val lastUrl = backend.lastBackendUrl() ?: BuildConfig.DEFAULT_BACKEND_URL
        state = state.copy(
            baseUrl = session?.baseUrl ?: lastUrl,
            authState = when {
                session == null -> AuthState.LoggedOut
                session.biometricEnabled -> AuthState.Locked(session)
                else -> AuthState.Authenticated(session)
            }
        )
        if (state.authState is AuthState.Authenticated) {
            loadMachines()
            loadPendingMachines()
        }
    }

    private suspend fun pollWifiScan(machineId: Int, commandId: Long, attempt: Int = 0) {
        if (attempt >= 20) {
            state = state.copy(
                remoteWifiBusy = false,
                remoteWifiStatus = "El escaneo tardó demasiado. Probá nuevamente."
            )
            return
        }

        delay(1000)

        try {
            val command = backend.commandStatus(machineId, commandId)
            val status = command.status.lowercase()
            if (status == "completed") {
                val networks = backend.wifiScanNetworks(command)
                    .sortedByDescending { it.rssi ?: Int.MIN_VALUE }
                state = state.copy(
                    remoteWifiBusy = false,
                    remoteWifiNetworks = networks,
                    remoteWifiStatus = when {
                        networks.isNotEmpty() -> "Se encontraron ${networks.size} redes"
                        else -> backend.commandMessage(command) ?: "Escaneo completado sin redes visibles"
                    }
                )
                return
            }

            if (status == "failed") {
                state = state.copy(
                    remoteWifiBusy = false,
                    remoteWifiStatus = backend.commandMessage(command) ?: "El escaneo remoto falló"
                )
                return
            }

            state = state.copy(
                remoteWifiBusy = true,
                remoteWifiStatus = backend.commandMessage(command) ?: "Escaneando redes..."
            )
            pollWifiScan(machineId, commandId, attempt + 1)
        } catch (error: BackendException) {
            state = state.copy(
                remoteWifiBusy = false,
                remoteWifiStatus = "No se pudo consultar el escaneo remoto",
                errorMessage = error.message
            )
        } catch (error: Exception) {
            state = state.copy(
                remoteWifiBusy = false,
                remoteWifiStatus = "No se pudo consultar el escaneo remoto",
                errorMessage = error.message ?: "Error inesperado"
            )
        }
    }

    private fun currentRole(): String? = when (val auth = state.authState) {
        is AuthState.Authenticated -> auth.session.user.role
        is AuthState.Locked -> auth.session.user.role
        else -> null
    }

    private fun canManagePending(role: String?): Boolean =
        role == "admin" || role == "gerente" || role == "distribuidor"

    private suspend fun runAction(
        onError: ((String) -> Unit)? = null,
        action: suspend () -> Unit
    ) {
        state = state.copy(isBusy = true)
        try {
            action()
        } catch (error: BackendException) {
            val message = error.message
            if (onError != null) {
                onError(message)
            } else {
                state = state.copy(errorMessage = message)
            }
        } catch (error: Exception) {
            val message = error.message ?: "Error inesperado"
            if (onError != null) {
                onError(message)
            } else {
                state = state.copy(errorMessage = message)
            }
        } finally {
            state = state.copy(isBusy = false)
        }
    }
}
