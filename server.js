const express = require('express');
const session = require('express-session');
const path = require('path');
const socket = require('socket.io');
const sheets = require('./server/sheets.js');

require('./server/initEnv.js')();

const app = express();
const server = app.listen(process.env.PORT, () => {
    const startupMessage = `server started on port ${process.env.PORT}`;
    console.log(startupMessage);
    sendAdminMessage('info',startupMessage);
});
const io = socket(server)

// server vars
var status = "not started";
var consoleHistory = [];
var questionState = '';
var answers = {};
var timeBegin;
var sentQuestionWords = [];
var confirmationHistories = {};
var startWaitTime;
var cancelled;

// load sheets info
sheets.initSheets()
.then(() => {
    console.log('sheets initialized');
    sendAdminMessage('info','sheets intialized');
});

// middleware
app.use(express.static('client/public'));
app.use(express.json());
app.use(express.text());
const sessionMiddleware = session({
    secret: process.env.SERVER_SESSION_SECRET,
    saveUninitialized: false,
    resave: false
});
app.use(sessionMiddleware);

// routing
app.get('/', (req,res) => {
    sendClient(res,'index.html');
});

app.get('/tryouts', (req,res) => {
    const sess = req.session;
    var validId = false;
    sheets.users.forEach( user => {
        if (user.tryoutsid == sess.tryoutsid) validId = true;
    });
    if (validId) sendClient(res,'tryouts.html');
    else sendClient(res,'tryoutsNoID.html');
});

app.get('/admin', (req,res) => {
    const sess = req.session;
    if (sess.admin) sendClient(res, 'adminConsole.html');
    else sendClient(res,'adminLogin.html');
});

app.post('/api/tryoutsid', (req,res) => {
    const id = req.body;
    if (getUser(id)){
        sess = req.session;
        sess.tryoutsid = id;
        res.json({ valid: true });
    }
    else{
        res.status(400);
        res.json({
            valid: false
        });
    }
});

app.post('/api/adminlogin', (req,res) => {
    const password = req.body;
    const sess = req.session;
    if (password == process.env.ADMIN_PASSWORD) {
        sess.admin = true;
        res.json({
            valid: true
        });
    }
    else{
        res.status(401);
        res.json({
            valid: false
        });
    }
});

app.post('/api/command', (req,res) => {
    const sess = req.session;
    if (!sess.admin){
        res.status(403);
        res.json({
            message: 'not authenticated as admin'
        });
        return;
    }
    else { res.sendStatus(200); }
    var command = req.body;
    sendAdminMessage('echo', `<em>${command}</em>`);

    handleCommand(command);
});

// socket
const ioTryouts = io.of('/tryouts');
ioTryouts.use( (socket,next) => {
    sessionMiddleware(socket.request, {}, next);
});
ioTryouts.on('connection', (socket) => {
    const sess = socket.request.session;
    if (!sess.tryoutsid && !sess.admin) return ioTryouts.emit('restart');
    
    socket.emit('state', {
        status: status,
        user: getUser(sess.tryoutsid),
        questionState: questionState,
        timeElapsed: Date.now()-timeBegin,
        sentQuestionWords: sentQuestionWords,
        answer: answers[sess.tryoutsid],
        confirmationHistory: confirmationHistories[sess.tryoutsid],
        startWaitTime: startWaitTime
    });

    socket.on('answer', answer => {
        answers[sess.tryoutsid] = answer ? answer : '[no answer]';
        updateConsoleAnswers();
    });
});

const ioAdmin = io.of('/admin');
ioAdmin.use( (socket,next) => {
    sessionMiddleware(socket.request, {}, next);
});
ioAdmin.on('connection', (socket) => {
    const sess = socket.request.session;
    if(!sess.admin){
        socket.emit('not authorized');
        return socket.disconnect(true);
    }

    socket.emit('history', consoleHistory);
    updateConsoleAnswers();
    sendAdminMessage('info',`${socket.id}: hello!`)
});

// util
function sendClient(res,file){
    res.sendFile(path.join(__dirname+'/client/'+file));
}

function getUser(id){
    return sheets.users.find( user => user.tryoutsid == id );
}

function sendAdminMessage(type, text){
    var time = (new Date).toTimeString();
    time = time.substring(0,time.indexOf(' '));
    const message = {
        type: type,
        time: time,
        message: text
    };
    consoleHistory.push(message);
    ioAdmin.emit('console', message);
}

function updateStatus(newStatus){
    status = newStatus;
    ioTryouts.emit('status', status);
}

