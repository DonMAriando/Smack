# SMACK!

SMACK! es un mini juego de reacción vertical, pensado primero para celular.

## Cómo jugar

- Tocá los objetos peligrosos antes de que lleguen al personaje.
- No toques los objetos tiernos.
- Tenés 3 vidas.
- El combo x10 activa FEVER x3.
- A los 27 segundos aparece el boss: **Abuela Chancla**.
- Cada partida dura 45 segundos.
- Con una sola vida el tiempo entra en cámara lenta.

## Récords

El juego mide tu latencia real de reacción: el cronómetro de cada objeto
arranca cuando entra en pantalla, no cuando nace fuera del borde. Se guardan en
el dispositivo tu mejor puntaje, tu mejor reacción histórica y tu racha de días
seguidos. Al terminar podés compartir una tarjeta de 1080x1080 con tu reacción.

## Controles

- Celular: tap.
- PC: click.

## Modos

- **Partida libre**: objetos al azar.
- **Desafío del día**: la semilla se deriva de la fecha, así que todos los que
  juegan hoy reciben la misma secuencia de objetos y las mismas misiones. Los
  puntajes son comparables.

## Objetos

| | |
|---|---|
| Normales | un toque |
| 🛡️ Blindados | tres toques rápidos |
| ↩️ Deslizables | arrastralos por donde vinieron; durante el boss pegan el triple |
| 🎭 Disfrazados | el halo de color miente, el ícono dice la verdad |

## Progresión

El puntaje de cada partida se acumula como experiencia y desbloquea objetos
nuevos, colores de pelo y títulos. Cada partida trae tres misiones cortas que
dan experiencia extra.

## Ejecutar

```
npx http-server . -p 8123 -c-1
```

Y abrilo en `http://localhost:8123`. Hace falta servirlo por HTTP porque usa
módulos ES y un service worker, y ninguno de los dos funciona desde `file://`.
Para probar en el celular, entrá desde el teléfono a la IP de la máquina en la
misma red.

Sin dependencias ni paso de build. Los iconos se regeneran con
`node scripts/make-icons.mjs`.

## Instalable

Es una PWA: se puede agregar a la pantalla de inicio y arranca sin conexión.
Para que el navegador ofrezca instalarla hay que servirla por HTTPS.

## Publicar en itch.io

1. Comprimí los archivos con `index.html` en la raíz del ZIP.
2. En itch.io elegí **HTML** como tipo de proyecto.
3. Subí el ZIP.
4. Marcá **This file will be played in the browser**.

## Tecnología

HTML5 + CSS + Canvas + JavaScript + WebAudio. Sin librerías externas.
