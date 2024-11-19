
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import ServerHttp from './http/server.js';
import { sendMessageChatwood, recover, updateContact } from './services/chatwood.js'
import { flujoFinal, reset, start, stop } from './utils/timer.js'
//flows
import { freeFlow } from './flows/agents.js'
import { primera_vez, prima_menu, attach_forms, attach_forms_cedula, attach_forms_continuidad } from './flows/prima.js';
const PORT = process.env.PORT_WB ?? 1000

import Queue from 'queue-promise';
import { catch_error, esHorarioLaboral, formatName, getMimeWB, saveMediaWB, verifyMSG } from './utils/utils.js';
import { showMSG, i18n } from './i18n/i18n.js';
import debounce from './utils/debounce.js';
import logger from './utils/logger.js';
import { crearDetectorPalabrasOfensivas } from './utils/detector-words.js';
const PHONE_NUMBER = process.env.PHONE_NUMBER
const clientBuffers = new Map();

const queue = new Queue({
    concurrent: 1,
    interval: 500
});
i18n.init();

console.log("🚀 CHATWOOT IS RUNNING IN: ", process.env.SERVER_DOCKER)

const flowtest = addKeyword('testing2552')
    .addAction(async (ctx, { flowDynamic }) => {
        const fecha = new Date();
        return await flowDynamic(`La fecha es: ${fecha.toString()}`);
    })
//clearCache();
//user data registered
const menuPrincipalwithoutRegister = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAction(async (_, { flowDynamic, globalState }) => {
        await flowDynamic(`${showMSG('user_registered')} ${globalState.get('nombre')}?`);
        await flowDynamic([{ delay: 200, body: `${showMSG('solicitar_consulta')}\n${showMSG('prima')}\n${showMSG('vacaciones')}\n${showMSG('tramite_status')}\n${showMSG('salir')}` }]);
    })
    .addAction({ capture: true }, async (ctx, { fallBack, state, gotoFlow }) => {
        reset(ctx, gotoFlow);
        await state.update({ opc_consulta: ctx.body });
        let typeMSG = getMimeWB(ctx.message)
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(`${showMSG('solicitar_consulta')}`);
        }
    })
    .addAction(async (ctx, { fallBack, state, gotoFlow, endFlow, globalState }) => {
        stop(ctx);
        sendMessageChatwood(`${showMSG('selected')} ${state.get('opc_consulta')}`, 'incoming', globalState.get('conversation_id'));
        switch (parseInt(state.get('opc_consulta'))) {
            case 1:
                //menu de prima de antiguedad
                return gotoFlow(prima_menu);
            case 2:
                //consultar vacaciones (free mode)
                return gotoFlow(freeFlow);
            case 3:
                //consultar tramite (free mode)
                return gotoFlow(freeFlow)
            case 4:
                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                reset(ctx, gotoFlow);
                return fallBack(`${showMSG('no_permitida')}\n${showMSG('solicitar_consulta')}\n${showMSG('prima')}\n${showMSG('vacaciones')}\n${showMSG('tramite_status')}\n${showMSG('salir')}`);
        }
    })


