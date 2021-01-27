const express = require('express')
const app = express();
const mysql = require('mysql2');
const fs = require('fs');
const static = require('serve-static');
const path = require('path')
const body = require('body-parser');
const https = require('https');
const db_config = require('./config/db_config.json');
const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT;
const session = require('express-session');
const MySQLStore = require('express-mysql-session');
const mySQLStore = require('express-mysql-session')(session);
const options = {
    host: db_config.host,
    user: db_config.user,
    password: db_config.pw,
    database: db_config.db
};
const sessionStore = new MySQLStore(options);
app.use(session({
    secret: 'anjdlqfurgkwl?',
    resave: false,
    saveUninitialized: true,
    store: sessionStore
}));
// 모든 template에서 session 사용하게 해줌.
app.use(function (req, res, next) {
    res.locals.user = req.session.user;
    res.locals.data = req.session.data;
    next();
});
const connection = mysql.createConnection({
    host: db_config.host,
    user: db_config.user,
    password: db_config.pw,
    database: db_config.db
});
connection.connect();
// 서버 재시작시 세션 초기화
connection.query('DELETE FROM sessions', (err, res, fields) => {
    console.log('CLEARED SESSION');
});
try {
    const option = {
        cert: fs.readFileSync(process.env.FULL_CHAIN_LOCATION),
        key: fs.readFileSync(process.env.PRIV_KEY_LOCATION)
    }
    const server = https.createServer(option, app).listen(PORT, () => {
        console.log('server has started');
    })
} catch (err) {
    console.log(err);
}
// 이거 있어야 html render 가능
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use('/views', static(path.join(__dirname, '/views')));
//post
app.use(body.json());
app.use(body.urlencoded({ extended: true }));
app.use('/logout', (req, res) => {
    console.log(req.session.user.id + '님이 로그아웃하셨습니다.')
    delete req.session.user;
    res.redirect('/');
})
app.use('/chkuser', (req, res) => {
    connection.query('SELECT EXISTS (SELECT id FROM interview_target WHERE (id = ? AND mail = ?)) AS chk', [req.body.id, req.body.mail], (err, result, field) => {
        if (err) {
            console.log(err)
            res.end('error has occured\nplease contact sogang icpc team');
        } else {
            if (result[0].chk) {
                req.session.user = {};
                req.session.user.id = req.body.id;
                console.log(req.session.user.id + '님이 로그인하셨습니다.')
                req.session.save(() => {
                    res.redirect('/main')
                });
            } else {
                console.log(req.body.id +' & '+req.body.mail+ '님이 로그인 실패하셨습니다.')
                res.end('not interview target');
            }
        }
    })
})
app.use('/submit', (req, res) => {
    if (!req.session.user) res.redirect('/')
    else {
        connection.query('SELECT * FROM interview', (err, result, field) => {
            console.log(result)
            res.render('ejs/submit.ejs', {
                id: req.session.user.id,
                result: result
            })
        })
    }
})
app.use('/senddata', (req, res) => {
    if (!req.session.user) res.redirect('/')
    else {
        connection.query('UPDATE interview SET id = null WHERE id= ?', [req.session.user.id], (err, result, field) => {
            connection.query('UPDATE interview SET id = ? WHERE (date = ? and (id is null OR id = ?))', [req.session.user.id, req.body.date, req.session.user.id], (err, result1, field) => {
                res.redirect('/success')
            })
        })
    }
})
app.use('/success', (req, res) => {
    if (!req.session.user) res.redirect('/')
    else {
        res.render('ejs/success')
    }
})
app.use('/main', (req, res) => {
    console.log(req.session)
    if (!req.session.user) res.redirect('/')
    else {
        var bul;
        var promised = new Date(2020,11,20,21,00,00);
        if(promised.getTime() > new Date().getTime())
            bul='n';
        else
            bul='y';
        connection.query('SELECT date FROM interview WHERE id = ?', [req.session.user.id], (err, result1, field) => {
            if (!result1.length) {
                res.render('ejs/mid.ejs', {
                    date: '없음',
                    bul:bul
                })
            } else {
                res.render('ejs/mid.ejs', {
                    date: result1[0].date,
                    bul:bul
                })
            }
        })
    }
})
app.use('/', (req, res) => {
    if (!req.session.user)
        res.render('ejs/login.ejs')
    else
        res.redirect('/main')
})