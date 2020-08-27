document.getElementById('tryoutsid').focus();

const form = document.getElementById('form');
form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const tryoutsid = formData.get('tryoutsid');

    if (!tryoutsid) return;

    const invalid = document.querySelector('.invalid');
    invalid.style.display = "none";
    
    fetch('/api/tryoutsid', {
        method: 'POST',
        body: tryoutsid,
        headers: {
            'content-type': 'text/plain',
            'content-length': tryoutsid.length.toString()
        }
    })
    .then( (res) => res.json())
    .then( (res) => {
        if (res.valid) location.href = '/tryouts';
        else invalid.style.display = "inline-block";
    });
});