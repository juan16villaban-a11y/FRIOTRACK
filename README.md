# Friotrack — Plataforma SSOMA de Grupo Friopacking

Plataforma gratuita para homologar empresas contratistas, autorizar trabajos puntuales en sede, inducir a contratistas, visitantes y transportistas, y controlar quién puede ingresar.

| Módulo | Para quién | Dirección |
|---|---|---|
| Portal (inicio) | Todos | `https://juan16villaban-a11y.github.io/FRIOTRACK/` |
| **Homologación** | Empresas con servicio continuo | `…/homologacion/` |
| **Autorización de trabajos en sede** | Empresas con un trabajo puntual | `…/autorizacion/` |
| **Inducción SSOMA** | Contratistas, visitantes y transportistas | `…/induccion/` (`?tipo=visitante`, `?tipo=transportista`, `?empresa=frioteam`) |
| **Verificar trabajador** (QR o DNI) | Vigilancia | `…/verificar/` |
| **Panel SSOMA** (clave por sede) | Solo SSOMA | `…/panel/` |

- La web vive en **GitHub Pages** y los datos en una **Google Sheet** con Apps Script (`apps-script/Codigo.gs`).
- Los documentos de homologación y los certificados se guardan en tu **Google Drive**.

---

## 1 · Google (base de datos)

1. Con la cuenta de Gmail del área, crea una hoja en **sheets.google.com**.
2. **Extensiones → Apps Script**. Borra lo que haya y pega todo `apps-script/Codigo.gs`. Guarda.
3. Elige la función **configurarPlataforma** y pulsa **Ejecutar**. Acepta los permisos
   (*Configuración avanzada → Ir al proyecto → Permitir*). Esto crea las hojas y el aviso diario de vencimientos (7:00 a. m.).
4. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: **Yo** · Acceso: **Cualquier persona** → **Implementar**.
   Copia la URL que termina en `/exec`.
5. En la hoja **Configuración** completa: Video YouTube y Correo SSOMA.
6. En la hoja **Usuarios** verás 4 claves creadas al azar: **Administrador** y una por sede (**Norte, Sur, Centro**).
   Escribe el correo de cada sede (recibe los avisos) y entrega a cada una su clave. Puedes agregar más filas (una por persona) o cambiar claves (mínimo 6 caracteres).

Si más adelante cambias el código: pégalo, guarda, ejecuta **configurarPlataforma** (no borra nada) y
**Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**.

## 2 · GitHub (la web)

1. Abre `assets/config.js` con el Bloc de notas y pega la URL `/exec` en `API_URL`.
2. En GitHub: **+ → New repository**. Nombre exacto: **`ssomagrupofriopacking-spec.github.io`** · **Public** · Create.
3. **uploading an existing file** → arrastra todo el contenido de esta carpeta (menos `apps-script`) → **Commit changes**.
4. **Settings → Pages** → Branch **main** / **(root)** → Save. En 1–2 minutos la web estará en línea.

---

## Sedes (Norte, Sur, Centro)

- Al registrarse, la empresa marca **en qué sedes trabajará** y cuál **coordinará su homologación** (sede responsable).
- **Una sola evaluación por empresa**: la hace la sede responsable (o el administrador). Las otras sedes donde trabaja la empresa pueden ver sus documentos y su personal, en modo consulta.
- Cada sede ve en el panel solo las empresas, inducciones y personal de su sede. El administrador ve todo.
- La sede responsable o el administrador pueden cambiar las sedes y los clientes de una empresa (Panel → Homologación → empresa → *Sedes y clientes*).

## Homologación

1. La empresa entra con su **RUC** y recibe un **código de 6 dígitos** en su correo (vence en 15 min; la sesión dura 12 horas).
2. Sube sus documentos por ítem (PDF, JPG, PNG, Word o Excel; máx. 10 MB).
3. Pulsa **Enviar a revisión** → la sede responsable recibe un correo.
4. En el **Panel → Homologación**, la sede marca **Cumple / No cumple / N/A** con observaciones y ve el puntaje en vivo (secciones 25/30/25/10/10).
5. Resultado: **≥95% Aprobado**, **90–94% Aprobado con observaciones** (3 días para levantar), **<90% No aprobado**. La empresa recibe un correo con las observaciones.

### Fecha de vencimiento

