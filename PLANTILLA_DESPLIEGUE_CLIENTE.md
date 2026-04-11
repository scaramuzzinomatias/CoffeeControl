# Plantilla de Despliegue por Cliente

Documento base para alta de una empresa nueva en CoffeeControl.

## 1. Objetivo

Mantener una convención repetible por cliente usando el modelo actual del sistema:

- un backend por empresa
- una base por empresa
- un subdominio por empresa
- secretos separados por empresa

## 2. Convención recomendada

Tomando como ejemplo un cliente `McCain`.

### Identidad

- `client_slug`: `mccain`
- `client_name`: `McCain`

### Base de datos

- nombre de base: `coffeecontrol_mccain`

### Backend

- puerto interno: `3001`
- carpeta de variables: `backend/.env`

### Dominio

- externo: `mccain.coffeecontrol.tudominio.com`

### Backup

- carpeta recomendada: `D:\Backups\CoffeeControl\mccain\`

## 3. Alta de una empresa nueva

### Paso 1. Crear base

Ejemplo:

```powershell
createdb -U postgres coffeecontrol_mccain
```

### Paso 2. Preparar `.env`

Copiar:

```powershell
Copy-Item .\backend\.env.client.example .\backend\.env
```

Y completar:

- `CLIENT_SLUG`
- `CLIENT_NAME`
- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`
- `REGISTRATION_SECRET`
- SMTP del cliente o de la operación central

### Paso 3. Migrar esquema

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
npm run db:migrate:all
```

### Paso 4. Verificación operativa

```powershell
npm run support:doctor
```

### Paso 5. Crear o resetear `admin`

```powershell
node scripts/support-user.js --username admin --password NuevaClaveSegura2026 --role admin --protected --activate
```

### Paso 6. Crear `gerente`

```powershell
node scripts/support-user.js --username gerencia.mccain --password Temporal2026 --role gerente --full-name "Gerencia McCain" --email gerencia@mccain.com --activate
```

## 4. Reverse proxy recomendado

Ejemplo conceptual:

- `mccain.coffeecontrol.tudominio.com` -> `127.0.0.1:3001`
- `pepsico.coffeecontrol.tudominio.com` -> `127.0.0.1:3002`

## 5. Naming recomendado por cliente

### Base

- `coffeecontrol_<cliente>`

### Puerto

- `3001`, `3002`, `3003`...

### Dominio

- `<cliente>.coffeecontrol.tudominio.com`

### Carpeta de backup

- `D:\Backups\CoffeeControl\<cliente>\`

## 6. Checklist post-deploy

1. `/health` responde OK
2. login admin OK
3. login gerente OK
4. `support:doctor` OK
5. backup manual generado
6. backup con `*.meta.json`
7. restore `--dry-run` probado
8. `REGISTRATION_SECRET` distinto al de otros clientes
9. subdominio apuntando al backend correcto
10. SMTP validado o conscientemente deshabilitado

## 7. Qué no hacer

- no reutilizar la misma base para clientes distintos
- no reutilizar el mismo `JWT_SECRET` y `REGISTRATION_SECRET` en todas las empresas
- no mezclar backups de clientes en una sola carpeta sin naming claro
- no restaurar un backup de un cliente sobre otro sin validación explícita
