import axios from 'axios';

const SERVER = process.env.SERVER || "http://localhost:3000";

const sendMessageChatwood = async (msg = "", message_type = "incoming") => {
    try {
        const myHeaders = new Headers();
        myHeaders.append("api_access_token", "b4Byq6gGFtXjFGiWt57usi4Z");
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            content: msg.join("\n"),
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
        const dataRaw = await fetch(`${SERVER}/api/v1/accounts/2/conversations/19/messages`, requestOptions);
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
        const res = await axios.get(`${SERVER}/api/v1/accounts/2/contacts/search?q=${user}`, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": process.env.API
                // Añade otros encabezados si es necesario
            }
        });
        //console.log('response recovered...', res.data)
        return res.data;
    } catch (err) {
        console.error('err', err);
        return null;
    }
};

const recoverConversation = async (user = "") => {
    try {

        searchUser(user)
            .then(data => {
                console.log(`recovering... ${user}`)
                if (data) {
                    const { meta, payload } = data;
                    console.log(`payload: ${payload} ${meta}`);
                    payload.forEach(contact => {
                        console.log(contact.id)
                    })
                }
                else {
                    console.log('No se obtuvieron datos.');
                }
            });
        const contact_id = 0

        //search conversations
        /*
        const res = await axios.get(`${SERVER}/api/v1/accounts/2/contacts/${contact_id}/conversations`, {
            headers: {
                'Content-Type': 'application/json',
                "api_access_token": process.env.API
                // Añade otros encabezados si es necesario
            }
        });
        */
        //console.log(res)
        return true;
    } catch (err) {
        console.error('err', err);
        return null;
    }

};
export { sendMessageChatwood, searchUser, recoverConversation };
