# Centro de control · Operaciones de salida SIJ → EJE No Penal

Evolución del repositorio `Trigoat2612/seguimiento-cronograma` para el **Plan de Operaciones de Salida v2.0**, CSJ Lima Este, especialidad Laboral (NLPT), 10/11/2026. La versión anterior usaba 80 actividades de una propuesta del 3–9/11/2026; **esta versión trabaja exclusivamente con las 23 filas del cronograma oficial, páginas 11–12**.

## Visión ejecutiva
- 6 KPI: avance respaldado, completadas con evidencia, en curso, bloqueadas, sin confirmar y fuera de plazo sin cierre documentado.
- Avance por fase y punto de decisión Go/No-Go. No presupone su aprobación.
- Actividades filtrables por estado, fase, equipo, criticidad y búsqueda, con detalle, observaciones, responsable y fecha/hora real.
- Línea de tiempo del 8 al 20/11, exportación CSV de seguimiento.
- Consulta de 5 umbrales, 4 niveles y 12 pasos de rollback, más observaciones detectadas en el plan.
- Interfaz responsive. Los estados iniciales son **Sin confirmar**, no «no ejecutada».

## Persistencia centralizada y seguridad

Los archivos del tablero son `index.html`, `data/plan-operaciones.json`, `api/operaciones.js`, `db/002_operaciones_salida.sql` y `lib/core.js` (compartida con el proyecto anterior). El API usa Neon, manteniendo **intactas** las tablas previas `seguimiento_cronograma.activities`, `activity_history` y `activity_evidence`.

Antes de habilitar el seguimiento compartido:
1. Ejecutar **con autorización** la migración SQL `db/002_operaciones_salida.sql` en `neondb`, proyecto Neon del seguimiento. Crea exclusivamente `operational_status`, `operational_evidence` y `operational_history` dentro del esquema existente.
2. En Vercel configurar `DATABASE_URL` como variable **solo del servidor**, con la cadena de conexión a Neon. No incluir en el repositorio ni en archivos públicos.
3. Configurar `OPERACIONES_EDITOR_KEY` (clave aleatoria de 12+ caracteres) como variable de entorno privada. En la web, introducirla mediante el botón «Edición». La clave no se persiste en `localStorage` ni se incluye en el código.
4. Activar Deployment Protection / autenticación de acceso para restringir también **lectura** del dashboard. La clave de edición no protege las solicitudes GET, ni identifica por sí sola a una persona.
5. Abrir el dashboard, registrar un cambio y verificar que permanece después de actualizar. Control de versiones optimista para evitar sobreescrituras en sesiones simultáneas.

El sistema solo registra **enlaces HTTPS** a evidencias guardadas en repositorios institucionales con permisos propios. No sube ni almacena expedientes judiciales. No se debe ingresar información sensible en observaciones.

## Sin conexión a Neon

Si la API no responde, el tablero cambia de forma visible al **modo ensayo local**. Permite probar filtros, seguimiento y evidencia con `localStorage`. Estos datos **no son oficiales ni se comparten** y jamás se escriben automáticamente en Neon. La aplicación muestra claramente la diferencia. No contar un porcentaje de ensayo como cumplimiento real.

## Integridad de la fuente

`data/plan-operaciones.json` conserva los textos originales de fecha, inicio, fin, responsable, evidencia y página PDF. Para fines visuales añade `start_at` / `end_at` cuando hay horarios suficientes. Los rangos multifecha **no implican trabajo continuo**. `GO` y `C4-R` son IDs **técnicos** de filas sin código identificable; el código fuente se mantiene intacto. Las tareas a demanda y de monitoreo continuo no se incluyen en el denominador del porcentaje de cierre.

La «criticidad» es una priorización visual construida para seguimiento, no una categorización aprobada en el PDF. Las 8 observaciones de inconsistencias se muestran separadas, sin alterar el plan.

## Desarrollo

```sh
npm install
npm run dev
# abrir http://localhost:3000
npm run check
```

La conexión a Neon y la clave de editor se configuran mediante variables de entorno privadas. En el repositorio principal, `server-local.mjs` debe servir `data/plan-operaciones.json` y enrutar `/api/operaciones` a `api/operaciones.js`.