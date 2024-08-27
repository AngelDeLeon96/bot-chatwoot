import path from 'path';
import fs from 'fs/promises';
const umbralPorDefecto = 2;
const DICCIONARIO_PATH = path.join(process.cwd(), 'src/utils/detector/bads_words.json');
console.log(DICCIONARIO_PATH)


async function cargarDiccionario() {
    try {
        const data = await fs.readFile(DICCIONARIO_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error al cargar el diccionario:', error);
        return {};
    }
}



function limpiarTexto(texto) {
    return texto.toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export async function crearDetectorPalabrasOfensivas(umbral = umbralPorDefecto) {
    let diccionario = await cargarDiccionario();
    //console.log(diccionario);

    const detector = async function detectarOfensas(mensaje) {
        const mensajeLimpio = limpiarTexto(mensaje);
        const palabras = mensajeLimpio.split(/\s+/);

        let puntajeTotal = 0;
        const palabrasDetectadas = [];

        for (const palabra of palabras) {
            if (Object.prototype.hasOwnProperty.call(diccionario, palabra)) {
                puntajeTotal += diccionario[palabra];
                palabrasDetectadas.push(palabra);
            }
        }

        const esOfensivo = puntajeTotal > umbral;
        const mensajeEtiquetado = esOfensivo
            ? `Posibles faltas de respeto en el siguiente mensaje: ${mensaje}`
            : mensaje;
        console.log('res')
        return {
            esOfensivo,
            puntajeTotal,
            palabrasDetectadas,
            mensajeOriginal: mensaje,
            mensajeEtiquetado
        };
    };

    return detector;
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