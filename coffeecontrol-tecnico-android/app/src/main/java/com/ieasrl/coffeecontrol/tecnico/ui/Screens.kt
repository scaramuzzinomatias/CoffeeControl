package com.ieasrl.coffeecontrol.tecnico.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.Nfc
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ieasrl.coffeecontrol.tecnico.biometric.BiometricUnlocker
import com.ieasrl.coffeecontrol.tecnico.data.EmployeeSearchItemDto
import com.ieasrl.coffeecontrol.tecnico.data.MachineSummaryDto
import com.ieasrl.coffeecontrol.tecnico.data.PendingMachineDto
import com.ieasrl.coffeecontrol.tecnico.data.StoredSession
import com.ieasrl.coffeecontrol.tecnico.data.WifiScanNetworkDto
import com.ieasrl.coffeecontrol.tecnico.nfc.NfcReaderController

private val CoffeeControlColorScheme = darkColorScheme(
    primary = Color(0xFF1DA1D8),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF8BD7F6),
    background = Color(0xFF071521),
    surface = Color(0xFF102536),
    surfaceVariant = Color(0xFF18344B),
    onSurface = Color(0xFFF1F6FA),
    onSurfaceVariant = Color(0xFFB6CAD8),
    error = Color(0xFFFF6B6B)
)

@Composable
fun CoffeeControlTecnicoRoot(
    viewModel: TechnicianAppViewModel,
    biometricUnlocker: BiometricUnlocker,
    nfcReaderController: NfcReaderController
) {
    val state = viewModel.state
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.setBiometricsAvailable(biometricUnlocker.isAvailable())
    }

    LaunchedEffect(state.infoMessage, state.errorMessage) {
        val message = state.errorMessage ?: state.infoMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeMessages()
    }

    MaterialTheme(colorScheme = CoffeeControlColorScheme) {
        Surface(modifier = Modifier.fillMaxSize()) {
            Scaffold(
                snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                containerColor = MaterialTheme.colorScheme.background,
                contentWindowInsets = WindowInsets.safeDrawing
            ) { padding ->
                when (val authState = state.authState) {
                    AuthState.Loading -> SplashScreen(padding)
                    AuthState.LoggedOut -> LoginScreen(
                        state = state,
                        paddingValues = padding,
                        onBackendUrlChange = viewModel::updateBaseUrl,
                        onUsernameChange = viewModel::updateLoginUsername,
                        onPasswordChange = viewModel::updateLoginPassword,
                        onBiometricToggle = viewModel::toggleBiometrics,
                        onLogin = viewModel::login
                    )
                    is AuthState.Locked -> UnlockScreen(
                        session = authState.session,
                        paddingValues = padding,
                        onUnlock = {
                            biometricUnlocker.authenticate(
                                onSuccess = viewModel::unlockStoredSession,
                                onError = viewModel::showError
                            )
                        },
                        onUsePassword = viewModel::requirePasswordLogin
                    )
                    is AuthState.Authenticated -> AuthenticatedArea(
                        state = state,
                        paddingValues = padding,
                        nfcReaderController = nfcReaderController,
                        onRefreshMachines = viewModel::refreshMachines,
                        onRefreshPending = viewModel::refreshPendingMachines,
                        onMachineSearchChange = viewModel::setMachineSearch,
                        onMachineSelected = viewModel::selectMachine,
                        onClearMachine = viewModel::clearSelectedMachine,
                        onRebootSelectedMachine = viewModel::rebootSelectedMachine,
                        onStartRemoteWifiScan = viewModel::startRemoteWifiScan,
                        onSendWifiUpdate = viewModel::sendWifiUpdate,
                        onRestock = viewModel::restockSelectedItem,
                        onAdjust = viewModel::adjustSelectedItem,
                        onApprovePending = viewModel::approvePendingMachine,
                        onRejectPending = viewModel::rejectPendingMachine,
                        onEmployeeQueryChange = viewModel::setEmployeeQuery,
                        onEmployeeSelected = viewModel::selectEmployee,
                        onStartTagScan = viewModel::startTagScan,
                        onTagRead = viewModel::handleScannedTag,
                        onCancelTagScan = viewModel::cancelTagScan,
                        onReassignLookup = viewModel::reassignLookupToSelectedEmployee,
                        onLogout = viewModel::logout
                    )
                }
            }
        }
    }
}

