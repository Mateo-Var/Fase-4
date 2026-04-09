# Lecciones aprendidas — Appium Android (MIUI / React Native)

Este archivo documenta errores cometidos y cómo resolverlos.
**Validar siempre contra estas lecciones antes de generar código de automatización.**

---

## 1. `el.click()` silently fails en MIUI (Xiaomi)

**Error cometido:** Usar `el.click()` o `mobile: clickGesture` para tapear elementos.

**Por qué falla:** MIUI (Xiaomi) mata el GestureController de UiAutomator2. El método retorna sin error pero el tap nunca se registra en la pantalla.

**Solución correcta:**
```js
// NUNCA:
await el.click()
await browser.executeScript('mobile: clickGesture', [{ x, y }])

// SIEMPRE en MIUI:
execSync(`adb -s ${device} shell input tap ${x} ${y}`, { timeout: 5000 })
```

---

## 2. `el.getLocation()` y `el.getSize()` crashean UiAutomator2 en MIUI

**Error cometido:** Usar `tapElement(el)` que llama `el.getLocation()` + `el.getSize()` para calcular el centro del elemento.

**Por qué falla:** La llamada a `/element/{id}/rect` causa que la instrumentación de UiAutomator2 crashee en MIUI. Error típico:
```
'GET /element/.../rect' cannot be proxied to UiAutomator2 server because the
instrumentation process is not running (probably crashed)
```

**Solución correcta:** Extraer `bounds=` directamente del page source XML, sin llamar APIs de elemento:
```js
const src = await browser.getPageSource()
const attrIdx = src.indexOf(`content-desc="${label}"`)
const tagStart = src.lastIndexOf('<', attrIdx)
const tagEnd   = src.indexOf('>', attrIdx)
const tag = src.slice(tagStart, tagEnd + 1)
const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
const x = Math.round((+b[1] + +b[3]) / 2)
const y = Math.round((+b[2] + +b[4]) / 2)
execSync(`adb -s ${device} shell input tap ${x} ${y}`)
```

---

## 3. `getPageSource()` devuelve XML jerárquico, NO formato `<node .../>`

**Error cometido:** Usar regex `/<node[^>]*\/>/g` para parsear el page source de WDIO.

**Por qué falla:** `uiautomator dump` genera `<node ... />` (self-closing, atributo `bounds`).
`getPageSource()` de WDIO genera XML jerárquico con nombres de clase reales.

**Formato correcto de `getPageSource()`:**
```xml
<android.widget.TextView text="Cuenta" bounds="[810,2280][1050,2340]" .../>
<android.view.ViewGroup content-desc="Cuenta" bounds="[810,2133][1080,2355]" ...>
```

**Regex correcto:**
```js
// Para TextViews con texto:
/<android\.widget\.TextView[^>]+>/g

// Para cualquier elemento con atributo específico:
const idx = src.indexOf(`content-desc="${label}"`)
const tag = src.slice(src.lastIndexOf('<', idx), src.indexOf('>', idx) + 1)
```

---

## 4. Los atributos XML pueden estar en cualquier orden

**Error cometido:** Regex que asume orden fijo de atributos:
```js
// MALO — asume que content-desc viene antes que bounds:
/content-desc="Cuenta"[^>]*bounds="\[(\d+)..."/ 
```

**Por qué falla:** Android puede generar los atributos en cualquier orden. El regex no coincide si el orden cambia.

**Solución correcta:** Encontrar el atributo, extraer todo el tag, luego buscar `bounds=` dentro:
```js
const attrIdx = src.indexOf(`content-desc="${label}"`)
const tag = src.slice(src.lastIndexOf('<', attrIdx), src.indexOf('>', attrIdx) + 1)
const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
```

---

## 5. Los tabs del navbar usan `content-desc`, no `text`

**Error cometido:** Buscar tabs con `UiSelector().text("Cuenta")`.

**Por qué falla:** En React Native, los tabs del bottom navbar tienen el label en `content-desc`, no en `text`. El `text` attribute puede estar vacío.

**Solución correcta:** Buscar por `content-desc` primero:
```js
// Selector WDIO:
const el = await $('~Cuenta')  // ~ = content-desc en WDIO

// En page source XML:
src.indexOf(`content-desc="${label}"`)
```

---

## 6. `uiautomator dump` falla durante una sesión Appium activa

**Error cometido:** Llamar `adb shell uiautomator dump` mientras Appium/UiAutomator2 está corriendo.

**Por qué falla:** MIUI mata el proceso secundario de uiautomator cuando la instrumentación principal está activa. Error: `ERROR: could not get idle state`.

**Solución:** Usar `browser.getPageSource()` dentro de la sesión Appium, o correr el dump en `onPrepare` (antes de que empiece la sesión).

---

## 7. Múltiples specs corriendo en paralelo consumen la sesión

**Error cometido:** Tener `tests/specs/debug/tap-test.spec.js` en el glob de specs junto con el login spec.

**Por qué falla:** WDIO lanza ambos en paralelo con `maxInstances: 1`, causando que compitan por la sesión y se interfieran.

**Solución:** Excluir specs de debug en `wdio.android.conf.js`:
```js
exclude: ['./tests/specs/debug/**/*.spec.js']
```

---

## 8. El botón submit puede estar disabled inicialmente (Formik)

**Error cometido:** Tapear el botón submit inmediatamente después de llenar los campos.

**Por qué falla:** Formik con Yup valida el formulario de forma asíncrona. El botón empieza con `enabled="false"` y se habilita cuando la validación pasa.

**Solución:** Verificar `enabled="true"` en el tag antes de tapear, y reintentar:
```js
if (!tag.includes('enabled="true"')) continue  // skip si deshabilitado
// retry loop con hasta 3s de espera
```

---

## 9. Polling necesario — la app puede estar en splash screen

**Error cometido:** Intentar tapear el tab de Menú inmediatamente al iniciar el test.

**Por qué falla:** La app puede estar en la pantalla de splash (logo animado) cuando el test empieza. El navbar aún no existe en el árbol de UI.

**Solución:** Loop con deadline de 30s que reintenta cada 2s hasta que el elemento aparezca:
```js
const deadline = Date.now() + 30000
while (Date.now() < deadline) {
  const src = await browser.getPageSource()
  // buscar elemento...
  await browser.pause(2000)
}
```

---

## 10. Patrón correcto para tap en MIUI (resumen)

```
getPageSource()           → obtener XML de la UI (una sola llamada)
    ↓
src.indexOf(attr)         → encontrar el elemento por texto/content-desc
    ↓
extraer tag completo      → src.slice(lastIndexOf('<'), indexOf('>') + 1)
    ↓
tag.match(/bounds=.../)   → extraer coordenadas del bounds
    ↓
adb shell input tap x y   → tap real que bypasea GestureController
```

**Nunca:** `el.click()` · `el.getLocation()` · `el.getSize()` · `mobile: clickGesture`  
**Siempre:** `getPageSource()` → bounds → `adb shell input tap`
