import axios from 'axios';

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
            message: {
                content: (msg instanceof Array) ? msg.join("\n") : msg,
                type: type,
                private: "true"
            }
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };
        console.log(raw);
        const dataRaw = await fetch(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/conversations`, requestOptions);
        const data = await dataRaw.json();
        return data;
    } catch (err) {
        console.error(err);
    } ``
}

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0) => {
    try {
        const myHeaders = new Headers();
        myHeaders.append("api_access_token", API);
        myHeaders.append("Content-Type", "application/json");
        const raw = JSON.stringify({
            content: (msg instanceof Array) ? msg.join("\n") : msg,
            message_type: message_type, // "incoming", 
            private: true,
            content_type: "input_email",
            content_attributes: {}
        });
        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };
        console.log(raw);
        const dataRaw = await fetch(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversation_id}/messages`, requestOptions);
        const data = await dataRaw.json();
        return data;
    } catch (err) {
        console.error(err);
    }
};

const searchUser = async (user = "") => {
    try {
        console.log(`searching: ${user}`)
        let count = null
        let data_user = []
        const res = await axios.get(`${SERVER}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=${user}`, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": API
                // Añade otros encabezados si es necesario
            }
        });
        const { meta, payload } = res.data
        count = meta.count
        payload.forEach(element => {
            //se agrega el id del usuario
            data_user.push(element.id)
        });
        //se agrega el contador de conversaciones abiertas, minimo debe ser 1.
        data_user.push(count)
        return data_user;

    } catch (err) {
        console.error('err', err);
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
        console.error('err', err);
        return null;
    }
};

const recover = async (user = "") => {
    try {
        return await recoverConversation(await searchUser(user))
    } catch (err) {
        console.error('err', err);
        return null;
    }
};


export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover };
