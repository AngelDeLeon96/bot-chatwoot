import { addKeyword, EVENTS } from '@builderbot/bot';
import path from 'path'
import { sendMessageChatwood } from '../services/chatwood.js';
import { reset, start, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import { freeFlow } from './agents.js';
import Queue from 'queue-promise';
import { saveMediaWB, getMimeWB, extractMimeWb } from '../utils/utils.js';


const queue = new Queue({
    concurrent: 1,
    interval: 500
});

const prima_menu = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('menu'), showMSG('prima_opcion_1'), showMSG('prima_opcion_2'), showMSG('prima_opcion_3'), showMSG('prima_opcion_4'), `5. ${showMSG('exit')}`], { capture: true }, async (ctx, { state }) => {
        reset(ctx)
        await state.update({ 'prima_menu_opc': ctx.body })
    })
    .addAction(async (ctx, { state, gotoFlow, endFlow, fallBack, globalState }) => {
        sendMessageChatwood(`${showMSG('selected')} ${state.get('prima_menu_opc')}`, 'incoming', globalState.get('conversation_id'));
        switch (parseInt(state.get('prima_menu_opc'))) {
            case 1:
                stop(ctx)
                return gotoFlow(primera_vez);
            case 2:
                stop(ctx)
                return gotoFlow(attach_forms);
            case 3:
                stop(ctx)
                return gotoFlow(attach_forms_continuidad);
            case 4:
                stop(ctx)
                return gotoFlow(freeFlow);
            case 5:
                stop(ctx)
                return endFlow(`${showMSG('gracias')} ${showMSG('reiniciar_bot')}`);
            default:
                reset(ctx)
                return fallBack(showMSG('opcion_invalida'));
        }
    })

const primera_vez = addKeyword(EVENTS.ACTION)
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_1')}`)
    .addAnswer(`${showMSG('llenar_form')}`, { media: path.join(process.cwd(), 'public/files', 'FGE-solicitud y declaracion CO.pdf') })
    .addAnswer(`${showMSG('subir_pdf')} `)
    .addAction({ delay: 700 }, async (_, { gotoFlow }) => {
        //return endFlow(`${showMSG('formulario_captado')}`)
        return gotoFlow(prima_menu)
    })

//flow para attach los docs de form, cedula.
const attach_forms = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_2')}`)
    .addAnswer(`${showMSG('adjuntar_form')}`, { capture: true }, async (ctx, { fallBack, globalState }) => {
        reset(ctx)
        //console.log('body: ', JSON.stringify(ctx))
        let extractedMime = extractMimeWb(ctx)
        let formats = ['pdf', 'docx']
        if (formats.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx)
            sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`${showMSG('no_permitida')} Solo se permiten los archivos en formato: ${formats}. ${showMSG('try_again')}`);
        }
    })
    .addAnswer(showMSG('formulario_captado'))
    .addAnswer(`${showMSG('adjuntar_cedula')}`, { capture: true }, async (ctx, { fallBack, globalState }) => {
        reset(ctx)
        //console.log('body: ', JSON.stringify(ctx))
        let extractedMime = extractMimeWb(ctx)
        let formats = ['pdf', 'docx', 'png', 'jpg']
        if (formats.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx)
            sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`${showMSG('no_permitida')} Solo se permiten los archivos en formato: ${formats}. ${showMSG('try_again')}`);
        }
    })
    .addAnswer(`${showMSG('formulario_captado')}`)
    .addAction(async (ctx, { gotoFlow }) => {
        stop(ctx)
        //return endFlow(`${showMSG('formulario_captado')}`)
        return gotoFlow(prima_menu)
    })


const attach_forms_continuidad = addKeyword('attach2')
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_3')}`)
    .addAnswer(`${showMSG('adjuntar_continuidad')}`, { capture: true }, async (ctx, { globalState, fallBack }) => {
        reset(ctx)
        let extractedMime = extractMimeWb(ctx)
        //console.log('ext detected: ', extractedMime)
        let formats = ['pdf', 'docx']
        if (formats.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx)
            await sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`${showMSG('no_permitida')} Solo se permiten los archivos en formato: ${formats}. ${showMSG('try_again')}`);
        }
    })
    .addAnswer(`${showMSG('formulario_captado')}`)
    .addAction(async (ctx, { gotoFlow }) => {
        stop(ctx)
        //return endFlow(`${showMSG('formulario_captado')}`)
        return gotoFlow(prima_menu)
    })



export { primera_vez, prima_menu, attach_forms, attach_forms_continuidad };