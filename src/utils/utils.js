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
        logger.info('No se recibió respuesta del servidor.', { 'error': error })
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
                        reject('Error al crear la carpeta: ' + err);
                    } else {
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

const esHorarioLaboral = (fecha) => {
    const hora_inicio = process.env.H_INICIO ?? 8;
    const hora_salida = process.env.H_SALIDA ?? 16;

    const inicio_semana = process.env.S_LABORAL_INICIO ?? 1
    const final_semana = process.env.S_LABORAL_FINAL ?? 5

    const diaActual = fecha.getDay();
    const horaActual = fecha.getHours();
    const esDiaLaboral = diaActual >= inicio_semana && diaActual <= final_semana
    const esHoraLaboral = horaActual >= hora_inicio && horaActual <= hora_salida
    //console.log(esDiaLaboral, esHoraLaboral)
    //console.log(hora_inicio, hora_salida, horaActual)
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
    let attachment = [];
    let caption = "";
    let msg = "";
    const mime = payload?.message?.imageMessage?.mimetype ??
        payload?.message?.videoMessage?.mimetype ??
        payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype ??
        payload?.message?.audioMessage?.mimetype;
    //console.log('mensaje capturado con el provider: ');
    if (payload?.body.includes('_event_') || mime) {
        const mimeType = mime.split("/")[0];

        if (mimeType !== 'audio' && mimeType !== 'video') {
            //console.log('Procesando archivo no audio/video', JSON.stringify(payload.body));
            const extension = getExtensionFromMime(mime);

            if (mimeType === 'image') {
                caption = payload?.message?.imageMessage?.caption;
            } else {
                caption = payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.caption;
            }
            try {
                msg = caption || "Archivo adjunto sin mensaje";
                let [nombre, extension2] = msg.includes('.')
                    ? msg.split(/\.(?=[^.]+$)/)
                    : [msg.replace(/ /g, '_'), null];
                let filename = nombre.toLocaleLowerCase() || 'file';
                const buffer = await downloadMediaMessage(payload, "buffer");
                const fileName = `${filename}_${Date.now()}.${extension}`;
                const docsDir = `${process.cwd()}/public/docs`;
                await verificarOCrearCarpeta(docsDir);
                const pathFile = `${docsDir}/${fileName}`;
                //console.log(pathFile)
                fs.promises.writeFile(pathFile, buffer);
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

export { catch_error, numberClean, blackListFlow, verificarOCrearCarpeta, esHorarioLaboral, getExtensionFromMime, getMimeWB, saveMediaWB };