- Los documentos que vencen (2.1 SCTR Salud, 2.2 SCTR Pensión, 2.3 Vida Ley, 2.4 EMO, 2.5 clínica, 5.1 equipos, 5.3 trabajo en altura) **piden su fecha de vencimiento** al subirlos; no se aceptan documentos ya vencidos.
- La homologación vence en la **fecha más próxima** entre la vigencia máxima (*Vigencia homologación (meses)*, 12 por defecto) y el vencimiento de esos documentos. La plataforma muestra el **motivo** (por ejemplo, «2.2 SCTR Pensión vigente»).
- Avisos automáticos por correo a la empresa y a su sede **30, 15, 7 y 1 día antes**.
- Desde 30 días antes, la empresa puede **renovar**: sube los documentos nuevos y envía a renovación. Su personal **sigue habilitado** mientras SSOMA revisa, hasta la fecha de vencimiento anterior.

### Requisitos por cliente

1. En la hoja **Clientes** escribe cada cliente (Activo: Sí).
2. En **Homologación - Requisitos** agrega filas con un ítem propio (C1.1, C1.2…), el requisito, el documento, si pide vencimiento, *Activo: Sí* y el **nombre del cliente** en la última columna.
3. En el panel asigna el cliente a la empresa (*Sedes y clientes*). La empresa verá una sección extra «Requisitos del cliente».
- Estos requisitos se califican igual, **no cambian el puntaje de homologación** y se muestran aparte como *Cumple / No cumple / Pendiente* por cliente.

## Autorización de trabajos en sede (trámite separado)

Para empresas que vienen a hacer **un trabajo puntual** (obra, mantenimiento, instalación). No se mezcla con la homologación: tiene su propia página, sus propias hojas y su propia pestaña en el panel.

**Quién hace qué**

| Quién | Qué hace |
|---|---|
| **Responsable de sede** (rol *Solicitante*, por ejemplo «Mantenimiento Norte») | Entra al panel con su clave y registra el trabajo: empresa (RUC), trabajo, lugar, fechas (máximo 90 días) y actividades. Puede editarlo antes de que se envíe, o anularlo. Solo ve sus trabajos; no ve inducciones, homologación ni vetos. |
| **Empresa contratista** | Recibe un correo con el enlace. Entra con su RUC y un código, indica su supervisor, sube los documentos, registra a su personal y envía a revisión. No puede crear trabajos. |
| **SSOMA de la sede** | Califica cada ítem. Todo cumple (o no aplica) → **Autorizado**; algún «No cumple» → **Observado** (la empresa corrige y reenvía). |

- El **nivel de riesgo** es el más alto de las actividades marcadas. Se piden los requisitos de ese nivel y de los inferiores, más los de cada actividad crítica.
- Los documentos con vencimiento deben estar vigentes **hasta el último día del trabajo**.
- El personal autorizado queda **habilitado solo entre la fecha de inicio y fin**, si tiene la inducción de contratista vigente. Si el trabajo se anula, deja de habilitar.
- El responsable recibe copia de los avisos (envío a revisión y resultado).

**Usuarios:** en la hoja **Usuarios** se crean tres responsables de ejemplo (Mantenimiento Norte, Sur y Centro) con rol **Solicitante**. Agrega una fila por cada responsable real (nombre, sede, rol *Solicitante*, clave, correo).
Si ya tenías la plataforma instalada, agrégalos a mano. Revisa también en **Configuración** la *Dirección web de la plataforma* (va en el correo a la empresa).

Actividades y requisitos se editan en las hojas **Trabajos - Actividades** (actividad y nivel Bajo/Medio/Alto) y **Trabajos - Requisitos**
(ítem, requisito, documento, nivel o actividades separadas por punto y coma, si pide vencimiento, activo).

## Inducción (contratistas, visitantes y transportistas)

La persona elige primero **cómo ingresa**:

| Tipo | Datos que pide | Para estar habilitado |
|---|---|---|
| Contratista | RUC de la empresa, cargo, área, sede | Inducción + empresa homologada **o** autorización de trabajo vigente |
| Visitante | Empresa o institución, a quién visita, sede | Solo la inducción |
| Transportista | Empresa de transporte, placa, licencia, sede | Solo la inducción |

Cada tipo tiene su propio **video, número de preguntas, nota mínima y vigencia** en la hoja **Tipos de ingreso**, y sus propias preguntas en la hoja **Preguntas**
(columna «Tipo de ingreso»; vacío = contratista). Se incluyen 8 preguntas modelo para visitantes y 8 para transportistas: revísalas y ajústalas a tus normas (por ejemplo, la velocidad máxima en patio).
Si el RUC ya está registrado en homologación, la razón social se completa sola.

## Personal habilitado

