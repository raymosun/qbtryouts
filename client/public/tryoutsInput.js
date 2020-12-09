const form = document.querySelector('form');
const confirmations = document.querySelector('.confirmations');
const userinfo = document.querySelector('.userinfo');
const answer = document.querySelector('input');

form.addEventListener('submit', event => {
    event.preventDefault();
});

answer.addEventListener('input', event => {
    socket.emit('answer',event.target.value);
});

socket.on('state', async state => {
    userinfo.innerHTML = `Trying out as <strong>${state.user.name}</strong></br>Your ID: ${state.user.tryoutsid}`;
    switch(state.questionState){
        case 'asking':
        case 'done':
            answer.value = state.answer == '[no answer]' ? '' : state.answer;
            enableAnswer();
            break;
    }
    if (!state.confirmationHistory) return;
    for(var confirmation of state.confirmationHistory){
        showConfirmation(confirmation);
    }
});

socket.on('questionBegin', enableAnswer);

window.addEventListener('question ended', disableAnswer);

socket.on('answer confirmation', showConfirmation);

socket.on('clear history', () => {
    confirmations.innerHTML = '';
});

function enableAnswer(){
    answer.disabled = false;
    answer.focus();
}

function disableAnswer(){
    answer.disabled = true;
    answer.value = '';
}

function showConfirmation(confirmation){
    var message = document.createElement('P');
    var userAnswer = document.createElement('SPAN');
    userAnswer.classList.add('answer');
    var ending = document.createElement('SPAN');
    
    userAnswer.textContent = confirmation.answer;
    ending.innerHTML = ` to <em>${confirmation.question}</em>`;

    message.innerHTML = 'Answered ';
    message.append(userAnswer)
    message.append(ending);
    confirmations.prepend(message);
}

setInterval(fetch, 1000*60*20, '/');