require('dotenv').config();
const path = require('path');
const express = require('express');
const cons = require('consolidate');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const expressJWT = require('express-jwt');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');

const config = {
  secret: process.env.SESSION_SECRET,
  port: process.env.PORT || 8100,
  authorizedDomains: (process.env.AUTHORIZED_DOMAINS || "beta.gouv.fr,modernisation.gouv.fr").toLowerCase().split(","),
  authorizedEmails: (process.env.AUTHORIZED_EMAILS || "john@example.com,antoine@michon.tech").toLowerCase().split(","),
  secure: (process.env.SECURE || 'true') === 'true',
  senderEmail: process.env.MAIL_SENDER || "webconf@beta.gouv.fr"
};

const mailTransport = nodemailer.createTransport({
  debug: process.env.MAIL_DEBUG || false,
  service: process.env.MAIL_SERVICE,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const app = express();

app.engine('mustache', cons.mustache);
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.use('/static', express.static('static'));

app.use(cookieParser(config.secret));
app.use(session({ cookie: { maxAge: 300000 } })); // Only used for Flash not safe for others purposes
app.use(flash());

app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  expressJWT({
    secret: config.secret,
    getToken: req =>
      req.query.token || req.cookies.token
        ? req.query.token || req.cookies.token
        : null
  }).unless({ path: ['/', '/login'] })
);

// Save a token in cookie that expire after 7 days if user is logged
app.use((req, res, next) => {
  if (req.user && req.user.id) {
    const token = jwt.sign({ id: req.user.id }, config.secret, {
      expiresIn: '7 days'
    });

    res.cookie('token', token);
  }

  next();
});

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    req.flash(
      'error',
      "Vous n'étes pas identifié pour accèder à cette page (ou votre accès n'est plus valide)"
    );

    return res.redirect('/login');
  }

  next(err);
});

app.get('/', (req, res) => {
  if (!req.cookies.token) {
    return res.redirect('/login');
  }
  return res.redirect('/webconf');
});

app.get('/logout', (req, res) => {
  res.clearCookie('token').redirect('/login');
});

function renderLogin(req, res, params) {
  params.partials = {
    header: 'header',
    footer: 'footer'
  };

  return res.render('login', params);
}

async function sendMail(to_email, subject, html, text) {
  const mail = {
    to: to_email,
    from: `Webconf BetaGouv <${config.senderEmail}>`,
    subject: subject,
    html: html,
    text: html.replace(/<(?:.|\n)*?>/gm, ''),
    headers: { 'X-Mailjet-TrackOpen': '0', 'X-Mailjet-TrackClick': '0' }
  };

  return new Promise((resolve, reject) => {
    mailTransport.sendMail(mail, (error, info) =>
      error ? reject(error) : resolve(info)
    );
  });
}

async function sendLoginEmail(email, url) {
  const token = jwt.sign({ email: email }, config.secret, { expiresIn: '1 hours' });
  const urlWithPath = `${url}/webconf?token=${encodeURIComponent(token)}`;
  const html = `
      Voici votre lien pour accéder à la webconférence de l'Etat. Celui-ci est valable 1 heure :<br>
      <br>
      <a href="${urlWithPath}">${urlWithPath}</a><br>
      <br>
      L'équipe BetaGouv<br>
      Contactez-nous sur <a href="mailto:${config.senderEmail}">${config.senderEmail}</a>`;

  try {
    await sendMail(email, 'Connexion Webconf BetaGouv', html);
  } catch (err) {
    console.error(err);

    throw new Error("Erreur d'envoi de mail à ton adresse");
  }
}

app.get('/webconf', (req, res) => {
  return res.redirect('https://webconf.numerique.gouv.fr');
});

app.get('/login', async (req, res) => {
  renderLogin(req, res, { errors: req.flash('error') });
});

app.post('/login', async (req, res) => {
  const email = req.body.email
  if (
    email === undefined ||
    !/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(email)
  ) {
    req.flash('error', 'Email invalide');
    return res.redirect('/login');
  }
  
  const domain = email.split("@")[1].toLowerCase();
  console.log(`Check if ${domain} is authorized`);
  if(!config.authorizedDomains.includes(domain) && !config.authorizedEmails.includes(email)) {
    req.flash('error', 'Votre email n\'est pas autorisé');
    return res.redirect('/login');
  }

  const url = `${config.secure ? 'https' : 'http'}://${req.hostname}`;

  try {
    const result = await sendLoginEmail(email, url);

    renderLogin(req, res, {
      message: `Email de connexion envoyé pour ${email}`
    });
  } catch (err) {
    console.error(err);

    renderLogin(req, res, { errors: [err] });
  }
});

   
module.exports = app.listen(config.port, () => console.log(`Running on port: ${config.port}`));
