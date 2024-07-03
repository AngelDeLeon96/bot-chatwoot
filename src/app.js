import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';
import { sendMessageChatwood, searchUser, recover } from './services/chatwood.js'
import { idleFlow, reset, start, stop } from './utils/idle-custom.js'

console.log('ess ', process.env.PORT_WB)
const PORT = process.env.PORT_WB ?? 1000

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword('REGISTER_MSG_CONVERSATION')
    .addAnswer(`Cuál es su nombre?`, { capture: true, delay: 500 }, async (ctx, { state, flowDynamic, globalState }) => {
        try {
            await state.update({ name: ctx.body })
            sendMessageChatwood(`Cuál es su nombre?`, 'incoming', globalState.get('c_id'))
            sendMessageChatwood(state.get('name'), 'outgoing', globalState.get('c_id'))
        }
        catch (err) {
            console.log(err)
        }
    })
    .addAnswer(`Cuál es su consulta?`, { capture: true, delay: 500 }, async (ctx, { state, flowDynamic, globalState }) => {
        try {
            await state.update({ consulta: ctx.body })
            sendMessageChatwood(`Cuál es su consulta?`, 'incoming', globalState.get('c_id'))
            sendMessageChatwood(state.get('consulta'), 'outgoing', globalState.get('c_id'))
        }
        catch (err) {
            console.log(err)
        }
    })
    .addAction(async (ctx, { flowDynamic, state, globalState }) => {
        const MSG = `Hemos recibido su información: ${state.get('name')}. Un agente se estará comunicando con usted a este número: ${ctx.from}. Tenga un buen día.`;
        await flowDynamic(MSG);
        await sendMessageChatwood(MSG, 'incoming', globalState.get('c_id'));
    })

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta, se crea la conversacion.
const createConversation = addKeyword('CREATE_CONVERSATION')
    .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword('USER_REGISTERED')
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        await flowDynamic('Por favor, proporciónenos los siguientes datos:')
        sendMessageChatwood('Por favor, proporciónenos los siguientes datos:', 'incoming', globalState.get('c_id'))
        console.log('Flow User Registered ')
        const conversation_id = await recover(ctx.from);
        console.log(conversation_id, '=====')
        // si existe una conversacion abierta, se registran los mensajes
        if (conversation_id > 0) {
            console.log('register msg')
            return gotoFlow(registerMsgConversation)
        }
        else {
            console.log('ddd')
        }
    })

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword('USER_NOT_REGISTERED').addAnswer()
    .addAction(async (ctx, { flowDynamic, state }) => {
        console.log('Unregistered')
        const numero = ctx.from
        var FORMULARIO = "https://forms.office.com/"
        var MSG = [
            `Por favor, rellene el siguiente formulario: ${FORMULARIO}.`,
            `Un agente se comunicará con usted a este número: ${numero}.`
        ]
        await flowDynamic(MSG)
    })
//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION).addAnswer("We don't have that Option 🤔")

//flujo final por inactividad
const flujoFinal = addKeyword(EVENTS.ACTION).addAnswer('Se canceló por inactividad')

//flow principal
const welcomeFlow = addKeyword(['hi', 'hello', 'hola', 'inicio'])
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, 10000))
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`, { capture: false, idle: 300000 }, async (ctx, { globalState, gotoFlow }) => {
        const MNSF = `¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones.`
        const conversation_id = await recover(ctx.from);
        await globalState.update({ c_id: conversation_id })
        sendMessageChatwood(MNSF, 'incoming', globalState.get('c_id'))
    })
    .addAction(async (ctx, { gotoFlow }) => {
        const data_user = await searchUser(ctx.from)
        if (data_user[1] > 0) {
            console.log('user found')
            return gotoFlow(userRegistered);
        }
        else if (data_user[1] == 0) {
            console.log('No se obtuvieron datos.');
            return gotoFlow(userNotRegistered);
        }
        else {
            return gotoFlow(flowDefault);
        }
    })
/*
const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('What is your age?', { capture: true }, async (ctx, { state }) => {
        await state.update({ age: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
    })
*/
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, createConversation, registerMsgConversation, flowDefault, flujoFinal, idleFlow])
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
    const server = new ServerHttp(adapterProvider)
    server.start()
    httpServer(+PORT)
}

main()
