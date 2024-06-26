import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';

import { sendMessageChatwood, searchUser, recoverConversation } from './services/chatwood.js'

console.log('ess ', process.env.PORT_WB)
const PORT = process.env.PORT_WB ?? 1000

const userRegistered = addKeyword('USER_REGISTERED')
    .addAction(async (ctx, { flowDynamic, state }) => {
        recoverConversation(ctx.from).then(response => {
            console.log('converstation recovered...', response)
        })
        await flowDynamic('recovering conversation...')
    })

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

const discordFlow = addKeyword('doc').addAnswer(
    ['You can see the documentation here', '📄 https://builderbot.app/docs \n', 'Do you want to continue? *yes*'].join(
        '\n'
    ),
    { capture: true },
    async (ctx, { gotoFlow, flowDynamic }) => {
        if (ctx.body.toLocaleLowerCase().includes('yes')) {
            return gotoFlow(registerFlow)
        }
        await flowDynamic('Thanks!')
        return
    }
)

const welcomeFlow = addKeyword(['hi', 'hello', 'hola'])
    .addAnswer(`¡Hola! 👋 Bienvenido / a al Bot de la Fiscalia General Electoral. Por favor sigue las instrucciones`)
    .addAction(async (ctx, { flowDynamic, gotoFlow }) => {
        searchUser(ctx.from)
            .then(data => {
                //console.log('searching...')
                if (data) {
                    //console.log(`Número de resultados: ${meta.count}`);
                    return gotoFlow(userRegistered);
                }
                else {
                    console.log('No se obtuvieron datos.');
                    return gotoFlow(userNotRegistered);
                }
            });
        //return gotoFlow(userNotRegistered);
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
    const adapterFlow = createFlow([welcomeFlow, registerFlow, userNotRegistered, userRegistered])
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
