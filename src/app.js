import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';
import { sendMessageChatwood, searchUser, recover } from './services/chatwood.js'

console.log('ess ', process.env.PORT_WB)
const PORT = process.env.PORT_WB ?? 1000

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta.
const createConversation = addKeyword('CREATE_CONVERSATION')
    .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })

//flujo que recupera 
const userRegistered = addKeyword('USER_REGISTERED')
    .addAnswer('Bienvenido de vuelta...')
    .addAnswer('Por favor, proporciónenos los siguientes datos:')
    .addAction({ capture: false }, async (ctx, { globalState, flowDynamic, state }) => {
        console.log('Flow User Registered ')
        const conversation_id = await recover(ctx.from);

        console.log("id:::", conversation_id)


        if (conversation_id > 0) {
            await globalState.update({ conver_id: conversation_id });
            const MSG = `conversation recovered id:${conversation_id}`
            await flowDynamic(MSG)
            sendMessageChatwood(MSG, 'incoming', conversation_id)

            console.log('conversation recovered id:', conversation_id);

        } else {
            console.log('...');
        }

    });

const userNotRegistered = addKeyword('USER_NOT_REGISTERED')
    .addAction(async (ctx, { flowDynamic, state }) => {
        console.log('unregistered')
        const numero = ctx.from
        console.log(numero)
        var FORMULARIO = "https://forms.office.com/"
        var MSG = [
            `Por favor, rellene el siguiente formulario: ${FORMULARIO}.`,
            `Un agente se comunicará con usted a este número: ${numero}.`
        ]
        await flowDynamic(MSG)
    })

//flow principal
const welcomeFlow = addKeyword(['hi', 'hello', 'hola', 'inicio'])
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones`)
    .addAction(async (ctx, { flowDynamic, gotoFlow }) => {

        const data_user = await searchUser(ctx.from)
        console.log('wss ', data_user[1])

        if (data_user[1] > 0) {
            console.log('user found')
            return gotoFlow(userRegistered);
        }
        else {
            console.log('No se obtuvieron datos.');
            return gotoFlow(userNotRegistered);
        }

    })

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

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, registerFlow, userNotRegistered, userRegistered, createConversation])
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
