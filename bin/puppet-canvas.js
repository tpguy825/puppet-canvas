"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadImage = exports.loadFont = exports.close = exports.releaseCanvas = exports.screenshotCanvas = exports.createCanvas = exports.linkCanvas = void 0;
const browser_1 = require("./browser");
function proxy(handler, path = [], refId) {
    const proxyInstance = new Proxy(function () { }, {
        get(_, prop, receiver) {
            if (prop === '$puppetCanvasRefId' && refId) {
                return refId;
            }
            if (prop === 'then') {
                if (path.length === 0) {
                    return { then: () => receiver };
                }
                const getter = handler({ type: 'GET', path });
                return getter.then.bind(getter);
            }
            return proxy(handler, path.concat(`${String(prop)}`));
        },
        set(_, prop, value) {
            handler({
                type: 'SET',
                path: path.concat(`${String(prop)}`),
                value
            });
            return true;
        },
        apply(_, __, args) {
            return handler({
                type: 'APPLY',
                path,
                args
            });
        }
    });
    return proxyInstance;
}
function createParamRef(param) {
    if (param && param.$puppetCanvasRefId) {
        const deref = {
            id: param.$puppetCanvasRefId,
            type: '_deferred_'
        };
        return deref;
    }
    return param;
}
function createHandler(canvasHandle, proxyTarget) {
    return async (request) => {
        try {
            // if any of the request args or values are proxied, replace them by their handles
            if (request.value) {
                request.value = createParamRef(request.value);
            }
            if (request.args) {
                for (let i = 0; i < request.args.length; i++) {
                    request.args[i] = createParamRef(request.args[i]);
                }
            }
            // Execute in browser
            const target = proxyTarget || canvasHandle;
            const result = await target.evaluate(async (jsTarget, canvasElement, type, path, value, ...args) => {
                // de-ref params
                const derefArg = (arg) => {
                    if (arg && (typeof arg === 'object') && arg.type === '_deferred_') {
                        const cw = self;
                        const refMap = cw.$puppetCanvasMap.get(canvasElement);
                        if (refMap) {
                            return refMap.get(arg.id);
                        }
                    }
                    return arg;
                };
                value = derefArg(value);
                if (args) {
                    for (let i = 0; i < args.length; i++) {
                        args[i] = derefArg(args[i]);
                    }
                }
                const reducePath = (list) => list.reduce((o, prop) => (o ? o[prop] : o), jsTarget);
                const ref = reducePath(path);
                const refParent = reducePath(path.slice(0, -1));
                let out = null;
                switch (type) {
                    case 'GET':
                        out = ref;
                        break;
                    case 'SET':
                        const prop = path.length && path.pop();
                        if (prop) {
                            refParent[prop] = value;
                        }
                        return true;
                    case 'APPLY':
                        out = await ref.apply(refParent, args);
                }
                // instead of returning an object, store the object ref in a map
                // The handle of this object is then later retrieved
                if (typeof out === 'object') {
                    const cw = self;
                    const refMap = cw.$puppetCanvasMap.get(canvasElement);
                    if (refMap) {
                        const refId = `${Date.now()}-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`;
                        refMap.set(refId, out);
                        const defref = {
                            id: refId,
                            type: '_deferred_'
                        };
                        out = defref;
                    }
                    else {
                        throw new Error('Canvas element not initialized as puppet-canvas');
                    }
                }
                return out;
            }, canvasHandle, request.type, request.path || [], request.value, ...(request.args || []));
            if ((typeof result === 'object') && result.type === '_deferred_') {
                // Retrieve the object handle of the response object
                const refId = result.id;
                const deferredHandle = await getHandlyByRefId(canvasHandle, refId);
                return deferredHandle ? proxy(createHandler(canvasHandle, deferredHandle), [], refId) : null;
            }
            return result;
        }
        catch (err) {
            throw err;
        }
    };
}
async function getHandlyByRefId(canvasHandle, refId) {
    return await canvasHandle.evaluateHandle((canvasElement, refId) => {
        const cw = self;
        const refMap = cw.$puppetCanvasMap.get(canvasElement);
        if (refMap) {
            return refMap.get(refId);
        }
        return null;
    }, refId);
}
async function linkCanvas(canvas) {
    return initializeCanvas(canvas);
}
exports.linkCanvas = linkCanvas;
async function createCanvas(width, height, browser) {
    const html = `<canvas width="${width}" height="${height}"></canvas>`;
    if (!browser) {
        browser = await (0, browser_1.getBrowser)();
    }
    const page = await browser.newPage();
    await page.setContent(html);
    const canvasElement = await page.$('canvas');
    if (canvasElement) {
        return initializeCanvas(canvasElement, page);
    }
    else {
        throw new Error('Failed to initialize canvas in puppeteer');
    }
}
exports.createCanvas = createCanvas;
const proxyMap = new Map();
async function initializeCanvas(canvasHandle, page) {
    await canvasHandle.evaluate((canvas) => {
        const cw = self;
        if (!cw.$puppetCanvasMap) {
            cw.$puppetCanvasMap = new Map();
        }
        if (!cw.$puppetCanvasMap.has(canvas)) {
            cw.$puppetCanvasMap.set(canvas, new Map());
        }
    });
    const p = proxy(createHandler(canvasHandle));
    proxyMap.set(p, {
        canvasHandle: canvasHandle,
        page
    });
    return p;
}
async function screenshotCanvas(canvas, options) {
    if (proxyMap.has(canvas)) {
        const canvasHandle = proxyMap.get(canvas).canvasHandle;
        return canvasHandle.screenshot(options);
    }
    else {
        throw new Error('Canvas element not initialized as puppet-canvas');
    }
}
exports.screenshotCanvas = screenshotCanvas;
async function releaseCanvas(canvas) {
    if (proxyMap.has(canvas)) {
        const handle = proxyMap.get(canvas);
        await handle.canvasHandle.evaluate((canvas) => {
            const cw = self;
            if (cw.$puppetCanvasMap) {
                cw.$puppetCanvasMap.delete(canvas);
            }
        });
    }
}
exports.releaseCanvas = releaseCanvas;
async function close() {
    return (0, browser_1.closeBrowser)();
}
exports.close = close;
async function loadFont(name, url, canvas) {
    const cachedRecord = proxyMap.get(canvas);
    if (cachedRecord) {
        await cachedRecord.canvasHandle.evaluate(async (_, fontName, fontUrl) => {
            console.log('ff', fontName, fontUrl);
            //@ts-ignore
            const ff = new FontFace(fontName, `url(${fontUrl})`);
            await ff.load();
            document.fonts.add(ff);
        }, name, url);
    }
    else {
        throw new Error('Canvas element not initialized as puppet-canvas');
    }
}
exports.loadFont = loadFont;
async function loadImage(url, canvas, page) {
    const cachedRecord = proxyMap.get(canvas);
    const pageToUse = (cachedRecord && cachedRecord.page) || page;
    if (pageToUse) {
        const canvasHandle = cachedRecord.canvasHandle;
        const imageRef = await pageToUse.evaluate((canvasElement, url) => {
            return new Promise((resolve, reject) => {
                const img = document.createElement('img');
                img.onerror = () => reject(new Error('Image load error'));
                img.onabort = () => reject(new Error('Image load aborted'));
                img.onload = () => {
                    const cw = self;
                    const refMap = cw.$puppetCanvasMap.get(canvasElement);
                    if (refMap) {
                        const refId = `${Date.now()}-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`;
                        refMap.set(refId, img);
                        const defref = {
                            id: refId,
                            type: '_deferred_'
                        };
                        resolve(defref);
                    }
                };
                img.src = url;
            });
        }, canvasHandle, url);
        if (imageRef) {
            const refId = imageRef.id;
            const deferredHandle = await getHandlyByRefId(canvasHandle, refId);
            return proxy(createHandler(canvasHandle, deferredHandle), [], refId);
        }
        else {
            throw new Error('Failed to load image');
        }
    }
    else {
        throw new Error('No reference page found for this canvas');
    }
}
exports.loadImage = loadImage;
//# sourceMappingURL=puppet-canvas.js.map