
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';
import { sendMessageChatwood, searchUser, recover, createConversationChatwood } from './services/chatwood.js'
import { flujoFinal, reset, start, stop } from './utils/idle-custom.js'
import { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow } from './flows/agents.js'
import { numberClean } from './utils/utils.js';
const PORT = process.env.PORT_WB ?? 1000

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword('REGISTER_MSG_CONVERSATION')
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
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
            await sendMessageChatwood(`Cuál es su consulta?`, 'incoming', globalState.get('c_id')); // Registrar la pregunta primero
            await state.update({ consulta: ctx.body });
            await sendMessageChatwood(state.get('consulta'), 'outgoing', globalState.get('c_id')); // Luego registrar la respuesta
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
const createConversation = addKeyword('CREATE_CONVERSATION')
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        await createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
        return gotoFlow(userRegistered)
    })

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword('USER_REGISTERED')
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        try {
            await flowDynamic('Por favor, proporciónenos los siguientes datos:')
            await sendMessageChatwood('Por favor, proporciónenos los siguientes datos:', 'incoming', globalState.get('c_id'))

            if (globalState.get('c_id') == 0) {
                const conversation_id = await recover(ctx.from);
                await globalState.update({ c_id: conversation_id })
            }
            console.log('Flow User Registered ', globalState.get('c_id'))
            const conversation_id = await recover(ctx.from);
            console.log('conver ID: ', conversation_id)
            // si existe una conversacion abierta, se registran los mensajes
            if (conversation_id > 0) {
                console.log('register msg')
                return gotoFlow(registerMsgConversation)
            }
            else {
                return gotoFlow(createConversation)
                //console.log('ddd')
            }
        }
        catch {
            return null
        }
    })

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword('USER_NOT_REGISTERED')
    .addAction(async (ctx, { flowDynamic, state }) => {
        try {
            console.log('Unregistered')
            const numero = ctx.from
            var FORMULARIO = "https://forms.office.com/"
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

const unban = addKeyword("UNBAN")
    .addAction(async (ctx, { blacklist }) => {
        console.log('unban')
        return blacklist.remove(numberClean(ctx.from))
    })

const ban = addKeyword("BAN")
    .addAction(async (ctx, { blacklist }) => {
        console.log('ban')
        return blacklist.add(numberClean(ctx.from))
    })

//flow principal
const welcomeFlow = addKeyword(['hola', 'hi', 'iniciar'])
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`, { capture: false }, async (ctx, { globalState, blacklist }) => {
        try {
            const phone = numberClean(ctx.from)
            const check = blacklist.checkIf(phone)
            console.log('check...', check)
            if (check) {
                blacklist.remove(phone)
                console.log('user unbanned...')
            }
            else {
                console.log('user ban...')
            }
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
            console.log('--contact ID--', globalState.get('contact_id'))
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
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, createConversation, registerMsgConversation, flowDefault, flujoFinal, flowTalkAgent, mediaFlow, documentFlow, freeFlow, flowGoodBye, flowMsgFinal, unban, ban])
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const bot = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
    const server = new ServerHttp(adapterProvider)
    server.start()
    bot.httpServer(+PORT)



}

main()
