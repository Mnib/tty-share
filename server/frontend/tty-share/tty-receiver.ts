import { Terminal } from 'xterm';

import base64 from './base64';

interface IRectSize {
    width: number;
    height: number;
}

class TTYReceiver {
    private xterminal: Terminal;
    private containerElement: HTMLElement;

    constructor(wsAddress: string, container: HTMLDivElement) {
        const connection = new WebSocket(wsAddress);

        // TODO: expose some of these options in the UI
        this.xterminal = new Terminal({
            cursorBlink: false,
            macOptionIsMeta: true,
            scrollback: 1000,
            fontSize: 14,
            letterSpacing: 0,
            disableStdin: true,
            theme: {
                background: '#181616',
                foreground: '#d1d1d1',
                black: '#272822',
                brightBlack: '#272822',
                red: '#f92672',
                brightRed: '#f92672',
                green: '#a6e22e',
                brightGreen: '#a6e22e',
                yellow: '#f4bf75',
                brightYellow: '#f4bf75',
                blue: '#66d9ef',
                brightBlue: '#66d9ef',
                magenta: '#ae81ff',
                brightMagenta: '#ae81ff',
                cyan: '#a1efe4',
                brightCyan: '#a1efe4',
                white: '#f8f8f2',
                brightWhite: '#f8f8f2',
            },
            fontFamily: 'SourceCode, courier-new, monospace',
        });

        this.containerElement = container;
        this.xterminal.open(container);

        connection.onclose = (_: CloseEvent) => {
            this.xterminal.blur();
            this.xterminal.options.cursorBlink = false;
            this.xterminal.clear();

            setTimeout(() => {
                this.xterminal.write('Session closed');
            }, 1000);
        };

        this.xterminal.focus();

        const containerPixSize = this.getElementPixelsSize(container);
        const newFontSize = this.guessNewFontSize(
            this.xterminal.cols,
            this.xterminal.rows,
            containerPixSize.width,
            containerPixSize.height
        );
        this.xterminal.options.fontSize = newFontSize;
        this.xterminal.options.fontFamily = 'SourceCode, courier-new, monospace';

        connection.onmessage = (ev: MessageEvent) => {
            let message = JSON.parse(ev.data);
            let msgData = base64.decode(message.Data);

            if (message.Type === 'Write') {
                let writeMsg = JSON.parse(msgData);
                this.xterminal.write(base64.base64ToArrayBuffer(writeMsg.Data));
            }

            if (message.Type == 'WinSize') {
                let winSizeMsg = JSON.parse(msgData);

                const containerPixSize = this.getElementPixelsSize(container);
                const newFontSize = this.guessNewFontSize(
                    winSizeMsg.Cols,
                    winSizeMsg.Rows,
                    containerPixSize.width,
                    containerPixSize.height
                );
                this.xterminal.options.fontSize = newFontSize;

                // Now set the new size.
                this.xterminal.resize(winSizeMsg.Cols, winSizeMsg.Rows);
            }
        };
    }

    // Get the pixels size of the element, after all CSS was applied. This will be used in an ugly
    // hack to guess what fontSize to set on the xterm object. Horrible hack, but I feel less bad
    // about it seeing that VSV does it too:
    // https://github.com/microsoft/vscode/blob/d14ee7613fcead91c5c3c2bddbf288c0462be876/src/vs/workbench/parts/terminal/electron-browser/terminalInstance.ts#L363
    private getElementPixelsSize(element: HTMLElement): IRectSize {
        const defView = this.containerElement.ownerDocument.defaultView;
        let width = parseInt(defView.getComputedStyle(element).getPropertyValue('width').replace('px', ''), 10);
        let height = parseInt(defView.getComputedStyle(element).getPropertyValue('height').replace('px', ''), 10);

        return {
            width,
            height,
        };
    }

    // Tries to guess the new font size, for the new terminal size, so that the rendered terminal
    // will have the newWidth and newHeight dimensions
    private guessNewFontSize(newCols: number, newRows: number, targetWidth: number, targetHeight: number): number {
        const cols = this.xterminal.cols;
        const rows = this.xterminal.rows;
        const fontSize = this.xterminal.options.fontSize;
        const xtermPixelsSize = this.getElementPixelsSize(this.containerElement.querySelector('.xterm-screen'));

        const newHFontSizeMultiplier = (cols / newCols) * (targetWidth / xtermPixelsSize.width);
        const newVFontSizeMultiplier = (rows / newRows) * (targetHeight / xtermPixelsSize.height);

        let newFontSize;

        if (newHFontSizeMultiplier > newVFontSizeMultiplier) {
            newFontSize = Math.floor(fontSize * newVFontSizeMultiplier);
        } else {
            newFontSize = Math.floor(fontSize * newHFontSizeMultiplier);
        }
        return newFontSize;
    }
}

export { TTYReceiver };