function handleCommand(command){
    var args = '';
    if (command.includes(' ')){
        args = command.substring(command.indexOf(' ')+1)
        command = command.substring(0,command.indexOf(' '));
    }

    switch(command){
        case 'ping':
            sendAdminMessage('info','pong!');
            break;
        case 'status':
            updateStatus(args);
            sendAdminMessage('info',`status updated to: '${args}'`);
            break;
        case 'see':
            switch(args){
                case 'q':
                case 'questions':
                    questionsString = 'questions:';
                    sheets.questions.forEach( (question,index) => {
                        questionsString += `<br>${index} - ${question}`;
                    });
                    sendAdminMessage('info',questionsString);
                    break;
                case 'u':
                case 'users':
                    usersString = 'users:';
                    sheets.users.forEach( user => {
                        usersString += `<br>${user.tryoutsid}, ${user.name}`
                    });
                    sendAdminMessage('info',usersString);
                    break;
                default:
                    sendAdminMessage('err',`no '${args}' to see`);
            }
            break;
        case 'ask':
            if (!args || isNaN(args)){
                sendAdminMessage('err','must give question number');
                break;
            }
            args = parseInt(args);
            if (args < 0 || args >= sheets.questions.length){
                sendAdminMessage('err', `question index out of range
                 (there are ${sheets.questions.length} questions)`);
                break;
            }
            askQuestion(args)
            .catch(err => {
                sendAdminMessage('err',err.message)
            });
            break;
        case 'update':
            sendAdminMessage('info','updating sheets data...');
            sheets.updateInfo().then( () => {
                updateConsoleAnswers();
                sendAdminMessage('info','done updating.');
            });
            break;
        case 'rs':
        case 'restart':
            sendAdminMessage('info','refreshing everyone in 5 seconds...');
            setTimeout(() => {
                ioTryouts.emit('restart');
                sendAdminMessage('info','refreshed everyone\'s pages')
            },5000);
            break;
        case 'begin':
            if (isNaN(args) || !args){
                return sendAdminMessage('err', 'must give wait time before start in seconds');
            }
            sendAdminMessage('info', `beginning tryouts in ${args} seconds`);
            startWaitTime = parseInt(args);
            runTryouts();
            break;
        case 'cancel':
            sendAdminMessage('info','cancelling...');
            if (status === 'starting soon...'){
                ioTryouts.emit('cancel');
                updateStatus('not started');
                clearInterval(sleeper);
                sendAdminMessage('info','cancelled.');
            }
            else cancelled = true;
            break;
        case 'h':
        case 'help':
            var commands = ['Commands:','ping','status','see (questions or users)',
                            'ask','update','restart','begin','cancel','help']
            sendAdminMessage('info',commands.join('<br>'));
            break;
        default:
            sendAdminMessage('err',`no command '${command}' recognized`)
    }
}

async function askQuestion(questionIndex){
    if (questionState) throw new Error('already asking a question');

    const question = sheets.questions[questionIndex];
    sendAdminMessage('info',`asking question ${questionIndex}, '${question}'`);

    ioTryouts.emit('prep');
    questionState = 'prep';
    timeBegin = Date.now();
    await sleep(3200);

    ioTryouts.emit('questionBegin');
    sentQuestionWords = [];
    questionState = 'asking';
    resetAnswers();
    updateConsoleAnswers();
    await sleep(100);

    words = question.split(' ');
    while (words.length > 0) {
        word = words.shift();
        ioTryouts.emit('questionWord',word);
        sentQuestionWords.push(word);
        await sleep(200);
    }

    ioTryouts.emit('questionDone');
    timeBegin = Date.now();
    questionState = 'done';

    // send confirmations of answers and log them
    await sleep(5500);
    for(var tryoutsid in answers){
        if (!confirmationHistories[tryoutsid]){
            confirmationHistories[tryoutsid] = [];
        }
        confirmationHistories[tryoutsid].push({
            question: question,
            answer: answers[tryoutsid]
        }); 
    }
    for(var socketId in ioTryouts.sockets){
        const socket = ioTryouts.sockets[socketId];
        const sess = socket.request.session;
        if (sess.tryoutsid){
            const confirmation = confirmationHistories[sess.tryoutsid].slice(-1).pop();
            socket.emit('answer confirmation', confirmation);
        }
    }
    questionState = '';

    sheets.postAnswers(question,answers)
    .then( () => {
        sendAdminMessage('info', `answers posted for question ${questionIndex}, '${question}'`);
    })
    .catch(err => {
        sendAdminMessage('err',err.message)
    });
}

var sleeper;
async function sleep(time){
    return new Promise(res => {
        sleeper = setTimeout(res,time);
    });
}

function resetAnswers(){
    answers = {};
    sheets.users.forEach( user => {
        answers[user.tryoutsid] = '[no answer]';
    });
}

function updateConsoleAnswers(){
    ioAdmin.emit('answers',{
        users: sheets.users,
        answers: answers
    });
}

async function runTryouts(){
    cancelled = false;

    timeBegin = Date.now();
    updateStatus('starting soon...');
    ioTryouts.emit('starting soon', startWaitTime);

    await sleep(startWaitTime);

    for(var i = 0; i < sheets.questions.length; i++){
        if (cancelled){
            cancelled = false;
            updateStatus('not started');
            sendAdminMessage('info','cancelled.');
            return;
        }
        updateStatus(`in progress (${i+1}/${sheets.questions.length})`);
        await askQuestion(i);
        await sleep(1000);
    }

    sendAdminMessage('info','tryouts completed');
    updateStatus('finished. thanks for trying out!');
}