//registramos un MSG en una conversacion
const menuPrincipal = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(showMSG('solicitar_nombre'), { capture: true }, async (ctx, { globalState, state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ name: ctx.body });
        let checkMSG = verifyMSG(ctx.body)
        if (!checkMSG) {
            return fallBack(`${showMSG('solicitar_nombre')}`);
        }
        else {
            sendMessageChatwood(state.get('name'), 'incoming', globalState.get('conversation_id'));
        }
    })
    .addAnswer(showMSG('solicitar_cedula'), { capture: true }, async (ctx, { state, gotoFlow, globalState, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ cedula: ctx.body });
        let checkMSG = verifyMSG(ctx.body);
        if (!checkMSG) {
            return fallBack(`${showMSG('solicitar_cedula')}`);
        }
        else {
            sendMessageChatwood(state.get('cedula'), 'incoming', globalState.get('conversation_id'));
        }
    })
    .addAnswer([showMSG('solicitar_consulta'), showMSG('prima'), showMSG('vacaciones'), showMSG('tramite_status'), showMSG('salir')], { capture: true, delay: 500 }, async (ctx, { state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ opc_consulta: ctx.body });
        let typeMSG = getMimeWB(ctx.message)
        await state.update({ status: typeMSG });
        if (typeMSG !== "senderKeyDistributionMessage") {
            return fallBack(`${showMSG('solicitar_consulta')}`);
        }
    })
    .addAction(async (_, { globalState, state }) => {
        try {
            const id = globalState.get('contact_id');
            const nombre = formatName(state.get('name'));
            const cedula = state.get('cedula');
            if (globalState.get('new') == 1) {
                updateContact(id, nombre, cedula);
            }
        }
        catch (err) {
            logger.error("error", { "err": err })

        }
    })
    .addAction({ delay: 500 }, async (ctx, { fallBack, gotoFlow, endFlow, globalState, state }) => {
        stop(ctx);
        sendMessageChatwood(`${showMSG('selected')} ${state.get('opc_consulta')}`, 'incoming', globalState.get('conversation_id'));
        switch (parseInt(state.get('opc_consulta'))) {
            case 1:
                //menu de prima de antiguedad
                return gotoFlow(prima_menu);
            case 2:
                //consultar vacaciones (free mode)
                return gotoFlow(freeFlow);
            case 3:
                //consultar tramite (free mode)
                return gotoFlow(freeFlow)
            case 4:
                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                return fallBack(`${showMSG('no_permitida')}\n${showMSG('solicitar_consulta')}\n${showMSG('prima')}\n${showMSG('vacaciones')}\n${showMSG('tramite_status')}\n${showMSG('salir')}`);
        }
    })


//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAnswer(showMSG('solicitar_datos'), { delay: 500 }, async (_, { gotoFlow, }) => {
        try {
            return gotoFlow(registerMsgConversation);
            // si existe una conversacion abierta, se registran los mensajes
        }
        catch (err) {
            catch_error(err)
        }
    });

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, endFlow }) => {
        try {
            logger.info("se produjo una excepcion en el flujo welcome y se redirijio al flujo userNotRegistered.")
            //console.log('Unregistered')
            //const numero = ctx.from
            //var FORMULARIO = process.env.FORM_URL
            var MSG = "Se produjo una excepción no esperada, intente más tarde."
            await flowDynamic(MSG)
            return endFlow()
        }
        catch (err) {
            catch_error(err)
            return endFlow()
        }
    });

const testWelcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic }) => {
        const clientId = ctx.from; //El numero de telefono funciona como id unico.

        // Si el cliente no tiene un buffer aún, crear uno
        if (!clientBuffers.has(clientId)) {
            clientBuffers.set(clientId, { buffer: [], timeout: null });
        }

        // Obtener el buffer y el temporizador del cliente
        const clientData = clientBuffers.get(clientId);

        // Procesar si es un audio o texto
        if (!ctx.body.includes("_event_voice_note_")) {
            clientData.buffer.push(ctx.body);
        }
        // Limpiar el temporizador anterior si existe
        if (clientData.timeout) {
            clearTimeout(clientData.timeout);
        }

        // Iniciar un nuevo temporizador
        clientData.timeout = setTimeout(async () => {
            // Unir todos los mensajes del buffer en un solo string
            const messagesToProcess = clientData.buffer.join(' ');
            clientData.buffer = []; // Limpiar el buffer

            await flowDynamic(messagesToProcess);

            //console.log(response);

            // Limpiar el temporizador del cliente
            clientBuffers.delete(clientId);

        }, 6000); // Esperar segundos sin recibir más mensajes
    })

