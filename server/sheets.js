const {GoogleSpreadsheet} = require('google-spreadsheet');

var doc;
var configSheet;
var outputSheet;

exports.questions = [];
exports.users = [];

exports.initSheets = async function () {
    doc = new GoogleSpreadsheet(process.env.SHEETS_FILE_ID);

    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
    });
    await doc.loadInfo();

    configSheet = doc.sheetsById[process.env.CONFIG_SHEET_ID];
    outputSheet = doc.sheetsById[process.env.OUTPUT_SHEET_ID];

    await exports.updateInfo();
}

exports.updateInfo = async function updateInfo() {
    await configSheet.loadCells('B4:B');
    await outputSheet.loadCells();

    exports.questions = [];
    exports.users = [];

    for(var r = 3; r < configSheet.rowCount; r++){
        // load questions
        const question = configSheet.getCell(r,1).value;
        if (question) exports.questions.push(question);
    }
    
    for(var c = 1; c < outputSheet.columnCount; c++){
        // load users
        const tryoutsid = outputSheet.getCell(0,c).value;
        const name = outputSheet.getCell(1,c).value;
        if (tryoutsid && name) exports.users.push( {tryoutsid: tryoutsid, name: name})
    }
}

exports.postAnswers = async function (question,answers){
    await exports.updateInfo();
    var latestRow;
    var questionCell;
    for(latestRow = 2; latestRow < outputSheet.rowCount; latestRow++){
        var questionCell = outputSheet.getCell(latestRow,0);
        if (!questionCell.value) break;
    }
    if (latestRow == outputSheet.rowCount) throw new Error('no more space to log answers');
    questionCell.value = question;

    for(var c = 1; c < outputSheet.columnCount; c++){
        for(var tryoutsid in answers){
            if (tryoutsid == outputSheet.getCell(0,c).value){
                outputSheet.getCell(latestRow,c).value = answers[tryoutsid];
            }
        }
    }
    await outputSheet.saveUpdatedCells();
}