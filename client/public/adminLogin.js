document.querySelector('input').focus();

const form = document.querySelector('form');
form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = formData.get('password');

    if (!password) return;

    const invalid = document.querySelector('.invalid');
    invalid.style.display = "none";
    
    fetch('/api/adminlogin', {
        method: 'POST',
        body: password,
        headers: {
            'content-type': 'text/plain',
            'content-length': password.length.toString()
        }
    })
    .then( (res) => res.json())
    .then( (res) => {
        if (res.valid) location.reload();
        else invalid.style.display = "inline-block";
    });
});