@Composable
private fun SplashScreen(paddingValues: PaddingValues) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun LoginScreen(
    state: TechnicianAppState,
    paddingValues: PaddingValues,
    onBackendUrlChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onBiometricToggle: (Boolean) -> Unit,
    onLogin: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.Center,
        contentPadding = PaddingValues(vertical = 32.dp)
    ) {
        item {
            Text(
                text = "CoffeeControl Tecnico",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Login móvil nativo para máquinas, stock y TAGs.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(24.dp))
            OutlinedTextField(
                value = state.baseUrl,
                onValueChange = onBackendUrlChange,
                label = { Text("Backend") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = state.loginUsername,
                onValueChange = onUsernameChange,
                label = { Text("Usuario") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = state.loginPassword,
                onValueChange = onPasswordChange,
                label = { Text("Contraseña") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Activar biometría")
                    Text(
                        text = if (state.biometricsAvailable) "Huella / rostro del dispositivo" else "No disponible en este equipo",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = state.enableBiometrics && state.biometricsAvailable,
                    enabled = state.biometricsAvailable,
                    onCheckedChange = onBiometricToggle
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = onLogin,
                enabled = !state.isBusy,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.isBusy) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text("Ingresar")
                }
            }
        }
    }
}

@Composable
private fun UnlockScreen(
    session: StoredSession,
    paddingValues: PaddingValues,
    onUnlock: () -> Unit,
    onUsePassword: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Rounded.Fingerprint,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(72.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Sesión protegida",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "${session.user.username} · ${session.user.role}",
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onUnlock, modifier = Modifier.fillMaxWidth()) {
            Text("Desbloquear con biometría")
        }
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedButton(onClick = onUsePassword, modifier = Modifier.fillMaxWidth()) {
            Text("Usar usuario y contraseña")
        }
    }
}

