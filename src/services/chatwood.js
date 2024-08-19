import axios from 'axios';
import { catch_error } from '../utils/utils.js'
import { readFile } from 'fs/promises'
import { showMSG } from '../i18n/i18n.js';
import { LRUCache } from 'lru-cache'

const SERVER = process.env.SERVER_DOCKER || "http://localhost";
const ACCOUNT_ID = process.env.ACCOUNT_ID ?? 2
const INBOX_ID = process.env.INBOX_ID ?? 5
const API = process.env.API
const PORT = process.env.PORT

console.log('server: ', SERVER, PORT);

const clearCache = () => {
    cache.clear();
    console.log('Caché limpiado');
};

const builderURL = (path) => {
    return `${SERVER}/api/v1/accounts/${ACCOUNT_ID}/${path}`
}
// Configuración del caché
const cache = new LRUCache({
    max: 1000, // Número máximo de elementos en caché
    maxAge: 1000 * 60 * 60 // Tiempo de vida: 1 hora
});
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
        //console.log(data)
        return data;
    } catch (err) {
        catch_error(err)
        //return null
    }
}

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0, attachments = []) => {
    try {
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
                console.error('Error al leer el archivo adjunto:', readFileError);
                throw readFileError;
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
            console.error('El servidor respondió con:', response.status, response.statusText);
            console.error('Cuerpo de la respuesta:', textResponse);
            throw new Error(`¡Error HTTP! estado: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await response.text();
            console.error('Tipo de contenido inesperado:', contentType);
            console.error('Cuerpo de la respuesta:', textResponse);
            throw new Error(`Se esperaba JSON, pero se recibió ${contentType}`);
        }

        const data = await response.json();
        // Guardar los datos en caché
        return data;

    } catch (err) {
        catch_error(err);
        console.error('Error en sendMessageChatwood:', err);
        throw err; // Re-lanza el error para que el llamador pueda manejarlo
    }
};

const searchUser = async (user = "") => {
    try {
        const cachedData = cache.get(user);
        if (cachedData) {
            console.log('Usando datos en caché para user:', cachedData);
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
                //data_user.push(element.id)
            });
        } else {
            //no hay datos, no existe el user
            data_user.user_id = 0
        }
        //se agrega el contador de conversaciones abiertas, minimo debe ser 1, si es 0 se debe crear la conver...
        data_user.count = count
        cache.set(user, data_user);

        return data_user;
    } catch (err) {
        //catch_error(err)
        console.error(err)

    }
};

const recoverConversation = async (id = 0, user = "") => {
    try {
        const cachedData = cache.get(id);
        if (cachedData) {
            console.log('Usando datos en caché para conversation_id:', cachedData);
            return cachedData;
        }

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

        for (let i = 0; i < payload.length; i++) {
            const conversation = payload[i];
            //console.log(conversation.id, conversation.status);
            if (conversation.status == "open") {
                conversation_id = conversation.id;
                //console.log(JSON.stringify(payload), '\n')
                //console.log('La conversación abierta es la:', conversation_id);
                break;
            }
            else {
                conversation_id = 0
                //console.log('No se encontro una conversacion abierta.\n Se debe crear una nueva conversacion');
            }
        }
        //console.log('convert: ', conversation_id)
        // Guardar los datos en caché
        cache.set(id, conversation_id);

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
            const conversation_id = await recoverConversation(data_user.user_id, user)
            user_info.conversation_id = conversation_id
        }
        else {
            console.log('No se encontro el usuario:', user)
            user_info.user_id = 0
            user_info.conversation_id = 0
        }
        //console.log(user_info)
        return user_info

    } catch (err) {
        catch_error(err)
        //console.error('err', err);
    }
};

const checking = async (user = "") => {
    try {
        console.log(`searching: ${user}`, ACCOUNT_ID, SERVER, API, INBOX_ID)
        //process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
        const res = await axios.get('http://127.0.0.1:3000/api/v1/accounts/1/contacts/search?q=+50766962147', {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": API
                // Añade otros encabezados si es necesario
            },
            //httpsAgent: new axios.http.Agent({ rejectUnauthorized: false })
        });
        console.log('fecht url', res.data)
        //const { meta, payload } = res.data
        return res.data;
    }
    catch (err) {
        console.error(err)
    }
}

export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover, clearCache };
