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
- **Localizada en 30 idiomas**, los de más hablantes nativos más el polaco: inglés, chino (simplificado
  y tradicional), español, hindi, bengalí, portugués (Brasil), ruso, japonés, panyabí, maratí, telugu,
  turco, coreano, francés, alemán, vietnamita, tamil, urdu, javanés, italiano, árabe, guyaratí, persa,
  bhoyapurí, hausa, canarés, indonesio, polaco, malayalam y ucraniano. La extensión sigue
  automáticamente el idioma del navegador, o puedes elegir otro en los ajustes. El árabe, el persa y el
  urdu invierten el diseño (de derecha a izquierda). Consulta [Localización](#localización).
- **Pantalla de ajustes** (botón de engranaje): idioma, tema claro / oscuro / del sistema, borrado
  automático del portapapeles, historial de contraseñas, entrada del menú contextual y desenfoque de
  las contraseñas hasta pasar el ratón. Un botón restaura los valores predeterminados.
- **Pantalla Acerca de** (botón de GitHub): versión, autor, licencia, declaración de privacidad y un
  enlace al [código fuente en GitHub](https://github.com/mgnischor/chrome-padlock).
- Accesible con el teclado, sin acceso a la red y sin analíticas.
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
src/locales/            Traducciones, un archivo JSON por idioma (en_US es el origen)
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
menos que actives el historial (véase más arriba). Solo se conservan tus ajustes (mediante
`chrome.storage.sync`, de modo que acompañan a tu perfil de Chrome): las opciones del generador, el
idioma, el tema y los demás interruptores. La extensión no realiza ninguna solicitud de red. El único
enlace que contiene, a la página del proyecto en GitHub en la pantalla Acerca de, se abre en una
pestaña nueva y solo si haces clic en él.

### Localización

El popup y el menú contextual están traducidos a 30 idiomas. De forma predeterminada el idioma sigue el
idioma de la interfaz del navegador, y los ajustes permiten elegir otro, algo que `chrome.i18n` no
puede hacer. Por eso las traducciones van empaquetadas en la propia extensión y las consulta
`src/shared/i18n.ts`, con el mismo formato de mensaje que Chrome (marcadores `$1` y `$NOMBRE$`). Los
idiomas del navegador se asocian a la traducción más cercana: `pt-PT` usa portugués de Brasil, `es-419`
usa español, `zh-TW`/`zh-HK` usan chino tradicional, cualquier otro chino usa el simplificado, y el
resto recurre al inglés.

- **Los mensajes** están en `src/locales/<código>.json`, en el formato del `messages.json` de Chrome.
  El inglés (`en_US`) es el origen; los demás archivos deben definir las mismas claves y marcadores.
- **Los textos del propio Chrome** (nombre, descripción, texto emergente de la barra de herramientas,
  descripción del atajo) proceden de `_locales`. La compilación genera esas carpetas a partir de
  `src/locales`, pero solo para los 26 idiomas que Chrome admite. El panyabí, el urdu, el javanés, el
  bhoyapurí y el hausa no existen como idioma de la interfaz de Chrome, así que la ficha de la tienda y
  la página de extensiones muestran inglés para ellos. La extensión en sí está totalmente traducida.
- **El texto del popup** se localiza al iniciar, y de nuevo cada vez que cambia el idioma, con
  `applyTranslations`. El HTML conserva su texto en inglés como alternativa y marca los elementos
  traducibles con `data-i18n="clave"`, `data-i18n-title`, `data-i18n-aria-label` o
  `data-i18n-placeholder`. Los mensajes construidos en el código usan `t("clave", sustituciones)`. Las
  claves se comprueban en cuanto a tipos frente a `en_US.json`, y `src/shared/catalog.ts` está tipado
  de modo que un idioma al que le falte un mensaje no compila.
- **El núcleo es neutral respecto al idioma:** el generador informa _códigos_ de error y el módulo de
  entropía informa _niveles_ de fortaleza; el popup convierte ambos en texto localizado.
- **Los idiomas de derecha a izquierda** (árabe, persa, urdu) ponen `dir="rtl"` en la página. Las
  contraseñas, las pistas de caracteres y los campos numéricos siguen siempre de izquierda a derecha.
- **Las fechas** del historial usan el idioma activo.
- **Añadir un idioma:** copia `src/locales/en_US.json` en `src/locales/<código>.json` y traduce cada
  `message` (deja los bloques `placeholders` como están); añade una entrada a `LOCALES` en
  `src/shared/locales.ts` (código, nombre en ese idioma, etiqueta de idioma, dirección); añade la
  importación y la entrada en `src/shared/catalog.ts`. Si Chrome admite el idioma como idioma de la
  interfaz, añade también su código a `MANIFEST_LOCALES` en `scripts/manifest-locales.mjs`. Las
  pruebas comprueban entonces que el archivo nuevo tiene las mismas claves y marcadores que el inglés,
  que está traducido y no es una copia, que no queda ningún mensaje sin usar y que la descripción
  respeta el límite de 132 caracteres de la Web Store.
- **Probar un idioma:** elígelo en los ajustes, o inicia Chrome con `--lang=es` para probar la
  elección automática.

### Apariencia y ajustes

El ajuste de tema es _Predeterminado del sistema_, _Claro_ u _Oscuro_. Se aplica mediante un atributo
`data-theme` en la página, de modo que los colores son variables CSS normales en `public/popup.css`. El
popup permanece oculto hasta que se aplican el idioma y el tema guardados, para que ninguno de los dos
parpadee al abrir. Los ajustes se validan al leerlos (`sanitizeSettings`), así que un idioma o tema
desconocido en el almacenamiento vuelve al valor predeterminado en lugar de romper el popup.

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
| `src/locales/*.json`           | Empaquetados en el JavaScript sin las notas `description` y `example`, que solo sirven a los traductores, en UTF-8 y no en escapes `\u`               |
| `_locales/*/messages.json`     | Generados: solo los cinco mensajes del manifest, JSON compacto, para los 26 idiomas que Chrome admite                                                 |
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

- [docs/privacy-policy.md](docs/privacy-policy.md): la política de privacidad. La tienda exige que
  esté en una URL pública. Actualízala antes de publicar cualquier cambio en lo que la extensión
  almacena o transmite.

## Limitaciones

- Solo contraseñas de caracteres aleatorios; no hay modo de frase de contraseña (passphrase).
- "Insertar contraseña segura" rellena únicamente el campo que tiene el foco. No rellena un campo de
  "confirmar contraseña"; copia la contraseña y pégala allí.
- La extensión no es un gestor de contraseñas. El historial opcional es una comodidad de corta
  duración, no un almacenamiento; guarda las contraseñas importantes en un gestor de contraseñas.