- **Contratista:** inducción vigente + (empresa homologada vigente **o** incluido en una autorización de trabajo vigente hoy) + sin veto.
- **Visitante / transportista:** inducción vigente + sin veto.

Está habilitada **hasta la fecha que venza primero** (inducción, homologación o fin del trabajo autorizado). Se consulta en **Panel → Personal habilitado** (filtros por sede, empresa y estado; exportable a Excel), en el expediente de cada empresa y en **Verificar trabajador** (QR del certificado o DNI) en vigilancia.

## Personal vetado

- Cualquier sede puede vetar desde **Panel → Vetados** (o con el botón *Vetar* en Personal habilitado): DNI, nombre, empresa, motivo interno y fecha límite opcional (vacía = permanente).
- El veto aplica en **todo el grupo**. La persona no puede rendir la inducción ni figura como habilitada.
- Lo que ve el trabajador o vigilancia es solo «No habilitado. Comunícate con el área SSOMA.»; el motivo queda interno.
- Si una persona vetada intenta registrarse, la sede que la vetó recibe un correo de alerta.
- Solo la sede que vetó o el administrador pueden **levantar** el veto, indicando el motivo. Queda el historial completo en la hoja **Vetados**.

## Hojas de la Google Sheet

| Hoja | Contenido |
|---|---|
| Usuarios | Claves del panel: administrador, SSOMA de cada sede y responsables de sede (Solicitante) |
| Tipos de ingreso | Video, preguntas, nota y vigencia para contratista, visitante y transportista |
| Registros | Inducciones (tipo, nota, vencimiento, RUC, sede, placa, enlace al PDF) |
| Preguntas | Banco de preguntas del examen |
| Configuración | Video, nota mínima, sedes, correo SSOMA, vigencias |
| Vetados | Vetos activos, vencidos y levantados (con historial) |
| Clientes | Clientes que exigen requisitos adicionales |
| Homologación - Empresas | Empresas, sedes, estado, puntaje, vencimiento y motivo |
| Homologación - Requisitos | Lista de verificación base y requisitos por cliente |
| Homologación - Archivos | Documentos subidos (enlace a Drive y fecha de vencimiento) |
| Homologación - Evaluación | Calificación por ítem, observaciones y evaluador |
| Homologación - Accesos | Códigos y sesiones de ambos trámites (oculta, no editar) |
| Trabajos - Empresas | Empresas registradas para trabajos puntuales |
| Trabajos - Solicitudes | Cada solicitud: sede, fechas, actividades, nivel de riesgo, estado |
| Trabajos - Personal | Personal incluido en cada solicitud |
| Trabajos - Actividades | Catálogo de actividades y su nivel de riesgo |
| Trabajos - Requisitos | Requisitos por nivel y por actividad |
| Trabajos - Archivos / Evaluación | Documentos subidos y calificación por ítem |

## Límites gratuitos

- Correos: 100 por día con Gmail (códigos, avisos, resultados y certificados).
- Archivos: 10 MB cada uno; Drive gratuito tiene 15 GB.

## Almacenamiento: Google Drive + Google Sheet (sin Supabase ni AWS, costo cero)

Mismo esquema que la plataforma de Compras de Friopacking:

```
Navegador (GitHub Pages)  ──POST text/plain──▶  Apps Script /exec (corre "como Yo")
                                                   ├─ Google Sheet  → registros (empresas, inducciones, evaluaciones, enlaces)
                                                   └─ Google Drive  → archivos (PDF, imágenes, Word, Excel)
```

Árbol que se crea solo en el Drive del dueño:

```
Friotrack/
  Certificados de inducción/                       PDF de cada certificado
  Homologación de contratistas/
    20123456789 - EMPRESA SAC/
      2.1 - SCTR Salud/   2.1 - poliza.pdf
  Autorizaciones de trabajos en sede/
    T-0001 - EMPRESA SAC/   1.1 - ats.pdf
```

- Ningún token de Google va en el navegador; solo la URL `/exec`.
- Cada subida usa `LockService` (dos personas a la vez no duplican carpetas ni filas) y no se duplica si ya existe un archivo con el mismo nombre y peso.
- Usa la cuenta con más espacio (Workspace / Google One). Límite práctico: 10 MB por archivo, ~6 min por llamada, 100 correos/día en Gmail.
- Para que SSOMA abra los enlaces, comparte la carpeta **Friotrack** con el equipo o el dominio; no la hagas pública.
- Instalaciones previas: las carpetas ya creadas siguen funcionando (sus IDs están en la hoja Configuración).
