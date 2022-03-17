const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const BunchStorage = require("./bunchStorage");
const Settings = require("./settings");
const fs = require("fs");

// Set env
process.env.NODE_ENV = "development";

const isDev = process.env.NODE_ENV !== "production" ? true : false;
// const isDev = false;
const isMac = process.platform === "darwin" ? true : false;

let mainWindow;

//HACK....this is painful wtf
//-----------background flash fix------------
const globalSettings = new Settings("global");

const backgroundLookUp = {
    light: "#e7e6e1",
    dark: "#222831",
    "lemon-mint": "#fffdde",
    "sea-mist": "#c4f8f0",
    beehive: "#ffc600",
    houseplant: "#a7ff83",
    cafe: "#f4dfba",
    terminal: "#000",
    dream: "#091933",
    construction: "#52575d",
};

var theme = globalSettings.get("theme");

ipcMain.on("background:set", () => {
    theme = globalSettings.get("theme");
    mainWindow.setBackgroundColor(backgroundLookUp[theme]);
});
//--------------------------------------

function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: "Flashbang",
        width: isDev ? 875 : 625,
        height: 425,
        icon: "./assets/icons/icon.png",
        resizable: false,
        backgroundColor: backgroundLookUp[theme],
        // titleBarStyle: "hidden",
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
        },
    });

    mainWindow.on("ready-to-show", function () {
        mainWindow.show();
        mainWindow.focus();
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.loadFile("./app/index.html");
    app.commandLine.appendSwitch("--enable-features", "OverlayScrollbar");
}

app.on("ready", () => {
    createMainWindow();

    const mainMenu = Menu.buildFromTemplate(menu);
    Menu.setApplicationMenu(mainMenu);
});

const menu = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
        label: "Edit",
        submenu: [
            { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
            {
                label: "Redo",
                accelerator: "Shift+CmdOrCtrl+Z",
                selector: "redo:",
            },
            { type: "separator" },
            { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
            { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
            { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
            {
                label: "Select All",
                accelerator: "CmdOrCtrl+A",
                selector: "selectAll:",
            },
        ],
    },
    ...(isDev
        ? [
              {
                  label: "Developer",
                  submenu: [
                      { role: "reload" },
                      { role: "forcereload" },
                      { type: "separator" },
                      { role: "toggledevtools" },
                  ],
              },
          ]
        : []),
];

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

ipcMain.on("returnToIndex", returnToIndexPage);

//manages when title change
ipcMain.on("bunch:setAll", (e, bunch, fileTitle) => {
    var count = 0;
    const userDataPath = app.getPath("userData");
    var title;
    title = bunch.title + "";
    var filePath = userDataPath + "/bunches/" + title + ".json";
    while (fs.existsSync(filePath)) {
        //checks to see if title is taken
        count += 1;
        filePath = userDataPath + "/bunches/" + title + count + ".json";
    }
    title += count === 0 ? "" : count;

    const bunchStorage = new BunchStorage({
        fileName: fileTitle,
    });
    bunchStorage.set("title", title);

    const oldPath = userDataPath + "/bunches/" + fileTitle + ".json";
    fs.rename(oldPath, filePath, () => {});
    e.reply("bunch:getAll", bunchStorage.getAll());
});

ipcMain.on("bunch:save", (e, bunch, fileTitle) => {
    const bunchStorage = new BunchStorage({
        fileName: fileTitle,
    });

    for (const [key, value] of Object.entries(bunch)) {
        bunchStorage.set(key, value);
    }

    e.reply("bunch:getAll", bunchStorage.getAll()); //TODO idk if this should rlly be here (used for import button)
});

ipcMain.on("bunch:delete", (e, fileName) => {
    const userDataPath = app.getPath("userData");
    var filePath = userDataPath + "/bunches/" + fileName + ".json";
    fs.unlink(filePath, () => {});
});

ipcMain.on("bunch:getAll", (e, title) => {
    const bunchStorage = new BunchStorage({ fileName: title });
    e.reply("bunch:getAll", bunchStorage.getAll()); //TODO idk if this should rlly be here (used for import button)
});

ipcMain.on("bunch:set", (e, title, input) => {
    const bunchStorage = new BunchStorage({ fileName: title });
    bunchStorage.set(input.key, input.value);
});

//pass bunch title of "" for defaults
ipcMain.on("bunch:get", (e, title, key) => {
    const bunchStorage = new BunchStorage({ fileName: title });
    e.reply(`bunch:get${key}`, bunchStorage.get(key));
});

ipcMain.on("bunchdata:get", sendBunchData);

//used to format index page
//this has to be done here and not in index becuase index.js cannot access directory
function sendBunchData() {
    //TODO see if there is a way to stop this from reading all the contents of every json file
    const userDataPath = app.getPath("userData");
    const bunchesDir = userDataPath + "/bunches";
    if (fs.existsSync(userDataPath + "/bunches")) {
        try {
            var data = [];
            const files = fs.readdirSync(bunchesDir, "utf-8");
            let re = /^\./i; //excludes hidden files
            for (x = 0; x < files.length; x++) {
                if (!re.exec(files[x])) {
                    const jsonString = fs.readFileSync(
                        bunchesDir + "/" + files[x]
                    );
                    const bunch = JSON.parse(jsonString);
                    const title = bunch.title;
                    const lastUsed = bunch.lastUsed;
                    const numTerms = bunch.pairs.length;
                    data.push({ title, lastUsed, numTerms });
                }
            }
            mainWindow.webContents.send("bunchdata:get", data);
        } catch {
            (error) => {
                console.log(error);
            };
        }
    } else {
        mainWindow.webContents.send("bunchdata:get", []); //return 0 if bunches directory dne
    }
}

function returnToIndexPage() {
    mainWindow.loadFile("./app/index.html");
}

//----------Global Settings----------

ipcMain.on("globalSettings:get", (e, key) => {
    // mainWindow.webContents.send("settings:getAll", globalSettings.getAll());
    e.reply(`globalSettings:get${key}`, globalSettings.get(key));
});

ipcMain.on("globalSettings:getAll", (e) => {
    // mainWindow.webContents.send("settings:getAll", globalSettings.getAll());
    e.reply("globalSettings:getAll", globalSettings.getAll());
});

ipcMain.on("globalSettings:set", (e, input) => {
    globalSettings.set(input.key, input.value);
    e.reply("globalSettings:getAll", globalSettings.getAll());
});

//replies only wiht the set value
ipcMain.on("globalSettings:set1", (e, input) => {
    globalSettings.set(input.key, input.value);
    e.reply(`globalSettings:get${input.key}`, globalSettings.get(input.key));
});

ipcMain.on("globalSettings:resetDefaults", (e) => {
    globalSettings.resetDefault();
    e.reply("globalSettings:getAll", globalSettings.getAll());
    e.reply("globalSettings:gettheme", globalSettings.get("theme"));
});

app.allowRendererProcessReuse = true;
