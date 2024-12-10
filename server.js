const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const handlebars = require("handlebars");
const fs = require('node:fs');
const { parse } = require('node:path');
const app = express();
const port = 80;

const domain = 'http://books.final/';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const top = fs.readFileSync('./html/top.html', 'utf8');
const bottom = fs.readFileSync('./html/bottom.html', 'utf8');

// MESSAGES

const messages = {
    create_success: { msg: 'Knyga sėkmingai sukurta!', type: 'success' },
    edit_success: { msg: 'Knyga sėkmingai atnaujinta!', type: 'success' },
    delete_success: { msg: 'Knyga sėkmingai ištrinta!', type: 'success' },
    validation_error: { msg: 'Užpildykite visus laukus!', type: 'danger' }
};

const getMessages = msg => {
    if (!msg) return null;
    const message = messages[msg];
    if (!message) return null;
    return message;
}

const addToSession = (req, key, value) => {
    req.session.data[key] = value;
    const sessionData = fs.readFileSync('./data/session.json', 'utf8');
    const sessions = JSON.parse(sessionData);
    const session = sessions.find(s => s.id === req.session.id);
    session.data = req.session.data;
    fs.writeFileSync('./data/session.json', JSON.stringify(sessions));
  }

// MIDDLEWARE

const cookiesManager = (req, res, next) => {

    let session = req.cookies.session || '';
    let sessionData = fs.readFileSync('./data/session.json', 'utf8');
    sessionData = JSON.parse(sessionData);
    const findSession = sessionData.find(s => s.id === session);
    if (session && findSession) {
        req.session = findSession;
    } else {
        req.session = {};
        session = uuidv4();
        sessionData.push({ id: session, data: {} });
        sessionData = JSON.stringify(sessionData);
        fs.writeFileSync('./data/session.json', sessionData);
    }
    res.cookie('session', session, { maxAge: 1000 * 60 * 60 * 24 * 365 });

    next();
}


app.use(cookiesManager);

// ROUTES

app.get('/', (req, res) => {

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);

    const file = top + fs.readFileSync('./html/read.html', 'utf8') + bottom;
    const template = handlebars.compile(file);
    const data = {
        pageTitle: 'Knygų sąrašas',
        domain: domain,
        books,
        message: getMessages(req.query.msg)
    };
    const html = template(data);
    res.send(html);
});

app.get('/create', (req, res) => {

    const file = top + fs.readFileSync('./html/create.html', 'utf8') + bottom;
    const template = handlebars.compile(file);
    const data = {
        pageTitle: 'Nauja knyga',
        domain: domain,
        message: getMessages(req.query.msg)
    };
    const html = template(data);
    res.send(html);
});

app.get('/edit/:id', (req, res) => {

    const file = top + fs.readFileSync('./html/edit.html', 'utf8') + bottom;
    const template = handlebars.compile(file);

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);
    const id = req.params.id;

    const book = books.find(book => book.id === id);

    // validation

    if (!book) {
        res.status(404).send('Tokios knygos nėra');
        return;
    }

    const data = {
        pageTitle: `Redaguoti knygą ${book.title}`,
        domain: domain,
        ...book
    };
    const html = template(data);
    res.send(html);
});

app.post('/store', (req, res) => {
    const { title, author, year, genre, isbn, pages } = req.body;
    const id = uuidv4();

    // need validation

    if (!title || !author || !year || !genre || !isbn || !pages) {
        res.status(422).redirect(domain + 'create?msg=validation_error');
        return;
    }

    const book = { id, title, author, year, genre, isbn, pages };

    let data = fs.readFileSync('./data/books.json', 'utf8');
    data = JSON.parse(data);
    data.push(book);
    data = JSON.stringify(data);
    fs.writeFileSync('./data/books.json', data);

    res.status(302).redirect(domain + '?msg=create_success');


});

app.post('/update/:id', (req, res) => {

    const { title, author, year, genre, isbn, pages } = req.body;

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);
    const id = req.params.id;

    const oldBook = books.find(book => book.id === id);

    // validation
    if (!oldBook) {
        res.status(404).send('Tokios knygos nėra');
        return;
    }

    const newBook = { id: oldBook.id, title, author, year, genre, isbn, pages };

    books = books.map(book => book.id === id ? newBook : book);


    books = JSON.stringify(books);
    fs.writeFileSync('./data/books.json', books);

    res.status(302).redirect(domain + '?msg=edit_success');


});

app.get('/delete/:id', (req, res) => {

    const file = top + fs.readFileSync('./html/delete.html', 'utf8') + bottom;
    const template = handlebars.compile(file);

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);
    const id = req.params.id;

    const book = books.find(book => book.id === id);

    // validation
    if (!book) {
        res.status(404).send('Tokios knygos nėra');
        return;
    }


    const data = {
        pageTitle: 'Trynimo patvirtinimas',
        domain: domain,
        ...book
    };
    const html = template(data);
    res.send(html);

});

app.post('/destroy/:id', (req, res) => {

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);
    const id = req.params.id;

    const oldBook = books.find(book => book.id === id);

    // validation
    if (!oldBook) {
        res.status(404).send('Tokios knygos nėra');
        return;
    }

    books = books.filter(book => book.id !== id);

    books = JSON.stringify(books);
    fs.writeFileSync('./data/books.json', books);

    res.status(302).redirect(domain + '?msg=delete_success');


});

app.get('/show/:id', (req, res) => {

    const file = top + fs.readFileSync('./html/show.html', 'utf8') + bottom;
    const template = handlebars.compile(file);

    let books = fs.readFileSync('./data/books.json', 'utf8');
    books = JSON.parse(books);
    const id = req.params.id;

    const book = books.find(book => book.id === id);

    // validation

    if (!book) {
        res.status(404).send('Tokios knygos nėra');
        return;
    }

    const data = {
        pageTitle: `Rodyti knygą ${book.title}`,
        domain: domain,
        ...book
    };
    const html = template(data);
    res.send(html);
});

// const Handlebars = require("handlebars");
// const template = Handlebars.compile("Name: {{name}}");
// console.log(template({ name: "Nils" }));

app.listen(port, () => {
    console.log(`Knygynas darbui pasiruošęs ant ${port} porto`)
});