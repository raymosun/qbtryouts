const socket = io('/tryouts');

const status = document.querySelector('.status');
const question = document.querySelector('.question');
const loadingBar = document.querySelector('.loading-bar');
const mainTime = document.querySelector('.main-time');
const deciseconds = document.querySelector('.deciseconds');

var cancelled;
var questionTime = 8000;

socket.on('restart', () => {
    location.reload();
});

socket.on('disconnect', () => {
    location.reload();
});

socket.on('state', async state => {
    console.log(state);
    status.innerHTML = state.status;
    questionTime = state.questionTime;
    if (state.status === 'starting soon...'){
        loadingBar.style.backgroundColor = '#555555';
        syncTimer(state.timeElapsed,state.startWaitTime, function(){});
    }
    switch(state.questionState){
        case 'prep':
            loadingBar.style.backgroundColor = "#555555";
            question.innerHTML = '<span class="noquestion"><em>question incoming</em></span>';
            syncTimer(state.timeElapsed,3000, function(){},true);
            break;
        case 'asking':
            loadingBar.style.backgroundColor = "#1abd40";
            loadingBar.style.width = '100%';
            question.innerHTML = '&#8203';
            state.sentQuestionWords.forEach( word => {
                question.innerHTML += `<span>${word} </span>`;
            });
            break;
        case 'done':
            loadingBar.style.backgroundColor = "#1abd40";
            syncTimer(state.timeElapsed,questionTime, () => {
                question.innerHTML = '<span class="noquestion"><em>question</em></span>';
                window.dispatchEvent(questionEnded);
            });
            question.innerHTML = '&#8203';
            state.sentQuestionWords.forEach( word => {
                question.innerHTML += `<span>${word} </span>`;
            });
            break;
    }
});

socket.on('status', statusVal => {
    status.innerHTML = statusVal;
});

socket.on('prep', () => {
    loadingBar.style.backgroundColor = "#555555";
    question.innerHTML = '<span class="noquestion"><em>question incoming</em></span>';
    updateTimer(3000, function(){},true)
});

socket.on('questionTime', time => {
    questionTime = time;
});

socket.on('questionBegin', () => {
    question.innerHTML = '&#8203';
    loadingBar.style.backgroundColor = "#1abd40";
});

socket.on('questionWord', word => {
    question.innerHTML += `<span>${word} </span>`;
});

socket.on('questionDone', () => {
    updateTimer(questionTime, () => {
        question.innerHTML = '<span class="noquestion"><em>question</em></span>';
        window.dispatchEvent(questionEnded);
    });
});

socket.on('starting soon', waitTime => {
    loadingBar.style.backgroundColor = '#555555';
    updateTimer(waitTime, ()=>{});
});

socket.on('cancel', () => {
    cancelled = true;
    loadingBar.style.width = 0;
    mainTime.innerHTML = '00:00';
    deciseconds.innerHTML = '.0';
});

function syncTimer(timeElapsed,duration,endFunction,countUp=false){
    updateTimer(duration,endFunction,countUp,Date.now()-timeElapsed,Date.now());
}

async function updateTimer(duration,endFunction,countUp=false,startTime=Date.now(),currentTime=startTime){
    if (cancelled) return cancelled = false;
    const timeLeft = Math.max(duration-(currentTime-startTime), 0);

    var minutes = Math.floor(timeLeft/1000/60);
    var seconds = Math.floor(timeLeft/1000)%60;
    const decisecondsVal = Math.floor(timeLeft%1000 / 100);
    if (seconds < 10) seconds = '0'+seconds;
    if (minutes < 10) minutes = '0'+minutes;

    mainTime.innerHTML = `${minutes}:${seconds}`;
    deciseconds.innerHTML = `.${decisecondsVal}`;

    if (countUp) widthPercent = Math.min(100-((timeLeft-100)/duration*100), 100);
    else widthPercent = Math.max((timeLeft-100)/duration*100,0);

    const widthString = widthPercent+'%';
    loadingBar.style.width = widthString;

    if (timeLeft === 0) return endFunction();

    const inaccuracy = Date.now()-currentTime;
    setTimeout(updateTimer,100-inaccuracy,duration,endFunction,countUp,startTime,currentTime+100)
}

const questionEnded = new Event('question ended');