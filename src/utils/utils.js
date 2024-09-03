import { addKeyword } from '@builderbot/bot';
import fs from 'fs';
import mime from 'mime-types';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

import logger from './logger.js'
const ADMIN_NUMBER = process.env.ADMIN_NUMBER

const catch_error = (error) => {
    if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        if (error.response.status === 404) {
            //console.log('Recurso no encontrado (Error 404).');
            logger.warn('Recurso no encontrado (Error 404).', { 'error': error })

        } else {
            //console.log(`Error en la respuesta del servidor: ${error.response.status}`);
            logger.error(`Error en la respuesta del servidor: `, { 'error': error })
        }
    } else if (error.request) {
        // La solicitud fue hecha pero no se recibió respuesta
        logger.error('No se recibió respuesta del servidor.', { 'error': error })
        //console.log('No se recibió respuesta del servidor.');
    } else {
        // Algo pasó al configurar la solicitud que lanzó un error
        //console.log('Error en la configuración de la solicitud:', error);
        logger.error('Error en la configuración de la solicitud:', { 'error': error });
    }

}

const numberClean = (raw) => {
    //Mute +3400000 
    const number = raw.toLowerCase().replace('mute', '').replace(/\s/g, '').replace('+', '')
    // 3400000
    return number
}

const blackListFlow = addKeyword('mute')
    .addAction(async (ctx, { blacklist, flowDynamic }) => {
        if (ctx.from === ADMIN_NUMBER) {
            const toMute = numberClean(ctx.body) //Mute +34000000 message incoming
            const check = blacklist.checkIf(toMute)
            if (!check) {
                blacklist.add(toMute)
                await flowDynamic(`❌ ${toMute} muted`)
                return
            }
            blacklist.remove(toMute)
            await flowDynamic(`🆗 ${toMute} unmuted`)
            return
        }
    })

const verificarOCrearCarpeta = (ruta) => {
    return new Promise((resolve, reject) => {
        fs.access(ruta, fs.constants.F_OK, (err) => {
            if (err) {
                // La carpeta no existe, crearla
                fs.mkdir(ruta, { recursive: true }, (err) => {
                    if (err) {
                        logger.error('Error al crear la carpeta: ', { error: err })
                        reject('Error al crear la carpeta: ' + err);
                    } else {
                        logger.error('Carpeta creada correctamente')
                        resolve('Carpeta creada correctamente.');
                    }
                });
            } else {
                // La carpeta existe
                resolve('La carpeta ya existe.');
            }
        });
    });
}

const esHorarioLaboral = () => {
    const fecha = new Date();
    const hora_inicio = Number(process.env.H_INICIO ?? 8);
    const hora_salida = Number(process.env.H_SALIDA ?? 16);
    const inicio_semana = Number(process.env.S_LABORAL_INICIO ?? 1);
    const final_semana = Number(process.env.S_LABORAL_FINAL ?? 5);
    const diaActual = fecha.getDay();
    const horaActual = fecha.getHours();
    console.log(`dia de la semana: ${diaActual}, hora actual${fecha.toString()} `)
    const esDiaLaboral = diaActual >= inicio_semana && diaActual <= final_semana
    const esHoraLaboral = horaActual >= hora_inicio && horaActual <= hora_salida
    //console.log('es hora laboral y dia', esHoraLaboral, esDiaLaboral)
    //console.log('Configuración:', { hora_inicio, hora_salida, inicio_semana, final_semana });
    //console.log('Fecha actual:', fecha.toString());
    return esHoraLaboral && esDiaLaboral ? true : false
}

const getExtensionFromMime = (mimeType) => {
    const extension = mime.extension(mimeType);
    //console.log(`MIME type: ${mimeType}, Extension: ${extension}`);
    return extension || 'bin';  // 'bin' como fallback si no se encuentra una extensión
}

