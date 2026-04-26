# Runbook de Producción — Máquinas

Este runbook resume qué mirar en operación real para una máquina CoffeeControl ya instalada.

Está pensado para soporte técnico y operación de campo, no para desarrollo.

---

## 1. Señales de máquina sana

Una máquina se considera sana cuando cumple todo esto:

- aparece `online` en el panel
- `last_seen` se actualiza normalmente
- `backend_ok = true`
- la versión actual coincide con la deseada:
  - `current_firmware_version = desired_firmware_version`
- una venta real cierra completa:
  - `tap aprobado`
  - `crédito visible`
  - `selección permitida`
  - `confirmación de venta`

Si la máquina está online pero no vende, no alcanza con mirar solo WiFi o backend: hay que revisar también `MDB`.

---

## 2. Hardware validado hoy

Revisión de hardware actualmente validada en máquina real:

### ESP32-C3

- `MDB TX = GPIO21`
- `MDB RX = GPIO20`
- `MDB_UART_TX_INVERT = on`

### RC522

- `SCK = GPIO0`
- `MOSI = GPIO3`
- `MISO = GPIO1`
- `SS = GPIO4`
- `RST = GPIO7`

### Otros

- `LED verde = GPIO10`
- reloj operativo: `NTP`

Si una placa nueva no respeta ese mapeo, no asumir compatibilidad automática.

---

## 3. Flujo OTA esperado

Con la base actual de producción, una OTA sana debería recorrer estos estados:

1. `queued`
2. `in_progress`
3. `pending_reconnect`
4. `success`

Se considera OTA correcta cuando:

- la máquina descarga la release
- reinicia sola
- vuelve a registrar la nueva versión
- `current_firmware_version` pasa a la versión nueva
- `firmware_update_status = success`

Con el endurecimiento actual:

- el firmware consulta comandos remotos cada `5s`
- fuerza consulta inmediata al reconectar WiFi
- fuerza consulta inmediata después de `register`
- si `register` ya devuelve una OTA pendiente, intenta consumirla en ese mismo arranque
- el backend puede reentregar una OTA `delivered` si el ciclo no cerró limpio

---

## 4. Qué hacer si una OTA no entra

## 4.1 Primer chequeo

Verificar:

- `health` del backend responde `200`
- la máquina sigue `online`
- `last_seen` sigue moviéndose
- hay una `desired_firmware_version` distinta de la actual

## 4.2 Si la máquina está online y la OTA sigue pendiente

Mirar:

- `firmware_update_status`
- `firmware_update_message`
- si hay comando remoto activo `queued` o `delivered`

Interpretación rápida:

- `queued`: todavía no fue tomada
- `in_progress`: está descargando o empezando a aplicar
- `pending_reconnect`: ya grabó firmware y se espera el re-registro
- `success`: ciclo cerrado
- `failed`: mirar mensaje y volver a desplegar o recuperar

## 4.3 Acción sugerida

En la base actual (`3.1.20+`), si la máquina está online y no entra sola dentro de aproximadamente `1 minuto`:

1. esperar unos segundos sin usar tag ni vending
2. hacer un reinicio simple de la máquina una vez
3. volver a mirar si cierra en `success`

Si aun así no entra:

- revisar si la release OTA realmente corresponde a esa revisión de hardware
- revisar que el binario declare la misma versión publicada
- revisar que la máquina no haya quedado con WiFi inestable

## 4.4 Recuperación

Usar USB solo si:

- la máquina no vuelve a registrar
- el firmware nuevo no corresponde al hardware instalado
- o la OTA quedó repetidamente en `failed`

Después de una recuperación por USB:

- alinear backend con la versión real cargada
- y recién después volver a usar OTA

---

## 5. Qué hacer si la máquina está online pero no vende

Revisar en este orden:

1. `WiFi / backend`
2. `NFC`
3. `MDB`

Señales útiles:

- si lee tag pero no aparece crédito:
  - probable problema de `MDB`
- si no lee tag:
  - probable problema de `RC522`
- si aprueba backend pero no cierra venta:
  - revisar secuencia MDB completa

Para `MDB`, en diagnóstico debería verse al menos:

- `RESET`
- `SETUP config`
- `READER ENABLE`

Si la máquina resetea el lector repetidamente o no habilita crédito, revisar interfaz física y polaridad TX/RX.

---

## 6. Tags desconocidos

Cuando se acerca un TAG no registrado:

- el backend lo registra como `card_unknown`
- debe aparecer en `NFCs sin asignar`

Hoy esa vista está prevista para:

- `admin`
- `gerente`

## 6.1 Si un tag desconocido “no aparece”

Revisar:

1. refrescar el panel
2. confirmar rol correcto (`admin` o `gerente`)
3. abrir `NFCs sin asignar`
4. verificar que exista en backend:
   - `GET /api/dashboard/unknown-uids`
   - o `taps.deny_reason = 'card_unknown'`

Si el UID está en backend pero no en pantalla:

- el problema es de panel/visibilidad
- no de captura del ESP

---

## 7. Criterio de cierre post-cambio

Después de cualquier cambio relevante en firmware o backend por máquina, el cierre mínimo recomendado es:

1. OTA o carga correcta
2. re-registro correcto
3. un tag aprobado
4. un tag rechazado
5. una venta real OK

Si esos cinco puntos cierran, la máquina puede considerarse operativa nuevamente.

---

## 8. Referencias relacionadas

- [GUIA_SOPORTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/GUIA_SOPORTE.md)
- [CHECKLIST_PILOTO.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CHECKLIST_PILOTO.md)
- [README.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/README.md)
