package com.ieasrl.coffeecontrol.tecnico.biometric

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricUnlocker(private val activity: FragmentActivity) {
    private val allowedAuthenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL

    fun isAvailable(): Boolean {
        return BiometricManager.from(activity).canAuthenticate(allowedAuthenticators) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    fun authenticate(
        title: String = "Desbloquear CoffeeControl Tecnico",
        subtitle: String = "Validá tu identidad para continuar",
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!isAvailable()) {
            onError("La biometría del dispositivo no está disponible")
            return
        }

        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onError(errString.toString())
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(allowedAuthenticators)
            .build()

        prompt.authenticate(promptInfo)
    }
}
