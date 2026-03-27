package com.ieasrl.coffeecontrol.tecnico.nfc

import android.nfc.NfcAdapter
import androidx.activity.ComponentActivity

class NfcReaderController(private val activity: ComponentActivity) {
    private val adapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)
    private var callback: ((String) -> Unit)? = null

    fun isAvailable(): Boolean = adapter != null

    fun startScanning(onUidRead: (String) -> Unit) {
        callback = onUidRead
        adapter?.enableReaderMode(
            activity,
            { tag ->
                val uid = tag.id?.joinToString(separator = "") { byte -> "%02X".format(byte) } ?: return@enableReaderMode
                activity.runOnUiThread {
                    callback?.invoke(uid)
                }
            },
            NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
    }

    fun stopScanning() {
        adapter?.disableReaderMode(activity)
        callback = null
    }
}
