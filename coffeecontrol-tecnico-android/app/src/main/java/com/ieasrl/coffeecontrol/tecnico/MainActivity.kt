package com.ieasrl.coffeecontrol.tecnico

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ieasrl.coffeecontrol.tecnico.biometric.BiometricUnlocker
import com.ieasrl.coffeecontrol.tecnico.nfc.NfcReaderController
import com.ieasrl.coffeecontrol.tecnico.ui.CoffeeControlTecnicoRoot
import com.ieasrl.coffeecontrol.tecnico.ui.TechnicianAppViewModel

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val biometricUnlocker = BiometricUnlocker(this)
        val nfcReaderController = NfcReaderController(this)

        setContent {
            val viewModel: TechnicianAppViewModel = viewModel()
            CoffeeControlTecnicoRoot(
                viewModel = viewModel,
                biometricUnlocker = biometricUnlocker,
                nfcReaderController = nfcReaderController
            )
        }
    }
}
