# Seguimiento de migración SIJ → EJE No Penal

Aplicación web sobre Vercel Functions + Neon PostgreSQL para las **80 actividades** de la hoja de ruta propuesta del 3 al 9 de noviembre de 2026.

## Implementado
- Cronograma Gantt, iconos por tipo de acción, KPIs por estado/día, vista de flujo y recuperación alternativa.
- Estados: pendiente, en curso, completada, bloqueada y no aplica.
- Observaciones, enlaces HTTPS de evidencias, registro histórico y responsable de cambio.
- Control optimista de versiones para impedir sobrescrituras silenciosas desde varias sesiones.
- API y fuente de datos centralizados en Neon; navegador sin `localStorage` como fuente de verdad.
- Importación del JSON del tablero anterior y exportación de CSV/JSON.
- Acceso directo al tablero sin contraseña administrativa ni cookies de sesión. El backend valida el origen de las solicitudes de edición (esto no sustituye un control de acceso).

## Configurar Vercel
1. Conectar `Trigoat2612/seguimiento-cronograma` al proyecto existente `seguimiento-cronograma-2qnh` o confirmar que ya está vinculado.
2. Colocar **estos archivos en la raíz del repositorio** (no dentro de otra carpeta). En Framework Preset usar **Other** y Output Directory sin establecer.
3. Agregar en Settings > Environment Variables: `DATABASE_URL` (cadena de conexión **pooled** de Neon, solo en el servidor). **No se necesitan** variables de contraseña ni secreto de sesión. No incluir las claves en Git ni variables `VITE_*`.
4. Desplegar y abrir la URL asignada por Vercel. La aplicación muestra el tablero directamente; cambiar el estado de una actividad y refrescar para comprobar su persistencia en Neon.

## Estado de Neon
En la rama **production** `br-misty-firefly-b52a21f6` del proyecto `super-credit-91949836`, base `neondb`, se creó el esquema aislado `seguimiento_cronograma` y se cargaron las 80 actividades. **No volver a ejecutar la carga inicial manualmente**; el esquema SQL de `db/001_schema.sql` queda para reproducir la estructura en otro entorno si se necesitara. Los datos reales ya están en la base indicada.

## Precauciones
- **Advertencia:** sin autenticación a nivel de aplicación, cualquier persona que acceda al sitio puede leer y modificar el seguimiento. Para uso interno, activar Deployment Protection o algún control de acceso de Vercel. La validación del encabezado Origin no impide solicitudes directas. La bitácora registra `tablero web`, no la identidad real de cada editor.
- El historial es de cambios registrados por el tablero, no representa evidencia de ejecución de GTI. Los enlaces a archivos deben dirigir a un repositorio con permisos institucionales.
- No usar este tablero para cargar expedientes ni documentos judiciales sensibles. Registra **solo seguimiento de actividades**.
- El cronograma es propuesto; horas y volúmenes deben confirmarse en pruebas.
- La lógica `api/activities.js` asume el esquema de Neon preparado. No otorga acceso directo a Postgres al navegador.

## Desarrollo local
`npm install` y exportar las variables de entorno. `npm run dev` en `http://localhost:3000`. Se utiliza el mismo backend para pruebas locales; las solicitudes que modifican datos deben proceder del origen de la aplicación.

## Variables retiradas
- `ADMIN_PASSWORD` y `SESSION_SECRET` fueron eliminadas del código, la interfaz y el ejemplo de configuración. Si están registradas como variables antiguas en Vercel, se pueden eliminar de ese proyecto después de confirmar que está desplegada esta versión.
