# Padlock – Generador de contraseñas seguras

[English](README.md) · [Português (Brasil)](README.pt-BR.md) · **Español**

Una extensión de Chrome (Manifest V3), escrita en TypeScript, que genera contraseñas aleatorias
fuertes íntegramente en tu dispositivo.

## Características

- **Aleatoriedad criptográficamente segura** – cada carácter procede de `crypto.getRandomValues`;
  `Math.random` no se usa nunca.
- **Sin sesgo de módulo** – los enteros aleatorios usan muestreo por rechazo (`src/core/random.ts`).
- **Salida uniforme** – las contraseñas se eligen de forma uniforme entre todas las cadenas que
  contienen al menos un carácter de cada tipo seleccionado (muestreo por rechazo, y no "insertar uno de
  cada tipo y mezclar"), por lo que no hay sesgo de posición.
- **Entropía exacta** – el medidor de fortaleza muestra la entropía real en bits, calculada por
  inclusión–exclusión sobre los tipos seleccionados (`src/core/entropy.ts`).
- **Opciones** – longitud de 4 a 128, minúsculas / mayúsculas / dígitos / símbolos, eliminación
  opcional de caracteres parecidos (`0 O 1 l I |`) y una lista personalizada de caracteres excluidos.
- **Insertar en una página** – haz clic derecho en cualquier campo de texto y elige _Insertar
  contraseña segura_.
- **Borrado automático del portapapeles** (opcional) – borra el portapapeles entre 30 s y 2 min
  después de copiar, pero solo si todavía contiene la contraseña copiada.
- **Historial de contraseñas** (opcional, desactivado por defecto) – cuando se activa en el popup, un
  botón _Historial_ muestra las últimas 50 contraseñas generadas, de la más reciente a la más antigua,
  cada una con su fecha y hora y un botón para copiar. Consulta [Historial](#historial) para saber qué
  se registra y dónde se guarda.
- **Popup amplio** que aprovecha los 640 × 400 px completos que puede tener el popup de una extensión:
  la contraseña y su fortaleza a la izquierda, todas las opciones a la derecha, sin desplazamiento en
  la vista del generador.
- **Localizada** en inglés (EE. UU.), portugués de Brasil y español. La extensión sigue
  automáticamente el idioma de la interfaz del navegador; cualquier otro idioma usa el inglés.
  Consulta [Localización](#localización).
- **Tema claro / oscuro**, accesible con el teclado, sin acceso a la red y sin analíticas.
- Abre el popup con `Ctrl+Shift+Y` (`Command+Shift+Y` en macOS); cambia el atajo en
  `chrome://extensions/shortcuts`.

## Instalación (desde el código fuente)

Requiere Node.js 20.12 o posterior.

```bash
npm install
npm run build
```

Después abre `chrome://extensions`, activa el **Modo de desarrollador**, haz clic en **Cargar
descomprimida** y selecciona la carpeta `dist/`.

## Desarrollo

| Comando             | Finalidad                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run build`     | Compilación de producción en `dist/`: JS, HTML, CSS y JSON minificados    |
| `npm run package`   | Compila, verifica y comprime en `release/padlock-<versión>.zip`           |
| `npm run watch`     | Recompila al detectar cambios (sin minificar, con source maps integrados) |
| `npm run typecheck` | Ejecuta `tsc --noEmit` en modo estricto                                   |
| `npm test`          | Ejecuta las pruebas unitarias (Vitest)                                    |
| `npm run icons`     | Regenera `public/icons/*.png` (generador sin dependencias)                |
| `npm run check`     | Comprueba los tipos, ejecuta las pruebas y compila                        |

Después de recompilar, pulsa el botón de recargar en la tarjeta de la extensión en
`chrome://extensions`.

### Estructura del proyecto

```
public/                 Archivos estáticos copiados a dist/ (manifest, HTML, CSS, iconos)
public/_locales/        Traducciones: en_US (predeterminado), pt_BR y es
scripts/                Herramientas de compilación: build, package, minify, zip y generador de iconos
src/core/               Lógica pura, sin DOM: random, charsets, generator, entropy
src/shared/             Ajustes, historial, helper de i18n, tipos de mensaje, helper de hash
src/popup/              Interfaz del popup
src/background/         Service worker: menú contextual, temporizador de borrado del portapapeles
src/offscreen/          Documento offscreen que borra el portapapeles
tests/                  Pruebas unitarias Vitest de core/, ajustes, historial e idiomas
```

## Notas de diseño

### ¿Por qué muestreo por rechazo para toda la contraseña?

El enfoque habitual, "elegir un carácter de cada tipo, rellenar el resto y mezclar", produce una
distribución que no es uniforme entre las contraseñas válidas, lo que dificulta indicar la entropía
real. Padlock, en cambio, elige cada posición de forma uniforme a partir del conjunto combinado y lo
reintenta si falta algún tipo seleccionado. El resultado es exactamente uniforme entre las cadenas
válidas, y la entropía es `log2(N)` con `N` calculado de forma exacta. El coste de los reintentos es
despreciable (aproximadamente un intento para longitudes normales; unos cien intentos baratos en el
peor caso, con longitud 4).

### Permisos

| Permiso                                          | Motivo                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `storage`                                        | Recordar tus opciones y mantener en memoria el historial opcional             |
| `contextMenus`, `scripting`, `activeTab`         | "Insertar contraseña segura" en el campo sobre el que haces clic derecho      |
| `alarms`, `offscreen`                            | Temporizador y documento auxiliar para el borrado automático del portapapeles |
| `clipboardRead`, `clipboardWrite` _(opcionales)_ | Se solicitan solo cuando activas el borrado automático del portapapeles       |

No se solicita ningún permiso de host. `activeTab` solo concede acceso a la pestaña en la que invocas
el menú contextual, para esa única acción.

### Borrado automático del portapapeles

El popup se cierra en cuanto pierde el foco, así que el temporizador se ejecuta en el service worker.
El worker guarda únicamente un hash SHA-256 de la contraseña copiada en `chrome.storage.session`
(solo en memoria, nunca se escribe en disco). Cuando salta la alarma, un documento offscreen lee el
portapapeles, compara su hash y lo sobrescribe solo si coinciden. Chrome limita las alarmas a un
mínimo de 30 segundos. Si el usuario ha copiado otra cosa mientras tanto, el portapapeles no se toca.

### Historial

Desactivado por defecto. Actívalo con _Mantener un historial de las últimas 50 contraseñas_ en el
popup.

- **Qué se registra:** la contraseña que se muestra al abrir el popup, tras _Regenerar_ y tras cambiar
  una opción. Mientras se arrastra el control deslizante o se escribe en el campo de exclusión, solo
  se registra la contraseña final, no cada una de las intermedias. Las contraseñas insertadas desde el
  menú contextual también se registran. Los duplicados consecutivos se ignoran y solo se conservan las
  50 más recientes.
- **Dónde se guarda:** en `chrome.storage.session`, es decir, solo en la memoria del navegador. Nunca
  se escribe en disco y se borra al cerrar Chrome. Las contraseñas se guardan **sin cifrar** mientras
  Chrome está en ejecución, por lo que cualquiera que pueda inspeccionar la extensión con tu sesión
  del navegador abierta podría leerlas.
- **Eliminación:** _Borrar historial_ elimina todas las entradas, y desactivar la opción borra el
  historial.
- **Persistencia:** para conservar el historial entre reinicios del navegador, cambia `storageArea` en
  `src/shared/history.ts` a `chrome.storage.local`. Eso escribe las contraseñas en texto plano en tu
  perfil, en disco, y por eso no es el comportamiento por defecto.

### Privacidad

Las contraseñas se generan en memoria, se muestran en el popup y se descartan cuando este se cierra, a
menos que actives el historial (véase más arriba). Solo se conservan tus opciones (mediante
`chrome.storage.sync`, de modo que acompañan a tu perfil de Chrome). La extensión no realiza ninguna
solicitud de red.

### Localización

La extensión usa el sistema `chrome.i18n` integrado en Chrome, por lo que el idioma siempre sigue el
idioma de la interfaz del navegador y no requiere ningún ajuste. Chrome elige la mejor coincidencia:
un idioma exacto como `pt_BR`, después el idioma base como `es` y, por último, el idioma
predeterminado `en_US`.

- **Los mensajes** están en `public/_locales/<idioma>/messages.json`. El manifest (nombre,
  descripción, texto emergente del botón de la barra de herramientas, descripción del atajo) usa
  referencias `__MSG_<clave>__`.
- **El texto del popup** se localiza al iniciar con `applyTranslations` en `src/shared/i18n.ts`. El
  HTML conserva su texto en inglés como alternativa y marca los elementos traducibles con
  `data-i18n="clave"`, `data-i18n-title`, `data-i18n-aria-label` o `data-i18n-placeholder`. Los
  mensajes construidos en el código usan `t("clave", sustituciones)`. Las claves de los mensajes se
  comprueban en cuanto a tipos frente a `en_US/messages.json`.
- **El núcleo es neutral respecto al idioma:** el generador informa _códigos_ de error y el módulo de
  entropía informa _niveles_ de fortaleza; el popup convierte ambos en texto localizado.
- **Las fechas** del historial usan el idioma de la interfaz del navegador.
- **Añadir un idioma:** copia `public/_locales/en_US` en una carpeta nueva con el nombre del idioma
  (por ejemplo `fr` o `de`), traduce cada `message` y deja sin cambios los bloques `placeholders`.
  Después añade el nombre de la carpeta a `EXPECTED_LOCALES` en `tests/i18n.test.ts`. Las pruebas
  comprueban que cada idioma tiene las mismas claves y los mismos placeholders que `en_US`, que no
  queda ningún mensaje sin usar y que la descripción de la extensión respeta el límite de 132
  caracteres de la Web Store.
- **Probar un idioma:** inicia Chrome con `--lang=es` (o cambia el idioma en
  `chrome://settings/languages` y reinicia Chrome) y recarga la extensión.

### Documentación del código

Cada función está documentada con [TSDoc](https://tsdoc.org): un resumen de una línea, seguido de
`@param nombre - descripción`, `@returns` y `@throws` cuando corresponda. Los tipos no se repiten en
las etiquetas porque TypeScript ya los proporciona.

### Compilación y empaquetado

`npm run build` siempre genera la compilación de producción, que es la que se distribuye. Solo
`npm run watch` omite la minificación, para que los errores apunten a código legible.

| Tipo de archivo                | Cómo se minifica                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript → JavaScript        | esbuild: empaquetado, minificado, sin source maps, comentarios de licencia eliminados                                                                 |
| `popup.css`                    | minificador de CSS de esbuild                                                                                                                         |
| `popup.html`, `offscreen.html` | `scripts/minify.mjs`: comentarios eliminados y espacios reducidos; los atributos entre comillas y el contenido de `<script>`/`<textarea>` no se tocan |
| `manifest.json`                | JSON compacto, con la versión tomada de `package.json`                                                                                                |
| `_locales/*/messages.json`     | JSON compacto, sin las notas `description` y `example`, que solo sirven a los traductores                                                             |
| Iconos                         | Se copian tal cual                                                                                                                                    |

A continuación, `npm run package` verifica la compilación y escribe el archivo para subir a la Web
Store en `release/padlock-<versión>.zip` (reproducible: las mismas fuentes dan los mismos bytes). Se
detiene con un error si el manifest hace referencia a un archivo inexistente, si se han colado source
maps u otros archivos de desarrollo, si una página HTML tiene un script en línea o si el JavaScript
empaquetado contiene `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `new Function` o una URL
`http(s)://`.

### Seguridad

- **Sin red, por construcción.** La política de seguridad de contenido bloquea toda solicitud
  (`connect-src 'none'`), los plugins, los cambios de URL base y los envíos de formularios, y solo
  permite scripts empaquetados con la extensión. La verificación del paquete descrita arriba rechaza
  el código de red y `eval`.
- **Sin acceso a sitios.** El manifest no declara permisos de host, content scripts ni recursos
  accesibles desde la web. `activeTab` da acceso a una sola pestaña, y solo después de que el usuario
  haga clic en el elemento del menú contextual.
- **Gestión estricta de mensajes.** El service worker acepta mensajes de runtime solo de esta
  extensión y valida su forma, el formato del hash y el retardo frente a los valores que ofrece la
  interfaz.
- **Secretos solo en memoria.** El historial y el hash del portapapeles viven en
  `chrome.storage.session`, limitado a contextos de confianza de la extensión y nunca escrito en
  disco.
- **Actualizaciones seguras del DOM.** El código nunca usa `innerHTML`; el texto entra con
  `textContent`.
- **Pruebas de protección.** `tests/manifest.test.ts` falla si se añade un permiso sin la
  justificación correspondiente en `docs/chrome-web-store.md`, o si el manifest obtiene acceso a
  sitios o una política más débil.
- **Dependencias.** `npm audit` no informa de vulnerabilidades conocidas, y la extensión no incluye
  dependencias de runtime: todo lo que se empaqueta es código de este repositorio.

### Publicación

Estos documentos están en inglés, el idioma que usa la Chrome Web Store.

- [docs/chrome-web-store.md](docs/chrome-web-store.md): respuestas para la pestaña _Prácticas de
  privacidad_ de la Chrome Web Store (propósito único y justificaciones de los permisos).
- [docs/privacy-policy.md](docs/privacy-policy.md): la política de privacidad. La tienda exige que
  esté en una URL pública. Actualízala antes de publicar cualquier cambio en lo que la extensión
  almacena o transmite.

## Limitaciones

- Solo contraseñas de caracteres aleatorios; no hay modo de frase de contraseña (passphrase).
- "Insertar contraseña segura" rellena únicamente el campo que tiene el foco. No rellena un campo de
  "confirmar contraseña"; copia la contraseña y pégala allí.
- La extensión no es un gestor de contraseñas. El historial opcional es una comodidad de corta
  duración, no un almacenamiento; guarda las contraseñas importantes en un gestor de contraseñas.
