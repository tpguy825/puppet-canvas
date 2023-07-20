"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeBrowser = exports.getBrowser = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
let _browser = null;
async function getBrowser() {
    if (!_browser) {
        _browser = await puppeteer_1.default.launch({ headless: true });
    }
    return _browser;
}
exports.getBrowser = getBrowser;
async function closeBrowser() {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}
exports.closeBrowser = closeBrowser;
//# sourceMappingURL=browser.js.map