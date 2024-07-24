
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import fs from 'fs/promises'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import ServerHttp from './http/server.js';
import { sendMessageChatwood, searchUser, recover, createConversationChatwood } from './services/chatwood.js'
import { flujoFinal, reset, start, stop } from './utils/timer.js'
import { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow } from './flows/agents.js'
const PORT = process.env.PORT_WB ?? 1000
import Queue from 'queue-promise';
import mimeType from 'mime-types'
import { catch_error } from './utils/utils.js';
const queue = new Queue({
    concurrent: 1,
    interval: 500
})

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`Cuál es su nombre?`, { capture: true }, async (ctx, { state, gotoFlow, globalState }) => {
        try {
            reset(ctx, gotoFlow);
            sendMessageChatwood(`Cuál es su nombre?`, 'incoming', globalState.get('conversation_id')); // Registrar la pregunta primero
            await state.update({ name: ctx.body });
            await sendMessageChatwood(state.get('name'), 'outgoing', globalState.get('conversation_id')); // Luego registrar la respuesta
        }
        catch (err) {
            console.error(err)
        }
    })
    .addAnswer(`Cuál es su consulta?`, { capture: true, delay: 1500 }, async (ctx, { state, gotoFlow, globalState }) => {
        try {
            reset(ctx, gotoFlow);
            await sendMessageChatwood(`Cuál es su consulta?`, 'incoming', globalState.get('conversation_id')); // Registrar la pregunta
            await state.update({ consulta: ctx.body });
            queue.enqueue(async () => {
                sendMessageChatwood(state.get('consulta'), 'outgoing', globalState.get('conversation_id'))
            })
            console.log(`==>`)
            return gotoFlow(flowMsgFinal)
        }
        catch (err) {
            console.error(err)
        }
    })

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta.
const createConversation = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { gotoFlow, globalState }) => {
        try {
            createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
            return gotoFlow(userRegistered)
        }
        catch (err) {
            console.error(err)
        }
    })

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        try {
            console.log(`flow user registered`)
            await flowDynamic('Por favor, proporciónenos los siguientes datos:')
            sendMessageChatwood('Por favor, proporciónenos los siguientes datos:', 'incoming', globalState.get('conversation_id'))
            //const conversation_id = globalState.get('conversation_id')
            console.log('registering msg...')
            return gotoFlow(registerMsgConversation)
            // si existe una conversacion abierta, se registran los mensajes
        }
        catch (err) {
            catch_error(err)
        }
    })

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, endFlow }) => {
        try {
            //console.log('Unregistered')
            const numero = ctx.from
            var FORMULARIO = process.env.FORM_URL
            var MSG = [
                `Por favor, rellene el siguiente formulario: ${FORMULARIO}.`,
                `Un agente se comunicará con usted a este número: ${numero}.`
            ]
            await flowDynamic(MSG)
            return endFlow()
        }
        catch (err) {
            catch_error(err)
            return endFlow()
        }
    })

//flow principal
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`, { capture: false }, async (ctx, { globalState, gotoFlow, endFlow }) => {
        try {
            const MNSF = `¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`
            const user_data = await recover(ctx.from);
            //set las variables con los datos del usuario como su: id y id de conversation
            await globalState.update({ conversation_id: user_data.conversation_id })
            await globalState.update({ contact_id: user_data.user_id })
            console.log('data user', globalState.get('contact_id'), typeof (globalState.get('conversation_id')))
            /*  puede ser contact id= 1, conversation id= 1 .
                contact id= 0, conversation id= 0
                contact id= 1, conversation id= 0
            */
            if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') > 0) {
                console.log('user found...', globalState.get('contact_id'))
                const msg2 = sendMessageChatwood(MNSF, 'incoming', globalState.get('conversation_id'))
                return gotoFlow(userRegistered);
            } else if (globalState.get('contact_id') == 0 && globalState.get('conversation_id') == 0) {
                console.log('user not found...');
                return gotoFlow(userNotRegistered);
            }
            else if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') == 0) {
                console.log(`user found: ${globalState.get('contact_id')} => creating conversation...`)
                createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
                const user_data = await recover(ctx.from);
                await globalState.update({ conversation_id: user_data.conversation_id })
                await globalState.update({ contact_id: user_data.user_id })
                console.log(globalState.get('contact_id'), globalState.get('conversation_id'))
                const msg3 = sendMessageChatwood(MNSF, 'incoming', user_data.contact_id)
                return gotoFlow(userRegistered);
            } else {
                return endFlow('Se produjo un error, intente nuevamente.')
            }

        }
        catch (err) {
            catch_error(err)
        }
    })



//flujo principal
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, createConversation, registerMsgConversation, flowDefault, flujoFinal, flowTalkAgent, mediaFlow, documentFlow, freeFlow, flowGoodBye, flowMsgFinal])
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const bot = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    },
        {
            queue: {
                timeout: 20000, //👌
                concurrencyLimit: 50 //👌
            }
        }
    )
    const server = new ServerHttp(adapterProvider, bot)
    server.start()
    bot.httpServer(+PORT)

    //bot desactivado

    adapterProvider.on('message', (payload) => {
        try {
            //verificamos si el usuario esta con el bot desactivado
            if (bot.dynamicBlacklist.checkIf(payload.from)) {
                queue.enqueue(async () => {
                    const attachment = []
                    let caption, msg = ""
                    const mime = payload?.message?.imageMessage?.mimetype ?? payload?.message?.videoMessage?.mimetype ?? payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype;
                    console.log(JSON.stringify(payload))

                    if (payload?.body.includes('_event_') || mime) {
                        const extension = mimeType.extension(mime);
                        let mimeslice = mime.split("/")[0]
                        console.log(mimeslice)
                        if (mimeslice === 'image') {
                            caption = payload?.message?.imageMessage?.caption
                        }
                        else {
                            caption = payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.caption
                        }
                        const buffer = await downloadMediaMessage(payload, "buffer");
                        const fileName = `file-${Date.now()}.${extension}`
                        const pathFile = `${process.cwd()}/public/docs/${fileName}`
                        //msg = payload?.
                        await fs.writeFile(pathFile, buffer);
                        attachment.push(pathFile)
                        msg = caption
                    }
                    else {
                        msg = payload?.body
                    }
                    console.log(msg)
                    const daata = await recover(payload.from)
                    const conversation_id = daata.conversation_id
                    if (conversation_id != 0) {
                        console.log('data to send: ', conversation_id, attachment, msg)
                        const msg2 = sendMessageChatwood(msg, 'incoming', conversation_id, attachment)
                    }
                })
            }
        }
        catch (err) {
            catch_error(err)
            //console.error('ERROR', err)
        }
    })

}

main()
