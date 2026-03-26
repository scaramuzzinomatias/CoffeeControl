# Checklist de Salida a Piloto

Este checklist sirve para dejar una instalación lista para piloto real de CoffeeControl en el escenario objetivo actual:

- una máquina expendedora de café
- un producto
- un valor
- control de consumo principalmente informativo
- restricciones opcionales, según decisión del cliente

## 1. Alcance congelado del piloto

- [ ] Confirmar que el piloto no depende de DEX/UCS, catálogo complejo ni subsidios avanzados.
- [ ] Confirmar que la operación se limita a café simple con un solo producto y un solo precio.
- [ ] Confirmar con el cliente si el límite diario es:
  - [ ] solo informativo
  - [ ] advertencia por email
  - [ ] bloqueo duro

## 2. Preparación del backend

Ubicación de trabajo:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
```

Chequeos obligatorios:

- [ ] `npm run support:doctor`
- [ ] `npm run db:backup`
- [ ] `npm run db:migrate:all`
- [ ] Verificar que `http://127.0.0.1:3000/health` responda `200`

Configuración:

- [ ] `DATABASE_URL` correcta
- [ ] `JWT_SECRET` no default en instalación final
- [ ] SMTP configurado si el piloto usará emails
- [ ] `business_timezone` correcta para la empresa

## 3. Seguridad mínima antes de instalar

- [ ] Cambiar o validar la contraseña de la cuenta protegida `admin`
- [ ] Crear usuarios reales para el piloto:
  - [ ] gerente
  - [ ] supervisor/es
  - [ ] técnico o distribuidor, si aplica
- [ ] Confirmar que la cuenta `admin` siga protegida
- [ ] Confirmar que ningún usuario funcional tenga más permisos de los necesarios

## 4. Datos funcionales mínimos

- [ ] Alta de empleados del piloto
- [ ] Cargar `email`, `department`, `dni` o `legajo` si el cliente los usa
- [ ] Definir política diaria por empleado o por jerarquía
- [ ] Asignar TAGs NFC a quienes participarán del piloto
- [ ] Verificar que no haya TAGs perdidos/inactivos asignados por error

## 5. Hardware y máquina

- [ ] ESP32-C3 flasheado con firmware vigente
- [ ] Lector NFC operativo
- [ ] RTC operativo
- [ ] Comunicación MDB estable
- [ ] Fuente estable
- [ ] Cableado firme y etiquetado
- [ ] Máquina aprobada en panel con nombre y ubicación correctos

## 6. Configuración de red

- [ ] Portal `CoffeeControl-Setup` accesible
- [ ] SSID correcto
- [ ] Password WiFi correcta
- [ ] URL backend correcta
- [ ] `Probar conexión` OK desde el portal
- [ ] La máquina reporta:
  - [ ] `SSID`
  - [ ] `IP`
  - [ ] `RSSI`
  - [ ] `backend_ok`

## 7. Prueba funcional mínima en línea

- [ ] Login gerente/admin correcto
- [ ] Login técnico o distribuidor correcto
- [ ] La máquina aparece online en `Máquinas`
- [ ] Un TAG válido autoriza consumo
- [ ] `confirm` registra consumo
- [ ] `cancel` no deja consumo válido
- [ ] El consumo aparece en:
  - [ ] dashboard
  - [ ] reportes
  - [ ] detalle por empleado
  - [ ] detalle por máquina

## 8. Prueba offline obligatoria

- [ ] Desconectar backend o WiFi según protocolo
- [ ] Verificar autenticación offline con TAG válido
- [ ] Realizar varios consumos offline
- [ ] Reconectar
- [ ] Confirmar flush de cola
- [ ] Confirmar que los consumos aparezcan en backend/reportes

Capacidad offline esperada del firmware actual:

- cache de tarjetas: `1500`
- cola de eventos offline: `1000`

## 9. Notificaciones y soporte

- [ ] Enviar prueba desde `Notificaciones`
- [ ] Validar correo real de llegada
- [ ] Confirmar destinatarios correctos
- [ ] Confirmar eventos habilitados para el piloto

## 10. Operación remota

- [ ] Reinicio remoto probado
- [ ] Cambio remoto de WiFi probado o validado en entorno controlado
- [ ] Escaneo remoto de redes probado
- [ ] Estado de red visible por máquina

## 11. Stock

Si el piloto usará stock:

- [ ] Crear al menos una selección configurada
- [ ] Probar reposición
- [ ] Probar ajuste
- [ ] Validar descuento automático en venta confirmada
- [ ] Validar alerta de stock bajo si aplica

Si el piloto no usará stock:

- [ ] Dejar documentado que el módulo existe pero no forma parte del alcance operativo del piloto

## 12. Reportes y exportación

- [ ] Reporte por máquina OK
- [ ] Reporte por empleado OK
- [ ] Reporte por departamento OK
- [ ] Exportación Excel OK
- [ ] Exportación PDF OK
- [ ] Filtros por área / empleado funcionando si el volumen lo requiere

## 13. Respaldo y recuperación

- [ ] Generar backup inicial antes de salir a piloto
- [ ] Confirmar carpeta de backup:
  - `C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backups\db`
- [ ] Validar que soporte sepa usar:
  - [ ] `doctor`
  - [ ] `backup`
  - [ ] `restore`
  - [ ] `purge`
  - [ ] `rebuild`

## 14. Criterios de aceptación del piloto

- [ ] La máquina mantiene operación online estable
- [ ] La máquina tolera una caída controlada y recupera offline
- [ ] Los consumos se registran con trazabilidad por empleado
- [ ] Los roles funcionan como se espera
- [ ] Los reportes responden a la necesidad del cliente
- [ ] El cliente entiende si el sistema está en modo informativo o restrictivo

## 15. Entrega operativa

- [ ] Dejar documentados:
  - [ ] usuario gerente
  - [ ] usuario soporte/técnico/distribuidor
  - [ ] responsable del cliente
  - [ ] política de backup
  - [ ] procedimiento de recuperación
- [ ] Entregar o guardar copia de:
  - [ ] [PROTOCOLO_PRUEBAS.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PROTOCOLO_PRUEBAS.md)
  - [ ] [GUIA_SOPORTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/GUIA_SOPORTE.md)

## Resultado esperado

Si todos los puntos anteriores están OK, la instalación puede considerarse lista para un piloto serio y controlado, sin seguir agregando complejidad innecesaria.
