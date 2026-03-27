# CoffeeControl Tecnico Android

Base nativa Android para la app tecnico de CoffeeControl.

Incluye en esta primera base:

- login contra `mobile-auth`
- persistencia segura de sesion con Android Keystore
- desbloqueo biometrico
- lista de maquinas
- detalle tecnico + stock
- WiFi remoto con escaneo de redes visibles
- pendientes / onboarding para `distribuidor`, `gerente` y `admin`
- busqueda de empleados y flujo de TAGs sobre `mobile-tech`
- lectura NFC real con `ReaderMode`

Importante:

- el proyecto ya compilo en esta maquina con `Gradle 8.13`, `JDK 17` (JBR de Android Studio) y el SDK local
- el APK debug generado queda en `app/build/outputs/apk/debug/app-debug.apk`
- el backend esperado por defecto es `http://192.168.1.76:3000/`, pero se puede cambiar desde el login

## Como abrirla

1. Abrir `coffeecontrol-tecnico-android/` en Android Studio.
2. Usar `JDK 17` o superior.
3. Dejar que Android Studio genere `local.properties`, sincronice Gradle y descargue el SDK faltante.
4. Verificar que el telefono Android tenga:
   - NFC
   - biometria configurada
   - acceso de red al backend
5. Ejecutar la app en el dispositivo.

## Prueba minima recomendada

1. Ingresar con un usuario `tecnico` o `distribuidor`.
2. Confirmar que carga `Máquinas`.
3. Abrir una máquina y probar `Stock`.
4. Probar biometria cerrando y reabriendo la app.
5. Ir a `TAGs`, buscar un empleado y escanear un TAG real.
6. Comparar el UID leido por el telefono con el UID que ya usa la maquina.
7. Si el rol lo permite, revisar `Pendientes`.
8. Si hay una máquina online, abrir `WiFi remoto` y lanzar un escaneo.

## Limitaciones actuales

- la PWA `coffeecontrol-tecnico.html` sigue existiendo como herramienta secundaria
- login, biometria, maquinas, stock y flujo NFC/TAGs ya quedaron validados en telefono Android real
- la validacion en vivo de `WiFi remoto` y `Pendientes` depende de tener una máquina online y/o registros pendientes reales
