import { addKeyword, EVENTS } from '@builderbot/bot';
import path from 'path'
import { sendMessageChatwood } from '../services/chatwood.js';
import { reset, start, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import { freeFlow } from './agents.js';
import Queue from 'queue-promise';
import { saveMediaWB, getMimeWB } from '../utils/utils.js';
const queue = new Queue({
    concurrent: 1,
    interval: 500
});

const prima_menu = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('menu'), '1. Solicitud por primera vez.', '2. Adjuntar formulario de solictud y copia de cédula.', '3. (Opcional)Adjuntar de certificaciones de continuidad de otras instituciones.', '4. Consulta del trámite en curso (hablar con un agente).', '5. Salir'], { capture: true }, async (ctx, { state }) => {
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
                return fallBack();
        }
    })

const primera_vez = addKeyword(EVENTS.DOCUMENT)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('llenar_form')} y subalo.`, { media: path.join(process.cwd(), 'public/files', 'FGE-solicitud y declaracion CO.pdf') })
    .addAnswer(`Por favor suba el formulario lleno y firmado.`, { capture: true }, async (ctx, { gotoFlow }) => {
        console.log(ctx.body)
    })
    .addAction(async (ctx, { endFlow }) => {
        return endFlow()
    })

const attach_forms = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('adjuntar_form')}`, async (ctx, { provider }) => {
        try {
            reset(ctx)
            const localPath = await provider.saveFile(ctx, { path: path.join(process.cwd(), 'public/files') })
            console.log(localPath)
        }
        catch (err) {
            console.error(err)
        }
    })
    .addAnswer(`${showMSG('adjuntar_cedula')}`, { capture: true }, async (ctx, { provider }) => {
        try {
            reset(ctx)
            //const localPath = await provider.saveFile(ctx, { path: path.join(process.cwd(), 'public/files') })
            console.log(ctx)
        }
        catch (err) {
            console.error(err)
        }
    })
    .addAction(async (ctx, { endFlow }) => {
        return endFlow()
    })

const attach_forms_continuidad = addKeyword('attach')
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('adjuntar_continuidad')}`, { capture: true }, async (ctx, { provider, globalState, fallBack }) => {
        reset(ctx)
        console.log(JSON.stringify(ctx))
        let typeMSG = getMimeWB(ctx.message)

        if (typeMSG === "senderKeyDistributionMessage") {
            return fallBack(showMSG('no_permitida'));
        }
        else {
            let [msg, attachment] = await saveMediaWB(ctx)
            sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
    })
    .addAction(async (ctx, { endFlow }) => {
        stop(ctx)
        return endFlow(`${showMSG('formulario_captado')}`)
    })



export { primera_vez, prima_menu, attach_forms, attach_forms_continuidad };