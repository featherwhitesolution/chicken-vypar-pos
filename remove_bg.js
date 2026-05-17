import { Jimp } from 'jimp';

async function main() {
    try {
        console.log("Reading image...");
        // In jimp v1, Jimp.read might need to be imported differently or used differently
        // It's safer to use Jimp.read()
        const image = await Jimp.read('public/logo.png');
        const w = image.bitmap.width;
        const h = image.bitmap.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2;
        
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // If it's outside the circle (anti-aliased slightly)
                if (dist > r - 1.5) {
                    image.setPixelColor(0x00000000, x, y);
                }
            }
        }
        await image.write('public/logo.png');
        console.log("Background removed successfully!");
    } catch(e) {
        console.error("Error:", e);
    }
}
main();
