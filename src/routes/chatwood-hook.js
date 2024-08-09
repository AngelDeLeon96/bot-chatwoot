import express from 'express';
import { catch_error } from '../utils/utils.js';
const router = express.Router();
const TIMER_BOT = process.env.TIMER_BOT ?? 600000
import { timers } from '../utils/timer.js';
// Enviar mensaje a usuario de WhatsApp
console.log(TIMER_BOT / 60000)
const chatWoodHook = async (req, res) => {
    try {
        const providerWS = req.providerWS;
        const bot = req.bot;
        const body = req.body;
        const mapperAttributes = body?.conversation?.meta?.assignee;
        const attachments = body?.attachments;
        const phone = body.conversation?.meta?.sender?.phone_number.replace('+', '');
        const content = body.content;
        const status = body.status;
        const event = body.event;
        const keywords = ['hasta luego', 'adios', 'resuelto'];
        let partial = content ? keywords.includes(content.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, "")) : false
        let partial_status = (status === "resolved" && event === "conversation_updated")

        if (partial || partial_status) {
            let phone_check = bot.dynamicBlacklist.checkIf(phone)
            //console.log('capturando el texto clave o cambio de estado.', partial, partial_status, phone_check)
            if (phone_check) {
                bot.dynamicBlacklist.remove(phone);
                console.log('user removed:', phone);
                await providerWS.sendMessage(`${phone}`, '⭕️Comunicacion cerrada por el agente...', {});
                res.send('ok');
            }
            return;
        }

        /*La parte que se encarga de enviar un mensaje al whatsapp del cliente*/
        const checkIfMessage = body?.private == false && body?.event == "message_created" && body?.message_type === "outgoing" && body?.conversation?.channel.includes("Channel::Api")
        //console.log(`checkif`, checkIfMessage, '\n')
        if (checkIfMessage) {
            console.log('mensaje enviado desde CRM', `MSG is: ${body?.content}`, checkIfMessage, Date.now())
            const content = body?.content ?? '';
            const file = attachments?.length ? attachments[0] : null;
            //console.log(mapperAttributes)
            if (body?.event === 'message_created' && Object.hasOwn(mapperAttributes, 'id')) {
                const idAssigned = mapperAttributes.id ?? true
                //const idAssigned = true
                //console.log('idAssigned: ', idAssigned)
                if (idAssigned) {
                    console.log(`${phone} blocked...`)
                    if (!bot.dynamicBlacklist.checkIf(phone) && !timers[phone]) {
                        bot.dynamicBlacklist.add(phone);
                        timers[phone] = setTimeout(() => {
                            if (bot.dynamicBlacklist.checkIf(phone)) {
                                bot.dynamicBlacklist.remove(phone)
                            }
                            //await providerWS.sendMessage(`${phone}`, '', {});
                            console.log(`bot reactivated...`);
                        }, TIMER_BOT);
                    }
                }
            }
            //envia los docs al whatsapp
            if (file) {
                console.log(file.data_url)
                const fileURL = file.data_url.replace('http://127.0.0.1:3000/', process.env.FRONTEND_URL)
                await providerWS.sendMedia(`${phone}@c.us`, fileURL, content)
                res.send('ok')
                return
            }
            /*esto envia un mensaje de texto al whatsapp de usuario*/
            await providerWS.sendMessage(`${phone}`, body.content, {});
            res.send('ok');
            console.log('=>OK')
            return;
        }

        //res.send(body)
        res.send('ok')
    }
    catch (err) {
        catch_error(err)
    }

};

router.post('/chatwood-hook', chatWoodHook);

export default router;
