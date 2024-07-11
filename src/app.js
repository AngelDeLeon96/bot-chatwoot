
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
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
const queue = new Queue({
    concurrent: 1,
    interval: 500
})

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword(EVENTS.ACTION)
    //.addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`Cuál es su nombre?`, { capture: true, delay: 0 }, async (ctx, { state, gotoFlow, globalState }) => {
        try {
            reset(ctx, gotoFlow);
            await sendMessageChatwood(`Cuál es su nombre?`, 'incoming', globalState.get('c_id')); // Registrar la pregunta primero
            await state.update({ name: ctx.body });
            await sendMessageChatwood(state.get('name'), 'outgoing', globalState.get('c_id')); // Luego registrar la respuesta
        }
        catch {
            return null
        }
    })
    .addAnswer(`Cuál es su consulta?`, { capture: true, delay: 2800 }, async (ctx, { state, gotoFlow, globalState }) => {
        try {
            reset(ctx, gotoFlow);
            await sendMessageChatwood(`Cuál es su consulta?`, 'incoming', globalState.get('c_id')); // Registrar la pregunta
            await state.update({ consulta: ctx.body });
            await sendMessageChatwood(state.get('consulta'), 'outgoing', globalState.get('c_id')); // Luego registrar la 
        }
        catch {
            return null
        }
    })
    .addAction(async (ctx, { gotoFlow }) => {
        stop(ctx)
        return gotoFlow(flowMsgFinal)
    })

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta.
const createConversation = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { gotoFlow, globalState }) => {
        await createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
        return gotoFlow(userRegistered)
    })

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        try {
            await flowDynamic('Por favor, proporciónenos los siguientes datos:')
            await sendMessageChatwood('Por favor, proporciónenos los siguientes datos:', 'incoming', globalState.get('c_id'))
            if (globalState.get('c_id') == 0) {
                const conversation_id = await recover(ctx.from);
                await globalState.update({ c_id: conversation_id })
            }
            //console.log('Flow User Registered ', globalState.get('c_id'))
            const conversation_id = await recover(ctx.from);
            //console.log('conver ID: ', conversation_id)
            // si existe una conversacion abierta, se registran los mensajes
            if (conversation_id > 0) {
                console.log('registering msg...')
                return gotoFlow(registerMsgConversation)
            }
            else {
                console.log('creating conversation...')
                return gotoFlow(createConversation)
                //console.log('ddd')
            }
        }
        catch {
            return null
        }
    })

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            console.log('Unregistered')
            const numero = ctx.from
            var FORMULARIO = process.env.FORM_URL
            var MSG = [
                `Por favor, rellene el siguiente formulario: ${FORMULARIO}.`,
                `Un agente se comunicará con usted a este número: ${numero}.`
            ]
            await flowDynamic(MSG)
        }
        catch {
            return null
        }
    })

//flow principal
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { blacklist }) => {
        const toMute = ctx.from.replace('+', '')
        const check = blacklist.checkIf(toMute)
        console.log('muted', check, ctx.from)
    })
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`, { capture: false }, async (ctx, { globalState }) => {
        try {
            const MNSF = `¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`
            const conversation_id = await recover(ctx.from);
            await globalState.update({ c_id: conversation_id })
            sendMessageChatwood(MNSF, 'incoming', globalState.get('c_id'))
        }
        catch {
            return null
        }
    })
    .addAction(async (ctx, { gotoFlow, globalState }) => {
        try {
            const data_user = await searchUser(ctx.from)
            await globalState.update({ contact_id: data_user.user_id })
            //console.log('--contact ID--', globalState.get('contact_id'))
            if (data_user.user_id > 0) {
                console.log('user found...')
                return gotoFlow(userRegistered);
            }
            else if (data_user.user_id == 0) {
                console.log('user not found...');
                return gotoFlow(userNotRegistered);
            }
            else {
                return gotoFlow(flowDefault);
            }
        }
        catch {
            return null
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
            queue.enqueue(async () => {
                const attachment = []
                let caption, msg = ""
                const mime = payload?.message?.imageMessage?.mimetype ?? payload?.message?.videoMessage?.mimetype ?? payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype;
                //console.log(`Message Payload:`, JSON.stringify(payload))
                if (payload?.body.includes('_event_') || mime) {
                    const extension = mimeType.extension(mime);
                    let mimeslice = mime.split("/")[0]
                    console.log(mimeslice)
                    if (mimeslice == 'image') {
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

                const c_id = await recover(payload.from)
                console.log('data to send: ', c_id, attachment, msg)
                await sendMessageChatwood(msg, 'incoming', c_id, attachment)
            })
        }
        catch (err) {
            console.log('ERROR', err)
        }
    })

    /*
        bot.on('send_message', ({ answer, from }) => {
            console.log(`Send Message Payload:`, { answer, from })
        })
    */
}

main()
