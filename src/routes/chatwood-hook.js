import express from 'express';
import { catch_error } from '../utils/utils.js';
const router = express.Router();
// Enviar mensaje a usuario de WhatsApp
const chatWoodHook = async (req, res) => {
    try {
        //console.log('hook...')
        const bot = req.bot
        const providerWS = req.providerWS;
        const body = req.body;
        const mapperAttributes = body?.conversation?.meta?.assignee
        const attachments = body?.attachments
        const phone = body.conversation?.meta?.sender?.phone_number.replace('+', '')
        const content = body.content

        if (content && (content.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, "") === 'hasta luego' || content.toLowerCase().replace(/[\u0300-\u036f]/g, "") === 'adios')) {
            console.log(`Bot reactivado para el usuario ${phone}`)

            if (bot.dynamicBlacklist.checkIf(phone)) {
                bot.dynamicBlacklist.remove(phone)
                console.log(bot.dynamicBlacklist.checkIf(phone))
            }
            return;
        }
        /*La parte que se encarga de determinar si un mensaje es enviado al whatsapp del cliente*/
        const checkIfMessage = body?.private == false && body?.event == "message_created" && body?.message_type === "outgoing" && body?.conversation?.channel.includes("Channel::Api")

        if (checkIfMessage) {
            console.log('mensaje enviado desde CRM', `MSG is: ${body?.content}`, checkIfMessage, Date.now())
            const content = body?.content ?? '';
            const file = attachments?.length ? attachments[0] : null;
            if (body?.event === 'message_created' && Object.hasOwn(mapperAttributes, 'id')) {
                const idAssigned = mapperAttributes.id ?? null
                console.log('idAssigned: ', idAssigned)

                if (idAssigned) {
                    console.log(`${phone} blocked`)
                    bot.dynamicBlacklist.add(phone)
                }
            }
            //envia los docs al whatsapp
            if (file) {
                console.log(file.data_url)
                const fileURL = file.data_url.replace('http://127.0.0.1:3000/', process.env.FRONTEND_URL)
                console.log(fileURL)
                await providerWS.sendMedia(`${phone}@c.us`, fileURL, content)
                res.send('ok')
                return
            }
            /*esto envia un mensaje de texto al whatsapp de usuario*/
            await providerWS.sendMessage(`${phone}`, body.content, {});
            res.send('ok');
            return;
        }
        //res.send(body)
        res.send('ok')
    }
    catch (err) {
        catch_error(err)
    }

};

const test3 = async () => {
    console.log('tesing')
    return "hola"
}

router.post('/chatwood-hook', chatWoodHook);
router.get('/wood', test3)

//console.log(JSON.stringify(router))
export default router;