private enum class MainTab(val route: String, val label: String) {
    Machines("machines", "Máquinas"),
    Pending("pending", "Pendientes"),
    Tags("tags", "TAGs"),
    Session("session", "Sesión")
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun AuthenticatedArea(
    state: TechnicianAppState,
    paddingValues: PaddingValues,
    nfcReaderController: NfcReaderController,
    onRefreshMachines: () -> Unit,
    onRefreshPending: () -> Unit,
    onMachineSearchChange: (String) -> Unit,
    onMachineSelected: (MachineSummaryDto) -> Unit,
    onClearMachine: () -> Unit,
    onRebootSelectedMachine: () -> Unit,
    onStartRemoteWifiScan: () -> Unit,
    onSendWifiUpdate: (String, String, String?, Boolean) -> Unit,
    onRestock: (Int, Int, String?) -> Unit,
    onAdjust: (Int, Int, String?) -> Unit,
    onApprovePending: (Int, String, String?) -> Unit,
    onRejectPending: (Int) -> Unit,
    onEmployeeQueryChange: (String) -> Unit,
    onEmployeeSelected: (EmployeeSearchItemDto) -> Unit,
    onStartTagScan: (TagScanMode) -> Unit,
    onTagRead: (String) -> Unit,
    onCancelTagScan: () -> Unit,
    onReassignLookup: () -> Unit,
    onLogout: () -> Unit
) {
    val navController = rememberNavController()
    val backStack = navController.currentBackStackEntryAsState().value
    val currentRoute = backStack?.destination?.route ?: MainTab.Machines.route
    val session = (state.authState as AuthState.Authenticated).session
    val canManagePending = remember(session.user.role) {
        session.user.role == "admin" || session.user.role == "gerente" || session.user.role == "distribuidor"
    }
    val tabs = remember(canManagePending) {
        buildList {
            add(MainTab.Machines)
            if (canManagePending) add(MainTab.Pending)
            add(MainTab.Tags)
            add(MainTab.Session)
        }
    }

    Scaffold(
        modifier = Modifier.padding(paddingValues),
        topBar = {
            TopAppBar(
                title = { Text("CoffeeControl Tecnico", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onRefreshMachines) {
                        Icon(Icons.Rounded.Refresh, contentDescription = "Actualizar")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Rounded.Logout, contentDescription = "Cerrar sesión")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = when (tab) {
                            MainTab.Machines -> currentRoute.startsWith("machines") || currentRoute.startsWith("machine/")
                            MainTab.Pending -> currentRoute.startsWith("pending")
                            MainTab.Tags -> currentRoute.startsWith("tags") || currentRoute.startsWith("scan/")
                            MainTab.Session -> currentRoute.startsWith("session")
                        },
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = when (tab) {
                                    MainTab.Machines -> Icons.Rounded.Devices
                                    MainTab.Pending -> Icons.Rounded.Badge
                                    MainTab.Tags -> Icons.Rounded.Nfc
                                    MainTab.Session -> Icons.Rounded.Fingerprint
                                },
                                contentDescription = tab.label
                            )
                        },
                        label = { Text(tab.label) }
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = MainTab.Machines.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(MainTab.Machines.route) {
                MachinesScreen(
                    machines = state.machines,
                    query = state.machineSearch,
                    onQueryChange = onMachineSearchChange,
                    onMachineSelected = {
                        onMachineSelected(it)
                        navController.navigate("machine/${it.id}")
                    }
                )
            }
            if (canManagePending) {
                composable(MainTab.Pending.route) {
                    PendingScreen(
                        pendingMachines = state.pendingMachines,
                        onRefresh = onRefreshPending,
                        onApprove = onApprovePending,
                        onReject = onRejectPending
                    )
                }
            }
            composable("machine/{machineId}") {
                MachineDetailScreen(
                    machine = state.selectedMachine,
                    stock = state.machineStock,
                    stockLoading = state.stockLoading,
                    remoteWifiNetworks = state.remoteWifiNetworks,
                    remoteWifiStatus = state.remoteWifiStatus,
                    remoteWifiBusy = state.remoteWifiBusy,
                    onBack = {
                        onClearMachine()
                        navController.popBackStack()
                    },
                    onReboot = onRebootSelectedMachine,
                    onStartRemoteWifiScan = onStartRemoteWifiScan,
                    onSendWifiUpdate = onSendWifiUpdate,
                    onRestock = onRestock,
                    onAdjust = onAdjust
                )
            }
            composable(MainTab.Tags.route) {
                TagsScreen(
                    query = state.employeeQuery,
                    employees = state.employeeResults,
                    selectedEmployee = state.selectedEmployee,
                    lookup = state.tagLookup,
                    lastScannedUid = state.lastScannedUid,
                    onQueryChange = onEmployeeQueryChange,
                    onEmployeeSelected = onEmployeeSelected,
                    onLookupScan = {
                        onStartTagScan(TagScanMode.LOOKUP)
                        navController.navigate("scan/lookup")
                    },
                    onAssignScan = {
                        onStartTagScan(TagScanMode.ASSIGN)
                        navController.navigate("scan/assign")
                    },
                    onReassignLookup = onReassignLookup
                )
            }
            composable("scan/{mode}") { backStackEntry ->
                val scanMode = when (backStackEntry.arguments?.getString("mode")) {
                    "assign" -> TagScanMode.ASSIGN
                    else -> TagScanMode.LOOKUP
                }
                TagScannerScreen(
                    mode = scanMode,
                    nfcReaderController = nfcReaderController,
                    onCancel = {
                        onCancelTagScan()
                        navController.popBackStack()
                    },
                    onTagRead = { uid ->
                        onTagRead(uid)
                        navController.popBackStack()
                    }
                )
            }
            composable(MainTab.Session.route) {
                SessionScreen(
                    state = state,
                    onLogout = onLogout
                )
            }
        }
    }
}

@Composable
private fun MachinesScreen(
    machines: List<MachineSummaryDto>,
    query: String,
    onQueryChange: (String) -> Unit,
    onMachineSelected: (MachineSummaryDto) -> Unit
) {
    val filtered = remember(machines, query) {
        if (query.isBlank()) machines
        else machines.filter {
            it.name.contains(query, ignoreCase = true) ||
                (it.location?.contains(query, ignoreCase = true) == true)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            label = { Text("Buscar máquina") },
            leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(filtered, key = { it.id }) { machine ->
                MachineCard(machine = machine, onClick = { onMachineSelected(machine) })
            }
        }
    }
}

@Composable
private fun MachineCard(machine: MachineSummaryDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(
                            if (machine.online) Color(0xFF35D07F) else Color(0xFFFF8A65),
                            CircleShape
                        )
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(machine.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(machine.location ?: "Sin ubicación", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusPill("Hoy ${machine.taps_today}")
                StatusPill("Mes ${machine.taps_month}")
                StatusPill("Stock ${machine.stock_summary?.total_units ?: 0}")
            }
        }
    }
}

