# Carga de evidencias directamente a Google Drive

## Estado
Funcionalidad propuesta en la rama `feat/evidencias-drive-sin-login-2026-11-11`.
**No modificar la rama main ni la base de datos de producción sin validar esta prueba.**
La carga a Google no se puede verificar hasta configurar credenciales reales en el ambiente Preview.

## Experiencia de usuario
1. Abrir una actividad y seleccionar un archivo PDF, PNG o JPG (máximo **3 MiB**).
2. Completar **Quién registra el cambio**. No se solicita iniciar sesión ni introducir código adicional.
3. Presionar **Subir a Drive**. No se solicita inicio de sesión en Google.
4. La función Vercel utiliza credenciales almacenadas exclusivamente en el servidor para subir a la carpeta configurada.
5. Tras confirmación de Google, Neon vincula la evidencia con la actividad y conserva la fecha y el autor declarado.

Se mantiene la opción anterior de **añadir un enlace HTTPS manualmente**.
Eliminar una evidencia del dashboard **elimina su asociación en Neon, pero no borra el archivo de Google Drive**.

## Carpeta de destino y permisos

- Carpeta: https://drive.google.com/drive/folders/1yhEGQA2a3V4liYlqQYiGbvCrqFML5CAq
- ID: `1yhEGQA2a3V4liYlqQYiGbvCrqFML5CAq`
- Es una carpeta de **Mi unidad**, no se identificó un Drive compartido.
- La carpeta tiene el permiso **cualquier persona con el enlace: editor**. No es necesario modificarlo para la integración y no será alterado. Se mantiene por decisión operativa; cualquier persona con el enlace podría modificar archivos directamente.
- La cuenta Google usada por el servidor debe tener permiso Editor sobre esta carpeta y espacio de almacenamiento.

## Preparación de OAuth (una sola vez por el administrador)

**Por qué OAuth:** las cuentas de servicio no tienen cuota para poseer archivos en *Mi unidad*. En una carpeta de Mi unidad corresponde usar OAuth de una cuenta humana/institucional con permisos, o migrar la carpeta a una **Unidad compartida** y usar una cuenta de servicio allí.

1. En Google Cloud Console, crear/seleccionar un proyecto institucional, habilitar **Google Drive API** y configurar la pantalla de consentimiento OAuth. Elegir aplicación **interna** si todas las cuentas autorizadas pertenecen al Workspace.
2. Crear un cliente OAuth 2.0 de tipo **aplicación web**, conservar Client ID y Client Secret en un gestor de secretos.
3. Autorizar una vez una cuenta institucional con acceso de escritura a la carpeta. Generar un **refresh token** con acceso sin conexión (`access_type=offline`, y consentimiento cuando corresponda). Por ejemplo, usar OAuth Playground con credenciales propias y el redirect URI autorizado `https://developers.google.com/oauthplayground`. No subir el refresh token a GitHub.
4. Para una carpeta existente de Mi unidad, el permiso OAuth `https://www.googleapis.com/auth/drive` garantiza acceso según los permisos de la cuenta, pero es un alcance amplio/restringido: utilizar una cuenta dedicada y cumplir los requisitos de aprobación de Google. Puede usarse `drive.file` si la carpeta está autorizada para esa aplicación mediante Google Picker u otro flujo compatible; verificar ese caso antes de usarlo.
5. En **Vercel → proyecto → Settings → Environment Variables**, configurar en **Preview**:
   - `DATABASE_URL` (ya disponible en el proyecto si está configurada).
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN`
   - `GOOGLE_DRIVE_FOLDER_ID=1yhEGQA2a3V4liYlqQYiGbvCrqFML5CAq`
6. Marcar secretos como **Sensitive/Encrypted**. No usar valores reales en `.env.example`.
7. Volver a desplegar la rama Preview para recoger las variables.

La carga funciona sin códigos de usuario ni autenticación individual en Google. **Cualquier visitante que pueda abrir el dashboard podrá enviar archivos**, dentro de límites preventivos de cantidad y tamaño. El nombre del usuario será declarado y no verificado. Los permisos de consulta y edición de estados no cambian.

## Persistencia Neon

**Aplicado el 11/11/2026**: la migración `db/003_drive_evidence.sql` se ejecutó y verificó en la base `neondb` del proyecto de seguimiento. El script:

- Agrega la columna opcional `drive_file_id` a `operational_evidence`.
- Crea un índice único parcial para archivos subidos a Drive.
- Crea `operational_upload_attempts` para cuotas, trazabilidad técnica y detección de cargas huérfanas.
- **No borra ni modifica** las actividades ni las evidencias existentes por URL.

Para pruebas Preview se puede utilizar la base `neondb` ya migrada, pero las pruebas reales crearán archivos y registros; utiliza una base/ramal de ensayo si necesitas mantener aislados los datos oficiales.

## Controles incluidos

- Máximo **3 MiB** por archivo (debajo del límite de 4,5 MB de Vercel Functions).
- Formatos: `application/pdf`, `image/png`, `image/jpeg`; validación de extensión y cabecera binaria.
- Máximo **10 cargas por IP/hora** y **120 cargas globales/día** mediante registros en Neon. El hash de IP utiliza el secreto OAuth que ya se configura para la integración, sin una variable adicional. Son límites preventivos, no equivalen a un firewall, protección anti-bots o autenticación; podrían excederse en condiciones de concurrencia.
- Validación del identificador contra las 23 actividades oficiales.
- Sin clave de carga: se conservan la comprobación de tipo, extensión, firma, tamaño, ID de actividad y límites de frecuencia. Esto no impide completamente el abuso de un sitio público.
- Verificación de origen para solicitudes de escritura (no sustituye autenticación).
- Registro en Neon solo después de respuesta exitosa de Drive; intento de borrar el archivo remoto si falla el registro en Neon.
- No se crean permisos `anyone` ni se publican automáticamente los archivos; un usuario que abra el enlace podría necesitar permisos de Google para verlos.
- El nombre informado como autor lo escribe el usuario; **no existe verificación de identidad**.

## Pruebas

```bash
npm install
npm run check
npm test
```

Prueba funcional en **Preview**:
1. Sin variables OAuth o código, el botón muestra un error controlado y no crea archivos.
2. Credenciales OAuth inexistentes: HTTP 503, sin subir a Drive.
3. Archivo > 3 MiB: HTTP 413.
4. Archivo de extensión o firma incorrecta: HTTP 415/400.
5. PDF pequeño válido: Google Drive crea el archivo en la carpeta y Neon devuelve evidencia con `drive_file_id`.
6. Recargar la página: el nuevo enlace sigue en la actividad y el KPI de evidencias se actualiza.
7. Comprobar permisos de visualización en Drive con una cuenta de lector.
8. Revisar en Neon `operational_upload_attempts`: `stored` sin entradas `orphaned`.

## Limitaciones

- No se soportan archivos mayores de 3 MiB ni DOCX/XLSX por el momento.
- Para archivos grandes se requiere un flujo reanudable/directo diferente; no aumentar el límite sin rediseñar la carga.
- La aplicación no verifica antivirus. No es apropiada para cargar expedientes judiciales ni información clasificada.
- El dashboard mantiene operaciones de edición sin autenticar, y la carga de archivos también es abierta a los visitantes, según lo solicitado. La exposición pública requiere asumir ese riesgo.
