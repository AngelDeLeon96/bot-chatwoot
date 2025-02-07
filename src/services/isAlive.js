import https from 'https';
import http from 'http';
import url from 'url';

async function isUrlOnline(urlString, timeout = 5000) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new url.URL(urlString);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                method: 'HEAD',
                timeout
            };

            const req = protocol.request(parsedUrl, options, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.end();
        } catch (error) {
            resolve(false);
        }
    });
}

export default isUrlOnline;