@Composable
private fun MachineDetailScreen(
    machine: MachineSummaryDto?,
    stock: com.ieasrl.coffeecontrol.tecnico.data.MachineStockResponse?,
    stockLoading: Boolean,
    remoteWifiNetworks: List<WifiScanNetworkDto>,
    remoteWifiStatus: String?,
    remoteWifiBusy: Boolean,
    onBack: () -> Unit,
    onReboot: () -> Unit,
    onStartRemoteWifiScan: () -> Unit,
    onSendWifiUpdate: (String, String, String?, Boolean) -> Unit,
    onRestock: (Int, Int, String?) -> Unit,
    onAdjust: (Int, Int, String?) -> Unit
) {
    if (machine == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Seleccioná una máquina desde la lista")
        }
        return
    }

    var restockTarget by remember { mutableStateOf<com.ieasrl.coffeecontrol.tecnico.data.StockItemDto?>(null) }
    var adjustTarget by remember { mutableStateOf<com.ieasrl.coffeecontrol.tecnico.data.StockItemDto?>(null) }
    var showWifiDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            OutlinedButton(onClick = onBack) { Text("Volver") }
        }
        item {
            Card(shape = RoundedCornerShape(24.dp)) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(machine.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(machine.location ?: "Sin ubicación", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    DetailRow("Online", if (machine.online) "Sí" else "No")
                    DetailRow("WiFi", machine.wifi_ssid ?: "Sin dato")
                    DetailRow("IP", machine.wifi_ip ?: "Sin dato")
                    DetailRow("RSSI", machine.wifi_rssi?.toString() ?: "Sin dato")
                    DetailRow("Backend", machine.backend_url ?: "Sin dato")
                    DetailRow("Estado backend", machine.backend_ok?.let { if (it) "OK" else "Error" } ?: "Sin dato")
                    machine.backend_error?.let { DetailRow("Último error", it) }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onReboot,
                            enabled = machine.online,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Rounded.RestartAlt, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Reiniciar")
                        }
                        OutlinedButton(
                            onClick = { showWifiDialog = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("WiFi remoto")
                        }
                    }
                }
            }
        }
        item {
            Text("Stock", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        if (stockLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        } else if (stock == null || stock.items.isEmpty()) {
            item {
                Text("No hay selecciones configuradas para esta máquina.")
            }
        } else {
            items(stock.items, key = { it.id }) { item ->
                StockCard(
                    item = item,
                    onRestock = { restockTarget = item },
                    onAdjust = { adjustTarget = item }
                )
            }
        }
    }

    if (restockTarget != null) {
        QuantityDialog(
            title = "Reponer ${restockTarget!!.product_name}",
            label = "Cantidad a sumar",
            confirmLabel = "Reponer",
            onDismiss = { restockTarget = null },
            onConfirm = { quantity, note ->
                onRestock(restockTarget!!.id, quantity, note)
                restockTarget = null
            }
        )
    }

    if (adjustTarget != null) {
        QuantityDialog(
            title = "Ajustar ${adjustTarget!!.product_name}",
            label = "Nuevo valor actual",
            confirmLabel = "Ajustar",
            initialValue = adjustTarget!!.current_units.toString(),
            onDismiss = { adjustTarget = null },
            onConfirm = { quantity, note ->
                onAdjust(adjustTarget!!.id, quantity, note)
                adjustTarget = null
            }
        )
    }

    if (showWifiDialog) {
        RemoteWifiDialog(
            machine = machine,
            networks = remoteWifiNetworks,
            status = remoteWifiStatus,
            busy = remoteWifiBusy,
            onDismiss = { showWifiDialog = false },
            onScan = onStartRemoteWifiScan,
            onSave = { ssid, password, backendUrl, preservePassword ->
                onSendWifiUpdate(ssid, password, backendUrl, preservePassword)
                showWifiDialog = false
            }
        )
    }
}

@Composable
private fun StockCard(
    item: com.ieasrl.coffeecontrol.tecnico.data.StockItemDto,
    onRestock: () -> Unit,
    onAdjust: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Coffee, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.product_name, fontWeight = FontWeight.Bold)
                    Text(
                        text = "Item ${item.item_id} · ${item.status_label ?: item.status.uppercase()}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusPill("${item.current_units}/${item.capacity_units}")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onRestock, modifier = Modifier.weight(1f)) { Text("Reponer") }
                OutlinedButton(onClick = onAdjust, modifier = Modifier.weight(1f)) { Text("Ajustar") }
            }
        }
    }
}

@Composable
private fun PendingScreen(
    pendingMachines: List<PendingMachineDto>,
    onRefresh: () -> Unit,
    onApprove: (Int, String, String?) -> Unit,
    onReject: (Int) -> Unit
) {
    var approveTarget by remember { mutableStateOf<PendingMachineDto?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Máquinas pendientes", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                text = "Aprobá onboarding y nombrá cada equipo antes de liberarlo al cliente.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        item {
            OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Rounded.Refresh, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Actualizar pendientes")
            }
        }
        if (pendingMachines.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Sin pendientes", fontWeight = FontWeight.Bold)
                        Text(
                            "No hay máquinas esperando aprobación en este momento.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            items(pendingMachines, key = { it.id }) { pending ->
                PendingMachineCard(
                    pending = pending,
                    onApprove = { approveTarget = pending },
                    onReject = { onReject(pending.id) }
                )
            }
        }
    }

    if (approveTarget != null) {
        ApprovePendingDialog(
            pending = approveTarget!!,
            onDismiss = { approveTarget = null },
            onConfirm = { name, location ->
                onApprove(approveTarget!!.id, name, location)
                approveTarget = null
            }
        )
    }
}

@Composable
private fun PendingMachineCard(
    pending: PendingMachineDto,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("MAC ${pending.mac}", fontWeight = FontWeight.Bold)
            pending.first_seen?.let { DetailRow("Primera vez", it) }
            pending.last_ping?.let { DetailRow("Último ping", it) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onApprove, modifier = Modifier.weight(1f)) {
                    Text("Aprobar")
                }
                OutlinedButton(onClick = onReject, modifier = Modifier.weight(1f)) {
                    Text("Rechazar")
                }
            }
        }
    }
}

