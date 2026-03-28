package com.ieasrl.coffeecontrol.tecnico.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.Nfc
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.lightColorScheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.ieasrl.coffeecontrol.tecnico.data.CompanyProfile
import com.ieasrl.coffeecontrol.tecnico.data.EmployeeSearchItemDto
import com.ieasrl.coffeecontrol.tecnico.data.MachineSummaryDto
import com.ieasrl.coffeecontrol.tecnico.data.PendingMachineDto
import com.ieasrl.coffeecontrol.tecnico.data.StoredSession
import com.ieasrl.coffeecontrol.tecnico.data.WifiScanNetworkDto
import com.ieasrl.coffeecontrol.tecnico.nfc.NfcReaderController

private val CoffeeControlColorScheme = lightColorScheme(
    primary = Color(0xFF1591D7),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFFFFBF59),
    background = Color(0xFFF3F2EC),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFEAF3F8),
    onSurface = Color(0xFF1C2B31),
    onSurfaceVariant = Color(0xFF68747D),
    error = Color(0xFFFF6B6B)
)

private val AppBackgroundBrush = Brush.verticalGradient(
    colors = listOf(
        Color(0xFFF7F6F1),
        Color(0xFFF1EFE8),
        Color(0xFFE9EEF2)
    )
)

private enum class ChipTone {
    Neutral,
    Brand,
    Success,
    Warning,
    Danger
}

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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(AppBackgroundBrush)
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color.Transparent
            ) {
                Scaffold(
                    snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                    containerColor = Color.Transparent,
                    contentWindowInsets = WindowInsets.safeDrawing
                ) { padding ->
                    when (val authState = state.authState) {
                        AuthState.Loading -> SplashScreen(padding)
                    AuthState.LoggedOut -> LoginScreen(
                        state = state,
                        paddingValues = padding,
                        onCompanySelected = viewModel::selectCompany,
                        onAddCompany = viewModel::addCompany,
                        onUsernameChange = viewModel::updateLoginUsername,
                        onPasswordChange = viewModel::updateLoginPassword,
                        onTogglePasswordVisibility = viewModel::toggleLoginPasswordVisibility,
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
                        onSwitchCompany = viewModel::switchCompanyContext,
                        onLogout = viewModel::logout
                    )
                }
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
    onCompanySelected: (String) -> Unit,
    onAddCompany: (String, String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onBiometricToggle: (Boolean) -> Unit,
    onLogin: () -> Unit
) {
    var showAddCompany by rememberSaveable { mutableStateOf(false) }
    val selectedCompany = remember(state.companies, state.selectedCompanyId) {
        state.companies.find { it.id == state.selectedCompanyId }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.Center,
        contentPadding = PaddingValues(vertical = 28.dp)
    ) {
        item {
            HeroPanel(
                eyebrow = "Operación de campo",
                title = "Máquinas, stock y TAGs desde el teléfono.",
                subtitle = "Elegí la empresa a atender y entrá con login nativo, biometría y NFC real."
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    if (state.companies.isEmpty()) {
                        SectionCard(
                            title = "Sin empresas configuradas",
                            subtitle = "Agregá al menos una empresa para vincularla con su backend."
                        ) {
                            Button(onClick = { showAddCompany = true }, modifier = Modifier.fillMaxWidth()) {
                                Text("Agregar empresa")
                            }
                        }
                    } else {
                        SectionCard(
                            title = "Empresa activa",
                            subtitle = selectedCompany?.name ?: "Elegí qué empresa vas a atender ahora."
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                state.companies.forEach { company ->
                                    CompanySelectorCard(
                                        company = company,
                                        selected = company.id == state.selectedCompanyId,
                                        onClick = { onCompanySelected(company.id) }
                                    )
                                }
                                OutlinedButton(onClick = { showAddCompany = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text("Agregar empresa")
                                }
                            }
                        }
                    }
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.48f)
                    ) {
                        Column(
                            modifier = Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedTextField(
                                value = state.loginUsername,
                                onValueChange = onUsernameChange,
                                label = { Text("Usuario") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = state.loginPassword,
                                onValueChange = onPasswordChange,
                                label = { Text("Contraseña") },
                                visualTransformation = if (state.loginPasswordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
                                trailingIcon = {
                                    IconButton(onClick = onTogglePasswordVisibility) {
                                        Icon(
                                            imageVector = if (state.loginPasswordVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                            contentDescription = if (state.loginPasswordVisible) "Ocultar contraseña" else "Mostrar contraseña"
                                        )
                                    }
                                },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
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
                        }
                    }
                    Button(
                        onClick = onLogin,
                        enabled = !state.isBusy && selectedCompany != null,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (state.isBusy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Conectando...")
                        } else {
                            Text("Ingresar")
                        }
                    }
                }
            }
        }
    }

    if (showAddCompany) {
        AddCompanyDialog(
            onDismiss = { showAddCompany = false },
            onConfirm = { name, backendUrl ->
                onAddCompany(name, backendUrl)
                showAddCompany = false
            }
        )
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
        verticalArrangement = Arrangement.Center
    ) {
        HeroPanel(
            eyebrow = "Sesión segura",
            title = "Desbloqueá la operación técnica.",
            subtitle = buildString {
                append(session.companyName ?: "Empresa")
                append(" · ")
                append(session.user.username)
                append(" · ")
                append(session.user.role)
            }
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Fingerprint,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(72.dp)
                )
                Text(
                    "La app quedó protegida con la biometría del dispositivo.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Button(onClick = onUnlock, modifier = Modifier.fillMaxWidth()) {
                    Text("Desbloquear con biometría")
                }
                OutlinedButton(onClick = onUsePassword, modifier = Modifier.fillMaxWidth()) {
                    Text("Usar usuario y contraseña")
                }
            }
        }
    }
}

private enum class MainTab(val route: String, val label: String) {
    Home("home", "Inicio"),
    Machines("machines", "Máquinas"),
    Stock("stock", "Stock"),
    Tags("tags", "TAGs"),
}

@Composable
private fun BrandHeader(
    section: String,
    title: String,
    subtitle: String,
    chipText: String,
    chipTone: ChipTone,
    mark: String,
    markBrush: Brush
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(markBrush),
                contentAlignment = Alignment.Center
            ) {
                Text(mark, color = Color.White, fontWeight = FontWeight.ExtraBold)
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    section,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF0C557F),
                    fontWeight = FontWeight.ExtraBold
                )
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        StatusPill(chipText, chipTone)
    }
}