//flow principal
const welcomeFlow = addKeyword([EVENTS.WELCOME, EVENTS.DOCUMENT, EVENTS.VOICE_NOTE, EVENTS.MEDIA, EVENTS.LOCATION])
    .addAction(async (ctx, { endFlow, blacklist }) => {
        if (!esHorarioLaboral(ctx.from)) {
            return endFlow(`${showMSG('gracias')}\n${showMSG('fuera_laboral')}`)
        } else {
            if (blacklist.checkIf(ctx.from.replace('+', ''))) {
                return endFlow()
            }
        }
    })
    .addAnswer([showMSG('bienvenida'), showMSG('correcta_atencion')], async (ctx, { globalState, gotoFlow }) => {
        try {
            const user_data = await recover(ctx.from);
            //console.log('user found: ', user_data)
            if (user_data != null) {
                //set las variables con los datos del usuario como su: id y id de conversation
                await globalState.update({ conversation_id: user_data.conversation_id });
                await globalState.update({ contact_id: user_data.user_id });
                await globalState.update({ new: user_data.new });
                if (parseInt(globalState.get('new')) == 0)
                    await globalState.update({ nombre: user_data.nombre })

                //globalState.get('new'), globalState.get("contact_id"));
                if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') > 0) {
                    if (parseInt(globalState.get('new')) == 1) {
                        return gotoFlow(menuPrincipal);
                    }
                    else {
                        return gotoFlow(menuPrincipalwithoutRegister);
                    }
                }
            }
            else {
                return gotoFlow(userNotRegistered);
            }
        }
        catch (err) {
            logger.error("Se produjo un error", { "err": err })
        }
    })



//flujo principal
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, menuPrincipal, menuPrincipalwithoutRegister, prima_menu, attach_forms, attach_forms_cedula, attach_forms_continuidad, flujoFinal, freeFlow, primera_vez, flowtest]);
    const adapterProvider = createProvider(Provider, {
        phoneNumber: PHONE_NUMBER,
        experimentalSyncMessage: 'Si desea comunicarse, escriba: hola.',
        experimentalStore: true,
        timeRelease: 10800000, // 3 hours in milliseconds
    });
    const adapterDB = new Database();

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
    );
    const server = new ServerHttp(adapterProvider, bot);
    server.start();
    bot.httpServer(+PORT);
    //bot desactivado

    adapterProvider.on('message', async (payload) => {
        try {
            //verificamos si el usuario esta con el bot desactivado, es decir el modo libre esta activado
            //console.log(`payload: `, JSON.stringify(payload), '\n');
            let debounceSendMSG = debounce(sendMessageChatwood, 100);
            if (bot.dynamicBlacklist.checkIf(payload.from)) {

                queue.enqueue(async () => {
                    let [msg, attachment, status_code, extension] = await saveMediaWB(payload);
                    //console.log("result fn saveMedia", msg, attachment, status_code)
                    const detector = await crearDetectorPalabrasOfensivas();
                    const result = await detector(msg);
                    const daata = await recover(payload.from);
                    const conversation_id = daata.conversation_id;

                    if (parseInt(status_code) == 200) {
                        if (conversation_id > 0) {
                            //console.log('debounce')
                            msg = result.mensajeEtiquetado;
                            debounceSendMSG(msg, 'incoming', conversation_id, attachment);
                            if (result.puntajeTotal >= 2) {
                                logger.warn('msg inapropiado:', { text: 'Posible contenido inapropiado detectado. Revise su mensaje.', user: payload.from });
                                //send msg to whatsapp user
                                adapterProvider.vendor.sendMessage(payload.key.remoteJid, { text: 'Posible contenido inapropiado detectado. Revise su mensaje.' }, {});
                            }
                        }
                    } else {
                        adapterProvider.vendor.sendMessage(payload.key.remoteJid, { text: 'Atención: Solo se permiten archivos de texto (docx, pdf) e imágenes (jpg, jpeg, png).' }, {});

                        debounceSendMSG(`El usuario intento enviar un archivo con extensión ${extension} y no esta permitido.`, 'incoming', conversation_id)
                    }
                });
            }
        }
        catch (err) {
            logger.error("error al desactivar el bot", { "err": err })
        }
    });

    bot.on('send_message', async ({ answer, from }) => {
        try {
            const daata = await recover(from);
            //console.log('2. soy el bot: ', daata)
            if (daata != null) {
                const conversation_id = daata.conversation_id;
                queue.enqueue(async () => {
                    //console.log('msg send to chatwoot...🚀')
                    sendMessageChatwood(answer, 'outgoing', conversation_id);
                    await bot.sendMessage(from, 'jjj', {});
                });
            }
        }
        catch (err) {
            //console.error('ERROR', err)
            logger.error("error al reenviar los msg del bot.", { "err": err })
        }
    });
}
main()
