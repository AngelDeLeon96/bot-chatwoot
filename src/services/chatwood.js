import axios from 'axios';

const SERVER = process.env.SERVER || "http://localhost:3000";

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0) => {
    try {
        const myHeaders = new Headers();
        myHeaders.append("api_access_token", "b4Byq6gGFtXjFGiWt57usi4Z");
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
        const dataRaw = await fetch(`${SERVER}/api/v1/accounts/2/conversations/${conversation_id}/messages`, requestOptions);
        const data = await dataRaw.json();
        console.log(dataRaw.status, msg);

        return data;
    } catch (err) {
        console.error(err);
    }
};

const searchUser = async (user = "") => {
    try {
        console.log(`searching: ${user}`)
        let user_id = null
        let count = null
        let data_user = []
        const res = await axios.get(`${SERVER}/api/v1/accounts/2/contacts/search?q=${user}`, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": process.env.API
                // Añade otros encabezados si es necesario
            }
        });
        //console.log(JSON.stringify(res))
        const { meta, payload } = res.data
        count = meta.count
        payload.forEach(element => {
            console.log('4each ', element.id)
            data_user.push(element.id)
            user_id = element.id
        });
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
        const res = await axios.get(`${SERVER}/api/v1/accounts/2/contacts/${id}/conversations`, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": process.env.API
                // Añade otros encabezados si es necesario
            }
        });
        const payload = res.data.payload
        for (let i = 0; i < payload.length; i++) {
            const conversation = payload[i];
            console.log(conversation.id, conversation.status);
            if (conversation.status == "open") {
                conversation_id = conversation.id;
                console.log('La conversación abierta es la:', conversation_id);
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
}

const recover = async (user = "") => {
    try {
        return await recoverConversation(await searchUser(user))
    } catch (err) {
        console.error('err', err);
        return null;
    }

};
export { sendMessageChatwood, searchUser, recoverConversation, recover };
