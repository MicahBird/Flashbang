const electron = require("electron");
const path = require("path");
const fs = require("fs");

class Settings {
    constructor(type) {
        const userDataPath = (electron.app || electron.remote.app).getPath(
            "userData"
        );

        var defaults;
        if (type === "study") {
            //settings that can be chnaged within flashcard.html
            this.path = path.join(userDataPath + "/study-settings.json");
            defaults = {
                pairOrder: {
                    standard: true,
                    reversed: false,
                    both: false,
                },
                questionType: {
                    flashcard: true,
                    typed: false,
                },
                showInfo: true,
            };
        } else if (type === "global") {
            //settings only changable in settings.html
            this.path = path.join(userDataPath + "/settings.json");
            defaults = { theme: "light" };
        }

        this.data = parseDataFile(this.path, defaults);
    }
    get(key) {
        return this.data[key];
    }

    getAll() {
        return this.data;
    }

    set(key, val) {
        this.data[key] = val;
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }

    setAll(val) {
        this.data = val;
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }
}

function parseDataFile(filePath, defaults) {
    try {
        return JSON.parse(fs.readFileSync(filePath));
    } catch (err) {
        return defaults;
    }
}

module.exports = Settings;