@Composable
private fun DarkFeatureCard(
    title: String,
    headline: String,
    description: String,
    tone: ChipTone,
    metrics: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.animateContentSize(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(28.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF163443), Color(0xFF0D212C))
                    )
                )
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(title, color = Color(0xFFC1DAE7), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold)
                        Text(headline, color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                        Text(description, color = Color(0xFFC7D6DE))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    StatusPill(
                        text = when (tone) {
                            ChipTone.Warning -> "Atención"
                            ChipTone.Danger -> "Crítico"
                            ChipTone.Success -> "OK"
                            ChipTone.Brand -> "En línea"
                            ChipTone.Neutral -> "Info"
                        },
                        tone = tone
                    )
                }
                metrics()
            }
        }
    }
}

@Composable
private fun PriorityListItem(
    title: String,
    subtitle: String,
    chipText: String,
    chipTone: ChipTone
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(modifier = Modifier.width(10.dp))
        StatusPill(chipText, chipTone)
    }
}

@Composable
private fun ActionButtonBlock(
    title: String,
    subtitle: String,
    tone: ChipTone,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val background = when (tone) {
        ChipTone.Brand -> Color(0xFF1591D7)
        ChipTone.Success -> Color(0xFF173040)
        ChipTone.Warning -> Color(0xFFFFF1DC)
        ChipTone.Danger -> Color(0xFFFDEAE7)
        ChipTone.Neutral -> Color(0xFFEDF3F7)
    }
    val titleColor = when (tone) {
        ChipTone.Brand -> Color.White
        ChipTone.Success -> Color(0xFFCFE7F5)
        ChipTone.Warning -> Color(0xFF9A610D)
        ChipTone.Danger -> Color(0xFF984034)
        ChipTone.Neutral -> Color(0xFF0C557F)
    }
    val subtitleColor = when (tone) {
        ChipTone.Brand -> Color(0xFFDDF2FF)
        ChipTone.Success -> Color(0xFFAED2E7)
        ChipTone.Warning -> Color(0xFFB67B1C)
        ChipTone.Danger -> Color(0xFFAA5C4D)
        ChipTone.Neutral -> Color(0xFF47616F)
    }
    Card(
        modifier = modifier.clickable(enabled = enabled, onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = if (enabled) background else Color(0xFFE2E5E8)),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, fontWeight = FontWeight.ExtraBold, color = if (enabled) titleColor else Color(0xFF7A858C))
            Text(subtitle, color = if (enabled) subtitleColor else Color(0xFF8E989E), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun BarcodePreview() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(36.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        for (index in 0 until 15) {
            val barHeight = when {
                index % 5 == 0 -> 36.dp
                index % 2 == 0 -> 22.dp
                else -> 32.dp
            }
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(barHeight)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFF0F2531))
            )
        }
    }
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
    onSwitchCompany: () -> Unit,
    onLogout: () -> Unit
) {
    val navController = rememberNavController()
    val backStack = navController.currentBackStackEntryAsState().value
    val currentRoute = backStack?.destination?.route ?: MainTab.Home.route
    val session = (state.authState as AuthState.Authenticated).session
    val canManagePending = remember(session.user.role) {
        session.user.role == "admin" || session.user.role == "gerente" || session.user.role == "distribuidor"
    }
    val tabs = remember {
        listOf(MainTab.Home, MainTab.Machines, MainTab.Stock, MainTab.Tags)
    }

    Scaffold(
        modifier = Modifier.padding(paddingValues),
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                ),
                title = {
                    Column {
                        Text("CoffeeControl Tecnico", fontWeight = FontWeight.Bold)
                        Text(
                            "${session.user.username} · ${session.user.role}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onRefreshMachines) {
                        Icon(Icons.Rounded.Refresh, contentDescription = "Actualizar")
                    }
                    IconButton(onClick = { navController.navigate("session") }) {
                        Icon(Icons.Rounded.Fingerprint, contentDescription = "Sesión")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = "Cerrar sesión")
                    }
                }
            )
        },
        bottomBar = {
            Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                    tonalElevation = 10.dp
                ) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = when (tab) {
                                MainTab.Home -> currentRoute.startsWith("home")
                                MainTab.Machines -> currentRoute.startsWith("machines") || currentRoute.startsWith("machine/")
                                MainTab.Stock -> currentRoute.startsWith("stock")
                                MainTab.Tags -> currentRoute.startsWith("tags") || currentRoute.startsWith("scan/")
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
                                        MainTab.Home -> Icons.Rounded.Badge
                                        MainTab.Machines -> Icons.Rounded.Devices
                                        MainTab.Stock -> Icons.Rounded.Coffee
                                        MainTab.Tags -> Icons.Rounded.Nfc
                                    },
                                    contentDescription = tab.label
                                )
                            },
                            label = { Text(tab.label) }
                        )
                    }
                }
            }
        },
        containerColor = Color.Transparent
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = MainTab.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(MainTab.Home.route) {
                HomeScreen(
                    username = session.user.username,
                    companyName = session.companyName,
                    machines = state.machines,
                    pendingCount = if (canManagePending) state.pendingMachines.size else 0,
                    canManagePending = canManagePending,
                    onOpenMachines = { navController.navigate(MainTab.Machines.route) },
                    onOpenStock = { navController.navigate(MainTab.Stock.route) },
                    onOpenTags = { navController.navigate(MainTab.Tags.route) },
                    onOpenPending = {
                        if (canManagePending) navController.navigate("pending")
                    }
                )
            }
            composable(MainTab.Machines.route) {
                MachinesScreen(
                    username = session.user.username,
                    machines = state.machines,
                    pendingCount = if (canManagePending) state.pendingMachines.size else 0,
                    query = state.machineSearch,
                    onQueryChange = onMachineSearchChange,
                    onMachineSelected = {
                        onMachineSelected(it)
                        navController.navigate("machine/${it.id}")
                    }
                )
            }
            composable(MainTab.Stock.route) {
                StockOverviewScreen(
                    machines = state.machines,
                    onMachineSelected = {
                        onMachineSelected(it)
                        navController.navigate("machine/${it.id}")
                    }
                )
            }
            if (canManagePending) {
                composable("pending") {
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
                    onGoHome = {
                        onClearMachine()
                        navController.navigate(MainTab.Home.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
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
            composable("session") {
                SessionScreen(
                    state = state,
                    onSwitchCompany = onSwitchCompany,
                    onLogout = onLogout
                )
            }
        }
    }
}

@Composable
private fun HomeScreen(
    username: String,
    companyName: String?,
    machines: List<MachineSummaryDto>,
    pendingCount: Int,
    canManagePending: Boolean,
    onOpenMachines: () -> Unit,
    onOpenStock: () -> Unit,
    onOpenTags: () -> Unit,
    onOpenPending: () -> Unit
) {
    val onlineCount = remember(machines) { machines.count { it.online } }
    val offlineCount = remember(machines, onlineCount) { (machines.size - onlineCount).coerceAtLeast(0) }
    val stockAlerts = remember(machines) {
        machines.count {
            val summary = it.stock_summary
            summary != null && (summary.low_items > 0 || summary.empty_items > 0)
        }
    }
    val totalToday = remember(machines) { machines.sumOf { it.taps_today.toIntOrNull() ?: 0 } }
    val taskCount = remember(offlineCount, pendingCount, stockAlerts) {
        listOf(offlineCount, pendingCount, stockAlerts).count { it > 0 }
    }
    val highlightedMachines = remember(machines) {
        machines
            .sortedWith(
                compareByDescending<MachineSummaryDto> { !it.online }
                    .thenByDescending { (it.stock_summary?.empty_items ?: 0) > 0 }
                    .thenByDescending { (it.stock_summary?.low_items ?: 0) > 0 }
            )
            .take(3)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            BrandHeader(
                section = "SmartQ técnico",
                title = "Hola, $username",
                subtitle = "Soporte de campo · ${machines.size} máquina(s) visibles en ${companyName ?: "la empresa activa"}.",
                chipText = if (onlineCount > 0) "En línea" else "Revisar",
                chipTone = if (onlineCount > 0) ChipTone.Brand else ChipTone.Warning,
                mark = "Q",
                markBrush = Brush.linearGradient(listOf(Color(0xFF0C5D90), Color(0xFF1AA7EA)))
            )
        }
        item {
            DarkFeatureCard(
                title = "Tareas del día",
                headline = "$taskCount pendientes",
                description = buildString {
                    append(
                        when {
                            offlineCount > 0 -> "Hay una o más máquinas offline"
                            else -> "No hay máquinas offline"
                        }
                    )
                    append(", ")
                    append(
                        when {
                            stockAlerts > 0 -> "hay alertas de stock"
                            else -> "sin alertas críticas de stock"
                        }
                    )
                    if (canManagePending) {
                        append(" y ")
                        append(
                            if (pendingCount > 0) {
                                "$pendingCount equipo(s) pendiente(s) de aprobación"
                            } else {
                                "sin altas pendientes"
                            }
                        )
                    }
                    append(".")
                },
                tone = when {
                    offlineCount > 0 || stockAlerts > 0 -> ChipTone.Warning
                    canManagePending && pendingCount > 0 -> ChipTone.Warning
                    else -> ChipTone.Brand
                }
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Online", "$onlineCount/${machines.size}", ChipTone.Success, modifier = Modifier.weight(1f))
                    MetricTile("Pendientes", pendingCount.toString(), if (pendingCount > 0) ChipTone.Warning else ChipTone.Brand, modifier = Modifier.weight(1f))
                }
            }
        }
        item {
            SectionCard(
                title = "Prioridad inmediata",
                subtitle = "Resumen rápido para arrancar la jornada con foco."
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PriorityListItem(
                        title = if (offlineCount > 0) "Máquinas offline" else "Parque online",
                        subtitle = if (offlineCount > 0) "$offlineCount equipo(s) sin heartbeat reciente" else "Todo el parque está reportando normal",
                        chipText = if (offlineCount > 0) "Offline" else "OK",
                        chipTone = if (offlineCount > 0) ChipTone.Warning else ChipTone.Success
                    )
                    if (canManagePending) {
                        PriorityListItem(
                            title = "Pendiente de aprobación",
                            subtitle = if (pendingCount > 0) "$pendingCount equipo(s) esperando alta" else "No hay onboarding pendiente",
                            chipText = if (pendingCount > 0) "Alta" else "Limpio",
                            chipTone = if (pendingCount > 0) ChipTone.Warning else ChipTone.Brand
                        )
                    }
                    PriorityListItem(
                        title = if (stockAlerts > 0) "Stock bajo" else "Stock controlado",
                        subtitle = if (stockAlerts > 0) "$stockAlerts máquina(s) con reposición pendiente" else "Sin faltantes visibles",
                        chipText = if (stockAlerts > 0) "Reposición" else "OK",
                        chipTone = if (stockAlerts > 0) ChipTone.Danger else ChipTone.Success
                    )
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ActionButtonBlock(
                        title = "Abrir máquinas",
                        subtitle = "Estado y comandos",
                        tone = ChipTone.Brand,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenMachines
                    )
                    ActionButtonBlock(
                        title = if (canManagePending) "Pendientes" else "Empresa",
                        subtitle = if (canManagePending) "Onboarding y altas" else (companyName ?: "Activa"),
                        tone = ChipTone.Neutral,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (canManagePending) onOpenPending()
                        }
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ActionButtonBlock(
                        title = "Ver stock",
                        subtitle = "Reposición y faltantes",
                        tone = ChipTone.Warning,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenStock
                    )
                    ActionButtonBlock(
                        title = "Escanear tag",
                        subtitle = "Asignar o reemplazar",
                        tone = ChipTone.Success,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenTags
                    )
                }
            }
        }
        if (highlightedMachines.isNotEmpty()) {
            item {
                SectionCard(
                    title = "Foco rápido",
                    subtitle = "Equipos destacados por estado o reposición."
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        highlightedMachines.forEach { machine ->
                            PriorityListItem(
                                title = machine.name,
                                subtitle = buildString {
                                    append(machine.location ?: "Sin ubicación")
                                    machine.stock_summary?.let { summary ->
                                        append(" · ")
                                        append("${summary.low_items} bajo / ${summary.empty_items} vacíos")
                                    }
                                },
                                chipText = when {
                                    !machine.online -> "Offline"
                                    (machine.stock_summary?.empty_items ?: 0) > 0 -> "Crítico"
                                    (machine.stock_summary?.low_items ?: 0) > 0 -> "Bajo"
                                    else -> "OK"
                                },
                                chipTone = when {
                                    !machine.online -> ChipTone.Warning
                                    (machine.stock_summary?.empty_items ?: 0) > 0 -> ChipTone.Danger
                                    (machine.stock_summary?.low_items ?: 0) > 0 -> ChipTone.Warning
                                    else -> ChipTone.Success
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StockOverviewScreen(
    machines: List<MachineSummaryDto>,
    onMachineSelected: (MachineSummaryDto) -> Unit
) {
    val configuredMachines = remember(machines) {
        machines
            .filter { it.stock_summary != null }
            .sortedWith(
                compareByDescending<MachineSummaryDto> { it.stock_summary?.empty_items ?: 0 }
                    .thenByDescending { it.stock_summary?.low_items ?: 0 }
                    .thenByDescending { it.stock_summary?.total_units ?: 0 }
            )
    }
    val monitoredItems = remember(configuredMachines) {
        configuredMachines.sumOf { it.stock_summary?.configured_items ?: 0 }
    }
    val lowItems = remember(configuredMachines) {
        configuredMachines.sumOf { it.stock_summary?.low_items ?: 0 }
    }
    val emptyItems = remember(configuredMachines) {
        configuredMachines.sumOf { it.stock_summary?.empty_items ?: 0 }
    }
    val featuredMachine = configuredMachines.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            BrandHeader(
                section = "Stock y reposición",
                title = "Panorama de stock",
                subtitle = "Visión rápida del parque para entrar directo donde falta reponer.",
                chipText = if (lowItems + emptyItems > 0) "Stock bajo" else "Controlado",
                chipTone = if (lowItems + emptyItems > 0) ChipTone.Warning else ChipTone.Success,
                mark = "◫",
                markBrush = Brush.linearGradient(listOf(Color(0xFF2D6F52), Color(0xFF34AA73)))
            )
        }
        if (featuredMachine != null) {
            item {
                DarkFeatureCard(
                    title = "Selección principal",
                    headline = featuredMachine.name,
                    description = buildString {
                        append(featuredMachine.location ?: "Sin ubicación")
                        append(" · ")
                        append("items ${featuredMachine.stock_summary?.configured_items ?: 0}")
                    },
                    tone = when {
                        (featuredMachine.stock_summary?.empty_items ?: 0) > 0 -> ChipTone.Danger
                        (featuredMachine.stock_summary?.low_items ?: 0) > 0 -> ChipTone.Warning
                        else -> ChipTone.Success
                    }
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        MetricTile("Bajo", (featuredMachine.stock_summary?.low_items ?: 0).toString(), ChipTone.Warning, modifier = Modifier.weight(1f))
                        MetricTile("Vacío", (featuredMachine.stock_summary?.empty_items ?: 0).toString(), ChipTone.Danger, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        item {
            SectionCard(
                title = "Cobertura",
                subtitle = "Resumen de las selecciones configuradas en todo el parque visible."
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Ítems", monitoredItems.toString(), ChipTone.Neutral, modifier = Modifier.weight(1f))
                    MetricTile("Alertas", (lowItems + emptyItems).toString(), if (lowItems + emptyItems > 0) ChipTone.Warning else ChipTone.Success, modifier = Modifier.weight(1f))
                }
            }
        }
        if (configuredMachines.isEmpty()) {
            item {
                SectionCard(
                    title = "Sin stock configurado",
                    subtitle = "Todavía no hay selecciones definidas para ninguna máquina."
                ) {
                    Text(
                        "Cuando una máquina tenga stock configurado, va a aparecer acá con prioridad para reponer o ajustar.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(configuredMachines, key = { it.id }) { machine ->
                val summary = machine.stock_summary
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onMachineSelected(machine) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
                    shape = RoundedCornerShape(26.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(machine.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                Text(machine.location ?: "Sin ubicación", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            StatusPill(
                                text = when {
                                    (summary?.empty_items ?: 0) > 0 -> "Crítico"
                                    (summary?.low_items ?: 0) > 0 -> "Bajo"
                                    else -> "OK"
                                },
                                tone = when {
                                    (summary?.empty_items ?: 0) > 0 -> ChipTone.Danger
                                    (summary?.low_items ?: 0) > 0 -> ChipTone.Warning
                                    else -> ChipTone.Success
                                }
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            MetricTile("Configurado", (summary?.configured_items ?: 0).toString(), ChipTone.Brand, modifier = Modifier.weight(1f))
                            MetricTile("Bajo", (summary?.low_items ?: 0).toString(), ChipTone.Warning, modifier = Modifier.weight(1f))
                            MetricTile("Vacío", (summary?.empty_items ?: 0).toString(), ChipTone.Danger, modifier = Modifier.weight(1f))
                        }
                        DetailRow("Total unidades", (summary?.total_units ?: 0).toString())
                    }
                }
            }
        }
    }
}

@Composable
private fun MachinesScreen(
    username: String,
    machines: List<MachineSummaryDto>,
    pendingCount: Int,
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
    val onlineCount = remember(machines) { machines.count { it.online } }
    val offlineCount = remember(machines, onlineCount) { (machines.size - onlineCount).coerceAtLeast(0) }
    val stockAlerts = remember(machines) {
        machines.count {
            val summary = it.stock_summary
            summary != null && (summary.low_items > 0 || summary.empty_items > 0)
        }
    }
    val totalToday = remember(machines) { machines.sumOf { it.taps_today.toIntOrNull() ?: 0 } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            HeroPanel(
                eyebrow = "Máquinas",
                title = "Parque técnico de $username",
                subtitle = "Lista operativa del parque visible, con búsqueda, alertas y acceso directo al detalle."
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Online", "$onlineCount/${machines.size}", ChipTone.Success, modifier = Modifier.weight(1f))
                    MetricTile("Alertas", stockAlerts.toString(), if (stockAlerts > 0) ChipTone.Warning else ChipTone.Brand, modifier = Modifier.weight(1f))
                    MetricTile("Hoy", totalToday.toString(), ChipTone.Brand, modifier = Modifier.weight(1f))
                }
            }
        }
        item {
            SectionCard(
                title = "Prioridad inmediata",
                subtitle = "Lo que más conviene mirar antes de salir a campo."
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PriorityRow(
                        title = "Máquinas offline",
                        subtitle = if (offlineCount > 0) "$offlineCount equipo(s) sin heartbeat reciente" else "Todo el parque está reportando",
                        tone = if (offlineCount > 0) ChipTone.Warning else ChipTone.Success
                    )
                    PriorityRow(
                        title = "Pendientes de alta",
                        subtitle = if (pendingCount > 0) "$pendingCount equipo(s) esperando aprobación" else "Sin onboarding pendiente",
                        tone = if (pendingCount > 0) ChipTone.Warning else ChipTone.Brand
                    )
                    PriorityRow(
                        title = "Stock crítico",
                        subtitle = if (stockAlerts > 0) "$stockAlerts máquina(s) con bajo o sin stock" else "Sin alertas de reposición",
                        tone = if (stockAlerts > 0) ChipTone.Danger else ChipTone.Success
                    )
                }
            }
        }
        item {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.82f)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    label = { Text("Buscar máquina o ubicación") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(6.dp)
                )
            }
        }
        if (filtered.isEmpty()) {
            item {
                SectionCard(title = "Sin resultados", subtitle = "Probá otro nombre o ubicación.") {
                    Text(
                        "No encontramos máquinas con ese filtro.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(filtered, key = { it.id }) { machine ->
                MachineCard(machine = machine, onClick = { onMachineSelected(machine) })
            }
        }
    }
}

@Composable
private fun MachineCard(machine: MachineSummaryDto, onClick: () -> Unit) {
    val summary = machine.stock_summary
    Card(
        modifier = Modifier
            .animateContentSize()
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(28.dp)
    ) {
        Box(
            modifier = Modifier.background(
                Brush.linearGradient(
                    colors = if (machine.online) {
                        listOf(Color(0xFFE8F6FD), Color(0xFFD9EEF9))
                    } else {
                        listOf(Color(0xFFFBE6E1), Color(0xFFF6D8D0))
                    }
                )
            )
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .background(
                                if (machine.online) Color(0xFF35D07F) else Color(0xFFFF8A65),
                                CircleShape
                            )
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(machine.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(machine.location ?: "Sin ubicación", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    StatusPill(
                        text = if (machine.online) "Online" else "Offline",
                        tone = if (machine.online) ChipTone.Success else ChipTone.Warning
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Hoy", machine.taps_today, ChipTone.Brand, modifier = Modifier.weight(1f))
                    MetricTile("Mes", machine.taps_month, ChipTone.Neutral, modifier = Modifier.weight(1f))
                    MetricTile(
                        "Stock",
                        (summary?.total_units ?: 0).toString(),
                        when {
                            (summary?.empty_items ?: 0) > 0 -> ChipTone.Danger
                            (summary?.low_items ?: 0) > 0 -> ChipTone.Warning
                            else -> ChipTone.Brand
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusPill(
                        text = "${summary?.configured_items ?: 0} ítems",
                        tone = ChipTone.Neutral
                    )
                    if ((summary?.low_items ?: 0) > 0) {
                        StatusPill("${summary?.low_items ?: 0} bajo", tone = ChipTone.Warning)
                    }
                    if ((summary?.empty_items ?: 0) > 0) {
                        StatusPill("${summary?.empty_items ?: 0} vacío", tone = ChipTone.Danger)
                    }
                }
                if (!machine.backend_error.isNullOrBlank() || machine.backend_ok == false) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.75f)
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Diagnóstico rápido", fontWeight = FontWeight.Bold)
                            Text(
                                machine.backend_error ?: "El backend reportó un problema.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            DetailRow("SSID", machine.wifi_ssid ?: "Sin dato")
                            DetailRow("RSSI", machine.wifi_rssi?.let { "$it dBm" } ?: "Sin dato")
                        }
                    }
                }
                OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
                    Text("Abrir detalle")
                }
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
    onGoHome: () -> Unit,
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
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Volver") }
                Button(onClick = onGoHome, modifier = Modifier.weight(1f)) { Text("Inicio") }
            }
        }
        item {
            HeroPanel(
                eyebrow = "Detalle técnico",
                title = machine.name,
                subtitle = machine.location ?: "Sin ubicación"
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile(
                        "Estado",
                        if (machine.online) "Online" else "Offline",
                        if (machine.online) ChipTone.Success else ChipTone.Warning,
                        modifier = Modifier.weight(1f)
                    )
                    MetricTile(
                        "RSSI",
                        machine.wifi_rssi?.let { "$it dBm" } ?: "Sin dato",
                        ChipTone.Brand,
                        modifier = Modifier.weight(1f)
                    )
                    MetricTile(
                        "Backend",
                        machine.backend_ok?.let { if (it) "OK" else "Error" } ?: "Sin dato",
                        if (machine.backend_ok == false) ChipTone.Danger else ChipTone.Neutral,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
        item {
            SectionCard(title = "Estado de red", subtitle = "Conectividad actual y último diagnóstico reportado.") {
                DetailRow("WiFi", machine.wifi_ssid ?: "Sin dato")
                DetailRow("IP", machine.wifi_ip ?: "Sin dato")
                DetailRow("Backend", machine.backend_url ?: "Sin dato")
                machine.backend_error?.let { DetailRow("Último error", it) }
            }
        }
        item {
            SectionCard(title = "Acciones remotas", subtitle = "Estas acciones se envían a la máquina cuando está online.") {
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
        item {
            Text("Stock", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                "Reposición y ajuste por selección, pensado para intervención rápida en campo.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (stockLoading) {
            item {
                SectionCard(title = "Cargando stock") {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            }
        } else if (stock == null || stock.items.isEmpty()) {
            item {
                SectionCard(title = "Sin selecciones configuradas") {
                    Text("No hay stock configurado para esta máquina todavía.")
                }
            }
        } else {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Ítems", stock.summary.configured_items.toString(), ChipTone.Brand, modifier = Modifier.weight(1f))
                    MetricTile("Bajos", stock.summary.low_items.toString(), ChipTone.Warning, modifier = Modifier.weight(1f))
                    MetricTile("Unidades", stock.summary.total_units.toString(), ChipTone.Neutral, modifier = Modifier.weight(1f))
                }
            }
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
    val progress = remember(item.current_units, item.capacity_units) {
        if (item.capacity_units <= 0) 0f else (item.current_units.toFloat() / item.capacity_units.toFloat()).coerceIn(0f, 1f)
    }
    Card(
        modifier = Modifier.animateContentSize(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                StatusPill(
                    "${item.current_units}/${item.capacity_units}",
                    tone = when (item.status.lowercase()) {
                        "empty" -> ChipTone.Danger
                        "low" -> ChipTone.Warning
                        else -> ChipTone.Brand
                    }
                )
            }
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth(),
                color = when (item.status.lowercase()) {
                    "empty" -> Color(0xFFFF7A6E)
                    "low" -> Color(0xFFFFC76A)
                    else -> MaterialTheme.colorScheme.primary
                },
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            Text(
                text = when (item.status.lowercase()) {
                    "empty" -> "Sin unidades disponibles. Conviene reponer antes de volver a habilitar consumo."
                    "low" -> "Quedan pocas unidades respecto del mínimo configurado."
                    else -> "Nivel dentro del rango esperado."
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricTile("Actual", item.current_units.toString(), ChipTone.Neutral, modifier = Modifier.weight(1f))
                MetricTile("Mínimo", item.min_units.toString(), ChipTone.Warning, modifier = Modifier.weight(1f))
                MetricTile("Capacidad", item.capacity_units.toString(), ChipTone.Brand, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRestock, modifier = Modifier.weight(1f)) { Text("Reponer") }
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
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            HeroPanel(
                eyebrow = "Onboarding",
                title = "Máquinas pendientes",
                subtitle = "Nombrá y aprobá cada equipo antes de liberarlo al cliente."
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MetricTile("Pendientes", pendingMachines.size.toString(), ChipTone.Warning, modifier = Modifier.weight(1f))
                    MetricTile(
                        "Estado",
                        if (pendingMachines.isEmpty()) "Limpio" else "Revisar",
                        ChipTone.Brand,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
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
                SectionCard(title = "Sin pendientes", subtitle = "No hay máquinas esperando aprobación en este momento.") {
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
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("MAC ${pending.mac}", fontWeight = FontWeight.Bold)
                    Text("Equipo detectado y esperando alta", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                StatusPill("Pendiente", tone = ChipTone.Warning)
            }
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
@OptIn(ExperimentalLayoutApi::class)
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
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            BrandHeader(
                section = "Credenciales",
                title = "Operación de TAGs",
                subtitle = "Buscá un empleado, escaneá con NFC y operá sin salir de la app técnica.",
                chipText = "NFC activo",
                chipTone = ChipTone.Brand,
                mark = "⌁",
                markBrush = Brush.linearGradient(listOf(Color(0xFF2D6F52), Color(0xFF34AA73)))
            )
        }
        item {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.82f)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    label = { Text("Buscar empleado") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(6.dp)
                )
            }
        }
        item {
            AnimatedVisibility(visible = selectedEmployee != null) {
                selectedEmployee?.let { employee ->
                    Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = Color.Transparent)) {
                        Column(
                            modifier = Modifier
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(Color(0xFFE5F4FB), Color(0xFFD6ECF8))
                                    )
                                )
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("Empleado seleccionado", fontWeight = FontWeight.Bold)
                                    Text(employee.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(
                                        listOfNotNull(employee.department, employee.legajo, employee.email).joinToString(" · "),
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                StatusPill(if (employee.active) "Activo" else "Inactivo", if (employee.active) ChipTone.Success else ChipTone.Warning)
                            }
                            if (employee.nfc_cards.isEmpty()) {
                                Text(
                                    "Sin TAGs registrados todavía.",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else {
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    employee.nfc_cards.forEach { card ->
                                        StatusPill(
                                            buildString {
                                                append(card.uid)
                                                append(" · ")
                                                append(card.status.uppercase())
                                                if (!card.label.isNullOrBlank()) {
                                                    append(" · ")
                                                    append(card.label)
                                                }
                                            },
                                            tone = when (card.status.lowercase()) {
                                                "lost" -> ChipTone.Danger
                                                "inactive" -> ChipTone.Warning
                                                else -> ChipTone.Success
                                            }
                                        )
                                    }
                                }
                            }
                            BarcodePreview()
                            Text(
                                "Acercá la tarjeta o llavero al teléfono para leerlo y asignarlo con auditoría al empleado correcto.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ActionButtonBlock(
                        title = "Consultar TAG",
                        subtitle = "Leer y revisar un UID existente",
                        tone = ChipTone.Neutral,
                        modifier = Modifier.weight(1f),
                        onClick = onLookupScan
                    )
                    ActionButtonBlock(
                        title = "Escanear tag",
                        subtitle = if (selectedEmployee != null) "Vincular al empleado seleccionado" else "Seleccioná un empleado primero",
                        tone = ChipTone.Brand,
                        onClick = onAssignScan,
                        enabled = selectedEmployee != null,
                        modifier = Modifier.weight(1f)
                    )
                }
                if (selectedEmployee != null && lookup?.card != null && selectedEmployee.id != lookup.card.employee_id) {
                    ActionButtonBlock(
                        title = "Reemplazar perdido",
                        subtitle = "Reasignar el TAG leído a ${selectedEmployee.name}",
                        tone = ChipTone.Warning,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onReassignLookup
                    )
                }
            }
        }
        item {
            AnimatedVisibility(visible = lastScannedUid != null) {
                lastScannedUid?.let { uid ->
                    SectionCard(title = "Última lectura", subtitle = "El último UID leído desde NFC.") {
                        StatusPill("UID $uid", tone = ChipTone.Brand)
                    }
                }
            }
        }
        item {
            AnimatedVisibility(visible = lookup?.card != null) {
                lookup?.card?.let { card ->
                    Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f))) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Resultado del TAG", fontWeight = FontWeight.Bold)
                            DetailRow("UID", card.uid)
                            DetailRow("Estado", card.status)
                            DetailRow("Asignado a", card.employee_name ?: "Sin dato")
                            card.employee_department?.let { DetailRow("Área", it) }
                        }
                    }
                }
            }
        }
        item {
            SectionCard(
                title = "Buscar empleado",
                subtitle = if (selectedEmployee != null) "Podés cambiar el foco seleccionando otro empleado." else "Elegí a quién asignarle o reasignarle una credencial."
            ) {
                Text(
                    if (employees.isEmpty()) "Escribí al menos dos caracteres para empezar a buscar." else "Seleccioná un empleado de la lista para dejarlo listo antes de escanear.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        items(employees, key = { it.id }) { employee ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onEmployeeSelected(employee) },
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (selectedEmployee?.id == employee.id) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                )
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(employee.name, fontWeight = FontWeight.Bold)
                            Text(
                                listOfNotNull(employee.department, employee.legajo, employee.email).joinToString(" · "),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (selectedEmployee?.id == employee.id) {
                            StatusPill("Activo", tone = ChipTone.Brand)
                        }
                    }
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
        verticalArrangement = Arrangement.Center
    ) {
        HeroPanel(
            eyebrow = "NFC activo",
            title = if (mode == TagScanMode.ASSIGN) "Escaneá para asignar" else "Escaneá para consultar",
            subtitle = if (nfcReaderController.isAvailable()) {
                "Acercá el TAG al teléfono. Se leerá el UID en el mismo formato que usa la máquina."
            } else {
                "Este dispositivo no tiene NFC disponible."
            }
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Nfc,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(82.dp)
                )
                OutlinedButton(onClick = onCancel) { Text("Cancelar") }
            }
        }
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
    onSwitchCompany: () -> Unit,
    onLogout: () -> Unit
) {
    val session = (state.authState as? AuthState.Authenticated)?.session
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            HeroPanel(
                eyebrow = "Cuenta",
                title = "Sesión segura",
                subtitle = "Resumen rápido de usuario, backend y desbloqueo biométrico."
            )
        }
        if (session != null) {
            item {
                SectionCard(
                    title = session.companyName ?: session.user.username,
                    subtitle = "${session.user.username} · ${session.user.role}"
                ) {
                    DetailRow("Backend", session.baseUrl)
                    DetailRow("Biometría", if (session.biometricEnabled) "Activa" else "No")
                }
            }
        }
        item {
            OutlinedButton(onClick = onSwitchCompany, modifier = Modifier.fillMaxWidth()) {
                Text("Cambiar empresa")
            }
        }
        item {
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null)
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
private fun HeroPanel(
    eyebrow: String,
    title: String,
    subtitle: String,
    content: @Composable (() -> Unit)? = null
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
        shape = RoundedCornerShape(30.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.95f),
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.92f)
                        )
                    )
                )
                .padding(20.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                StatusPill(eyebrow, tone = ChipTone.Brand)
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
                content?.invoke()
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    subtitle: String? = null,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.animateContentSize(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            content()
        }
    }
}

@Composable
private fun PriorityRow(
    title: String,
    subtitle: String,
    tone: ChipTone
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        StatusPill(
            text = when (tone) {
                ChipTone.Success -> "OK"
                ChipTone.Warning -> "Atención"
                ChipTone.Danger -> "Crítico"
                ChipTone.Brand -> "Ver"
                ChipTone.Neutral -> "Info"
            },
            tone = tone
        )
    }
}

@Composable
private fun MetricTile(
    label: String,
    value: String,
    tone: ChipTone,
    modifier: Modifier = Modifier
) {
    val background = when (tone) {
        ChipTone.Brand -> Color(0xFFDCEFFD)
        ChipTone.Success -> Color(0xFFDFF4E6)
        ChipTone.Warning -> Color(0xFFFBEACB)
        ChipTone.Danger -> Color(0xFFF9D8D2)
        ChipTone.Neutral -> MaterialTheme.colorScheme.surface.copy(alpha = 0.88f)
    }
    val contentColor = when (tone) {
        ChipTone.Brand -> Color(0xFF15405A)
        ChipTone.Success -> Color(0xFF1D5A39)
        ChipTone.Warning -> Color(0xFF6D4A06)
        ChipTone.Danger -> Color(0xFF7A2A1F)
        ChipTone.Neutral -> MaterialTheme.colorScheme.onSurface
    }
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = background
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(label, color = contentColor.copy(alpha = 0.78f), style = MaterialTheme.typography.labelMedium)
            Text(value, color = contentColor, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ActionTile(
    title: String,
    subtitle: String,
    tone: ChipTone,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val background = when (tone) {
        ChipTone.Brand -> Brush.linearGradient(listOf(Color(0xFFDCEFFD), Color(0xFFCAE7F8)))
        ChipTone.Success -> Brush.linearGradient(listOf(Color(0xFFDDF3E3), Color(0xFFCFECD8)))
        ChipTone.Warning -> Brush.linearGradient(listOf(Color(0xFFFBECCF), Color(0xFFF5E1B7)))
        ChipTone.Danger -> Brush.linearGradient(listOf(Color(0xFFF9DDD7), Color(0xFFF2CBC3)))
        ChipTone.Neutral -> Brush.linearGradient(listOf(Color(0xFFEAEFF3), Color(0xFFE1E8EC)))
    }
    val titleColor = when (tone) {
        ChipTone.Brand -> Color(0xFF16425D)
        ChipTone.Success -> Color(0xFF1D5A39)
        ChipTone.Warning -> Color(0xFF6D4A06)
        ChipTone.Danger -> Color(0xFF7A2A1F)
        ChipTone.Neutral -> Color(0xFF2F4553)
    }
    val subtitleColor = when (tone) {
        ChipTone.Brand -> Color(0xFF345B72)
        ChipTone.Success -> Color(0xFF3D6A53)
        ChipTone.Warning -> Color(0xFF7C6328)
        ChipTone.Danger -> Color(0xFF8A4E42)
        ChipTone.Neutral -> Color(0xFF5A6E79)
    }
    Card(
        modifier = modifier.clickable(enabled = enabled, onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(20.dp)
    ) {
        Box(
            modifier = Modifier
                .background(if (enabled) background else Brush.linearGradient(listOf(Color(0xFFE1E4E6), Color(0xFFD3D8DB))))
                .padding(14.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(title, fontWeight = FontWeight.Bold, color = if (enabled) titleColor else Color(0xFF66727A))
                Text(
                    subtitle,
                    color = if (enabled) subtitleColor else Color(0xFF8A959C),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun CompanySelectorCard(
    company: CompanyProfile,
    selected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(20.dp)
    ) {
        Box(
            modifier = Modifier.background(
                if (selected) {
                    Brush.linearGradient(listOf(Color(0xFFD8EDFB), Color(0xFFC4E2F7)))
                } else {
                    Brush.linearGradient(listOf(Color(0xFFEEF2F4), Color(0xFFE4EAEE)))
                }
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(company.name, fontWeight = FontWeight.Bold)
                    Text(company.baseUrl, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                if (selected) {
                    StatusPill("Activa", tone = ChipTone.Success)
                }
            }
        }
    }
}

@Composable
private fun AddCompanyDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit
) {
    var name by rememberSaveable { mutableStateOf("") }
    var backendUrl by rememberSaveable { mutableStateOf("") }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Agregar empresa") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Cargá el nombre visible y el backend que corresponde a esa empresa.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Empresa") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = { backendUrl = it },
                    label = { Text("Backend URL") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(name, backendUrl) }) {
                Text("Guardar")
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
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(0.38f))
        Spacer(modifier = Modifier.width(12.dp))
        Text(value, fontWeight = FontWeight.Medium, modifier = Modifier.weight(0.62f))
    }
}

@Composable
private fun StatusPill(text: String, tone: ChipTone = ChipTone.Neutral) {
    val background = when (tone) {
        ChipTone.Brand -> Color(0xFFDFF1FF)
        ChipTone.Success -> Color(0xFFE4F6EB)
        ChipTone.Warning -> Color(0xFFFFF2DD)
        ChipTone.Danger -> Color(0xFFFDEAE7)
        ChipTone.Neutral -> MaterialTheme.colorScheme.surfaceVariant
    }
    val contentColor = when (tone) {
        ChipTone.Brand -> Color(0xFF0E618E)
        ChipTone.Success -> Color(0xFF1F6F46)
        ChipTone.Warning -> Color(0xFF97600C)
        ChipTone.Danger -> Color(0xFF984034)
        ChipTone.Neutral -> MaterialTheme.colorScheme.onSurface
    }
    Box(
        modifier = Modifier
            .background(background, RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold, color = contentColor)
    }
}
