const Map = require('../map');

class DevMap extends Map {
    constructor() {
        super();

        this.width = 2000;
        this.height = 1000;

        this.platforms = [

            // ===== SOL PRINCIPAL =====
            { x: 0, y: 600, w: 2000, h: 50 },

            // ===== PLATEFORMES ESCALIER (DOUBLE JUMP) =====
            { x: 200, y: 500, w: 150, h: 20 },
            { x: 400, y: 420, w: 150, h: 20 },
            { x: 600, y: 340, w: 150, h: 20 },

            // ===== PLATEFORME HAUTE =====
            { x: 850, y: 260, w: 200, h: 20 },

            // ===== ZONE DASH (ligne droite) =====
            { x: 1100, y: 600, w: 600, h: 50 },

            // ===== MUR NINJA (gauche) =====
            { x: 0, y: 300, w: 20, h: 300 },

            // ===== MUR NINJA (droite) =====
            { x: 1200, y: 300, w: 20, h: 300 },

            // ===== PUITS (TEST GLIDE VALKIRY) =====
            // trous dans le sol
            { x: 1400, y: 600, w: 200, h: 50 }, // gauche
            { x: 1700, y: 600, w: 300, h: 50 }, // droite

            // plateforme au-dessus du vide
            { x: 1500, y: 450, w: 150, h: 20 },

            // ===== PLATEFORME MUR COMBINÉ =====
            { x: 300, y: 250, w: 20, h: 200 }, // mur
            { x: 320, y: 250, w: 120, h: 20 }, // plateforme

        ];
    }
}

module.exports = DevMap;