# Seguimiento de migración SIJ → EJE No Penal

Aplicación web sobre Vercel Functions + Neon PostgreSQL para las **80 actividades** de la hoja de ruta propuesta del 3 al 9 de noviembre de 2026.

## Implementado
- Cronograma Gantt, iconos por tipo de acción, KPIs por estado/día, vista de flujo y recuperación alternativa.
- Estados: pendiente, en curso, completada, bloqueada y no aplica.
- Observaciones, enlaces HTTPS de evidencias, registro histórico y responsable de cambio.
- Control optimista de versiones para impedir sobrescrituras silenciosas desde varias sesiones.
- API y fuente de datos centralizados en Neon; navegador sin `localStorage` como fuente de verdad.
- Importación del JSON del tablero anterior y exportación de CSV/JSON.
- Autenticación con contraseña administrativa, cookie firmada HttpOnly, SameSite=Strict y Secure.

## Configurar Vercel
1. Conectar `Trigoat2612/seguimiento-cronograma` al proyecto existente `seguimiento-cronograma-2qnh` o confirmar que ya está vinculado.
2. Colocar **estos archivos en la raíz del repositorio** (no dentro de otra carpeta). En Framework Preset usar **Other** y Output Directory sin establecer.
3. Agregar en Settings > Environment Variables: `DATABASE_URL` (connection string **pooled** de Neon, servidor solamente), `ADMIN_PASSWORD` (al menos 12 caracteres) y `SESSION_SECRET` (al menos 32 caracteres aleatorios). No incluir las claves en Git ni variables `VITE_*`.
4. Deploy y abrir la URL asignada por Vercel. Iniciar sesión y cambiar el estado de una actividad para comprobar persistencia.

## Estado de Neon
En la rama **production** `br-misty-firefly-b52a21f6` del proyecto `super-credit-91949836`, base `neondb`, se creó el esquema aislado `seguimiento_cronograma` y se cargaron las 80 actividades. **No volver a ejecutar la carga inicial manualmente**; el esquema SQL de `db/001_schema.sql` queda para reproducir la estructura en otro entorno si se necesitara. Los datos reales ya están en la base indicada.

## Precauciones
- La contraseña compartida permite una única identidad administrativa. Para distintos usuarios y atribución individual verificable, migrar a autenticación por usuario antes de repartir el acceso.
- El historial es de cambios registrados por el tablero, no representa evidencia de ejecución de GTI. Los enlaces a archivos deben dirigir a un repositorio con permisos institucionales.
- No usar este tablero para cargar expedientes ni documentos judiciales sensibles. Registra **solo seguimiento de actividades**.
- El cronograma es propuesto; horas y volúmenes deben confirmarse en pruebas.
- La lógica `api/activities.js` asume el esquema de Neon preparado. No otorga acceso directo a Postgres al navegador.

## Desarrollo local
`npm install` y exportar las variables de entorno. `npm run dev` en `http://localhost:3000`. La cookie `Secure` requiere HTTPS, por lo que para probar el inicio de sesión es preferible el despliegue HTTPS de Vercel.
