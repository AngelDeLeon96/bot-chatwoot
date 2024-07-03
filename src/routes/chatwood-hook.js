import express from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';

const router = express.Router();

// Enviar mensaje a usuario de WhatsApp
const chatWoodHook = async (req, res) => {
    const providerWS = req.providerWS;
    const body = req.body;
    const phone = body?.conversation?.meta?.sender?.phone_number.replace("+", "");

    if (body?.private) {
        res.send(null);
        return;
    }

    console.log('sended to: ', phone, 'msg:', body.content);
    await providerWS.sendMessage(`${phone}`, body.content, {});

    res.send(body);
};

router.post('/chatwood-hook', chatWoodHook);

router.get('/get-qr', async (_, res) => {
    const path = join(process.cwd(), `bot.qr.png`);
    const fileStream = createReadStream(path);

    res.writeHead(200, { "Content-type": "image/png" });
    fileStream.pipe(res);
});

export default router;
