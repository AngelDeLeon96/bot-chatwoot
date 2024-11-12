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
import { log } from 'console';
//console.log('server: ', SERVER, PORT);
// Map para trackear las creaciones en proceso
const pendingSearches = new Map();


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
        logger.error('Error en sendMessageChatwood:', { error: err });
        //throw err; // Re-lanza el error para que el llamador pueda manejarlo
    }
};

const createContact = async (phone = "") => {
    try {
        const myHeaders = new Headers();
        const url = builderURL('contacts');
        const contact_data = {}
        myHeaders.append("api_access_token", API);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            name: `${phone}`,
            phone_number: `+${phone}`
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };

        const dataRaw = await fetch(url, requestOptions);
        const response = await dataRaw.json();
        contact_data.id = response.payload.contact.id;
        contact_data.new = 1;
        logger.info(`Se creó el contacto: ${phone} con id: ${contact_data.id} new: ${contact_data.new}`);

        return contact_data;
    }
    catch (err) {
        logger.err("Error al crear el contacto", { "err": err })

    }
}

const updateContact = async (id = 0, nombre = "", cedula = "") => {
    const contact_data = null
    try {
        const myHeaders = new Headers();
        const url = builderURL(`contacts/${id}`);

        myHeaders.append("api_access_token", API);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            name: nombre,
            custom_attributes: {
                cedula: cedula
            }
        });

        const requestOptions = {
            method: "PUT",
            headers: myHeaders,
            body: raw,
        };

        const dataRaw = await fetch(url, requestOptions);
        const response = await dataRaw.json();

        logger.info("Se actualizaron los datos del contacto", { "user": id, "nombre": nombre });

        return response.status;
    }
    catch (err) {
        logger.err("Error al actualizar el contacto", { "error": err });
    }

}

const searchUser = async (user = "") => {
    // Si ya hay una búsqueda en proceso para este usuario, retornar esa promesa
    if (pendingSearches.has(user)) {
        logger.info(`Búsqueda en proceso para: ${user}`)
        return pendingSearches.get(user);
    }

    const searchPromise = (async () => {
        try {
            const url = builderURL(`contacts/search?q=${user}`);
            let data_user = {};
            const myHeaders = new Headers();
            myHeaders.append("api_access_token", API);
            myHeaders.append("Content-Type", "application/json");

            const requestOptions = {
                method: "GET",
                headers: myHeaders,
            };
            const dataRaw = await fetch(url, requestOptions);
            const response = await dataRaw.json();
            const { meta, payload } = response;

            // Si encontramos el usuario
            if (payload.length > 0) {
                data_user.user_id = payload[0].id;  // Tomamos el primer resultado
                data_user.new = 0;
                data_user.nombre = payload[0].name;
                data_user.cedula = payload[0].custom_attributes.cedula;
            }
            else {
                const res_contact = await createContact(user);
                data_user.user_id = res_contact.id;
                data_user.new = res_contact.new;
                data_user.nombre = user;
                data_user.cedula = "0000000000";
            }

            data_user.count = meta.count;

            return data_user;
        } catch (err) {
            console.log(err)
            logger.err("Se produjo un error al buscar", { "error": err })
            catch_error(err);
        } finally {
            // Limpiar el Map de búsquedas pendientes
            pendingSearches.delete(user);
        }
    })();

    // Guardar la promesa en el Map
    pendingSearches.set(user, searchPromise);

    return searchPromise;
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
        const user_info = {};
        const data_user = await searchUser(user);

        if (data_user.user_id > 0) {
            const lockKey = `user_conversation_${data_user.user_id}`;
            try {
                await acquireLock(lockKey);
                const conversation_id = await recoverConversation(data_user.user_id, user)
                if (conversation_id === 0) {
                    const new_conv = await createConversationChatwood('', 'outgoing', data_user.user_id)
                    logger.info('Nueva conversación creada', { 'id': new_conv, 'user': user })
                    data_user.conversation_id = new_conv
                } else {
                    data_user.conversation_id = conversation_id
                }
            } finally {
                await releaseLock(lockKey);
            }
        } else {
            logger.warn('No se encontró el usuario:', { error: user })
            return null
        }

        return data_user

    } catch (err) {
        catch_error(err)
    }
};


export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover, updateContact };
