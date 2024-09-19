import axios from 'axios';
import { catch_error } from '../utils/utils.js';
import { readFile } from 'fs/promises';

import { releaseLock, acquireLock } from '../utils/in-memory-lock.js';
import logger from '../utils/logger.js';

const SERVER = process.env.SERVER_DOCKER || "http://localhost";
const ACCOUNT_ID = process.env.ACCOUNT_ID ?? 2;
const INBOX_ID = process.env.INBOX_ID ?? 5;
const API = process.env.API;
const PORT = process.env.PORT;
import { getData, setCache, clearCache } from '../utils/cachefn.js';
//console.log('server: ', SERVER, PORT);



const builderURL = (path) => {
    return `${SERVER}/api/v1/accounts/${ACCOUNT_ID}/${path}`
}


//create
const createConversationChatwood = async (msg = "", type = "outgoing", contact_id = 0) => {
    try {
        const myHeaders = new Headers();
        const url = builderURL('conversations')
        myHeaders.append("api_access_token", API);
        myHeaders.append("Content-Type", "application/json");
        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            contact_id: contact_id,
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };

        const dataRaw = await fetch(url, requestOptions);
        const data = await dataRaw.json();
        //console.log('conv created: ', JSON.stringify(data))
        return data.id;
    } catch (err) {
        catch_error(err)
        //return null
    }
}

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0, attachments = []) => {
    try {
        if (!conversation_id) {
            logger.error("ID de conversacion no válido. No se realizará la solicitud.", { id: conversation_id });
            return null; // O podrías devolver un objeto que indique que no se realizó la solicitud
        }
        const url = builderURL(`conversations/${conversation_id}/messages`);
        const form = new FormData();
        form.set("content", msg);
        form.set("message_type", message_type);
        form.set("private", "true");

        if (attachments.length) {
            const fileName = attachments[0].split('/').pop();
            try {
                const fileContent = await readFile(attachments[0]);
                const blob = new Blob([fileContent]);
                form.set("attachments[]", blob, fileName);
            } catch (readFileError) {
                logger.error('Error al leer el archivo adjunto:', readFileError);
                //throw readFileError;
            }
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                api_access_token: API
            },
            body: form
        });

        if (!response.ok) {
            const textResponse = await response.text();
            logger.error('El servidor respondió con:', { status_code: response.status, status: response.statusText });
            logger.error('Cuerpo de la respuesta:', { response: textResponse });
            // new Error(`¡Error HTTP! estado: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await response.text();
            logger.error('Tipo de contenido inesperado:', { type: contentType });

            logger.error('Cuerpo de la respuesta:', { response: textResponse });
            //throw new Error(`Se esperaba JSON, pero se recibió ${contentType}`);
        }

        const data = await response.json();
        // Guardar los datos en caché
        return data;

    } catch (err) {
        catch_error(err);
        logger.error('Error en sendMessageChatwood:', { error: err });
        //throw err; // Re-lanza el error para que el llamador pueda manejarlo
    }
};

const searchUser = async (user = "") => {
    try {
        const cachedData = getData(user);
        if (cachedData) {
            logger.info('Usando datos en caché para user:', { info: cachedData });
            return cachedData;
        }
        const url = builderURL(`contacts/search?q=${user}`)
        //console.log(url)
        let count = null
        let data_user = {}
        const res = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": API
                // Añade otros encabezados si es necesario
            }
        });

        const { meta, payload } = res.data
        count = meta.count
        //verificamos si hay datos
        if (payload.length) {
            payload.forEach(element => {
                //se agrega el id del usuario
                data_user.user_id = element.id
            });
        } else {
            //no hay datos, no existe el user
            data_user.user_id = 0
        }
        //se agrega el contador de conversaciones abiertas, minimo debe ser 1, si es 0 se debe crear la conver...
        data_user.count = count
        if (data_user.user_id > 0) {
            setCache(user, data_user)
        }

        return data_user;
    } catch (err) {
        catch_error(err)
        //console.error(err)
    }
};

const recoverConversation = async (id = 0, user = "") => {
    try {
        /*const cachedData = cache.get(id);
        if (cachedData) {
            //console.log('Usando datos en caché para conversation_id:', cachedData);
            return cachedData;
        }*/

        let conversation_id = 0
        const url = builderURL(`contacts/${id}/conversations`)
        const res = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": API
                // Añade otros encabezados si es necesario
            }
        });
        const payload = res.data.payload
        //console.log(payload)

        for (let i = 0; i < payload.length; i++) {
            const conversation = payload[i];
            //console.log(conversation.id, conversation.status);
            if (conversation.status == "open") {
                conversation_id = conversation.id;
                break;
            }
            else {
                conversation_id = 0
                //console.log('No se encontro una conversacion abierta.\n Se debe crear una nueva conversacion');
            }
        }

        return conversation_id
    } catch (err) {
        catch_error(err)
        //console.error('err', err);
    }
};



const recover = async (user = {}) => {
    try {
        const user_info = {}
        const data_user = await searchUser(user)

        if (data_user.user_id > 0) {
            user_info.user_id = data_user.user_id
            const lockKey = `user_conversation_${data_user.user_id}`;
            try {
                await acquireLock(lockKey);
                const conversation_id = await recoverConversation(data_user.user_id, user)
                //console.log('id capturado: ', conversation_id)
                if (conversation_id === 0) {
                    const new_conv = await createConversationChatwood('', 'outgoing', user_info.user_id)
                    //console.log('Nueva conversación creada:', new_conv)
                    logger.info('Nueva conversación creada', { 'id': new_conv, 'user': user })
                    user_info.conversation_id = new_conv
                } else {
                    user_info.conversation_id = conversation_id
                }
            } finally {
                await releaseLock(lockKey);
            }
        } else {
            //console.log(user)
            logger.warn('No se encontró el usuario:', { error: user })
            //console.log('No se encontró el usuario:', user)
            return null
        }

        return user_info

    } catch (err) {
        logger.error('Error en recover:', { error: err })
        catch_error(err)
    }
};


export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover };
