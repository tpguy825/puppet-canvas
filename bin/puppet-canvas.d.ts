/// <reference types="node" />
import { ElementHandle, Page, ScreenshotOptions, Browser } from 'puppeteer';
export declare function linkCanvas(canvas: ElementHandle<HTMLCanvasElement>): Promise<EverythingNeedsAwaiting<HTMLCanvasElement>>;
export declare function createCanvas(width: number, height: number, browser?: Browser): Promise<EverythingNeedsAwaiting<HTMLCanvasElement>>;
export declare function screenshotCanvas(canvas: HTMLCanvasElement, options?: ScreenshotOptions): Promise<string | Buffer>;
export declare function releaseCanvas(canvas: HTMLCanvasElement): Promise<void>;
export declare function close(): Promise<void>;
export declare function loadFont(name: string, url: string, canvas: HTMLCanvasElement): Promise<void>;
export declare function loadImage(url: string, canvas: HTMLCanvasElement, page?: Page): Promise<HTMLImageElement>;
type EverythingNeedsAwaiting<Object> = {
	[Key in keyof Object]: Object[Key] extends Record<string | number | symbol, any> ? EverythingNeedsAwaiting<Object[Key]> : Promise<Object[Key]>;
}