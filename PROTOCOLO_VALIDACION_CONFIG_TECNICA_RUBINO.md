# Protocolo de Validación — Configuración Técnica Remota Rubino

Objetivo:

- validar en campo la configuración técnica remota de una máquina Rubino
- comprobar que `backend -> config_update -> ESP -> persistencia -> venta real` funciona
- usar `Diag` y `Compatibilidad asistida` como apoyo, sin depender solo del monitor serie

Aplica a:

- roles `admin`, `tecnico`, `distribuidor`
- máquinas con perfil MDB compatible con Rubino

## Precondiciones

Antes de empezar, confirmar:

- la máquina aparece `online` en `Máquinas`
- `Diag` responde
- el precio humano actual es correcto
- la venta base ya funciona sin reset espurio
- la máquina no tiene otro comando remoto pendiente

Valores base sugeridos para Rubino:

- `price_cents = 1200`
- `pricing_profile = rubino_half_credit`
- `mdb_feature_level = 1`
- `mdb_country_code = 50`
- `mdb_scale_factor = 100`
- `mdb_decimal_places = 2`
- `mdb_max_response_time = 5`
- `mdb_misc_options = 0`

## Herramientas de verificación

Usar siempre estas tres vistas:

- `Máquinas > Config técnica`
- `Máquinas > Diag`
- `Compatibilidad asistida`

Opcional:

- monitor serie del ESP
- portal local del ESP con `Ver eventos` y `Ver setup MDB`

## Regla de prueba

Cada cambio se valida así:

1. cambiar un solo parámetro
2. guardar desde `Config técnica`
3. esperar la sincronización remota
4. abrir `Diag` y confirmar el valor aplicado
5. hacer una venta real
6. confirmar:
   - no hay reset espurio
   - la venta cierra
   - el backend guarda el importe humano correcto
7. reiniciar la máquina
8. volver a pedir `Diag`
9. confirmar que el valor quedó persistido
10. volver al valor base antes de seguir con el siguiente parámetro

No mezclar varios cambios al mismo tiempo.

## Checklist por parámetro

### 1. `pricing_profile`

Objetivo:

- validar la conversión entre precio humano y unidades MDB

Prueba:

1. partir de `price_cents = 1200`
2. probar con `rubino_half_credit`
3. verificar en `Compatibilidad asistida` que el precio se traduzca a `600` unidades MDB
4. hacer una venta real
5. confirmar que backend guarde `1200`
6. si se prueba `identity`, verificar si la máquina acepta `1200` MDB o si queda fuera de rango

Esperado:

- `rubino_half_credit` debe seguir siendo el perfil de referencia para Rubino salvo evidencia real en contrario

### 2. `mdb_feature_level`

Objetivo:

- confirmar compatibilidad entre el level que anuncia el VMC y el feature que anuncia el lector

Prueba:

1. mirar `Diag > Último setup MDB`
2. anotar `VMC level`
3. probar:
   - igual al `VMC level`
   - un valor menor conservador
4. hacer venta real en cada caso

Esperado:

- si aparece inestabilidad o resets, volver al valor que cierre mejor la sesión
- no dejar un `feature_level` más alto que el necesario sin una razón real

### 3. `mdb_country_code`

Objetivo:

- validar que el VMC no rechace la configuración del lector

Prueba:

1. partir de `0x0032`
2. guardar
3. confirmar en `Diag`
4. hacer venta real

Esperado:

- para Rubino actual, mantener `0x0032` salvo evidencia concreta de otra necesidad

### 4. `mdb_scale_factor`

Objetivo:

- verificar que la interpretación del dinero no rompa precio ni sesión

Prueba:

1. confirmar valor actual `100`
2. no cambiarlo salvo prueba controlada
3. si se ensaya otro valor, hacerlo con venta real y volver inmediatamente si afecta compatibilidad

Esperado:

- `100` es el baseline

### 5. `mdb_decimal_places`

Objetivo:

- validar coherencia de representación monetaria

Prueba:

1. baseline `2`
2. confirmar que el VMC sigue cerrando la venta

Esperado:

- `2` se mantiene salvo evidencia fuerte de incompatibilidad

### 6. `mdb_max_response_time`

Objetivo:

- verificar tolerancia de timing declarada al VMC sin tocar el timing real del firmware

Prueba:

1. probar `5`
2. si hace falta, probar `6`
3. confirmar en `Diag`
4. hacer venta real

Esperado:

- dejar el menor valor que funcione estable

### 7. `mdb_misc_options`

Objetivo:

- asegurar que flags opcionales no introduzcan incompatibilidades

Prueba:

1. mantener `0` como baseline
2. no moverlo salvo necesidad real detectada

Esperado:

- `0` para el caso Rubino actual

## Qué mirar en `Diag`

### Resumen

Confirmar:

- `Precio`
- `Config técnica`
- `Compatibilidad asistida`

### Último setup MDB

Confirmar:

- `VMC level`
- `Max price`
- `Min price`
- `Feature level`
- `Scale factor`
- `Decimal places`
- `Max response`

### Eventos

Secuencia sana esperable:

- `NFC_READ`
- `NFC_APPROVED_ONLINE`
- `MDB_BEGIN_SESSION`
- `MDB_VEND_REQUEST`
- `MDB_VEND_SUCCESS`
- `MDB_VEND_END`

Señales de problema:

- `MDB_RESET` después de `VEND_REQUEST`
- `SESSION_TIMEOUT`
- `NFC_DENIED`
- `QUEUE_ENQUEUE` inesperado si la máquina estaba online y backend reachable

## Criterio de aprobación

Un parámetro queda aprobado cuando:

- se aplicó remoto desde backend
- `Diag` lo confirma
- la venta real cierra bien
- el backend registra el importe humano correcto
- sobrevive a reinicio

## Criterio de rollback

Si cualquiera de estas condiciones falla:

- la máquina resetea el cashless
- la venta no cierra
- cambia mal el importe humano
- `Compatibilidad asistida` advierte rango inválido
- tras reinicio no persiste

entonces:

1. volver al valor base inmediato
2. repetir `Diag`
3. confirmar venta real
4. dejar asentado qué combinación falló

## Resultado esperado de este bloque

Al terminar este protocolo debería quedar definido:

- perfil MDB final para Rubino
- parámetros avanzados estables
- qué campos vale la pena exponer de forma normal
- y cuáles conviene dejar solo para soporte
