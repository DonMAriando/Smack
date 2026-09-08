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

Lo que hay que pegarle viene con **púas y en rojo**; lo que hay que dejar
pasar viene **redondo y en verde**. La forma es lo que se lee rápido y de
reojo, el color es refuerzo y el ícono es la verdad. Cada mecánica tiene además
su color propio alrededor de la cáscara, y no se repite ninguno.

| | |
|---|---|
| Normales | un toque |
| 🛡️ Blindados | arcos blancos: tres toques rápidos |
| ↩️ Deslizables | galones amarillos: arrastralos por donde vinieron; durante el boss pegan el triple |
| 🎭 Disfrazados | aro violeta punteado: la cáscara miente, el ícono dice la verdad |

El aro del disfrazado avisa que ese objeto miente, y eso es a propósito. Si el
disfraz fuera invisible, saber que existe te obligaría a desconfiar de todos
los objetos y el canal rápido dejaría de servir en toda la partida. Marcado, la
desconfianza dura lo que dura ese objeto.

## Desafiar a un amigo

Al terminar un desafío del día aparece **⚔️ DESAFIAR A UN AMIGO**, que comparte
un link con tu puntaje adentro. El que lo abre ve cuánto tiene que superar y,
al terminar su partida, si te ganó o por cuánto le faltó.

No hay servidor y no hace falta: como la semilla del día sale de la fecha, los
dos juegan exactamente la misma secuencia, así que el puntaje puede viajar en
el link y la comparación se resuelve en el teléfono de cada uno. Sin cuentas y
sin datos personales.

Lo que **no** es: una tabla de posiciones confiable. Cualquiera puede editar el
link y ponerse el puntaje que quiera. La suma de control detecta un link
cortado o roto por el chat, no a alguien que miente a propósito. Una tabla
global de verdad necesita un servidor que valide, y eso es una decisión de
infraestructura que todavía no tomamos.

## Sonido

No hay ni un archivo de audio. Los golpes y la música se generan con WebAudio
en el momento. La música es un secuenciador de semicorcheas y suma capas según
la intensidad: pulso solo, contratiempo, bajo, y melodía con redoblante en el
FEVER y en el boss, que además baja la tónica un tono.

## Progresión

El puntaje de cada partida se acumula como experiencia y desbloquea objetos
nuevos, colores de pelo y títulos. Cada partida trae tres misiones cortas que
dan experiencia extra.

## Ejecutar

Hay dos formas.

**Servido por HTTP**, que es la de desarrollo:

```
npx http-server . -p 8123 -c-1
```

Y abrilo en `http://localhost:8123`. Para probar en el celular, entrá desde el
teléfono a la IP de la máquina en la misma red.

**Un solo archivo**, `dist/index.html`, que se abre con doble clic:

```
node scripts/build.mjs
```

El `index.html` de la raíz **no** funciona con doble clic: usa módulos ES, y el
navegador los bloquea desde `file://` por CORS. Si lo intentás, el juego avisa
en pantalla en vez de quedarse mudo. Esa es también la razón de que exista
`dist/`: para subir a itch.io conviene un ZIP con `index.html` en la raíz.

Sin dependencias en runtime. Los iconos se regeneran con
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