@Composable
private fun TagsScreen(
    query: String,
    employees: List<EmployeeSearchItemDto>,
    selectedEmployee: EmployeeSearchItemDto?,
    lookup: com.ieasrl.coffeecontrol.tecnico.data.CardLookupResponse?,
    lastScannedUid: String?,
    onQueryChange: (String) -> Unit,
    onEmployeeSelected: (EmployeeSearchItemDto) -> Unit,
    onLookupScan: () -> Unit,
    onAssignScan: () -> Unit,
    onReassignLookup: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Operación de TAGs", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                text = "Buscá un empleado, escaneá el TAG con NFC y operá contra mobile-tech.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                label = { Text("Buscar empleado") },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (selectedEmployee != null) {
            item {
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Empleado seleccionado", fontWeight = FontWeight.Bold)
                        Text(selectedEmployee.name)
                        Text(
                            listOfNotNull(selectedEmployee.department, selectedEmployee.legajo, selectedEmployee.email).joinToString(" · "),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (selectedEmployee.nfc_cards.isEmpty()) {
                            Text(
                                "Sin TAGs registrados",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        } else {
                            selectedEmployee.nfc_cards.forEach { card ->
                                StatusPill(
                                    buildString {
                                        append(card.uid)
                                        append(" · ")
                                        append(card.status.uppercase())
                                        if (!card.label.isNullOrBlank()) {
                                            append(" · ")
                                            append(card.label)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onLookupScan, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Rounded.Nfc, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Consultar TAG")
                }
                Button(
                    onClick = onAssignScan,
                    enabled = selectedEmployee != null,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.Nfc, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Escanear y asignar")
                }
            }
        }
        lastScannedUid?.let { uid ->
            item { StatusPill("Último UID $uid") }
        }
        if (lookup?.card != null) {
            item {
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Resultado del TAG", fontWeight = FontWeight.Bold)
                        DetailRow("UID", lookup.card.uid)
                        DetailRow("Estado", lookup.card.status)
                        DetailRow("Asignado a", lookup.card.employee_name ?: "Sin dato")
                        lookup.card.employee_department?.let { DetailRow("Área", it) }
                        if (selectedEmployee != null && selectedEmployee.id != lookup.card.employee_id) {
                            Button(onClick = onReassignLookup, modifier = Modifier.fillMaxWidth()) {
                                Text("Reasignar a ${selectedEmployee.name}")
                            }
                        }
                    }
                }
            }
        }
        items(employees, key = { it.id }) { employee ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onEmployeeSelected(employee) },
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (selectedEmployee?.id == employee.id) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface
                )
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(employee.name, fontWeight = FontWeight.Bold)
                    Text(
                        listOfNotNull(employee.department, employee.legajo, employee.email).joinToString(" · "),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun TagScannerScreen(
    mode: TagScanMode,
    nfcReaderController: NfcReaderController,
    onCancel: () -> Unit,
    onTagRead: (String) -> Unit
) {
    var handled by remember { mutableStateOf(false) }

    DisposableEffect(mode) {
        if (nfcReaderController.isAvailable()) {
            nfcReaderController.startScanning { uid ->
                if (handled) return@startScanning
                handled = true
                onTagRead(uid)
            }
        }
        onDispose {
            nfcReaderController.stopScanning()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Rounded.Nfc,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(72.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (mode == TagScanMode.ASSIGN) "Escaneá para asignar" else "Escaneá para consultar",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (nfcReaderController.isAvailable()) {
                "Acercá el TAG al teléfono. Se leerá el UID en el mismo formato que usa la máquina."
            } else {
                "Este dispositivo no tiene NFC disponible."
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedButton(onClick = onCancel) { Text("Cancelar") }
    }
}

@Composable
private fun RemoteWifiDialog(
    machine: MachineSummaryDto,
    networks: List<WifiScanNetworkDto>,
    status: String?,
    busy: Boolean,
    onDismiss: () -> Unit,
    onScan: () -> Unit,
    onSave: (String, String, String?, Boolean) -> Unit
) {
    var ssid by rememberSaveable(machine.id) { mutableStateOf(machine.wifi_ssid ?: "") }
    var password by rememberSaveable(machine.id) { mutableStateOf("") }
    var backendUrl by rememberSaveable(machine.id) { mutableStateOf(machine.backend_url ?: "") }
    var preservePassword by rememberSaveable(machine.id) { mutableStateOf(true) }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("WiFi remoto · ${machine.name}") },
        text = {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Text(
                        "Configurá red y backend de la máquina. El escaneo usa el propio ESP32 del equipo.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                item {
                    OutlinedTextField(
                        value = ssid,
                        onValueChange = { ssid = it },
                        label = { Text("SSID") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Contraseña WiFi") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Conservar contraseña actual")
                            Text(
                                "Útil si solo cambiás SSID o backend",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = preservePassword,
                            onCheckedChange = { preservePassword = it }
                        )
                    }
                }
                item {
                    OutlinedTextField(
                        value = backendUrl,
                        onValueChange = { backendUrl = it },
                        label = { Text("URL backend") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedButton(
                        onClick = onScan,
                        enabled = machine.online && !busy,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (busy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Escaneando...")
                        } else {
                            Icon(Icons.Rounded.Search, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (machine.online) "Escanear redes" else "Escaneo no disponible offline")
                        }
                    }
                }
                status?.let { message ->
                    item {
                        Text(
                            message,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (networks.isNotEmpty()) {
                    item {
                        Text("Redes visibles", fontWeight = FontWeight.Bold)
                    }
                    items(networks, key = { "${it.ssid}:${it.rssi ?: 0}" }) { network ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { ssid = network.ssid },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(network.ssid, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        buildString {
                                            append(network.rssi?.let { "$it dBm" } ?: "RSSI ?")
                                            append(" · ")
                                            append(if (network.secure == false) "Abierta" else "Segura")
                                        },
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text("Usar")
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    ssid,
                    password,
                    backendUrl.takeIf { it.isNotBlank() },
                    preservePassword
                )
            }) {
                Text("Guardar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

@Composable
private fun ApprovePendingDialog(
    pending: PendingMachineDto,
    onDismiss: () -> Unit,
    onConfirm: (String, String?) -> Unit
) {
    val suggestedName = rememberSaveable(pending.id) {
        val suffix = pending.mac.takeLast(4).ifBlank { pending.id.toString() }
        "ESP32-${suffix}"
    }
    var name by rememberSaveable(pending.id) { mutableStateOf(suggestedName) }
    var location by rememberSaveable(pending.id) { mutableStateOf("") }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Aprobar máquina") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Definí nombre y ubicación para registrar la máquina ${pending.mac}.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nombre") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Ubicación") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(name, location.takeIf { it.isNotBlank() })
            }) {
                Text("Aprobar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

@Composable
private fun SessionScreen(
    state: TechnicianAppState,
    onLogout: () -> Unit
) {
    val session = (state.authState as? AuthState.Authenticated)?.session
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Sesión", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        if (session != null) {
            item {
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        DetailRow("Usuario", session.user.username)
                        DetailRow("Rol", session.user.role)
                        DetailRow("Backend", session.baseUrl)
                        DetailRow("Biometría", if (session.biometricEnabled) "Activa" else "No")
                    }
                }
            }
        }
        item {
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Rounded.Logout, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Cerrar sesión")
            }
        }
    }
}

@Composable
private fun QuantityDialog(
    title: String,
    label: String,
    confirmLabel: String,
    initialValue: String = "",
    onDismiss: () -> Unit,
    onConfirm: (Int, String?) -> Unit
) {
    var value by rememberSaveable { mutableStateOf(initialValue) }
    var note by rememberSaveable { mutableStateOf("") }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = value,
                    onValueChange = { value = it.filter(Char::isDigit) },
                    label = { Text(label) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Nota") }
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val quantity = value.toIntOrNull() ?: 0
                onConfirm(quantity, note.takeIf { it.isNotBlank() })
            }) {
                Text(confirmLabel)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.width(12.dp))
        Text(value, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun StatusPill(text: String) {
    Box(
        modifier = Modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}
