import axios from 'axios';
import { catch_error } from '../utils/utils.js'
import { readFile } from 'fs/promises'

const SERVER = process.env.SERVER || "http://localhost:3000";
const ACCOUNT_ID = process.env.ACCOUNT_ID ?? 2
const INBOX_ID = process.env.INBOX_ID ?? 5
const API = process.env.API
const createConversationChatwood = async (msg = "", type = "outgoing", contact_id = 0) => {
    try {
        const myHeaders = new Headers();
        myHeaders.append("api_access_token", API);
        myHeaders.append("Content-Type", "application/json");
        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            contact_id: contact_id,
            /*
            message: {
                content: (msg instanceof Array) ? msg.join("\n") : msg,
                type: type,
                private: "true"
            }*/
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };
        //console.log(raw);
        const dataRaw = await fetch(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/conversations`, requestOptions);
        const data = await dataRaw.json();

        return data;
    } catch (err) {
        catch_error(err)
        return null
    }
}

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0, attachments = []) => {
    try {
        console.log('....')
        const url = `${SERVER}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversation_id}/messages`
        const form = new FormData();
        form.set("content", msg);
        form.set("message_type", message_type);
        form.set("private", "true");

        if (attachments.length) {
            const fileName = `${attachments[0]}`.split('/').pop()
            const blob = new Blob([await readFile(attachments[0])]);
            form.set("attachments[]", blob, fileName);
        }
        const dataFetch = await fetch(url,
            {
                method: "POST",
                headers: {
                    api_access_token: API
                },
                body: form
            }
        );
        const data = await dataFetch.json();
        return data
    } catch (err) {
        catch_error(err)
        return null
        //console.error(err);
    }
};

const searchUser = async (user = "") => {
    try {
        //console.log(`searching: ${user}`, ACCOUNT_ID)
        let count = null
        let data_user = {}
        const res = await axios.get(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=${user}`, {
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
        return data_user;
    } catch (err) {
        catch_error(err)
        return null;
    }
};

const recoverConversation = async (id = 0) => {
    try {
        let conversation_id = 0
        const res = await axios.get(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/contacts/${id}/conversations`, {
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
                //console.log('La conversación abierta es la:', conversation_id);
                break;
            }
            else {
                conversation_id = 0
                console.log('No se encontro una conversacion abierta.\n Se debe crear una nueva conversacion');
            }
        }
        return conversation_id

    } catch (err) {
        catch_error(err)
        //console.error('err', err);
        return null;
    }
};

const recover = async (user = {}) => {
    try {
        let data_user = await searchUser(user)
        //console.log(data_user.user_id)
        return await recoverConversation(data_user.user_id)
    } catch (err) {
        catch_error(err)
        console.error('err', err);
        return null;
    }
};


export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover };
