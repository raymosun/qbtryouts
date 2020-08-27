module.exports = () => {
    // if running locally
    if (!process.env.PORT) {
        const credFile = require('./keys.json');
        process.env.PORT = 5000;
        process.env.GOOGLE_PRIVATE_KEY = credFile.sheets.private_key;
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = credFile.sheets.client_email;
        process.env.SERVER_SESSION_SECRET = credFile.server_session_secret;
        process.env.ADMIN_PASSWORD = credFile.admin_password;
        process.env.SHEETS_FILE_ID = credFile.sheets_file_id;
        process.env.CONFIG_SHEET_ID = credFile.config_sheet_id;
        process.env.OUTPUT_SHEET_ID = credFile.output_sheet_id;
    }
    process.env.GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/gm, '\n');
}