const getMimeWB = (messages) => {
    for (let key in messages) {
        if (key.endsWith('Message')) {
            //console.log(`El mensaje es de tipo: ${key}`);
            return key;
        }
    }
    //console.log('Tipo de mensaje no reconocido');
    return null;
}
const saveMediaWB = async (payload) => {
    const fecha = new Date();
    let attachment = [];
    let caption = "";
    let msg = "";
    const mime = findMimeType(payload);

    console.log('mensaje capturado con el provider: ',);
    if (payload?.body.includes('_event_') || mime) {
        const mimeType = mime.split("/")[0];
        console.log('saveMedia', mime);
        if (mimeType !== 'audio' && mimeType !== 'video') {
            //console.log('Procesando archivo no audio/video', JSON.stringify(payload.body));
            const extension = getExtensionFromMime(mime);
            caption = findCaption(payload)
            try {
                msg = caption || "Archivo adjunto sin mensaje";
                console.log('caption', caption, msg)
                const nombre = procesarNombreArchivo(msg);

                let filename = nombre.toLocaleLowerCase() || 'file';
                const buffer = await downloadMediaMessage(payload, "buffer");
                const fileName = `${payload.from}_${filename}_${Date.now()}.${extension}`;
                const docsDir = `${process.cwd()}/public/docs/${fecha.getFullYear()}/${fecha.getMonth()}`;
                await verificarOCrearCarpeta(docsDir);
                const pathFile = `${docsDir}/${fileName}`;
                //console.log(pathFile)
                await fs.promises.writeFile(pathFile, buffer);
                //console.log('Archivo guardado correctamente en:', pathFile, saved);
                attachment.push(pathFile);
            } catch (error) {
                logger.error('Error al procesar el archivo:', { 'error': error })
                //console.error('Error al procesar el archivo:', error);
                msg = "Hubo un error al procesar el archivo adjunto.";
            }
        } else {
            //console.log('Archivo de audio o video no permitido');
            msg = "El usuario intento enviar de audios, notas de voz o videos.";
        }
    } else {
        //console.log('msg without attachments')
        msg = payload?.body;
    }

    return [msg, attachment]
}

const procesarNombreArchivo = (msg) => {
    // Primero, dividimos el nombre y la extensión (si existe)
    const lastDotIndex = msg.lastIndexOf('.');
    let nombre;

    if (lastDotIndex !== -1) {
        nombre = msg.slice(0, lastDotIndex);
        //extension = msg.slice(lastDotIndex + 1);
    } else {
        nombre = msg;
        //extension = null;
    }

    // Reemplazamos espacios por guiones bajos en el nombre
    nombre = nombre.replace(/ /g, '_');

    return nombre;
};

const extractMimeWb = (payload) => {
    const mime = findMimeType(payload);
    let extracted_mime = mime ? getExtensionFromMime(mime) : null;
    //console.log('mime type: ', mime, extracted_mime);
    return extracted_mime;
};

const findMimeType = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }

    if (obj.mimetype) {
        return obj.mimetype;
    }

    for (let key in obj) {
        const result = findMimeType(obj[key]);
        if (result) {
            return result;
        }
    }

    return null;
};

const findMyData = (obj, keyToLook) => {
    // Si obj no es un objeto o es null, retornamos null
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }
    // Si la clave buscada existe directamente en el objeto, retornamos su valor
    if (keyToLook in obj) {
        return obj[keyToLook];
    }

    // Buscamos recursivamente en las propiedades del objeto
    for (let key in obj) {
        const result = findMyData(obj[key], keyToLook);
        if (result !== null) {
            return result;
        }
    }
    //logger.info(`No se encontró la clave ${keyToLook} en el objeto ${Date.now()}`)
    // Si no se encuentra la clave, retornamos null
    return null;
}

const findCaption = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }

    if (obj.caption) {
        return obj.caption;
    }

    for (let key in obj) {
        const result = findCaption(obj[key]);
        if (result) {
            return result;
        }
    }

    return null;
}
export { catch_error, numberClean, blackListFlow, verificarOCrearCarpeta, esHorarioLaboral, getExtensionFromMime, getMimeWB, saveMediaWB, extractMimeWb, findMyData };