// detector-palabras-ofensivas.js

const palabrasProhibidasPorDefecto = {
    'xuxa': 5,
    'chucha': 5,
    'puta': 3,
    'hp': 2,
    'jodete': 4,
    'verga': 5,
    'perra': 6,
    'imbecil': 3,
    'retrasada': 5,

    // Añade más palabras y sus puntajes
};

const umbralPorDefecto = 5;

function limpiarTexto(texto) {
    return texto.toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export function crearDetectorPalabrasOfensivas(
    palabrasProhibidas = palabrasProhibidasPorDefecto,
    umbral = umbralPorDefecto
) {
    return function detectarOfensas(mensaje) {
        const mensajeLimpio = limpiarTexto(mensaje);
        const palabras = mensajeLimpio.split(/\s+/);

        let puntajeTotal = 0;
        const palabrasDetectadas = [];

        for (const palabra of palabras) {
            if (Object.prototype.hasOwnProperty.call(palabrasProhibidas, palabra)) {
                puntajeTotal += palabrasProhibidas[palabra];
                palabrasDetectadas.push(palabra);
            }
        }

        const esOfensivo = puntajeTotal >= umbral;

        return { esOfensivo, puntajeTotal, palabrasDetectadas };
    };
}

// Ejemplo de uso (puedes incluirlo en un archivo separado):
/*
import { crearDetectorPalabrasOfensivas } from './detector-palabras-ofensivas.js';

const detectarOfensas = crearDetectorPalabrasOfensivas();

const mensajeUsuario = "Eres un gran insulto1 y también un insulto2";
const resultado = detectarOfensas(mensajeUsuario);

console.log(`¿Es ofensivo?: ${resultado.esOfensivo}`);
console.log(`Puntaje de ofensa: ${resultado.puntajeTotal}`);
console.log(`Palabras ofensivas detectadas: ${resultado.palabrasDetectadas.join(', ')}`);
*/