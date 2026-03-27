package com.ieasrl.coffeecontrol.tecnico.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

@Serializable
data class SessionUser(
    val id: Int,
    val username: String,
    val role: String,
    val is_protected: Boolean,
    val department: String? = null,
    val department_scopes: List<String> = emptyList()
)

@Serializable
data class StoredSession(
    val baseUrl: String,
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val lastAuthenticatedAt: Long,
    val biometricEnabled: Boolean,
    val user: SessionUser
)

class SecureSessionStore(private val context: Context) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }
    private val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    suspend fun loadSession(): StoredSession? = withContext(Dispatchers.IO) {
        val encrypted = prefs.getString(KEY_SESSION, null) ?: return@withContext null
        val plaintext = runCatching { decrypt(encrypted) }.getOrNull() ?: return@withContext null
        runCatching { json.decodeFromString<StoredSession>(plaintext) }.getOrNull()
    }

    suspend fun saveSession(session: StoredSession) = withContext(Dispatchers.IO) {
        saveLastBackendUrl(session.baseUrl)
        val encrypted = encrypt(json.encodeToString(StoredSession.serializer(), session))
        prefs.edit().putString(KEY_SESSION, encrypted).apply()
    }

    suspend fun clearSession() = withContext(Dispatchers.IO) {
        prefs.edit().remove(KEY_SESSION).apply()
    }

    fun saveLastBackendUrl(baseUrl: String) {
        prefs.edit().putString(KEY_LAST_BASE_URL, baseUrl).apply()
    }

    fun loadLastBackendUrl(): String? = prefs.getString(KEY_LAST_BASE_URL, null)

    private fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        }
        val encryptedBytes = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val iv = android.util.Base64.encodeToString(cipher.iv, android.util.Base64.NO_WRAP)
        val payload = android.util.Base64.encodeToString(encryptedBytes, android.util.Base64.NO_WRAP)
        return "$iv:$payload"
    }

    private fun decrypt(encrypted: String): String {
        val parts = encrypted.split(':', limit = 2)
        require(parts.size == 2) { "Sesión cifrada inválida" }
        val iv = android.util.Base64.decode(parts[0], android.util.Base64.NO_WRAP)
        val payload = android.util.Base64.decode(parts[1], android.util.Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), javax.crypto.spec.GCMParameterSpec(128, iv))
        }
        return cipher.doFinal(payload).toString(Charsets.UTF_8)
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    companion object {
        private const val PREF_NAME = "coffeecontrol_tecnico_secure"
        private const val KEY_SESSION = "encrypted_session"
        private const val KEY_LAST_BASE_URL = "last_backend_url"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "coffeecontrol_tecnico_session"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
