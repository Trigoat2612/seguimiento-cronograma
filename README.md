# Centro de control · Operaciones de salida SIJ → EJE No Penal

Evolución del repositorio `Trigoat2612/seguimiento-cronograma` para el **Plan de Operaciones de Salida v2.0**, CSJ Lima Este, especialidad Laboral (NLPT), 10/11/2026. La versión anterior usaba 80 actividades de una propuesta del 3–9/11/2026; **esta versión trabaja exclusivamente con las 23 filas del cronograma oficial, páginas 11–12**.

## Visión ejecutiva
- 6 KPI: avance respaldado, completadas con evidencia, en curso, bloqueadas, sin confirmar y fuera de plazo sin cierre documentado.
- Avance por fase y punto de decisión Go/No-Go. No presupone su aprobación.
- Actividades filtrables por estado, fase, equipo, criticidad y búsqueda, con detalle, registro de ejecución, responsable y fecha/hora real.
- Columna de responsables clicable: fichas por actividad y directorio general con búsqueda por código, nombre, cargo u organización. Identifica personas «por designar» y códigos no incluidos en el directorio.
- Línea de tiempo del 8 al 20/11, exportación CSV de seguimiento.
- Consulta de 5 umbrales, 4 niveles y 12 pasos de rollback.
- Interfaz responsive. Los estados iniciales son **Sin confirmar**, no «no ejecutada».
- **Nueva característica experimental (solo rama alternativa):** carga de PDF/PNG/JPG a Google Drive, sin inicio de sesión Google por visitante, mediante código de carga y credenciales OAuth de servidor. Documentación: [Evidencias Google Drive](docs/EVIDENCIAS_GOOGLE_DRIVE.md).

## Persistencia centralizada y seguridad

Los archivos del tablero son `index.html`, `data/plan-operaciones.json`, `api/operaciones.js`, `db/002_operaciones_salida.sql` y `lib/core.js` (compartida con el proyecto anterior). El API usa Neon, manteniendo **intactas** las tablas previas `seguimiento_cronograma.activities`, `activity_history` y `activity_evidence`.

Antes de habilitar el seguimiento compartido:
1. Ejecutar **con autorización** la migración SQL `db/002_operaciones_salida.sql` en `neondb`, proyecto Neon del seguimiento. Crea exclusivamente `operational_status`, `operational_evidence` y `operational_history` dentro del esquema existente.
2. En Vercel configurar `DATABASE_URL` como variable **solo del servidor**, con la cadena de conexión a Neon. No incluir en el repositorio ni en archivos públicos.
3. Activar Deployment Protection / autenticación de acceso para restringir tanto **lectura como escritura**. Sin autenticación propia, quien tenga acceso a la web puede modificar el seguimiento. La validación de `Origin` no es autenticación.
4. Abrir el dashboard, registrar un cambio y verificar que permanece después de actualizar. Control de versiones optimista para evitar sobreescrituras en sesiones simultáneas.

El dataset público incorpora nombres y suplentes del directorio de responsables, pero **no publica correos ni teléfonos**. Si la identidad del personal debe mantenerse reservada, se debe restringir también el acceso al repositorio o retirar los nombres antes de difundirlo.

El sistema permite conservar evidencias por enlace HTTPS. En la rama experimental, además, ofrece **Subir a Drive**, que registra automáticamente el archivo y su vínculo en Neon después de cargarlo. Solo admite PDF, PNG y JPG pequeños. No subir expedientes judiciales ni información sensible.

## Sin conexión a Neon

Si la API no responde, el tablero cambia de forma visible al **modo ensayo local**. Permite probar filtros, seguimiento y evidencia con `localStorage`. Estos datos **no son oficiales ni se comparten** y jamás se escriben automáticamente en Neon. La aplicación muestra claramente la diferencia. No contar un porcentaje de ensayo como cumplimiento real.

## Integridad de la fuente

`data/plan-operaciones.json` conserva los textos originales de fecha, inicio, fin, responsable, evidencia y página PDF. Para fines visuales añade `start_at` / `end_at` cuando hay horarios suficientes. Los rangos multifecha **no implican trabajo continuo**. `GO` y `C4-R` son IDs **técnicos** de filas sin código identificable; el código fuente se mantiene intacto. Las tareas a demanda y de monitoreo continuo no se incluyen en el denominador del porcentaje de cierre.

La «criticidad» es una priorización visual construida para seguimiento, no una categorización aprobada en el PDF. La información operativa del plan se conserva sin alterar sus actividades ni responsables.

## Desarrollo

```sh
npm install
npm run dev
# abrir http://localhost:3000
npm run check
```

Solo `DATABASE_URL` es necesaria para la conexión con Neon. Ya no se usa `OPERACIONES_EDITOR_KEY`; puede eliminarse de Vercel si existiera. `server-local.mjs` sirve `data/plan-operaciones.json` y enruta `/api/operaciones` a `api/operaciones.js`.

## Carga Drive (rama experimental)

La característica de carga requiere configurar `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`, `EVIDENCE_UPLOAD_CODE` y aplicar `db/003_drive_evidence.sql` en el ambiente de prueba. **La lectura del dashboard no depende de estas variables**. El visitante no requiere cuenta de Google; el código de carga restringe quién puede subir archivos.

Consulta [la guía de implementación y seguridad](docs/EVIDENCIAS_GOOGLE_DRIVE.md) antes de desplegar. Ejecuta `npm run check` y `npm test`.
